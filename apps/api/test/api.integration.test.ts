import "reflect-metadata"

import { randomUUID } from "node:crypto"

import type { INestApplication } from "@nestjs/common"
import { Test } from "@nestjs/testing"
import request from "supertest"
import { DataSource } from "typeorm"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

import {
  BookingEntity,
  ChangeLogEntity,
  OutboxEventEntity,
  ResourceAllocationEntity,
  ResourceEntity,
  TaskEntity,
  UserEntity,
} from "@crm/db"

import { AppModule } from "../src/app.module.js"
import { hashPassword } from "../src/auth/password.js"
import { configureApplication } from "../src/configure-application.js"

const ADMIN_EMAIL = "admin.integration@svistoplyasovo.local"
const READONLY_EMAIL = "readonly.integration@svistoplyasovo.local"
const PASSWORD = "integration-password"

describe.sequential("internal API + PostgreSQL", () => {
  let app: INestApplication
  let dataSource: DataSource
  let adminAgent: ReturnType<typeof request.agent>
  let readonlyAgent: ReturnType<typeof request.agent>
  let adminId: string

  beforeAll(async () => {
    process.env.APP_ENV = "test"
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgresql:///crm_v7_test"
    process.env.CORS_ORIGIN = "http://localhost:5173"
    process.env.LOG_LEVEL = "silent"
    process.env.RUN_MIGRATIONS = "false"

    const module = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = module.createNestApplication()
    configureApplication(app)
    await app.init()
    dataSource = app.get(DataSource)
  })

  beforeEach(async () => {
    await dataSource.query(`
      TRUNCATE TABLE sessions, change_log, outbox_events, idempotency_keys, saved_views,
        payments, resource_allocations, booking_items, bookings, resources, tasks,
        program_registrations, program_occurrences, program_templates, events, leads, customers, users RESTART IDENTITY CASCADE
    `)
    await dataSource.query(`ALTER SEQUENCE task_code_seq RESTART WITH 1000`)
    await dataSource.query(`ALTER SEQUENCE program_template_code_seq RESTART WITH 1000`)
    await dataSource.query(`ALTER SEQUENCE program_occurrence_code_seq RESTART WITH 1000`)
    await dataSource.query(`ALTER SEQUENCE program_registration_code_seq RESTART WITH 1000`)
    await dataSource.query(`ALTER SEQUENCE event_code_seq RESTART WITH 1000`)

    const users = dataSource.getRepository(UserEntity)
    const passwordHash = await hashPassword(PASSWORD)
    adminId = randomUUID()
    await users.save([
      users.create({
        id: adminId,
        email: ADMIN_EMAIL,
        displayName: "Integration Admin",
        passwordHash,
        role: "admin",
        status: "active",
        createdBy: null,
        updatedBy: null,
        archivedAt: null,
      }),
      users.create({
        id: randomUUID(),
        email: READONLY_EMAIL,
        displayName: "Integration Readonly",
        passwordHash,
        role: "readonly",
        status: "active",
        createdBy: null,
        updatedBy: null,
        archivedAt: null,
      }),
    ])

    adminAgent = request.agent(app.getHttpServer())
    readonlyAgent = request.agent(app.getHttpServer())
    await adminAgent.post("/api/internal/v1/auth/login").send({ email: ADMIN_EMAIL, password: PASSWORD }).expect(201)
    await readonlyAgent.post("/api/internal/v1/auth/login").send({ email: READONLY_EMAIL, password: PASSWORD }).expect(201)
  })

  afterAll(async () => {
    if (app) await app.close()
  })

  it("requires a cookie session and enforces backend capabilities", async () => {
    const unauthenticated = await request(app.getHttpServer()).get("/api/internal/v1/tasks").expect(401)
    expect(unauthenticated.body.code).toBe("UNAUTHENTICATED")
    expect(unauthenticated.body.requestId).toBeTypeOf("string")

    const forbidden = await readonlyAgent.post("/api/internal/v1/tasks").send({ title: "Нельзя создать" }).expect(403)
    expect(forbidden.body).toMatchObject({ code: "PERMISSION_DENIED" })
  })

  it("rejects cross-site mutations and invalidates sessions after a password change", async () => {
    const csrf = await adminAgent.post("/api/internal/v1/tasks").set("origin", "https://evil.example").send({ title: "CSRF" }).expect(403)
    expect(csrf.body.code).toBe("CSRF_REJECTED")

    await adminAgent.post("/api/internal/v1/auth/change-password").send({
      currentPassword: PASSWORD,
      newPassword: "new-integration-password",
    }).expect(201)
    await adminAgent.get("/api/internal/v1/auth/session").expect(401)
    await request(app.getHttpServer()).post("/api/internal/v1/auth/login").send({ email: ADMIN_EMAIL, password: PASSWORD }).expect(401)
    await request(app.getHttpServer()).post("/api/internal/v1/auth/login").send({ email: ADMIN_EMAIL, password: "new-integration-password" }).expect(201)
  })

  it("keeps PATCH sparse, detects stale versions and commits audit/outbox atomically", async () => {
    const created = await adminAgent.post("/api/internal/v1/tasks").send({
      title: "Сохранить все поля",
      details: "Эти детали нельзя потерять",
      status: "todo",
      priority: "high",
      dueAt: "2026-09-01T09:00:00.000Z",
      relation: { type: "booking", id: "B-2051" },
      assignees: [{ id: adminId, initials: "IA", name: "Integration Admin" }],
    }).expect(201)

    const updated = await adminAgent.patch(`/api/internal/v1/tasks/${created.body.id}`).send({
      version: created.body.version,
      status: "in_progress",
    }).expect(200)

    expect(updated.body).toMatchObject({
      title: "Сохранить все поля",
      details: "Эти детали нельзя потерять",
      status: "in_progress",
      priority: "high",
      dueAt: "2026-09-01T09:00:00.000Z",
      relation: { type: "booking", id: "B-2051" },
    })
    expect(updated.body.assignees).toHaveLength(1)

    const stale = await adminAgent.patch(`/api/internal/v1/tasks/${created.body.id}`).send({
      version: created.body.version,
      title: "Устаревшее изменение",
    }).expect(409)
    expect(stale.body).toMatchObject({ code: "VERSION_CONFLICT", details: { serverVersion: updated.body.version } })

    const task = await dataSource.getRepository(TaskEntity).findOneByOrFail({ code: created.body.id })
    expect(task.details).toBe("Эти детали нельзя потерять")
    expect(await dataSource.getRepository(ChangeLogEntity).countBy({ entityType: "task", entityId: task.id })).toBe(2)
    expect(await dataSource.getRepository(OutboxEventEntity).countBy({ aggregateType: "task", aggregateId: task.id })).toBe(2)
  })

  it("maps canonical validation and domain transition errors", async () => {
    const invalid = await adminAgent.post("/api/internal/v1/tasks").send({ title: "   " }).expect(400)
    expect(invalid.body).toMatchObject({ code: "VALIDATION_ERROR" })
    expect(invalid.body.fieldErrors.title).toBeDefined()

    const created = await adminAgent.post("/api/internal/v1/tasks").send({ title: "Переход", status: "open" }).expect(201)
    const conflict = await adminAgent.patch(`/api/internal/v1/tasks/${created.body.id}`).send({
      version: created.body.version,
      status: "done",
    }).expect(409)
    expect(conflict.body).toMatchObject({ code: "INVALID_STATE_TRANSITION" })
    expect(conflict.body.fieldErrors.status).toBeDefined()
  })

  it("paginates tasks with a stable opaque cursor", async () => {
    for (const title of ["Первая", "Вторая", "Третья"]) {
      await adminAgent.post("/api/internal/v1/tasks").send({ title, status: "todo" }).expect(201)
    }
    const firstPage = await adminAgent.get("/api/internal/v1/tasks?order=createdDesc&limit=2").expect(200)
    expect(firstPage.body).toHaveLength(2)
    expect(firstPage.headers["x-next-cursor"]).toBeTypeOf("string")
    const cursor = firstPage.headers["x-next-cursor"] as string
    const secondPage = await adminAgent.get(`/api/internal/v1/tasks?order=createdDesc&limit=2&cursor=${encodeURIComponent(cursor)}`).expect(200)
    expect(secondPage.body).toHaveLength(1)
    expect(new Set([...firstPage.body, ...secondPage.body].map((task: { id: string }) => task.id)).size).toBe(3)
    const invalid = await adminAgent.get("/api/internal/v1/tasks?cursor=broken").expect(400)
    expect(invalid.body.code).toBe("INVALID_CURSOR")
  })

  it("keeps saved views versioned and auditable", async () => {
    const created = await adminAgent.post("/api/internal/v1/saved-views").send({
      entityType: "tasks",
      name: "Просроченные",
      definition: { status: "todo" },
      isDefault: true,
    }).expect(201)
    const updated = await adminAgent.patch(`/api/internal/v1/saved-views/${created.body.id}`).send({
      version: created.body.version,
      name: "Мои просроченные",
    }).expect(200)
    expect(updated.body).toMatchObject({ name: "Мои просроченные", isDefault: true })
    await adminAgent.patch(`/api/internal/v1/saved-views/${created.body.id}`).send({ version: created.body.version, name: "Устарело" }).expect(409)
    await adminAgent.delete(`/api/internal/v1/saved-views/${created.body.id}?version=${updated.body.version}`).expect(200)
    expect(await dataSource.getRepository(ChangeLogEntity).countBy({ entityType: "saved_view", entityId: created.body.id })).toBe(3)
  })

  it("keeps customer and lead changes versioned, linked and auditable", async () => {
    const customer = await adminAgent.post("/api/internal/v1/customers").send({
      name: "Анна Тестова", type: "person", phone: "+7 921 000-00-00", channels: ["Телефон"],
    }).expect(201)
    const lead = await adminAgent.post("/api/internal/v1/leads").send({
      customerId: customer.body.id, name: "Анна Тестова", phone: "+7 921 000-00-00", direction: "Проживание",
      requestedItem: "Дом", desiredStartAt: "2026-09-20T10:00:00.000Z", desiredEndAt: "2026-09-21T10:00:00.000Z",
      guestCount: 2, source: "Телефон", assignees: [{ id: adminId, initials: "IA", name: "Integration Admin" }],
    }).expect(201)
    expect(lead.body).toMatchObject({ customerId: customer.body.id, status: "new" })
    const withLead = await adminAgent.get(`/api/internal/v1/customers/${customer.body.id}`).expect(200)
    expect(withLead.body).toMatchObject({ leadCount: 1, activeLeadCount: 1 })

    const successful = await adminAgent.post(`/api/internal/v1/leads/${lead.body.id}/transition`).send({ version: lead.body.version, status: "success" }).expect(201)
    expect(successful.body.version).toBe(lead.body.version + 1)
    await adminAgent.post(`/api/internal/v1/leads/${lead.body.id}/transition`).send({ version: lead.body.version, status: "rejected" }).expect(409)
    const afterTransition = await adminAgent.get(`/api/internal/v1/customers/${customer.body.id}`).expect(200)
    expect(afterTransition.body).toMatchObject({ leadCount: 1, activeLeadCount: 0 })
    expect(await dataSource.getRepository(ChangeLogEntity).countBy({ entityType: "lead", entityId: lead.body.id })).toBe(2)
    expect(await dataSource.getRepository(OutboxEventEntity).countBy({ aggregateType: "lead", aggregateId: lead.body.id })).toBe(2)
  })

  it("enforces fixed-resource half-open overlap in real PostgreSQL", async () => {
    const resources = dataSource.getRepository(ResourceEntity)
    const bookings = dataSource.getRepository(BookingEntity)
    const allocations = dataSource.getRepository(ResourceAllocationEntity)
    const resourceId = randomUUID()
    const firstBookingId = randomUUID()
    const secondBookingId = randomUUID()

    await resources.save(resources.create({
      id: resourceId,
      code: "R-1",
      kind: "house",
      name: "Дом",
      capacityMode: "fixed",
      capacityTotal: 1,
      settings: {},
      createdBy: adminId,
      updatedBy: adminId,
      archivedAt: null,
    }))
    await bookings.save([
      bookings.create({ id: firstBookingId, code: "B-1", customerId: null, status: "draft", currency: "RUB", totalAmount: 0, snapshot: {}, createdBy: adminId, updatedBy: adminId, archivedAt: null }),
      bookings.create({ id: secondBookingId, code: "B-2", customerId: null, status: "draft", currency: "RUB", totalAmount: 0, snapshot: {}, createdBy: adminId, updatedBy: adminId, archivedAt: null }),
    ])

    const allocation = (id: string, sourceId: string, startAt: string, endAt: string) => allocations.create({
      id,
      resourceId,
      sourceType: "booking",
      sourceId,
      startAt: new Date(startAt),
      endAt: new Date(endAt),
      quantity: 1,
      capacityImpact: 1,
      exclusive: true,
      status: "active",
      createdBy: adminId,
      updatedBy: adminId,
      archivedAt: null,
    })

    await allocations.save(allocation(randomUUID(), firstBookingId, "2026-09-01T10:00:00.000Z", "2026-09-01T11:00:00.000Z"))
    await expect(allocations.save(allocation(randomUUID(), secondBookingId, "2026-09-01T10:30:00.000Z", "2026-09-01T11:30:00.000Z"))).rejects.toMatchObject({ driverError: { code: "23P01" } })
    await expect(allocations.save(allocation(randomUUID(), secondBookingId, "2026-09-01T11:00:00.000Z", "2026-09-01T12:00:00.000Z"))).resolves.toMatchObject({ sourceId: secondBookingId })
  })

  it("serializes competing booking allocations so only one fixed-resource race wins", async () => {
    const resourceId = randomUUID()
    await dataSource.getRepository(ResourceEntity).save(dataSource.getRepository(ResourceEntity).create({
      id: resourceId, code: "R-race", kind: "house", name: "Гоночный дом", capacityMode: "fixed", capacityTotal: 1,
      settings: {}, createdBy: adminId, updatedBy: adminId, archivedAt: null,
    }))
    const bookingInput = (suffix: string) => ({
      operationId: randomUUID(),
      idempotencyKey: `booking-race-${suffix}-0001`,
      overrideConflict: false,
      customerId: randomUUID(),
      items: [{ type: "accommodation", resourceId, startAt: "2026-09-15T10:00:00.000Z", endAt: "2026-09-15T12:00:00.000Z", quantity: 1, price: { amountMinor: 1000, currency: "RUB" }, discount: { amountMinor: 0, currency: "RUB" }, preparationMinutes: 0 }],
      note: null,
    })
    const [left, right] = await Promise.all([
      adminAgent.post("/api/internal/v1/bookings").send(bookingInput("left")),
      adminAgent.post("/api/internal/v1/bookings").send(bookingInput("right")),
    ])
    expect([left.status, right.status].sort()).toEqual([201, 409])
    expect(await dataSource.getRepository(ResourceAllocationEntity).countBy({ resourceId, status: "tentative" })).toBe(1)
  })

  it("creates normalized bookings, allocates resources and keeps payment operations immutable/idempotent", async () => {
    const resourceId = randomUUID()
    await dataSource.getRepository(ResourceEntity).save(dataSource.getRepository(ResourceEntity).create({
      id: resourceId, code: "R-booking", kind: "house", name: "Дом для API", capacityMode: "fixed", capacityTotal: 1, settings: {}, createdBy: adminId, updatedBy: adminId, archivedAt: null,
    }))
    const customerId = randomUUID()
    const created = await adminAgent.post("/api/internal/v1/bookings").send({
      operationId: randomUUID(),
      idempotencyKey: "booking-create-integration-0001",
      overrideConflict: false,
      customerId,
      items: [{ type: "accommodation", resourceId, startAt: "2026-09-10T10:00:00.000Z", endAt: "2026-09-10T12:00:00.000Z", quantity: 1, price: { amountMinor: 10000, currency: "RUB" }, discount: { amountMinor: 1000, currency: "RUB" }, preparationMinutes: 30 }],
      note: "integration",
    }).expect(201)
    expect(created.body).toMatchObject({ customerId, status: "draft", total: { amountMinor: 9000, currency: "RUB" }, items: [{ resourceId, price: { amountMinor: 10000 }, discount: { amountMinor: 1000 } }] })
    expect(await dataSource.getRepository(ResourceAllocationEntity).countBy({ sourceType: "booking_item", status: "tentative" })).toBe(1)

    const unconfirmed = await adminAgent.post(`/api/internal/v1/bookings/${created.body.id}/transition`).send({ operationId: randomUUID(), idempotencyKey: "booking-transition-0001", expectedVersion: created.body.version, status: "unconfirmed" }).expect(201)
    const transitioned = await adminAgent.post(`/api/internal/v1/bookings/${created.body.id}/transition`).send({ operationId: randomUUID(), idempotencyKey: "booking-transition-0002", expectedVersion: unconfirmed.body.version, status: "confirmed" }).expect(201)
    const chargeInput = { operationId: randomUUID(), idempotencyKey: "charge-integration-0001", expectedVersion: transitioned.body.version, bookingId: created.body.id, type: "charge", amount: { amountMinor: 5000, currency: "RUB" }, method: "card", reason: null, sourcePaymentId: null }
    const [chargeResponse, replayResponse] = await Promise.all([
      adminAgent.post("/api/internal/v1/payments").send(chargeInput),
      adminAgent.post("/api/internal/v1/payments").send(chargeInput),
    ])
    expect(chargeResponse.status).toBe(201)
    expect(replayResponse.status).toBe(201)
    const charge = chargeResponse
    const replay = replayResponse
    expect(replay.body).toEqual(charge.body)
    const refund = await adminAgent.post("/api/internal/v1/payments").send({ operationId: randomUUID(), idempotencyKey: "refund-integration-0001", expectedVersion: transitioned.body.version + 1, bookingId: created.body.id, type: "refund", amount: { amountMinor: 2000, currency: "RUB" }, method: "card", reason: "По запросу клиента", sourcePaymentId: charge.body.id }).expect(201)
    expect(refund.body).toMatchObject({ type: "refund", sourcePaymentId: charge.body.id, amount: { amountMinor: 2000 } })
    await adminAgent.post("/api/internal/v1/payments").send({ ...chargeInput, operationId: randomUUID(), idempotencyKey: "refund-too-large-0001", expectedVersion: transitioned.body.version + 2, type: "refund", amount: { amountMinor: 4000, currency: "RUB" }, sourcePaymentId: charge.body.id }).expect(409)
    const summary = await adminAgent.get(`/api/internal/v1/payments/summary?bookingId=${created.body.id}`).expect(200)
    expect(summary.body).toMatchObject({ charged: { amountMinor: 5000 }, refunded: { amountMinor: 2000 }, balance: 6000, state: "partial" })
    const finance = await adminAgent.get("/api/internal/v1/finance?date=2026-08-01&rangeEnd=2026-08-31&page=1&pageSize=25&sort=date&order=desc").expect(200)
    expect(finance.body.operations).toEqual(expect.arrayContaining([
      expect.objectContaining({ bookingId: created.body.id, type: "accrual", amountMinor: 9000 }),
      expect.objectContaining({ bookingId: created.body.id, type: "payment", amountMinor: 5000, refundableMinor: 3000 }),
      expect.objectContaining({ bookingId: created.body.id, type: "refund", amountMinor: -2000, sourcePaymentId: charge.body.id }),
    ]))
    expect(finance.body.summary).toMatchObject({ accruedMinor: 9000, paidMinor: 5000, refundsMinor: 2000, debtMinor: 6000 })
  })
})
