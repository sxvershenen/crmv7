import "reflect-metadata"

import { randomUUID } from "node:crypto"

import type { INestApplication } from "@nestjs/common"
import { Test } from "@nestjs/testing"
import request from "supertest"
import { DataSource } from "typeorm"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

import { PublicLeadIntakeResponseSchema } from "@crm/contracts"
import { ChangeLogEntity, CustomerEntity, IdempotencyKeyEntity, LeadEntity, OutboxEventEntity, assertSafeTestDatabaseConnection, assertSafeTestDatabaseEnvironment } from "@crm/db"

import { AppModule } from "../src/app.module.js"
import { configureApplication } from "../src/configure-application.js"

const endpoint = "/api/public/v1/intake/leads"
const contact = { name: "  Иван\u0000   Петров  ", phone: "+7 (921) 450-12-40", email: "IVAN@example.COM" }

function input(overrides: Record<string, unknown> = {}) {
  return {
    operationId: randomUUID(), idempotencyKey: `public-intake-${randomUUID()}`,
    ...contact, message: "  Нужен   домик на выходные  ",
    intent: { kind: "resource", publicEntityId: randomUUID(), startDate: "2026-10-10", endDate: "2026-10-12", guests: 4 },
    attribution: { source: " YANDEX ", medium: " Organic ", campaign: "Осень", content: null, term: null, referrer: "https://example.com/catalog?phone=secret#contact", landingPath: "/domiki?untrusted=yes" },
    consent: { privacyAccepted: true, marketingAccepted: false, analyticsAccepted: true, policyVersion: " 2026-09 " },
    ...overrides,
  }
}

describe.sequential("public lead intake + PostgreSQL", () => {
  let app: INestApplication
  let dataSource: DataSource

  beforeAll(async () => {
    process.env.APP_ENV = "test"
    const target = assertSafeTestDatabaseEnvironment(process.env)
    const safetyConnection = new DataSource({ type: "postgres", url: target.url })
    try {
      await safetyConnection.initialize()
      await assertSafeTestDatabaseConnection(safetyConnection, target)
    } finally {
      if (safetyConnection.isInitialized) await safetyConnection.destroy()
    }
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = module.createNestApplication()
    configureApplication(app)
    await app.init()
    dataSource = app.get(DataSource)
  })

  beforeEach(async () => {
    await dataSource.query("TRUNCATE TABLE public_intake_rate_limits, change_log, outbox_events, idempotency_keys, leads, customers RESTART IDENTITY CASCADE")
  })

  afterAll(async () => { if (app) await app.close() })

  it("creates Customer + Lead atomically, replays the receipt and rejects a changed fingerprint", async () => {
    const body = input()
    const created = await request(app.getHttpServer()).post(endpoint).set("x-request-id", body.operationId).send(body).expect(202)
    expect(PublicLeadIntakeResponseSchema.parse(created.body)).toEqual(created.body)
    expect(Object.keys(created.body).sort()).toEqual(["accepted", "receivedAt", "requestId"])
    expect(created.body.requestId).not.toBe(body.operationId)
    const serializedResponse = JSON.stringify(created.body)
    expect(serializedResponse).not.toContain("Иван")
    expect(serializedResponse).not.toContain("9214501240")
    expect(serializedResponse).not.toContain("example.com")

    const replay = await request(app.getHttpServer()).post(endpoint).send(body).expect(202)
    expect(replay.body).toEqual(created.body)
    await request(app.getHttpServer()).post(endpoint).send({ ...body, message: "Другой запрос" }).expect(409).expect(({ body: error }) => {
      expect(error).toMatchObject({ code: "IDEMPOTENCY_CONFLICT" })
    })

    const customers = await dataSource.getRepository(CustomerEntity).find()
    const leads = await dataSource.getRepository(LeadEntity).find()
    expect(customers).toHaveLength(1)
    expect(leads).toHaveLength(1)
    expect(customers[0]).toMatchObject({ name: "Иван Петров", phones: ["79214501240"], email: "ivan@example.com", leadCount: 1, activeLeadCount: 1 })
    expect(customers[0]?.consent).toEqual({ processing: true, marketing: false, updatedAt: expect.any(String) })
    expect(leads[0]).toMatchObject({ customerId: customers[0]?.id, phone: "79214501240", status: "new", comment: "Нужен домик на выходные" })
    expect(leads[0]?.utm).toMatchObject({ source: "yandex", medium: "organic", referrer: "https://example.com/catalog", landingPath: "/domiki", consentPolicyVersion: "2026-09", consentCapturedAt: expect.any(String), analyticsAccepted: "true" })
    expect(await dataSource.getRepository(IdempotencyKeyEntity).count()).toBe(1)
    expect(await dataSource.query("SELECT count(*)::int AS count FROM bookings")).toEqual([{ count: 0 }])

    const changes = await dataSource.getRepository(ChangeLogEntity).find({ order: { entityType: "ASC" } })
    const events = await dataSource.getRepository(OutboxEventEntity).find({ order: { aggregateType: "ASC" } })
    expect(changes).toHaveLength(2)
    expect(events).toHaveLength(2)
    const leadChange = changes.find((entry) => entry.entityType === "lead")
    const leadEvent = events.find((entry) => entry.aggregateType === "lead")
    expect(leadChange?.changes).toMatchObject({ crmDeepLink: `/leads/${leads[0]?.id}` })
    expect(leadEvent?.payload).toMatchObject({ crmDeepLink: `/leads/${leads[0]?.id}` })
    const internalPayloads = JSON.stringify({ changes, events })
    expect(internalPayloads).not.toContain("79214501240")
    expect(internalPayloads).not.toContain("ivan@example.com")
    expect(internalPayloads).not.toContain("127.0.0.1")
  })

  it("silently accepts honeypot traffic without creating operational records", async () => {
    const response = await request(app.getHttpServer()).post(endpoint).send(input({ website: "https://spam.invalid" })).expect(202)
    expect(PublicLeadIntakeResponseSchema.safeParse(response.body).success).toBe(true)
    expect(await dataSource.getRepository(CustomerEntity).count()).toBe(0)
    expect(await dataSource.getRepository(LeadEntity).count()).toBe(0)
    expect(await dataSource.getRepository(IdempotencyKeyEntity).count()).toBe(0)
  })

  it("rejects missing consent, malformed contact data and invalid date intervals", async () => {
    await request(app.getHttpServer()).post(endpoint).send(input({ consent: { privacyAccepted: false, policyVersion: "2026-09" } })).expect(400)
    await request(app.getHttpServer()).post(endpoint).send(input({ phone: "abcde", email: undefined })).expect(400)
    await request(app.getHttpServer()).post(endpoint).send(input({ name: "\u0000" })).expect(400)
    await request(app.getHttpServer()).post(endpoint).send(input({ intent: { kind: "resource", publicEntityId: randomUUID(), startDate: "2026-99-99" } })).expect(400)
    await request(app.getHttpServer()).post(endpoint).send(input({ intent: { kind: "resource", publicEntityId: randomUUID(), startDate: "2026-10-12", endDate: "2026-10-10" } })).expect(400)
    expect(await dataSource.getRepository(LeadEntity).count()).toBe(0)
  })

  it("rate-limits by a shared HMAC identifier and stores no raw IP", async () => {
    for (let index = 0; index < 3; index += 1) await request(app.getHttpServer()).post(endpoint).send(input({ website: `bot-${index}` })).expect(202)
    await request(app.getHttpServer()).post(endpoint).send(input({ website: "bot-over-limit" })).expect(429).expect(({ body }) => expect(body.code).toBe("RATE_LIMITED"))
    const rows = await dataSource.query<Array<{ identifier_hash: string; request_count: number }>>("SELECT identifier_hash, request_count FROM public_intake_rate_limits")
    expect(rows).toEqual([{ identifier_hash: expect.stringMatching(/^[a-f0-9]{64}$/), request_count: 4 }])
    expect(JSON.stringify(rows)).not.toContain("127.0.0.1")
  })

  it("rolls back Customer, Lead, audit, outbox and idempotency when outbox persistence fails", async () => {
    await dataSource.query(`CREATE OR REPLACE FUNCTION test_reject_public_intake_outbox() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'forced outbox failure'; END $$`)
    await dataSource.query(`CREATE TRIGGER test_reject_public_intake_outbox BEFORE INSERT ON outbox_events FOR EACH ROW EXECUTE FUNCTION test_reject_public_intake_outbox()`)
    try {
      await request(app.getHttpServer()).post(endpoint).send(input()).expect(500)
      expect(await dataSource.getRepository(CustomerEntity).count()).toBe(0)
      expect(await dataSource.getRepository(LeadEntity).count()).toBe(0)
      expect(await dataSource.getRepository(ChangeLogEntity).count()).toBe(0)
      expect(await dataSource.getRepository(OutboxEventEntity).count()).toBe(0)
      expect(await dataSource.getRepository(IdempotencyKeyEntity).count()).toBe(0)
    } finally {
      await dataSource.query("DROP TRIGGER IF EXISTS test_reject_public_intake_outbox ON outbox_events")
      await dataSource.query("DROP FUNCTION IF EXISTS test_reject_public_intake_outbox()")
    }
  })
})
