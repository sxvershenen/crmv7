import "reflect-metadata"

import { randomUUID } from "node:crypto"

import type { INestApplication } from "@nestjs/common"
import { Test } from "@nestjs/testing"
import request from "supertest"
import { DataSource } from "typeorm"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

import { AnalyticsEventBatchResponseSchema } from "@crm/contracts"
import { AnalyticsEventEntity, AnalyticsIngestDedupEntity, assertSafeTestDatabaseConnection, assertSafeTestDatabaseEnvironment } from "@crm/db"

import { AppModule } from "../src/app.module.js"
import { configureApplication } from "../src/configure-application.js"

const endpoint = "/api/public/v1/analytics/events"

function input(overrides: Record<string, unknown> = {}) {
  return {
    events: [{
      eventId: randomUUID(), schemaVersion: 1, occurredAt: new Date().toISOString(), eventName: "page_view",
      consent: "analytics", purpose: "analytics",
      context: { path: "/domiki", pageNodeId: null, releaseId: null, referrer: "https://example.com/catalog?email=secret", viewport: { width: 1440, height: 900 } },
      properties: { kind: "page_view", title: "Домики" },
    }],
    ...overrides,
  }
}

describe.sequential("public analytics collector + PostgreSQL", () => {
  let app: INestApplication
  let dataSource: DataSource

  beforeAll(async () => {
    process.env.APP_ENV = "test"
    process.env.PUBLIC_INTAKE_RATE_LIMIT_MAX = "10"
    process.env.PUBLIC_INTAKE_RATE_LIMIT_WINDOW_SECONDS = "60"
    process.env.PUBLIC_INTAKE_RATE_LIMIT_HMAC_SECRET = "integration-public-analytics-rate-limit-secret"
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
    await dataSource.query("TRUNCATE TABLE analytics_events, analytics_ingest_dedup, public_intake_rate_limits RESTART IDENTITY CASCADE")
  })

  afterAll(async () => { if (app) await app.close() })

  it("issues server identity, stores a redacted event and replays it idempotently", async () => {
    const body = input()
    const created = await request(app.getHttpServer()).post(endpoint).set("user-agent", "Mozilla/5.0 Chrome/120.0 secret-full-ua").send(body).expect(202)
    expect(AnalyticsEventBatchResponseSchema.parse(created.body)).toMatchObject({ accepted: 1, duplicates: 0, dropped: 0 })
    expect(created.headers["set-cookie"]).toEqual(expect.arrayContaining([expect.stringContaining("sv_analytics_visitor="), expect.stringContaining("sv_analytics_session=")]))
    const replay = await request(app.getHttpServer()).post(endpoint).send(body).expect(202)
    expect(replay.body).toMatchObject({ accepted: 0, duplicates: 1, dropped: 0 })
    await request(app.getHttpServer()).post(endpoint).send({ events: [{ ...body.events[0], properties: { kind: "page_view", title: "Другая страница" } }] }).expect(409)

    const stored = await dataSource.getRepository(AnalyticsEventEntity).findOneByOrFail({ eventId: body.events[0]!.eventId })
    expect(stored.normalizedReferrerHost).toBe("example.com")
    expect(stored.userAgentFamily).toBe("Chrome")
    expect(stored.networkPseudonym).toMatch(/^[a-f0-9]{64}$/)
    expect(JSON.stringify(stored)).not.toContain("email=secret")
    expect(JSON.stringify(stored)).not.toContain("secret-full-ua")
    expect(await dataSource.getRepository(AnalyticsIngestDedupEntity).count()).toBe(1)
  })

  it("drops refused analytics consent without issuing identity or storing an event", async () => {
    const response = await request(app.getHttpServer()).post(endpoint).send(input({ events: [{ ...input().events[0], consent: "denied" }] })).expect(202)
    expect(response.body).toMatchObject({ accepted: 0, duplicates: 0, dropped: 1 })
    expect(response.headers["set-cookie"]).toBeUndefined()
    expect(await dataSource.getRepository(AnalyticsEventEntity).count()).toBe(0)
  })

  it("expires identity and stores no event when analytics consent is revoked", async () => {
    const response = await request(app.getHttpServer()).post(endpoint).send({ events: [{
      eventId: randomUUID(), schemaVersion: 1, occurredAt: new Date().toISOString(), eventName: "consent_changed", consent: "denied", purpose: "essential",
      context: { path: "/", pageNodeId: null, releaseId: null, referrer: null }, properties: {
        kind: "consent", state: "denied", policyVersion: "v1", timestamp: new Date().toISOString(), source: "privacy-settings",
      },
    }] }).expect(202)
    expect(response.body).toMatchObject({ accepted: 0, duplicates: 0, dropped: 1 })
    expect(response.headers["set-cookie"]).toEqual(expect.arrayContaining([expect.stringContaining("sv_analytics_visitor=;"), expect.stringContaining("sv_analytics_session=;")]))
    expect(await dataSource.getRepository(AnalyticsEventEntity).count()).toBe(0)
  })

  it("rejects payloads that attempt to carry contact data or query strings", async () => {
    await request(app.getHttpServer()).post(endpoint).send(input({ events: [{ ...input().events[0], context: { ...input().events[0]!.context, path: "/domiki?phone=secret" }, properties: { kind: "action", actionId: "cta.open", component: "hero", phone: "+79990000000" } }] })).expect(400)
  })
})
