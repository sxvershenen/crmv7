import "reflect-metadata"

import { createHash, randomUUID } from "node:crypto"

import type { INestApplication } from "@nestjs/common"
import { Test } from "@nestjs/testing"
import request from "supertest"
import sharp from "sharp"
import { DataSource } from "typeorm"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

import {
  AddonOfferingTermsEntity,
  AcceptedOfferingQuoteLinkEntity,
  BookingEntity,
  BookingItemEntity,
  BusinessCalendarDateEntity,
  BusinessCalendarDateOverrideEntity,
  BusinessCalendarEntity,
  CampgroundOfferingTermsEntity,
  CatalogOfferingEntity,
  ChangeLogEntity,
  CmsNodeEntity,
  CmsNodeRevisionEntity,
  CmsPublicProfileEntity,
  CmsSourceLinkEntity,
  CustomerEntity,
  EventCategoryEntity,
  EventEntity,
  OutboxEventEntity,
  OutboxDeliveryEntity,
  OfferingAddonAssignmentEntity,
  OfferingBindingEntity,
  OfferingQuoteSnapshotEntity,
  PriceBookEntity,
  PriceRuleEntity,
  RatePlanEntity,
  ProgramCategoryEntity,
  ProgramOccurrenceEntity,
  ProgramRegistrationEntity,
  ProgramTemplateEntity,
  PublicOfferingProjectionInvalidationReceiptEntity,
  PublicOfferingProjectionStateEntity,
  ResourceAllocationEntity,
  ResourceEntity,
  ResourceGroupEntity,
  ResourceGroupMemberEntity,
  TaskEntity,
  UserEntity,
  assertSafeTestDatabaseConnection,
  assertSafeTestDatabaseEnvironment,
} from "@crm/db"
import { CmsHeroPolicySchema, SeoMetadataSchema } from "@crm/contracts"

import { AppModule } from "../src/app.module.js"
import { hashPassword } from "../src/auth/password.js"
import { configureApplication } from "../src/configure-application.js"
import { revisionContentHash } from "../src/cms/cms-content.service.js"
import { ensureCatalogOfferingEditorialDraft } from "../src/cms/cms-source-draft.js"
import { resolvedContentHash } from "../src/cms/public-content.service.js"
import { OutboxDeliveryEngine } from "../src/delivery/outbox-delivery.engine.js"
import { OutboxDeliveryStore } from "../src/delivery/outbox-delivery.store.js"
import { PublicOfferingProjectionConsumer } from "../src/delivery/public-offering-projection.consumer.js"
import { normalizePublicOfferingInvalidation } from "../src/delivery/public-offering-invalidation.js"
import { OutboxDispatcherService } from "../src/live/outbox-dispatcher.service.js"

const ADMIN_EMAIL = "admin.integration@svistoplyasovo.local"
const READONLY_EMAIL = "readonly.integration@svistoplyasovo.local"
const PASSWORD = "integration-password"

function futureStayDates() {
  const pricingStart = new Date()
  const arrival = new Date(Date.now() + 24 * 60 * 60 * 1000)
  const iso = (date: Date) => date.toISOString().slice(0, 10)
  const plusDays = (days: number) => new Date(arrival.getTime() + days * 24 * 60 * 60 * 1000)
  return { pricingStartDate: iso(pricingStart), arrivalDate: iso(arrival), middleDate: iso(plusDays(1)), departureDate: iso(plusDays(2)), coverageEndDate: iso(plusDays(3)) }
}

function lifecycleGateDates() {
  const anchor = new Date()
  anchor.setUTCHours(12, 0, 0, 0)
  const iso = (offsetDays: number) => new Date(anchor.getTime() + offsetDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  return {
    coverageFrom: iso(-30),
    gapFrom: iso(0),
    coveredDate: iso(1),
    coverageToExclusive: iso(2),
    gapEndExclusive: iso(4),
    expiredFrom: iso(-4),
    expiredToExclusive: iso(-3),
  }
}

describe.sequential("internal API + PostgreSQL", () => {
  let app: INestApplication
  let dataSource: DataSource
  let adminAgent: ReturnType<typeof request.agent>
  let readonlyAgent: ReturnType<typeof request.agent>
  let adminId: string

  beforeAll(async () => {
    process.env.APP_ENV = "test"
    const testDatabase = assertSafeTestDatabaseEnvironment(process.env)
    process.env.DATABASE_URL = testDatabase.url
    process.env.CORS_ORIGIN = "http://localhost:5173"
    process.env.LOG_LEVEL = "silent"
    process.env.RUN_MIGRATIONS = "false"
    process.env.MEDIA_STORAGE_ROOT = "/tmp/crm-v7-media-integration"
    process.env.MEDIA_UPLOAD_SIGNING_SECRET = "integration-media-upload-signing-secret-2026"

    const safetyConnection = new DataSource({ type: "postgres", url: testDatabase.url })
    try {
      await safetyConnection.initialize()
      await assertSafeTestDatabaseConnection(safetyConnection, testDatabase)
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
    await dataSource.query(`
      TRUNCATE TABLE media_usages, media_processing_jobs, media_uploads, media_variants, media_blobs, media_assets,
        accepted_offering_quote_links, offering_quote_snapshots, offering_addon_assignments, price_rules, rate_plans, price_books, offering_bindings,
        business_calendar_date_overrides, business_calendar_dates, addon_offering_terms, campground_offering_terms,
        catalog_offerings, event_service_templates, resource_group_members, resource_groups, business_calendars,
        cms_public_profiles, cms_source_links, cms_active_release, cms_release_items, cms_releases, cms_site_settings_revisions, cms_site_settings, cms_node_revisions, cms_nodes,
        sessions, change_log, outbox_events, idempotency_keys, saved_views, workspace_settings,
        payments, resource_allocations, booking_lead_links, booking_items, bookings, resources, tasks,
        program_registrations, program_occurrences, program_templates, program_categories, events, event_categories, leads, customers, users RESTART IDENTITY CASCADE
    `)
    await dataSource.query(`INSERT INTO cms_active_release(singleton_key, release_id) VALUES ('public', NULL)`)
    await dataSource.query(`INSERT INTO cms_site_settings(id) VALUES ('00000000-0000-4000-8000-000000000001')`)
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
    await adminAgent.post("/api/internal/v1/auth/login").send({ email: ADMIN_EMAIL, password: PASSWORD }).expect(200)
    await readonlyAgent.post("/api/internal/v1/auth/login").send({ email: READONLY_EMAIL, password: PASSWORD }).expect(200)
  })

  afterAll(async () => {
    if (app) await app.close()
  })

  it("persists server promotions, forbids stacking, preserves snapshots and reports real cohort totals", async () => {
    const terms = { code: " autumn10 ", name: "Осенний промокод", active: true, discountType: "percent", value: 10, minimumAmountMinor: 0, startsAt: null, endsAt: null, scope: "all", resourceIds: [], offeringIds: [] }
    const command = { terms, operationId: randomUUID(), idempotencyKey: "marketing-promotion-create-001" }
    await readonlyAgent.post("/api/internal/v1/marketing/promotions").send(command).expect(403)
    const promotion = await adminAgent.post("/api/internal/v1/marketing/promotions").send(command).expect(201)
    expect(promotion.body.terms.code).toBe("AUTUMN10")
    const replay = await adminAgent.post("/api/internal/v1/marketing/promotions").send(command).expect(201)
    expect(replay.body.id).toBe(promotion.body.id)
    await adminAgent.post("/api/internal/v1/marketing/promotions").send({ ...command, operationId: randomUUID(), idempotencyKey: "marketing-duplicate-001" }).expect(409)
    const customer = await adminAgent.post("/api/internal/v1/customers").send({ name: "Promo Customer", type: "person", phone: "+7 921 300-00-00", channels: ["Сайт"] }).expect(201)
    const item = { type: "other", resourceId: null, startAt: "2026-10-10T09:00:00Z", endAt: "2026-10-10T10:00:00Z", quantity: 1, price: { amountMinor: 1099, currency: "RUB" }, discount: { amountMinor: 0, currency: "RUB" }, preparationMinutes: 0 }
    const preview = await adminAgent.post("/api/internal/v1/bookings/promotion-preview").send({ promoCode: "autumn10", items: [item] }).expect(201)
    expect(preview.body.total.amountMinor).toBe(989)
    await adminAgent.post("/api/internal/v1/bookings/promotion-preview").send({ promoCode: "autumn10", items: [{ ...item, discount: { amountMinor: 100, currency: "RUB" } }] }).expect(422)
    const booking = await adminAgent.post("/api/internal/v1/bookings").send({ customerId: customer.body.id, promoCode: "AUTUMN10", items: [item], operationId: randomUUID(), idempotencyKey: "promo-booking-create-001" }).expect(201)
    expect(booking.body.total.amountMinor).toBe(989)
    expect(booking.body.items[0].price.amountMinor).toBe(1099)
    expect(booking.body.items[0].discount.amountMinor).toBe(0)
    const detail = await adminAgent.get(`/api/internal/v1/bookings/${booking.body.id}`).expect(200)
    expect(detail.body.promo).toBe("AUTUMN10")
    expect(detail.body.promotion.discountAmountMinor).toBe(110)
    const disabled = await adminAgent.patch(`/api/internal/v1/marketing/promotions/${promotion.body.id}`).send({ terms: { ...terms, active: false }, expectedVersion: promotion.body.version, operationId: randomUUID(), idempotencyKey: "promo-disable-001" }).expect(200)
    await adminAgent.patch(`/api/internal/v1/marketing/promotions/${promotion.body.id}`).send({ terms, expectedVersion: promotion.body.version, operationId: randomUUID(), idempotencyKey: "promo-stale-command-001" }).expect(409)
    expect(disabled.body.version).toBeGreaterThan(promotion.body.version)
    const unchanged = await adminAgent.patch(`/api/internal/v1/bookings/${booking.body.id}`).send({ expectedVersion: booking.body.version, note: "keep historical promotion", operationId: randomUUID(), idempotencyKey: "promo-unchanged-001" }).expect(200)
    expect(unchanged.body.promotion).toEqual(booking.body.promotion)
    expect(unchanged.body.total.amountMinor).toBe(989)
    const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Moscow" }).format(new Date())
    const report = await adminAgent.get(`/api/internal/v1/marketing/report?from=${day}&to=${day}`).expect(200)
    expect(report.body.visitors).toBeNull()
    expect(report.body.promotions).toEqual([expect.objectContaining({ promotionId: promotion.body.id, bookings: 1, discountAmountMinor: 110, bookingAmountMinor: 989, paidAmountMinor: 0 })])
    const removed = await adminAgent.patch(`/api/internal/v1/bookings/${booking.body.id}`).send({ expectedVersion: unchanged.body.version, promoCode: null, operationId: randomUUID(), idempotencyKey: "promo-remove-command-001" }).expect(200)
    expect(removed.body.total.amountMinor).toBe(1099)
    expect(removed.body.promotion).toBeNull()
    expect(await dataSource.getRepository(ChangeLogEntity).count({ where: { entityId: promotion.body.id } })).toBe(2)
  })

  it("requires a cookie session and enforces backend capabilities", async () => {
    const unauthenticated = await request(app.getHttpServer()).get("/api/internal/v1/tasks").expect(401)
    expect(unauthenticated.body.code).toBe("UNAUTHENTICATED")
    expect(unauthenticated.body.requestId).toBeTypeOf("string")

    const forbidden = await readonlyAgent.post("/api/internal/v1/tasks").send({ title: "Нельзя создать" }).expect(403)
    expect(forbidden.body).toMatchObject({ code: "PERMISSION_DENIED" })
  })

  it("mounts the shared auth authority on the CMS namespace without changing internal sessions", async () => {
    const cmsAuthAgent = request.agent(app.getHttpServer())

    await cmsAuthAgent.get("/api/admin/v1/auth/session").expect(401)
    const login = await cmsAuthAgent.post("/api/admin/v1/auth/login").send({ email: ADMIN_EMAIL, password: PASSWORD }).expect(200)
    expect(login.body.user).toMatchObject({ email: ADMIN_EMAIL, role: "admin" })
    expect(login.headers["set-cookie"]).toEqual(expect.arrayContaining([expect.stringContaining("Path=/")]))

    await cmsAuthAgent.get("/api/admin/v1/auth/session").expect(200).expect(({ body }) => {
      expect(body.user).toMatchObject({ email: ADMIN_EMAIL, role: "admin" })
    })
    await cmsAuthAgent.get("/api/internal/v1/auth/session").expect(200).expect(({ body }) => {
      expect(body.user).toMatchObject({ email: ADMIN_EMAIL, role: "admin" })
    })

    await cmsAuthAgent.post("/api/admin/v1/auth/logout").expect(200).expect({ ok: true })
    await cmsAuthAgent.get("/api/admin/v1/auth/session").expect(401)
    await cmsAuthAgent.get("/api/internal/v1/auth/session").expect(401)
    await adminAgent.get("/api/internal/v1/auth/session").expect(200)

    await cmsAuthAgent.post("/api/admin/v1/auth/login").send({ email: ADMIN_EMAIL, password: PASSWORD }).expect(200)
    await cmsAuthAgent.post("/api/admin/v1/auth/change-password").send({
      currentPassword: PASSWORD,
      newPassword: "cms-new-integration-password",
    }).expect(200).expect({ ok: true })
    await cmsAuthAgent.get("/api/admin/v1/auth/session").expect(401)
    await adminAgent.get("/api/internal/v1/auth/session").expect(401)
    await request(app.getHttpServer()).post("/api/internal/v1/auth/login").send({ email: ADMIN_EMAIL, password: PASSWORD }).expect(401)
    await request(app.getHttpServer()).post("/api/internal/v1/auth/login").send({ email: ADMIN_EMAIL, password: "cms-new-integration-password" }).expect(200)
  })

  it("lists only safe active resource binding targets with deterministic cursor paging on both offering surfaces", async () => {
    const resources = dataSource.getRepository(ResourceEntity)
    const alphaId = randomUUID()
    const betaId = randomUUID()
    const archivedId = randomUUID()
    await resources.save([
      resources.create({ id: alphaId, code: "HOUSE-ALPHA", kind: "house", name: "Альфа дом", capacityMode: "fixed", capacityTotal: 2, settings: { internalOnly: "never-return" }, createdBy: adminId, updatedBy: adminId, archivedAt: null }),
      resources.create({ id: betaId, code: "HOUSE-BETA", kind: "house", name: "Бета дом", capacityMode: "shared", capacityTotal: 5, settings: { internalOnly: "never-return" }, createdBy: adminId, updatedBy: adminId, archivedAt: null }),
      resources.create({ id: archivedId, code: "HOUSE-ARCHIVED", kind: "house", name: "Архивный дом", capacityMode: "fixed", capacityTotal: 1, settings: { internalOnly: "never-return" }, createdBy: adminId, updatedBy: adminId, archivedAt: new Date() }),
      resources.create({ id: randomUUID(), code: "VENUE-ALPHA", kind: "venue", name: "Альфа площадка", capacityMode: "shared", capacityTotal: 20, settings: {}, createdBy: adminId, updatedBy: adminId, archivedAt: null }),
    ])

    await request(app.getHttpServer()).get("/api/internal/v1/offerings/binding-targets?targetType=resource").expect(401)
    const internalFirst = await adminAgent.get("/api/internal/v1/offerings/binding-targets?targetType=resource&kind=house&limit=1").expect(200)
    const adminFirst = await adminAgent.get("/api/admin/v1/offerings/binding-targets?targetType=resource&kind=house&limit=1").expect(200)
    expect(adminFirst.body).toEqual(internalFirst.body)
    expect(internalFirst.body.items).toEqual([expect.objectContaining({ id: alphaId, type: "resource", name: "Альфа дом", capacity: { mode: "fixed", total: 2 }, archived: false })])
    expect(Object.keys(internalFirst.body.items[0]).sort()).toEqual(["archived", "capacity", "code", "id", "kind", "name", "type", "version"])
    expect(internalFirst.body.items[0].settings).toBeUndefined()
    expect(internalFirst.body.nextCursor).toEqual(expect.any(String))

    const internalSecond = await adminAgent.get(`/api/internal/v1/offerings/binding-targets?targetType=resource&kind=house&limit=1&cursor=${encodeURIComponent(internalFirst.body.nextCursor)}`).expect(200)
    expect(internalSecond.body).toMatchObject({ items: [{ id: betaId, name: "Бета дом" }], nextCursor: null })
    const byCaseInsensitiveCode = await adminAgent.get("/api/admin/v1/offerings/binding-targets?targetType=resource&q=house-beta").expect(200)
    expect(byCaseInsensitiveCode.body.items).toEqual([expect.objectContaining({ id: betaId })])
    expect(byCaseInsensitiveCode.body.items.map((item: { id: string }) => item.id)).not.toContain(archivedId)
    const detailByCode = await adminAgent.get("/api/internal/v1/resources/HOUSE-ALPHA").expect(200)
    expect(detailByCode.body).toMatchObject({ id: alphaId, code: "HOUSE-ALPHA" })

    await readonlyAgent.get("/api/internal/v1/offerings/binding-targets?targetType=resource").expect(200)
    await readonlyAgent.get("/api/admin/v1/offerings/binding-targets?targetType=resource").expect(200)
    await adminAgent.get("/api/internal/v1/offerings/binding-targets?targetType=program_template").expect(400)
    await adminAgent.get("/api/admin/v1/offerings/binding-targets?targetType=resource&targetId=11111111-1111-4111-8111-111111111111").expect(400)
    await adminAgent.get("/api/internal/v1/offerings/binding-targets?targetType=resource&cursor=not-a-cursor").expect(422)
  })

  it("creates one house commercial dossier from its Resource across CRM and CMS surfaces", async () => {
    const calendarId = randomUUID()
    const resourceId = randomUUID()
    await dataSource.getRepository(BusinessCalendarEntity).save({
      id: calendarId, code: `resource-dossier-${calendarId.slice(0, 8)}`, name: "Resource dossier calendar",
      timezone: "Europe/Moscow", countryCode: "RU", source: "official_ru", sourceVersion: "integration-v1",
      state: "active", importedAt: new Date(), coverageFrom: null, coverageToExclusive: null, contentHash: null,
      createdBy: adminId, updatedBy: adminId, archivedAt: null,
    })
    await dataSource.getRepository(ResourceEntity).save({
      id: resourceId, code: "HOUSE-DOSSIER", kind: "house", name: "Дом единого досье",
      capacityMode: "fixed", capacityTotal: 4, settings: {}, createdBy: adminId, updatedBy: adminId, archivedAt: null,
    })
    const body = { operationId: randomUUID(), idempotencyKey: `resource-dossier-${randomUUID()}` }

    const created = await adminAgent.post(`/api/internal/v1/offerings/by-resource/${resourceId}`).send(body).expect(201)
    const replay = await adminAgent.post(`/api/admin/v1/offerings/by-resource/${resourceId}`).send(body).expect(201)
    expect(created.body).toMatchObject({ kind: "house", operationalName: "Дом единого досье", state: "draft" })
    expect(replay.body).toEqual(created.body)

    const offeringId = created.body.offeringId as string
    expect((await adminAgent.get(`/api/internal/v1/offerings/by-resource/${resourceId}`).expect(200)).body).toEqual({ resolution: "linked", offering: created.body })
    expect((await adminAgent.get(`/api/admin/v1/offerings/${offeringId}/editor`).expect(200)).body).toMatchObject({
      offering: { id: offeringId, kind: "house", businessCalendarId: calendarId },
      bindings: [{ target: { type: "resource", id: resourceId }, role: "primary" }],
      editorial: { source: { sourceKind: "catalog_offering", sourceId: offeringId } },
    })
    expect(await dataSource.getRepository(CatalogOfferingEntity).countBy({ id: offeringId })).toBe(1)
    expect(await dataSource.getRepository(OfferingBindingEntity).countBy({ offeringId, resourceId, role: "primary" })).toBe(1)
    expect(await dataSource.getRepository(CmsSourceLinkEntity).countBy({ sourceKind: "catalog_offering", sourceId: offeringId })).toBe(1)
    const event = await dataSource.getRepository(OutboxEventEntity).findOneByOrFail({ topic: "crm.offering.created_from_resource", aggregateId: offeringId })
    expect(await dataSource.getRepository(OutboxDeliveryEntity).countBy({ eventId: event.id, consumer: "sse", status: "pending" })).toBe(1)
  })

  it("paginates program registrations with a stable createdAt/id cursor", async () => {
    const templateId = randomUUID(), occurrenceId = randomUUID(), createdAt = new Date("2026-09-09T12:00:00.000Z")
    await dataSource.getRepository(ProgramTemplateEntity).save({
      id: templateId, code: "P-REGISTRATION-PAGE", name: "Paginated program", categoryId: null, durationMinutes: 60,
      minimumParticipants: 1, participantLimit: 10, registrationCloseHours: null, basePriceAmount: 1_000, currency: "RUB",
      description: "", publication: "draft", assigneeIds: [], stages: [], createdBy: adminId, updatedBy: adminId, archivedAt: null,
    })
    await dataSource.getRepository(ProgramOccurrenceEntity).save({
      id: occurrenceId, code: "PO-REGISTRATION-PAGE", templateId, name: "Paginated run",
      startsAt: new Date("2026-09-20T09:00:00.000Z"), endsAt: new Date("2026-09-20T10:00:00.000Z"),
      participantLimit: 10, registrationLimit: 10, status: "open", currency: "RUB", comment: "", assigneeIds: [],
      createdBy: adminId, updatedBy: adminId, archivedAt: null,
    })
    await dataSource.getRepository(ProgramRegistrationEntity).save([0, 1, 2].map((index) => ({
      id: randomUUID(), code: `PR-REGISTRATION-PAGE-${index}`, occurrenceId, customerId: null, phone: "", participantCount: 1,
      participantNames: "", totalAmount: 1_000, discountAmount: 0, paidAmount: 0, currency: "RUB", pricingMode: "legacy_unpriced",
      status: "new", promo: "", source: "", comment: "", createdAt, updatedAt: createdAt, createdBy: adminId, updatedBy: adminId, archivedAt: null,
    })))
    await dataSource.query("UPDATE program_registrations SET created_at = '2026-09-09T12:00:00.123456Z' WHERE occurrence_id = $1", [occurrenceId])

    const first = await adminAgent.get("/api/internal/v1/programs/registrations?archived=false&limit=2").expect(200)
    expect(first.body.items).toHaveLength(2)
    expect(first.body.nextCursor).toEqual(expect.any(String))
    const second = await adminAgent.get(`/api/internal/v1/programs/registrations?archived=false&limit=2&cursor=${encodeURIComponent(first.body.nextCursor)}`).expect(200)
    expect(second.body.items).toHaveLength(1)
    expect(second.body.nextCursor).toBeNull()
    expect(new Set([...first.body.items, ...second.body.items].map((item: { id: string }) => item.id)).size).toBe(3)
    await adminAgent.get("/api/internal/v1/programs/registrations?archived=false&limit=2&cursor=broken").expect(400)
  })

  it("prepares and recovers one program dossier transactionally, promotes legacy CMS content and persists private previews", async () => {
    const anchor = new Date()
    anchor.setUTCHours(12, 0, 0, 0)
    const iso = (offset: number) => new Date(anchor.getTime() + offset * 86_400_000).toISOString().slice(0, 10)
    const serviceDate = iso(30)
    const calendarId = randomUUID()
    await dataSource.getRepository(BusinessCalendarEntity).save({
      id: calendarId, code: "PROGRAM-A-CORE", name: "Program A-core calendar", timezone: "Europe/Moscow", countryCode: "RU",
      source: "official_ru", sourceVersion: "program-a-core-v1", state: "active", importedAt: new Date(), coverageFrom: iso(0), coverageToExclusive: iso(60),
      contentHash: "a".repeat(64), createdBy: adminId, updatedBy: adminId, archivedAt: null,
    })
    await dataSource.getRepository(BusinessCalendarDateEntity).save({
      id: randomUUID(), calendarId, localDate: serviceDate, officialClass: "weekday", officialLabel: null,
      sourceVersion: "program-a-core-v1", createdBy: adminId, updatedBy: adminId, archivedAt: null,
    })
    const saveTemplate = (id: string, code: string, durationMinutes = 120) => dataSource.getRepository(ProgramTemplateEntity).save({
      id, code, name: `Program ${code}`, categoryId: null, durationMinutes, minimumParticipants: 1, participantLimit: 20,
      registrationCloseHours: 12, basePriceAmount: 999_999, currency: "RUB", description: "legacy review only", publication: "published",
      assigneeIds: [], stages: [{ type: "intro" }], createdBy: adminId, updatedBy: adminId, archivedAt: null,
    })
    const templateId = randomUUID()
    await saveTemplate(templateId, "P-A-CORE-LEGACY")
    expect((await adminAgent.get(`/api/internal/v1/programs/templates/${templateId}`).expect(200)).body.registrationCloseHours).toBe(12)

    const nodeId = randomUUID(), revisionId = randomUUID(), legacyLinkId = randomUUID()
    const legacyContent = {
      route: { path: "/programs/preserved", slug: "preserved", parentNodeId: null, sortOrder: 7 }, title: "Preserved program", summary: "Editorial history survives promotion",
      hero: { mode: "disabled" as const }, sections: [],
      seo: { title: "Preserved", description: "Preserved editorial program content", indexPolicy: "noindex_follow" as const, canonical: { mode: "self" as const }, structuredData: [] },
      relations: [], schemaVersion: 1,
    }
    const legacyHash = revisionContentHash(legacyContent)
    await dataSource.getRepository(CmsNodeEntity).save({ id: nodeId, kind: "program_detail", status: "active", createdBy: adminId, updatedBy: adminId, archivedAt: null })
    await dataSource.getRepository(CmsNodeRevisionEntity).save({
      id: revisionId, nodeId, revision: 3, state: "draft", path: legacyContent.route.path, slug: legacyContent.route.slug, parentNodeId: null, sortOrder: 7,
      title: legacyContent.title, summary: legacyContent.summary, hero: legacyContent.hero, sections: legacyContent.sections, seo: legacyContent.seo,
      relations: [], schemaVersion: 1, contentHash: legacyHash, createdBy: adminId, createdAt: new Date(),
    })
    await dataSource.getRepository(CmsSourceLinkEntity).save({ id: legacyLinkId, sourceKind: "program_template", sourceId: templateId, sourceVersion: 1, nodeId, syncState: "draft", createdAt: new Date() })

    expect((await adminAgent.get(`/api/internal/v1/programs/${templateId}/offering`).expect(200)).body).toEqual({ resolution: "unprepared", programTemplateId: templateId, programTemplateVersion: 1 })
    const prepareBody = { operationId: randomUUID(), idempotencyKey: `program-prepare-${randomUUID()}`, expectedProgramTemplateVersion: 1 }
    const prepared = await adminAgent.post(`/api/internal/v1/programs/${templateId}/offering`).send(prepareBody)
    expect(prepared.status, JSON.stringify(prepared.body)).toBe(201)
    expect(prepared.body).toMatchObject({ programTemplateId: templateId, cmsReady: true, publicReady: false, editorialNodeId: nodeId })
    expect((await adminAgent.post(`/api/admin/v1/programs/${templateId}/offering`).send(prepareBody).expect(201)).body).toEqual(prepared.body)
    await adminAgent.post(`/api/internal/v1/programs/${templateId}/offering`).send({ ...prepareBody, expectedProgramTemplateVersion: 2 }).expect(409)
    const offeringId = prepared.body.offeringId as string
    expect((await adminAgent.get(`/api/admin/v1/programs/${templateId}/offering`).expect(200)).body).toMatchObject({ resolution: "linked", offering: { offeringId, state: "draft", cmsReady: true, publicReady: false, editorialNodeId: nodeId } })
    expect((await adminAgent.get(`/api/internal/v1/offerings/${offeringId}/editor`).expect(200)).body).toMatchObject({
      offering: { id: offeringId, kind: "program" },
      bindings: [{ role: "primary", target: { type: "program_template", id: templateId } }],
      editorial: { node: { id: nodeId, kind: "program_detail" }, publication: { eligible: false, blockers: expect.arrayContaining(["safe_public_projection_missing"]) } },
    })
    expect(await dataSource.getRepository(CatalogOfferingEntity).countBy({ id: offeringId, kind: "program" })).toBe(1)
    expect(await dataSource.getRepository(OfferingBindingEntity).countBy({ offeringId, programTemplateId: templateId, role: "primary" })).toBe(1)
    expect(await dataSource.getRepository(CmsSourceLinkEntity).findOneByOrFail({ id: legacyLinkId })).toMatchObject({ sourceKind: "catalog_offering", sourceId: offeringId, nodeId })
    expect(await dataSource.getRepository(CmsNodeRevisionEntity).findOneByOrFail({ id: revisionId })).toMatchObject({ nodeId, revision: 3, path: "/programs/preserved", contentHash: legacyHash })

    const priceBookId = randomUUID(), ratePlanId = randomUUID(), ruleId = randomUUID()
    await dataSource.getRepository(PriceBookEntity).save({
      id: priceBookId, offeringId, revision: 1, name: "Program active", currency: "RUB", timezone: "Europe/Moscow", state: "draft",
      validFrom: iso(0), validToExclusive: iso(60), supersedesPriceBookId: null, changeReason: "integration", scheduledActivationAt: null, scheduledBy: null,
      activatedAt: null, activatedBy: null, retiredAt: null, retiredBy: null, createdBy: adminId, updatedBy: adminId, archivedAt: null,
    })
    await dataSource.getRepository(RatePlanEntity).save({
      id: ratePlanId, priceBookId, key: "standard", label: "Standard", pricingBasis: "per_person", baseAmountMinor: 2_500, baseExtraUnitAmountMinor: null,
      quantityMetric: "participants", includedQuantity: null, minimumQuantity: 1, maximumQuantity: 20, minimumDurationMinutes: 120, maximumDurationMinutes: 120,
      sortOrder: 0, isDefault: true, createdBy: adminId, updatedBy: adminId, archivedAt: null,
    })
    await dataSource.getRepository(PriceRuleEntity).save({
      id: ruleId, ratePlanId, selector: "any_date", dayClass: null, serviceDateFrom: null, serviceDateToExclusive: null, selectorLabel: null,
      minimumQuantity: 4, maximumQuantity: 4, minimumDurationMinutes: 120, maximumDurationMinutes: 120, minimumBookingLeadDays: null, maximumBookingLeadDays: null,
      amountMinor: 2_000, extraUnitAmountMinor: null, priority: 10, reason: "duration-aware integration", enabled: true,
      createdBy: adminId, updatedBy: adminId, archivedAt: null,
    })
    await dataSource.getRepository(PriceBookEntity).update({ id: priceBookId }, { state: "active", activatedAt: new Date(), activatedBy: adminId })
    await dataSource.getRepository(CatalogOfferingEntity).update({ id: offeringId }, { state: "active", activePriceBookId: priceBookId, pricingVersion: 2 })
    const preview = await adminAgent.post(`/api/internal/v1/programs/${templateId}/offering/quotes/preview`).send({
      ratePlanKey: null, serviceDate, participants: 4, currency: "RUB", addOns: [], operationId: randomUUID(), idempotencyKey: `program-preview-${randomUUID()}`,
    }).expect(200)
    expect(preview.body).toMatchObject({ quoteType: "template_preview", acceptanceReady: false, offeringId, programTemplateId: templateId, total: { amountMinor: 8_000, currency: "RUB" }, provenance: { subjectVersion: 1, programTemplateVersion: 1, pricingVersion: 2, matchedRuleIds: [ruleId] }, immutableSnapshot: true })
    expect(await dataSource.getRepository(OfferingQuoteSnapshotEntity).findOneByOrFail({ id: preview.body.quoteId })).toMatchObject({ quoteType: "template_preview", offeringId, programTemplateId: templateId, subjectVersion: 1, programTemplateVersion: 1, operationalContext: null })
    const startsAt = new Date(`${serviceDate}T06:00:00.000Z`), endsAt = new Date(`${serviceDate}T08:00:00.000Z`), occurrenceId = randomUUID()
    await dataSource.getRepository(ProgramOccurrenceEntity).save({ id: occurrenceId, code: "PO-GATE-B", templateId, name: "Gate B run", startsAt, endsAt, participantLimit: 4, registrationLimit: 2, status: "open", currency: "RUB", comment: "", assigneeIds: [], ratePlanOverrideId: ratePlanId, createdBy: adminId, updatedBy: adminId, archivedAt: null })
    await adminAgent.post("/api/internal/v1/programs/registrations").send({ occurrenceId, participantCount: 2, total: { amountMinor: 1, currency: "RUB" }, status: "new", operationId: randomUUID(), idempotencyKey: `program-priced-client-total-${randomUUID()}` }).expect(422)
    const registration = await adminAgent.post("/api/internal/v1/programs/registrations").send({ occurrenceId, participantCount: 2, status: "new", operationId: randomUUID(), idempotencyKey: `program-priced-registration-${randomUUID()}` }).expect(201)
    expect(registration.body).toMatchObject({ pricingMode: "quote_required", acceptedQuote: null, total: { amountMinor: 0, currency: "RUB" } })
    const registrationQuoteBody = { expectedOccurrenceVersion: 1, ratePlanKey: null, participants: 2, currency: "RUB", addOns: [], operationId: randomUUID(), idempotencyKey: `program-registration-quote-${randomUUID()}` }
    const registrationQuote = await adminAgent.post(`/api/internal/v1/programs/occurrences/${occurrenceId}/offering/quotes/registration`).send(registrationQuoteBody).expect(200)
    expect(registrationQuote.body).toMatchObject({ quoteType: "program_registration", acceptanceReady: true, programOccurrenceId: occurrenceId, programOccurrenceVersion: 1, programTemplateId: templateId, inputs: { startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(), participants: 2, durationMinutes: 120 }, total: { amountMinor: 5_000, currency: "RUB" } })
    await adminAgent.post(`/api/admin/v1/programs/occurrences/${occurrenceId}/offering/quotes/registration`).send(registrationQuoteBody).expect(404)
    await adminAgent.post(`/api/internal/v1/programs/registrations/${registration.body.id}/transition`).send({ version: 1, operationId: randomUUID(), idempotencyKey: `template-preview-rejected-${randomUUID()}`, status: "confirmed", quoteAcceptance: { quoteSnapshotId: preview.body.quoteId } }).expect(422)
    const acceptCommand = { version: 1, operationId: randomUUID(), idempotencyKey: `program-quote-accept-${randomUUID()}`, status: "confirmed", quoteAcceptance: { quoteSnapshotId: registrationQuote.body.quoteId } }
    const accepted = await adminAgent.post(`/api/internal/v1/programs/registrations/${registration.body.id}/transition`).send(acceptCommand).expect(201)
    expect(accepted.body).toMatchObject({ version: 2, status: "confirmed", total: { amountMinor: 5_000, currency: "RUB" }, discount: { amountMinor: 0, currency: "RUB" }, acceptedQuote: { quoteId: registrationQuote.body.quoteId, total: { amountMinor: 5_000 }, addOns: [] } })
    expect((await adminAgent.post(`/api/internal/v1/programs/registrations/${registration.body.id}/transition`).send(acceptCommand).expect(201)).body).toEqual(accepted.body)
    await adminAgent.post(`/api/internal/v1/programs/registrations/${registration.body.id}/transition`).send({ ...acceptCommand, quoteAcceptance: { quoteSnapshotId: randomUUID() } }).expect(409)
    expect(await dataSource.getRepository(AcceptedOfferingQuoteLinkEntity).countBy({ programRegistrationId: registration.body.id })).toBe(1)
    expect(await dataSource.getRepository(ChangeLogEntity).countBy({ entityType: "program_registration", entityId: registration.body.id, action: "quote_accepted" })).toBe(1)
    expect(await dataSource.getRepository(OutboxEventEntity).countBy({ topic: "crm.operational_quote.accepted", aggregateType: "program_registration", aggregateId: registration.body.id })).toBe(1)
    await expect(dataSource.getRepository(ProgramRegistrationEntity).update({ id: registration.body.id }, { totalAmount: 1 })).rejects.toThrow()
    const capacityRace = await Promise.all([0, 1].map((index) => adminAgent.post("/api/internal/v1/programs/registrations").send({ occurrenceId, participantCount: 2, status: "new", operationId: randomUUID(), idempotencyKey: `program-capacity-race-${index}-${randomUUID()}` })))
    expect(capacityRace.map((response) => response.status).sort()).toEqual([201, 409])
    const aggregate = await dataSource.getRepository(ProgramRegistrationEntity).createQueryBuilder("registration").select("SUM(participant_count)", "participants").where("occurrence_id = :occurrenceId AND archived_at IS NULL AND status <> 'cancelled'", { occurrenceId }).getRawOne<{ participants: string }>()
    expect(Number(aggregate?.participants)).toBe(4)
    await adminAgent.patch(`/api/internal/v1/programs/occurrences/${occurrenceId}`).send({ version: 1, participantLimit: 3, operationId: randomUUID(), idempotencyKey: `program-limit-reduction-${randomUUID()}` }).expect(409)
    await request(app.getHttpServer()).get(`/api/public/v1/programs/${templateId}/offering`).expect(404)

    const concurrentTemplateId = randomUUID()
    await saveTemplate(concurrentTemplateId, "P-A-CORE-RACE", 90)
    const concurrent = await Promise.all([0, 1].map((index) => adminAgent.post(`/api/internal/v1/programs/${concurrentTemplateId}/offering`).send({ operationId: randomUUID(), idempotencyKey: `program-race-${index}-${randomUUID()}`, expectedProgramTemplateVersion: 1 })))
    expect(concurrent.map((response) => response.status).sort()).toEqual([201, 409])
    const liveBindings = await dataSource.getRepository(OfferingBindingEntity).findBy({ programTemplateId: concurrentTemplateId, role: "primary" })
    expect(liveBindings).toHaveLength(1)
    const packageOfferingId = liveBindings[0]!.offeringId
    expect(await dataSource.getRepository(CatalogOfferingEntity).countBy({ id: packageOfferingId })).toBe(1)
    const packageBookId = randomUUID()
    await dataSource.getRepository(PriceBookEntity).save({
      id: packageBookId, offeringId: packageOfferingId, revision: 1, name: "Program package", currency: "RUB", timezone: "Europe/Moscow", state: "draft",
      validFrom: iso(0), validToExclusive: iso(60), supersedesPriceBookId: null, changeReason: "package boundary", scheduledActivationAt: null, scheduledBy: null,
      activatedAt: null, activatedBy: null, retiredAt: null, retiredBy: null, createdBy: adminId, updatedBy: adminId, archivedAt: null,
    })
    await dataSource.getRepository(RatePlanEntity).save({
      id: randomUUID(), priceBookId: packageBookId, key: "package", label: "Package", pricingBasis: "flat_package", baseAmountMinor: 10_000, baseExtraUnitAmountMinor: 500,
      quantityMetric: "participants", includedQuantity: 10, minimumQuantity: 1, maximumQuantity: 20, minimumDurationMinutes: 90, maximumDurationMinutes: 90,
      sortOrder: 0, isDefault: true, createdBy: adminId, updatedBy: adminId, archivedAt: null,
    })
    await dataSource.getRepository(PriceBookEntity).update({ id: packageBookId }, { state: "active", activatedAt: new Date(), activatedBy: adminId })
    await dataSource.getRepository(CatalogOfferingEntity).update({ id: packageOfferingId }, { state: "active", activePriceBookId: packageBookId, pricingVersion: 2 })
    const packagePreview = await adminAgent.post(`/api/admin/v1/programs/${concurrentTemplateId}/offering/quotes/preview`).send({
      ratePlanKey: "package", serviceDate, participants: 12, currency: "RUB", addOns: [], operationId: randomUUID(), idempotencyKey: `program-package-${randomUUID()}`,
    }).expect(200)
    expect(packagePreview.body).toMatchObject({ quoteType: "template_preview", acceptanceReady: false, total: { amountMinor: 11_000 }, lines: [{ kind: "base", quantity: 1 }, { kind: "extra_unit", quantity: 2 }] })

    const invalidTemplateId = randomUUID(), invalidNodeId = randomUUID()
    await saveTemplate(invalidTemplateId, "P-A-CORE-INVALID")
    await dataSource.getRepository(CmsNodeEntity).save({ id: invalidNodeId, kind: "resource_detail", status: "active", createdBy: adminId, updatedBy: adminId, archivedAt: null })
    await dataSource.getRepository(CmsSourceLinkEntity).save({ id: randomUUID(), sourceKind: "program_template", sourceId: invalidTemplateId, sourceVersion: 1, nodeId: invalidNodeId, syncState: "draft", createdAt: new Date() })
    await adminAgent.post(`/api/internal/v1/programs/${invalidTemplateId}/offering`).send({ operationId: randomUUID(), idempotencyKey: `program-invalid-${randomUUID()}`, expectedProgramTemplateVersion: 1 }).expect(409)
    expect(await dataSource.getRepository(OfferingBindingEntity).countBy({ programTemplateId: invalidTemplateId, role: "primary" })).toBe(0)
    expect(await dataSource.getRepository(CatalogOfferingEntity).countBy({ code: "PROGRAM-P-A-CORE-INVALID" })).toBe(0)
  })

  it("hydrates already-bound resource targets in the editor on both surfaces, including an archived identity", async () => {
    const calendarId = randomUUID()
    const offeringId = randomUUID()
    const resourceId = randomUUID()
    await dataSource.getRepository(BusinessCalendarEntity).save({
      id: calendarId, code: `binding-target-calendar-${calendarId.slice(0, 8)}`, name: "Binding target calendar",
      timezone: "Europe/Moscow", countryCode: "RU", source: "official_ru", sourceVersion: "binding-target-v1",
      state: "active", importedAt: new Date(), coverageFrom: "2026-09-01", coverageToExclusive: "2026-09-02",
      contentHash: "a".repeat(64), createdBy: adminId, updatedBy: adminId, archivedAt: null,
    })
    await dataSource.getRepository(ResourceEntity).save({
      id: resourceId, code: "BOUND-RESOURCE", kind: "house", name: "Привязанный дом", capacityMode: "fixed", capacityTotal: 3,
      settings: { privateEditorField: "must-not-leak" }, createdBy: adminId, updatedBy: adminId, archivedAt: null,
    })
    await dataSource.getRepository(CatalogOfferingEntity).save({
      id: offeringId, code: "BOUND-HOUSE", kind: "house", operationalName: "Дом с привязкой", internalComment: "",
      state: "draft", subjectVersion: 1, pricingVersion: 1, addonAssignmentsVersion: 1, salesMode: "request_only",
      priceDisplayMode: "request", currency: "RUB", timezone: "Europe/Moscow", taxMode: "not_taxable",
      businessCalendarId: calendarId, leadDirection: null, defaultAssigneeId: null, scope: null, ownerOfferingId: null,
      activePriceBookId: null, createdBy: adminId, updatedBy: adminId, archivedAt: null,
    })
    await dataSource.getRepository(OfferingBindingEntity).save({
      id: randomUUID(), offeringId, resourceId, resourceGroupId: null, programTemplateId: null, eventServiceTemplateId: null,
      role: "primary", quantityDefault: 1, capacityImpactDefault: 1, preparationBeforeMinutes: 0, preparationAfterMinutes: 0,
      availabilityRequired: true, createdBy: adminId, updatedBy: adminId, archivedAt: null,
    })

    const [internalEditor, adminEditor] = await Promise.all([
      adminAgent.get(`/api/internal/v1/offerings/${offeringId}/editor`).expect(200),
      adminAgent.get(`/api/admin/v1/offerings/${offeringId}/editor`).expect(200),
    ])
    expect(adminEditor.body).toEqual(internalEditor.body)
    expect(internalEditor.body).toMatchObject({
      bindings: [{ target: { type: "resource", id: resourceId } }],
      bindingTargets: [{ type: "resource", id: resourceId, name: "Привязанный дом", capacity: { mode: "fixed", total: 3 }, archived: false }],
    })
    expect(Object.keys(internalEditor.body.bindingTargets[0]).sort()).toEqual(["archived", "capacity", "code", "id", "kind", "name", "type", "version"])
    expect(internalEditor.body.bindingTargets[0].settings).toBeUndefined()

    await dataSource.getRepository(ResourceEntity).update({ id: resourceId }, { archivedAt: new Date() })
    const [internalArchived, adminArchived] = await Promise.all([
      adminAgent.get(`/api/internal/v1/offerings/${offeringId}/editor`).expect(200),
      adminAgent.get(`/api/admin/v1/offerings/${offeringId}/editor`).expect(200),
    ])
    expect(adminArchived.body).toEqual(internalArchived.body)
    expect(internalArchived.body).toMatchObject({
      bindings: [{ target: { type: "resource", id: resourceId } }],
      bindingTargets: [{ id: resourceId, archived: true }],
    })
    expect((await adminAgent.get("/api/internal/v1/offerings/binding-targets?targetType=resource&q=bound-resource").expect(200)).body).toEqual({ items: [], nextCursor: null })
  })

  it("promotes only an exact legacy house locator and exposes a safe fail-closed editorial summary", async () => {
    const calendarId = randomUUID()
    const resourceId = randomUUID()
    const offeringId = randomUUID()
    const ambiguousOfferingId = randomUUID()
    const nodeId = randomUUID()
    const revisionId = randomUUID()
    await dataSource.getRepository(BusinessCalendarEntity).save({
      id: calendarId, code: `editorial-calendar-${calendarId.slice(0, 8)}`, name: "Editorial calendar",
      timezone: "Europe/Moscow", countryCode: "RU", source: "official_ru", sourceVersion: "editorial-v1",
      state: "active", importedAt: new Date(), coverageFrom: "2026-09-01", coverageToExclusive: "2026-09-02",
      contentHash: "d".repeat(64), createdBy: adminId, updatedBy: adminId, archivedAt: null,
    })
    await dataSource.getRepository(ResourceEntity).save({
      id: resourceId, code: "EDITORIAL-HOUSE-RESOURCE", kind: "house", name: "Редакционный дом",
      capacityMode: "fixed", capacityTotal: 4, settings: { internalOnly: "must-not-leak" },
      createdBy: adminId, updatedBy: adminId, archivedAt: null,
    })
    const offerings = dataSource.getRepository(CatalogOfferingEntity)
    const common = {
      kind: "house", internalComment: "must-not-leak", state: "active", subjectVersion: 1, pricingVersion: 1,
      addonAssignmentsVersion: 1, salesMode: "request_only", priceDisplayMode: "request", currency: "RUB",
      timezone: "Europe/Moscow", taxMode: "not_taxable", businessCalendarId: calendarId, leadDirection: null,
      defaultAssigneeId: null, scope: null, ownerOfferingId: null, activePriceBookId: null,
      createdBy: adminId, updatedBy: adminId, archivedAt: null,
    }
    await offerings.save([
      offerings.create({ ...common, id: offeringId, code: "EDITORIAL-HOUSE", operationalName: "Дом Сосна" }),
      offerings.create({ ...common, id: ambiguousOfferingId, code: "EDITORIAL-HOUSE-AMBIGUOUS", operationalName: "Дубликат" }),
    ])
    const bindings = dataSource.getRepository(OfferingBindingEntity)
    for (const id of [offeringId, ambiguousOfferingId]) await bindings.save({
      id: randomUUID(), offeringId: id, resourceId, resourceGroupId: null, programTemplateId: null, eventServiceTemplateId: null,
      role: "primary", quantityDefault: 1, capacityImpactDefault: 1, preparationBeforeMinutes: 0, preparationAfterMinutes: 0,
      availabilityRequired: true, createdBy: adminId, updatedBy: adminId, archivedAt: null,
    })
    await dataSource.getRepository(CmsNodeEntity).save({
      id: nodeId, kind: "resource_detail", status: "active", createdBy: adminId, updatedBy: adminId, archivedAt: null,
    })
    const content = {
      route: { path: "/houses/sosna", slug: "sosna", parentNodeId: null, sortOrder: 0 }, title: "Дом Сосна", summary: "Безопасное редакционное описание",
      hero: { mode: "disabled" as const }, sections: [],
      seo: { title: "Дом Сосна", description: "Безопасное редакционное описание", indexPolicy: "noindex_follow" as const, canonical: { mode: "self" as const }, structuredData: [] },
      relations: [{ kind: "catalog_offering" as const, entityId: offeringId }], schemaVersion: 1,
    }
    await dataSource.getRepository(CmsNodeRevisionEntity).save({
      id: revisionId, nodeId, revision: 1, state: "approved", path: content.route.path, slug: content.route.slug,
      parentNodeId: null, sortOrder: 0, title: content.title, summary: content.summary, hero: content.hero, sections: [],
      seo: content.seo, relations: content.relations, schemaVersion: 1, contentHash: revisionContentHash(content), createdBy: adminId, createdAt: new Date(),
    })
    const legacyLinkId = randomUUID()
    await dataSource.getRepository(CmsSourceLinkEntity).save({
      id: legacyLinkId, sourceKind: "resource", sourceId: resourceId, sourceVersion: 1, nodeId, syncState: "draft", createdAt: new Date(),
    })

    const ambiguous = await dataSource.transaction((manager) => ensureCatalogOfferingEditorialDraft(manager, { offeringId, actorId: adminId, requestId: "integration-ambiguous" }))
    expect(ambiguous).toMatchObject({ status: "report_only", report: { status: "ambiguous", candidateOfferingIds: [expect.any(String), expect.any(String)] } })
    expect(await dataSource.getRepository(CmsSourceLinkEntity).findOneByOrFail({ id: legacyLinkId })).toMatchObject({ sourceKind: "resource", sourceId: resourceId })

    await offerings.update({ id: ambiguousOfferingId }, { archivedAt: new Date(), state: "archived" })
    const promoted = await dataSource.transaction((manager) => ensureCatalogOfferingEditorialDraft(manager, { offeringId, actorId: adminId, requestId: "integration-promote" }))
    expect(promoted).toMatchObject({ status: "promoted", link: { id: legacyLinkId, sourceKind: "catalog_offering", sourceId: offeringId, nodeId } })
    await expect(dataSource.query("UPDATE catalog_offerings SET kind = 'venue' WHERE id = $1", [offeringId])).rejects.toThrow(/protected by its canonical CMS source link/)
    await expect(dataSource.query("UPDATE cms_nodes SET kind = 'landing' WHERE id = $1", [nodeId])).rejects.toThrow(/protected by its canonical catalog offering link/)
    expect(await dataSource.getRepository(ChangeLogEntity).countBy({ entityId: nodeId, action: "catalog_offering_source_promoted" })).toBe(1)
    expect(await dataSource.getRepository(OutboxEventEntity).countBy({ topic: "public.offering_projection.invalidated", aggregateId: offeringId })).toBe(0)

    const [internalEditor, adminEditor] = await Promise.all([
      adminAgent.get(`/api/internal/v1/offerings/${offeringId}/editor`).expect(200),
      adminAgent.get(`/api/admin/v1/offerings/${offeringId}/editor`).expect(200),
    ])
    expect(adminEditor.body).toEqual(internalEditor.body)
    expect(internalEditor.body.editorial).toMatchObject({
      source: { sourceKind: "catalog_offering", sourceId: offeringId },
      node: { id: nodeId, kind: "resource_detail", status: "active" },
      currentRevision: { id: revisionId, state: "approved", path: "/houses/sosna", title: "Дом Сосна" },
      publication: { eligible: false, blockers: ["public_profile_missing", "safe_public_projection_missing"] },
    })
    expect(internalEditor.body.ownerVersions.editorial).toMatchObject({ nodeId, draftRevisionId: revisionId })
    expect(JSON.stringify(internalEditor.body.editorial)).not.toContain("must-not-leak")

    const publish = await adminAgent.post(`/api/admin/v1/content/nodes/${nodeId}/publish`).send({
      operationId: randomUUID(), idempotencyKey: `publish-catalog-${randomUUID()}`, expectedVersion: 1,
    }).expect(422)
    expect(publish.body).toMatchObject({ code: "CMS_PUBLICATION_VALIDATION_FAILED", details: { issues: [expect.objectContaining({ code: "CMS_CATALOG_OFFERING_SAFE_PROJECTION_REQUIRED" })] } })
  })

  it("hydrates assigned reusable and offering-specific add-on catalog summaries without leaking internal fields", async () => {
    const calendarId = randomUUID()
    const offeringId = randomUUID()
    const reusableId = randomUUID()
    const specificId = randomUUID()
    await dataSource.getRepository(BusinessCalendarEntity).save({
      id: calendarId, code: `addon-catalog-calendar-${calendarId.slice(0, 8)}`, name: "Add-on catalog calendar",
      timezone: "Europe/Moscow", countryCode: "RU", source: "official_ru", sourceVersion: "addon-catalog-v1",
      state: "active", importedAt: new Date(), coverageFrom: "2026-09-01", coverageToExclusive: "2026-09-02",
      contentHash: "b".repeat(64), createdBy: adminId, updatedBy: adminId, archivedAt: null,
    })
    const offerings = dataSource.getRepository(CatalogOfferingEntity)
    await offerings.save([
      offerings.create({
        id: offeringId, code: "ADDON-CATALOG-HOUSE", kind: "house", operationalName: "Дом с дополнениями", internalComment: "owner only",
        state: "draft", subjectVersion: 1, pricingVersion: 1, addonAssignmentsVersion: 1, salesMode: "request_only",
        priceDisplayMode: "request", currency: "RUB", timezone: "Europe/Moscow", taxMode: "not_taxable",
        businessCalendarId: calendarId, leadDirection: null, defaultAssigneeId: null, scope: null, ownerOfferingId: null,
        activePriceBookId: null, createdBy: adminId, updatedBy: adminId, archivedAt: null,
      }),
      offerings.create({
        id: reusableId, code: "ADDON-SAUNA", kind: "addon", operationalName: "Баня", internalComment: "library-only internal comment",
        state: "active", subjectVersion: 1, pricingVersion: 1, addonAssignmentsVersion: 1, salesMode: "request_only",
        priceDisplayMode: "request", currency: "RUB", timezone: "Europe/Moscow", taxMode: "not_taxable",
        businessCalendarId: calendarId, leadDirection: null, defaultAssigneeId: null, scope: "reusable", ownerOfferingId: null,
        activePriceBookId: null, createdBy: adminId, updatedBy: adminId, archivedAt: null,
      }),
      offerings.create({
        id: specificId, code: "ADDON-LATE-CHECKOUT", kind: "addon", operationalName: "Поздний выезд", internalComment: "specific internal comment",
        state: "draft", subjectVersion: 1, pricingVersion: 1, addonAssignmentsVersion: 1, salesMode: "request_only",
        priceDisplayMode: "request", currency: "RUB", timezone: "Europe/Moscow", taxMode: "not_taxable",
        businessCalendarId: calendarId, leadDirection: null, defaultAssigneeId: null, scope: "offering_specific", ownerOfferingId: offeringId,
        activePriceBookId: null, createdBy: adminId, updatedBy: adminId, archivedAt: null,
      }),
    ])
    await dataSource.getRepository(AddonOfferingTermsEntity).save([
      { offeringId: reusableId, offeringKind: "addon", serviceType: "scheduled_resource", categoryKey: "wellness", standalone: true, applicableOfferingKinds: ["house", "campground"], minimumQuantity: null, maximumQuantity: null, defaultQuantity: null, quantityStep: null, createdAt: new Date(), createdBy: adminId },
      { offeringId: specificId, offeringKind: "addon", serviceType: "quantity_service", categoryKey: "comfort", standalone: false, applicableOfferingKinds: ["house", "campground"], minimumQuantity: 1, maximumQuantity: 100, defaultQuantity: 1, quantityStep: 1, createdAt: new Date(), createdBy: adminId },
    ])
    await dataSource.getRepository(OfferingAddonAssignmentEntity).save([
      { id: randomUUID(), offeringId, addonOfferingId: reusableId, addonOfferingKind: "addon", enabled: true, required: false, recommended: true, groupKey: null, ratePlanKeyOverride: null, labelOverride: null, descriptionOverride: null, minimumQuantity: null, maximumQuantity: null, defaultQuantity: null, displayOrder: 10, createdBy: adminId, updatedBy: adminId, archivedAt: null },
      { id: randomUUID(), offeringId, addonOfferingId: specificId, addonOfferingKind: "addon", enabled: false, required: false, recommended: false, groupKey: null, ratePlanKeyOverride: null, labelOverride: null, descriptionOverride: null, minimumQuantity: null, maximumQuantity: null, defaultQuantity: null, displayOrder: 20, createdBy: adminId, updatedBy: adminId, archivedAt: null },
    ])

    const [internalEditor, adminEditor] = await Promise.all([
      adminAgent.get(`/api/internal/v1/offerings/${offeringId}/editor`).expect(200),
      adminAgent.get(`/api/admin/v1/offerings/${offeringId}/editor`).expect(200),
    ])
    expect(adminEditor.body).toEqual(internalEditor.body)
    expect(internalEditor.body).toMatchObject({
      addOnAssignments: [{ addOnOfferingId: reusableId }, { addOnOfferingId: specificId }],
      addOnCatalog: [
        { offering: { id: reusableId, code: "ADDON-SAUNA", operationalName: "Баня", state: "active", archived: false }, serviceType: "scheduled_resource", scope: "reusable", ownerOfferingId: null, categoryKey: "wellness", standalone: true, availability: { status: "available", blocker: null } },
        { offering: { id: specificId, code: "ADDON-LATE-CHECKOUT", operationalName: "Поздний выезд", state: "draft", archived: false }, serviceType: "quantity_service", scope: "offering_specific", ownerOfferingId: offeringId, categoryKey: "comfort", standalone: false, availability: { status: "blocked", blocker: "not_active" } },
      ],
    })
    expect(Object.keys(internalEditor.body.addOnCatalog[0].offering).sort()).toEqual(["archived", "code", "id", "operationalName", "salesMode", "state", "version"])
    expect(internalEditor.body.addOnCatalog[0].offering.internalComment).toBeUndefined()
  })

  it("pins and serves a strict public add-on projection from the active CMS release", async () => {
    const dates = futureStayDates()
    const calendarId = randomUUID()
    const offeringId = randomUUID()
    const priceBookId = randomUUID()
    const nodeId = randomUUID()
    const revisionId = randomUUID()
    const now = new Date()
    await dataSource.getRepository(BusinessCalendarEntity).save({
      id: calendarId, code: `public-addon-${calendarId.slice(0, 8)}`, name: "Public add-on calendar",
      timezone: "Europe/Moscow", countryCode: "RU", source: "official_ru", sourceVersion: "public-addon-v1",
      state: "active", importedAt: now, coverageFrom: dates.pricingStartDate, coverageToExclusive: dates.coverageEndDate,
      contentHash: "a".repeat(64), createdBy: adminId, updatedBy: adminId, archivedAt: null,
    })
    await dataSource.getRepository(BusinessCalendarDateEntity).save([dates.pricingStartDate, dates.arrivalDate, dates.middleDate, dates.departureDate].map((localDate) => ({
      id: randomUUID(), calendarId, localDate, officialClass: "weekday", officialLabel: null,
      sourceVersion: "public-addon-v1", createdBy: adminId, updatedBy: adminId, archivedAt: null,
    })))
    await dataSource.getRepository(CatalogOfferingEntity).save({
      id: offeringId, code: "ADDON-PUBLIC-BREAKFAST", kind: "addon", operationalName: "Внутреннее имя завтрака",
      internalComment: "must-not-leak", state: "draft", subjectVersion: 2, pricingVersion: 1,
      addonAssignmentsVersion: 1, salesMode: "selectable", priceDisplayMode: "exact", currency: "RUB",
      timezone: "Europe/Moscow", taxMode: "tax_included", businessCalendarId: calendarId, leadDirection: null,
      defaultAssigneeId: null, scope: "reusable", ownerOfferingId: null, activePriceBookId: null,
      createdBy: adminId, updatedBy: adminId, archivedAt: null,
    })
    await dataSource.getRepository(AddonOfferingTermsEntity).save({
      offeringId, offeringKind: "addon", serviceType: "person_service", standalone: true, categoryKey: "food",
      applicableOfferingKinds: ["house", "campground"], minimumQuantity: 1, maximumQuantity: 20,
      defaultQuantity: 2, quantityStep: 1, createdAt: now, createdBy: adminId,
    })
    await dataSource.getRepository(PriceBookEntity).save({
      id: priceBookId, offeringId, revision: 1, name: "Публичный завтрак", currency: "RUB", timezone: "Europe/Moscow",
      state: "draft", validFrom: dates.pricingStartDate, validToExclusive: dates.coverageEndDate, supersedesPriceBookId: null,
      changeReason: "integration", scheduledActivationAt: null, scheduledBy: null, activatedAt: null, activatedBy: null,
      retiredAt: null, retiredBy: null, createdBy: adminId, updatedBy: adminId, archivedAt: null,
    })
    await dataSource.getRepository(RatePlanEntity).save({
      id: randomUUID(), priceBookId, key: "adult", label: "Завтрак", pricingBasis: "per_person",
      baseAmountMinor: 85_000, baseExtraUnitAmountMinor: null, quantityMetric: "participants", includedQuantity: null,
      minimumQuantity: null, maximumQuantity: null, minimumDurationMinutes: null, maximumDurationMinutes: null,
      sortOrder: 0, isDefault: true, createdBy: adminId, updatedBy: adminId, archivedAt: null,
    })
    const activatedPriceBook = await adminAgent.post(`/api/admin/v1/offerings/${offeringId}/price-books/${priceBookId}/activate`).send({
      operationId: randomUUID(), idempotencyKey: `addon-price-activate-${randomUUID()}`, expectedPricingVersion: 1, reason: "Проверено",
    }).expect(200)
    expect(activatedPriceBook.body).toMatchObject({ pricingVersion: 2, priceBook: { id: priceBookId, state: "active" } })
    expect(await dataSource.getRepository(CatalogOfferingEntity).findOneByOrFail({ id: offeringId })).toMatchObject({ state: "active", version: 2, activePriceBookId: priceBookId })
    const activationAudit = await dataSource.getRepository(ChangeLogEntity).findOneByOrFail({ entityType: "catalog_offering_pricing", entityId: offeringId, action: "activated" })
    expect(activationAudit.changes).toMatchObject({ offeringState: { from: "draft", to: "active", reason: "first_active_price_book" } })
    expect((await adminAgent.get(`/api/admin/v1/offerings/${offeringId}/editor`).expect(200)).body.editorial).toBeNull()
    const libraryBeforePublication = await adminAgent.get(`/api/internal/v1/addons?q=${encodeURIComponent("Внутреннее имя завтрака")}&scope=reusable`).expect(200)
    expect(libraryBeforePublication.body.items).toEqual([
      expect.objectContaining({ offering: expect.objectContaining({ id: offeringId, state: "active", activePriceBookId: priceBookId }) }),
    ])
    const ownerOfferingId = randomUUID()
    await dataSource.getRepository(CatalogOfferingEntity).save({
      id: ownerOfferingId, code: `HOUSE-ADDON-${ownerOfferingId.slice(0, 8)}`, kind: "house", operationalName: "Домик с завтраком",
      internalComment: "", state: "active", subjectVersion: 1, pricingVersion: 1, addonAssignmentsVersion: 1,
      salesMode: "request_only", priceDisplayMode: "request", currency: "RUB", timezone: "Europe/Moscow", taxMode: "tax_included",
      businessCalendarId: calendarId, leadDirection: "houses", defaultAssigneeId: null, scope: null, ownerOfferingId: null,
      activePriceBookId: null, createdBy: adminId, updatedBy: adminId, archivedAt: null,
    })
    const assignedBeforePublication = await adminAgent.put(`/api/internal/v1/offerings/${ownerOfferingId}/add-ons`).send({
      operationId: randomUUID(), idempotencyKey: `addon-before-publication-${randomUUID()}`, expectedAddOnsVersion: 1,
      assignments: [{ addOnOfferingId: offeringId }],
    }).expect(200)
    expect(assignedBeforePublication.body).toMatchObject({ offeringId: ownerOfferingId, addOnAssignmentsVersion: 2, assignments: [{ addOnOfferingId: offeringId, enabled: true }] })
    await dataSource.getRepository(CmsNodeEntity).save({
      id: nodeId, kind: "addon_detail", status: "active", createdBy: adminId, updatedBy: adminId, archivedAt: null,
    })
    const content = {
      route: { path: "/services/breakfast", slug: "breakfast", parentNodeId: null, sortOrder: 10 },
      title: "Завтрак из фермерских продуктов", summary: "Готовим утром и приносим к домику.",
      hero: { mode: "disabled" as const }, sections: [],
      seo: { title: "Завтрак в Свистоплясово", description: "Фермерский завтрак для гостей базы отдыха", indexPolicy: "index_follow" as const, canonical: { mode: "self" as const }, structuredData: [] },
      relations: [{ kind: "catalog_offering" as const, entityId: offeringId }], schemaVersion: 1,
    }
    await dataSource.getRepository(CmsNodeRevisionEntity).save({
      id: revisionId, nodeId, revision: 1, state: "approved", path: content.route.path, slug: content.route.slug,
      parentNodeId: null, sortOrder: 10, title: content.title, summary: content.summary, hero: content.hero,
      sections: [], seo: content.seo, relations: content.relations, schemaVersion: 1,
      contentHash: revisionContentHash(content), createdBy: adminId, createdAt: now,
    })
    await dataSource.getRepository(CmsSourceLinkEntity).save({
      id: randomUUID(), sourceKind: "catalog_offering", sourceId: offeringId, sourceVersion: 2,
      nodeId, syncState: "draft", createdAt: now,
    })

    const blocked = await adminAgent.post("/api/admin/v1/releases/build").send({
      operationId: randomUUID(), idempotencyKey: `addon-release-blocked-${randomUUID()}`,
      revisionIds: [revisionId], removeNodeIds: [],
    }).expect(422)
    expect(blocked.body.details.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "CMS_CATALOG_OFFERING_SAFE_PROJECTION_REQUIRED" }),
    ]))

    await dataSource.getRepository(CmsPublicProfileEntity).save({
      id: randomUUID(), kind: "catalog_offering", entityId: offeringId, nodeId,
      createdBy: adminId, updatedBy: adminId, archivedAt: null,
    })
    expect((await adminAgent.get(`/api/admin/v1/offerings/${offeringId}/editor`).expect(200)).body.editorial.publication).toEqual({ eligible: true, blockers: [] })

    const built = await adminAgent.post("/api/admin/v1/releases/build").send({
      operationId: randomUUID(), idempotencyKey: `addon-release-build-${randomUUID()}`,
      revisionIds: [revisionId], removeNodeIds: [],
    }).expect(201)
    const releaseId = built.body.manifest.id as string
    expect(built.body.manifest.routes[0].dependencyRefs).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "crm_projection", id: offeringId, version: "public.addon-summary.v1", contentHash: expect.stringMatching(/^[a-f0-9]{64}$/) }),
    ]))
    await adminAgent.post(`/api/admin/v1/releases/${releaseId}/activate`).send({
      operationId: randomUUID(), idempotencyKey: `addon-release-activate-${randomUUID()}`,
      baseReleaseId: null, expectedActiveReleaseVersion: 1,
    }).expect(200)

    const detail = await request(app.getHttpServer()).get(`/api/public/v1/offerings/addons/${offeringId}`).expect(200)
    expect(detail.body).toMatchObject({
      offeringId, kind: "addon", title: content.title, summary: content.summary,
      price: { mode: "exact", amount: { amountMinor: 85_000, currency: "RUB" } },
      quoteAvailable: false, requestAvailable: true, readiness: "ready",
      terms: { serviceType: "person_service", standalone: true, categoryKey: "food", quantity: { unit: "participants", minimum: 1, maximum: 20, default: 2, step: 1 } },
      sourceVersions: { pricing: 2, priceBook: 1, contentReleaseId: releaseId, profileRevisionId: revisionId },
    })
    expect(JSON.stringify(detail.body)).not.toMatch(/must-not-leak|internalComment|applicableOfferingKinds|priceBookId|rawRule/)
    const etag = detail.headers.etag
    if (typeof etag !== "string") throw new Error("public add-on detail must return an ETag")
    await request(app.getHttpServer()).get(`/api/public/v1/offerings/addons/${offeringId}`).set("If-None-Match", etag).expect(304)
    const list = await request(app.getHttpServer()).get("/api/public/v1/offerings/addons").query({ categoryKey: "food", standalone: "true" }).expect(200)
    expect(list.body).toMatchObject({ releaseId, nextCursor: null, items: [{ offeringId, title: content.title }] })
    await request(app.getHttpServer()).get("/api/public/v1/offerings/addons").query({ state: "active" }).expect(400)
  })

  it("persists workspace profile and settings with permissions, versions and audit", async () => {
    const profile = await adminAgent.get("/api/internal/v1/workspace/profile").expect(200)
    const updatedProfile = await adminAgent.patch("/api/internal/v1/workspace/profile").send({
      version: profile.body.version,
      phone: "+7 900 123-45-67",
      browserNotifications: false,
      operationId: randomUUID(),
      idempotencyKey: `profile-${randomUUID()}`,
    }).expect(200)
    expect(updatedProfile.body).toMatchObject({ phone: "+7 900 123-45-67", browserNotifications: false, version: profile.body.version + 1 })
    expect((await adminAgent.get("/api/internal/v1/workspace/profile").expect(200)).body).toMatchObject({ phone: "+7 900 123-45-67" })

    const settings = await adminAgent.get("/api/internal/v1/workspace/settings").expect(200)
    const updatedSettings = await adminAgent.patch("/api/internal/v1/workspace/settings").send({
      version: settings.body.version,
      organization: { phone: "+7 812 000-00-01" },
      operations: { conflictWarnings: false },
      operationId: randomUUID(),
      idempotencyKey: `settings-${randomUUID()}`,
    }).expect(200)
    expect(updatedSettings.body).toMatchObject({
      version: settings.body.version + 1,
      organization: { phone: "+7 812 000-00-01" },
      operations: { conflictWarnings: false },
    })
    expect((await adminAgent.get("/api/internal/v1/workspace/settings").expect(200)).body).toMatchObject({ organization: { phone: "+7 812 000-00-01" } })
    await readonlyAgent.patch("/api/internal/v1/workspace/settings").send({
      version: updatedSettings.body.version,
      organization: { phone: "+7 812 000-00-02" },
      operationId: randomUUID(),
      idempotencyKey: `settings-readonly-${randomUUID()}`,
    }).expect(403)
    expect(await dataSource.getRepository(ChangeLogEntity).countBy({ entityType: "workspace_settings", entityId: settings.body.id })).toBe(1)
    expect(await dataSource.getRepository(OutboxEventEntity).countBy({ aggregateType: "workspace_settings", aggregateId: settings.body.id })).toBe(1)
  })

  it("rejects cross-site mutations and invalidates sessions after a password change", async () => {
    const csrf = await adminAgent.post("/api/internal/v1/tasks").set("origin", "https://evil.example").send({ title: "CSRF" }).expect(403)
    expect(csrf.body.code).toBe("CSRF_REJECTED")

    await adminAgent.post("/api/internal/v1/auth/change-password").send({
      currentPassword: PASSWORD,
      newPassword: "new-integration-password",
    }).expect(200)
    await adminAgent.get("/api/internal/v1/auth/session").expect(401)
    await request(app.getHttpServer()).post("/api/internal/v1/auth/login").send({ email: ADMIN_EMAIL, password: PASSWORD }).expect(401)
    await request(app.getHttpServer()).post("/api/internal/v1/auth/login").send({ email: ADMIN_EMAIL, password: "new-integration-password" }).expect(200)
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

  it("persists other-user notifications and read state", async () => {
    const created = await adminAgent.post("/api/internal/v1/tasks").send({ title: "Уведомить команду", status: "todo" }).expect(201)

    const own = await adminAgent.get("/api/internal/v1/notifications?limit=30").expect(200)
    expect(own.body).toEqual({ items: [], unreadCount: 0 })

    const initial = await readonlyAgent.get("/api/internal/v1/notifications?limit=30").expect(200)
    expect(initial.body.unreadCount).toBe(1)
    expect(initial.body.items[0]).toMatchObject({
      entityType: "task",
      href: `/tasks/${created.body.id}`,
      readAt: null,
      type: "other_user_change",
    })

    await readonlyAgent.post(`/api/internal/v1/notifications/${initial.body.items[0].id}/read`).expect(200)
    const afterRead = await readonlyAgent.get("/api/internal/v1/notifications?limit=30").expect(200)
    expect(afterRead.body.unreadCount).toBe(0)
    expect(afterRead.body.items[0].readAt).toBeTypeOf("string")

    await adminAgent.patch(`/api/internal/v1/tasks/${created.body.id}`).send({ version: created.body.version, title: "Уведомить всех" }).expect(200)
    await readonlyAgent.post("/api/internal/v1/notifications/read-all").expect(200)
    const afterAll = await readonlyAgent.get("/api/internal/v1/notifications?limit=30").expect(200)
    expect(afterAll.body.unreadCount).toBe(0)
    expect(afterAll.body.items).toHaveLength(2)
  })

  it("keeps customer and lead changes versioned, linked and auditable", async () => {
    const customer = await adminAgent.post("/api/internal/v1/customers").send({
      name: "Анна Тестова", type: "person", phone: "+7 921 000-00-00", channels: ["Телефон"],
    }).expect(201)
    await readonlyAgent.post(`/api/internal/v1/customers/${customer.body.id}/assign-self`).send({ version: customer.body.version }).expect(403)
    const assignedCustomer = await adminAgent.post(`/api/internal/v1/customers/${customer.body.id}/assign-self`).send({ version: customer.body.version }).expect(201)
    expect(assignedCustomer.body).toMatchObject({ version: customer.body.version + 1, assignees: [{ id: adminId, name: "Integration Admin" }] })
    const lead = await adminAgent.post("/api/internal/v1/leads").send({
      customerId: customer.body.id, name: "Анна Тестова", phone: "+7 921 000-00-00", direction: "Проживание",
      requestedItem: "Дом", desiredStartAt: "2026-09-20T10:00:00.000Z", desiredEndAt: "2026-09-21T10:00:00.000Z",
      guestCount: 2, source: "Телефон", assignees: [],
    }).expect(201)
    expect(lead.body).toMatchObject({ customerId: customer.body.id, status: "new" })
    await readonlyAgent.post(`/api/internal/v1/leads/${lead.body.id}/assign-self`).send({ version: lead.body.version }).expect(403)
    const assignedLead = await adminAgent.post(`/api/internal/v1/leads/${lead.body.id}/assign-self`).send({ version: lead.body.version }).expect(201)
    expect(assignedLead.body).toMatchObject({ version: lead.body.version + 1, assignees: [{ id: adminId, name: "Integration Admin" }] })
    const withLead = await adminAgent.get(`/api/internal/v1/customers/${customer.body.id}`).expect(200)
    expect(withLead.body).toMatchObject({ leadCount: 1, activeLeadCount: 1 })

    const successful = await adminAgent.post(`/api/internal/v1/leads/${lead.body.id}/transition`).send({ version: assignedLead.body.version, status: "success" }).expect(201)
    expect(successful.body.version).toBe(assignedLead.body.version + 1)
    await adminAgent.post(`/api/internal/v1/leads/${lead.body.id}/transition`).send({ version: lead.body.version, status: "rejected" }).expect(409)
    const afterTransition = await adminAgent.get(`/api/internal/v1/customers/${customer.body.id}`).expect(200)
    expect(afterTransition.body).toMatchObject({ leadCount: 1, activeLeadCount: 0 })
    expect(await dataSource.getRepository(ChangeLogEntity).countBy({ entityType: "lead", entityId: lead.body.id })).toBe(3)
    expect(await dataSource.getRepository(OutboxEventEntity).countBy({ aggregateType: "lead", aggregateId: lead.body.id })).toBe(3)
  })

  it("links bookings to leads authoritatively and preserves relation history", async () => {
    const customer = await adminAgent.post("/api/internal/v1/customers").send({ name: "Relation Customer", type: "person", phone: "+7 921 100-00-00", channels: ["Сайт"] }).expect(201)
    const firstLead = await adminAgent.post("/api/internal/v1/leads").send({ customerId: customer.body.id, name: "First lead", phone: "+7 921 100-00-00", direction: "Проживание" }).expect(201)
    const secondLead = await adminAgent.post("/api/internal/v1/leads").send({ customerId: customer.body.id, name: "Second lead", phone: "+7 921 100-00-00", direction: "Проживание" }).expect(201)
    const resourceId = randomUUID()
    await dataSource.getRepository(ResourceEntity).save(dataSource.getRepository(ResourceEntity).create({ id: resourceId, code: "R-link", kind: "house", name: "Дом для связи", capacityMode: "fixed", capacityTotal: 1, settings: {}, createdBy: adminId, updatedBy: adminId, archivedAt: null }))
    const created = await adminAgent.post("/api/internal/v1/bookings").send({ operationId: randomUUID(), idempotencyKey: "booking-link-create-0001", overrideConflict: false, customerId: customer.body.id, items: [{ type: "accommodation", resourceId, startAt: "2026-09-22T10:00:00.000Z", endAt: "2026-09-22T12:00:00.000Z", quantity: 1, price: { amountMinor: 1000, currency: "RUB" }, discount: { amountMinor: 0, currency: "RUB" }, preparationMinutes: 0 }], note: null }).expect(201)
    const projectionBeforeLink = await adminAgent.get("/api/internal/v1/bookings/projection?date=2026-09-22&rangeEnd=2026-09-22&category=all&resource=all&source=all&amountFrom=0&debtFrom=0&utm=all&promo=all&conflictOnly=false&overpayOnly=false&sort=arrival&order=asc").expect(200)
    expect(projectionBeforeLink.body.bookings.find((item: { id: string }) => item.id === created.body.id).sourceLeadId).toBeNull()
    const linked = await adminAgent.post(`/api/internal/v1/bookings/${created.body.id}/lead-link`).send({ leadId: firstLead.body.id, method: "manual", expectedVersion: created.body.version, operationId: randomUUID(), idempotencyKey: "booking-link-0001" }).expect(201)
    expect(linked.body.link).toMatchObject({ bookingId: created.body.id, leadId: firstLead.body.id, method: "manual", unlinkedAt: null })
    const relinked = await adminAgent.post(`/api/internal/v1/bookings/${created.body.id}/lead-link`).send({ leadId: secondLead.body.id, method: "from_lead", expectedVersion: linked.body.bookingVersion, operationId: randomUUID(), idempotencyKey: "booking-link-0002" }).expect(201)
    expect(relinked.body.link.leadId).toBe(secondLead.body.id)
    await adminAgent.post(`/api/internal/v1/bookings/${created.body.id}/lead-link`).send({ leadId: firstLead.body.id, method: "manual", expectedVersion: created.body.version, operationId: randomUUID(), idempotencyKey: "booking-link-stale" }).expect(409)
    await readonlyAgent.post(`/api/internal/v1/bookings/${created.body.id}/lead-link/unlink`).send({ expectedVersion: relinked.body.bookingVersion, operationId: randomUUID(), idempotencyKey: "booking-unlink-readonly" }).expect(403)
    const unlinked = await adminAgent.post(`/api/internal/v1/bookings/${created.body.id}/lead-link/unlink`).send({ expectedVersion: relinked.body.bookingVersion, operationId: randomUUID(), idempotencyKey: "booking-unlink-0001" }).expect(201)
    expect(unlinked.body.link).toBeNull()
    const history = await adminAgent.get(`/api/internal/v1/bookings/${created.body.id}/lead-link/history`).expect(200)
    expect(history.body.items).toHaveLength(2)
    expect(history.body.items[0]).toMatchObject({ leadId: firstLead.body.id, unlinkedBy: adminId })
    expect(history.body.items[1]).toMatchObject({ leadId: secondLead.body.id, unlinkedBy: adminId })
    const detail = await adminAgent.get(`/api/internal/v1/bookings/${created.body.id}`).expect(200)
    expect(detail.body.sourceLeadId).toBeNull()
    expect(detail.body.leadLink).toBeNull()
    expect(await dataSource.getRepository(ChangeLogEntity).countBy({ entityType: "booking", entityId: created.body.id })).toBe(4)
    expect(await dataSource.getRepository(OutboxEventEntity).countBy({ aggregateType: "booking", aggregateId: created.body.id })).toBe(4)
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

  it("lists and cancels non-booking allocations through the authoritative API", async () => {
    const resources = dataSource.getRepository(ResourceEntity)
    const resourceId = randomUUID()
    const sourceId = randomUUID()
    await resources.save(resources.create({ id: resourceId, code: "R-event", kind: "venue", name: "Площадка события", capacityMode: "shared", capacityTotal: 50, settings: {}, createdBy: adminId, updatedBy: adminId, archivedAt: null }))
    const created = await adminAgent.post("/api/internal/v1/resources/allocations").send({
      resourceId, sourceType: "event", sourceId, startAt: "2026-09-20T10:00:00.000Z", endAt: "2026-09-20T12:00:00.000Z", quantity: 12, capacityImpact: 12,
      status: "tentative", operationId: randomUUID(), expectedVersion: 1, overrideConflict: false,
    }).expect(201)
    const listed = await adminAgent.get(`/api/internal/v1/resources/allocations?sourceType=event&sourceId=${sourceId}`).expect(200)
    expect(listed.body).toHaveLength(1)
    expect(listed.body[0]).toMatchObject({ id: created.body.id, sourceType: "event", sourceId, quantity: 12, status: "tentative" })
    await readonlyAgent.post(`/api/internal/v1/resources/allocations/${created.body.id}/cancel`).send({ expectedVersion: 2, operationId: randomUUID(), idempotencyKey: "readonly-allocation-cancel-0001" }).expect(403)
    const cancelled = await adminAgent.post(`/api/internal/v1/resources/allocations/${created.body.id}/cancel`).send({ expectedVersion: 2, operationId: randomUUID(), idempotencyKey: "event-allocation-cancel-0001" }).expect(200)
    expect(cancelled.body).toMatchObject({ id: created.body.id, status: "cancelled", version: 2 })
    const included = await adminAgent.get(`/api/internal/v1/resources/allocations?sourceType=event&sourceId=${sourceId}&includeCancelled=true`).expect(200)
    expect(included.body[0].status).toBe("cancelled")
    expect(await dataSource.getRepository(ChangeLogEntity).countBy({ entityType: "resource_allocation", entityId: created.body.id })).toBe(2)
    expect(await dataSource.getRepository(OutboxEventEntity).countBy({ aggregateType: "resource", aggregateId: resourceId })).toBe(2)
  })

  it("serializes competing booking allocations so only one fixed-resource race wins", async () => {
    const resourceId = randomUUID()
    const customerId = randomUUID()
    await dataSource.getRepository(CustomerEntity).save(dataSource.getRepository(CustomerEntity).create({
      id: customerId, type: "person", name: "Race Customer", phones: [], channels: [], email: null, notes: "", consent: {}, duplicateRisk: "none", assignees: [],
      leadCount: 0, activeLeadCount: 0, bookingCount: 0, futureBookingCount: 0, taskCount: 0, turnover: 0, debt: 0, nextContactAt: null, lastVisitAt: null,
      createdBy: adminId, updatedBy: adminId, archivedAt: null,
    }))
    await dataSource.getRepository(ResourceEntity).save(dataSource.getRepository(ResourceEntity).create({
      id: resourceId, code: "R-race", kind: "house", name: "Гоночный дом", capacityMode: "fixed", capacityTotal: 1,
      settings: {}, createdBy: adminId, updatedBy: adminId, archivedAt: null,
    }))
    const bookingInput = (suffix: string) => ({
      operationId: randomUUID(),
      idempotencyKey: `booking-race-${suffix}-0001`,
      overrideConflict: false,
      customerId,
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
    await dataSource.getRepository(CustomerEntity).save(dataSource.getRepository(CustomerEntity).create({
      id: customerId, type: "person", name: "Booking Customer", phones: [], channels: [], email: null, notes: "", consent: {}, duplicateRisk: "none", assignees: [],
      leadCount: 0, activeLeadCount: 0, bookingCount: 0, futureBookingCount: 0, taskCount: 0, turnover: 0, debt: 0, nextContactAt: null, lastVisitAt: null,
      createdBy: adminId, updatedBy: adminId, archivedAt: null,
    }))
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

    const assignmentInput = { expectedVersion: created.body.version, operationId: randomUUID(), idempotencyKey: "booking-assign-self-0001" }
    await readonlyAgent.post(`/api/internal/v1/bookings/${created.body.id}/assign-self`).send(assignmentInput).expect(403)
    const assigned = await adminAgent.post(`/api/internal/v1/bookings/${created.body.id}/assign-self`).send(assignmentInput).expect(201)
    expect(assigned.body.version).toBe(created.body.version + 1)
    expect((await adminAgent.post(`/api/internal/v1/bookings/${created.body.id}/assign-self`).send(assignmentInput).expect(201)).body).toEqual(assigned.body)
    expect((await adminAgent.get(`/api/internal/v1/bookings/${created.body.id}`).expect(200)).body.assignees).toEqual([
      expect.objectContaining({ id: adminId, name: "Integration Admin" }),
    ])

    const unconfirmed = await adminAgent.post(`/api/internal/v1/bookings/${created.body.id}/transition`).send({ operationId: randomUUID(), idempotencyKey: "booking-transition-0001", expectedVersion: assigned.body.version, status: "unconfirmed" }).expect(201)
    const transitioned = await adminAgent.post(`/api/internal/v1/bookings/${created.body.id}/transition`).send({ operationId: randomUUID(), idempotencyKey: "booking-transition-0002", expectedVersion: unconfirmed.body.version, status: "confirmed" }).expect(201)
    const target = { type: "booking", id: created.body.id }
    const chargeInput = { operationId: randomUUID(), idempotencyKey: "charge-integration-0001", expectedVersion: transitioned.body.version, target, type: "charge", amount: { amountMinor: 5000, currency: "RUB" }, method: "card", reason: null, sourcePaymentId: null }
    const [chargeResponse, replayResponse] = await Promise.all([
      adminAgent.post("/api/internal/v1/payments").send(chargeInput),
      adminAgent.post("/api/internal/v1/payments").send(chargeInput),
    ])
    expect(chargeResponse.status).toBe(201)
    expect(replayResponse.status).toBe(201)
    const charge = chargeResponse
    const replay = replayResponse
    expect(replay.body).toEqual(charge.body)
    const refund = await adminAgent.post("/api/internal/v1/payments").send({ operationId: randomUUID(), idempotencyKey: "refund-integration-0001", expectedVersion: transitioned.body.version + 1, target, type: "refund", amount: { amountMinor: 2000, currency: "RUB" }, method: "card", reason: "По запросу клиента", sourcePaymentId: charge.body.id }).expect(201)
    expect(refund.body).toMatchObject({ type: "refund", sourcePaymentId: charge.body.id, amount: { amountMinor: 2000 } })
    await adminAgent.post("/api/internal/v1/payments").send({ ...chargeInput, operationId: randomUUID(), idempotencyKey: "refund-too-large-0001", expectedVersion: transitioned.body.version + 2, type: "refund", amount: { amountMinor: 4000, currency: "RUB" }, sourcePaymentId: charge.body.id }).expect(409)
    await adminAgent.post("/api/internal/v1/payments").send({ ...chargeInput, operationId: randomUUID(), idempotencyKey: "cross-target-refund-0001", expectedVersion: transitioned.body.version + 2, type: "refund", amount: { amountMinor: 1, currency: "RUB" }, sourcePaymentId: randomUUID() }).expect(409)
    const summary = await adminAgent.get(`/api/internal/v1/payments/summary?target[type]=booking&target[id]=${created.body.id}`).expect(200)
    expect(summary.body).toMatchObject({ charged: { amountMinor: 5000 }, refunded: { amountMinor: 2000 }, balance: 6000, state: "partial" })
    const finance = await adminAgent.get("/api/internal/v1/finance?date=2026-08-01&rangeEnd=2026-09-30&page=1&pageSize=25&sort=date&order=desc").expect(200)
    expect(finance.body.operations).toEqual(expect.arrayContaining([
      expect.objectContaining({ bookingId: created.body.id, type: "accrual", amountMinor: 9000 }),
      expect.objectContaining({ bookingId: created.body.id, type: "payment", amountMinor: 5000, refundableMinor: 3000 }),
      expect.objectContaining({ bookingId: created.body.id, type: "refund", amountMinor: -2000, sourcePaymentId: charge.body.id }),
    ]))
    expect(finance.body.summary).toMatchObject({ accruedMinor: 9000, paidMinor: 5000, refundsMinor: 2000, debtMinor: 6000 })
  })

  it("keeps event and program-registration payments in their own versioned ledger targets", async () => {
    const eventId = randomUUID()
    const registrationId = randomUUID()
    const templateId = randomUUID()
    const occurrenceId = randomUUID()
    const events = dataSource.getRepository(EventEntity)
    const registrations = dataSource.getRepository(ProgramRegistrationEntity)
    const templates = dataSource.getRepository(ProgramTemplateEntity)
    const occurrences = dataSource.getRepository(ProgramOccurrenceEntity)
    await events.save(events.create({ id: eventId, code: "E-PAYMENT-TARGET", name: "Оплата мероприятия", categoryId: null, customerId: null, phone: "", startsAt: new Date("2026-09-20T10:00:00.000Z"), endsAt: new Date("2026-09-20T12:00:00.000Z"), guestCount: 1, totalAmount: 10_000, paidAmount: 0, currency: "RUB", status: "planning", comment: "", requiresAction: false, assigneeIds: [], scenario: [], createdBy: adminId, updatedBy: adminId, archivedAt: null }))
    await templates.save(templates.create({ id: templateId, code: "P-PAYMENT-TARGET", name: "Программа оплаты", categoryId: null, durationMinutes: 60, minimumParticipants: 1, participantLimit: 10, registrationCloseHours: null, basePriceAmount: 5_000, currency: "RUB", description: "", publication: "draft", assigneeIds: [], stages: [], createdBy: adminId, updatedBy: adminId, archivedAt: null }))
    await occurrences.save(occurrences.create({ id: occurrenceId, code: "PO-PAYMENT-TARGET", templateId, name: "Проведение оплаты", startsAt: new Date("2026-09-21T10:00:00.000Z"), endsAt: new Date("2026-09-21T11:00:00.000Z"), participantLimit: 10, registrationLimit: 10, status: "open", currency: "RUB", comment: "", assigneeIds: [], createdBy: adminId, updatedBy: adminId, archivedAt: null }))
    await registrations.save(registrations.create({ id: registrationId, code: "PR-PAYMENT-TARGET", occurrenceId, customerId: null, phone: "", participantCount: 1, participantNames: "", totalAmount: 5_000, discountAmount: 0, paidAmount: 0, currency: "RUB", status: "new", promo: "", source: "", comment: "", createdBy: adminId, updatedBy: adminId, archivedAt: null }))

    const eventCharge = await adminAgent.post("/api/internal/v1/payments").send({ target: { type: "event", id: eventId }, operationId: randomUUID(), idempotencyKey: "event-payment-target-0001", expectedVersion: 1, type: "charge", amount: { amountMinor: 4_000, currency: "RUB" }, method: "card", reason: null, sourcePaymentId: null }).expect(201)
    expect(eventCharge.body).toMatchObject({ target: { type: "event", id: eventId } })
    expect((await events.findOneByOrFail({ id: eventId })).paidAmount).toBe(4_000)
    await adminAgent.post("/api/internal/v1/payments").send({ target: { type: "program_registration", id: registrationId }, operationId: randomUUID(), idempotencyKey: "registration-payment-target-0001", expectedVersion: 1, type: "refund", amount: { amountMinor: 1, currency: "RUB" }, method: "card", reason: null, sourcePaymentId: eventCharge.body.id }).expect(409)
    const registrationCharge = await adminAgent.post("/api/internal/v1/payments").send({ target: { type: "program_registration", id: registrationId }, operationId: randomUUID(), idempotencyKey: "registration-payment-target-0002", expectedVersion: 1, type: "charge", amount: { amountMinor: 2_000, currency: "RUB" }, method: "cash", reason: null, sourcePaymentId: null }).expect(201)
    expect(registrationCharge.body).toMatchObject({ target: { type: "program_registration", id: registrationId } })
    expect((await registrations.findOneByOrFail({ id: registrationId })).paidAmount).toBe(2_000)
  })

  it("keeps program and event categories authoritative, versioned and nullable on delete", async () => {
    const program = await adminAgent.post("/api/internal/v1/programs/categories").send({ name: "Сезонный тест", description: "Тестовая категория", icon: "snowflake", tone: "sky", operationId: randomUUID(), idempotencyKey: "program-category-create-0001" }).expect(201)
    expect(program.body).toMatchObject({ name: "Сезонный тест", templateCount: 0, capabilities: { canEdit: true, canArchive: true } })
    const template = await dataSource.getRepository(ProgramTemplateEntity).save(dataSource.getRepository(ProgramTemplateEntity).create({
      id: randomUUID(), code: "PROGRAM-CATEGORY-TEST", name: "Категорийная программа", categoryId: program.body.id,
      durationMinutes: 60, minimumParticipants: 1, participantLimit: 10, registrationCloseHours: null, basePriceAmount: 1000, currency: "RUB", description: "", publication: "draft", assigneeIds: [], stages: [], createdBy: adminId, updatedBy: adminId, archivedAt: null,
    }))
    const detail = await adminAgent.get(`/api/internal/v1/programs/categories/${program.body.id}`).expect(200)
    expect(detail.body.relatedTemplates).toHaveLength(1)
    const updated = await adminAgent.patch(`/api/internal/v1/programs/categories/${program.body.id}`).send({ version: program.body.version, name: "Сезонные тесты", operationId: randomUUID(), idempotencyKey: "program-category-update-0001" }).expect(200)
    expect(updated.body.version).toBe(program.body.version + 1)
    await adminAgent.patch(`/api/internal/v1/programs/categories/${program.body.id}`).send({ version: program.body.version, name: "stale", operationId: randomUUID(), idempotencyKey: "program-category-update-stale" }).expect(409)
    const archived = await adminAgent.post(`/api/internal/v1/programs/categories/${program.body.id}/archive`).send({ version: updated.body.version, operationId: randomUUID(), idempotencyKey: "program-category-archive-0001" }).expect(201)
    expect(archived.body.archived).toBe(true)
    expect(await dataSource.getRepository(ChangeLogEntity).countBy({ entityType: "program_category", entityId: program.body.id })).toBe(3)
    expect(await dataSource.getRepository(OutboxEventEntity).countBy({ aggregateType: "program_category", aggregateId: program.body.id })).toBe(3)
    await dataSource.getRepository(ProgramCategoryEntity).delete(program.body.id)
    expect((await dataSource.getRepository(ProgramTemplateEntity).findOneByOrFail({ id: template.id })).categoryId).toBeNull()

    const event = await adminAgent.post("/api/internal/v1/events/categories").send({ name: "Выездной тест", description: "", icon: "bus", tone: "sky", operationId: randomUUID(), idempotencyKey: "event-category-create-0001" }).expect(201)
    expect(event.body).toMatchObject({ name: "Выездной тест", eventCount: 0 })
    const eventRow = await dataSource.getRepository(EventEntity).save(dataSource.getRepository(EventEntity).create({
      id: randomUUID(), code: "EVENT-CATEGORY-TEST", name: "Тестовое мероприятие", categoryId: event.body.id, customerId: null, phone: "", startsAt: new Date("2026-09-01T10:00:00.000Z"), endsAt: new Date("2026-09-01T11:00:00.000Z"), guestCount: 1, totalAmount: 0, paidAmount: 0, currency: "RUB", status: "inquiry", comment: "", requiresAction: false, assigneeIds: [], scenario: [], createdBy: adminId, updatedBy: adminId, archivedAt: null,
    }))
    await dataSource.getRepository(EventCategoryEntity).delete(event.body.id)
    expect((await dataSource.getRepository(EventEntity).findOneByOrFail({ id: eventRow.id })).categoryId).toBeNull()
  })

  it("projects every new CRM public-content source into an explicitly linked CMS draft", async () => {
    const resource = await adminAgent.post("/api/internal/v1/resources").send({ kind: "house", name: "Домик-черновик", capacityMode: "fixed", capacityTotal: 1, settings: {} }).expect(201)
    const programCategory = await adminAgent.post("/api/internal/v1/programs/categories").send({ name: "Категория программ", description: "", icon: "snowflake", tone: "sky", operationId: randomUUID(), idempotencyKey: `projection-program-category-${randomUUID()}` }).expect(201)
    const template = await adminAgent.post("/api/internal/v1/programs/templates").send({ name: "Программа-черновик", categoryId: programCategory.body.id, durationMinutes: 60, participantLimit: 10, basePrice: { amountMinor: 1000, currency: "RUB" }, operationId: randomUUID(), idempotencyKey: `projection-template-${randomUUID()}` }).expect(201)
    const occurrenceSecret = "Внутреннее: клиент просил не звонить"
    const occurrence = await adminAgent.post("/api/internal/v1/programs/occurrences").send({ templateId: template.body.id, startsAt: "2026-10-01T10:00:00.000Z", endsAt: "2026-10-01T11:00:00.000Z", participantLimit: 10, registrationLimit: 10, comment: occurrenceSecret, operationId: randomUUID(), idempotencyKey: `projection-occurrence-${randomUUID()}` }).expect(201)
    const eventCategory = await adminAgent.post("/api/internal/v1/events/categories").send({ name: "Категория событий", description: "", icon: "bus", tone: "sky", operationId: randomUUID(), idempotencyKey: `projection-event-category-${randomUUID()}` }).expect(201)
    const eventSecret = "Внутреннее: заказчик Иван, скидку не показывать"
    const eventPhone = "+7 999 123-45-67"
    const event = await adminAgent.post("/api/internal/v1/events").send({ name: "Мероприятие-черновик", categoryId: eventCategory.body.id, phone: eventPhone, startsAt: "2026-10-02T10:00:00.000Z", endsAt: "2026-10-02T12:00:00.000Z", guestCount: 20, total: { amountMinor: 0, currency: "RUB" }, comment: eventSecret, operationId: randomUUID(), idempotencyKey: `projection-event-${randomUUID()}` }).expect(201)

    const expected = new Map([
      [resource.body.id, "resource"], [programCategory.body.id, "program_category"], [template.body.id, "program_template"],
      [occurrence.body.id, "program_occurrence"], [eventCategory.body.id, "event_category"], [event.body.id, "event"],
    ])
    const rows = await dataSource.query(`SELECT link.source_id AS "sourceId", link.source_kind AS "sourceKind", link.sync_state AS "syncState", link.node_id AS "nodeId", revision.state,
        revision.summary, revision.sections, revision.seo
      FROM cms_source_links link JOIN cms_node_revisions revision ON revision.node_id = link.node_id AND revision.revision = 1
      WHERE link.source_id = ANY($1::uuid[])`, [[...expected.keys()]]) as Array<{ sourceId: string; sourceKind: string; syncState: string; nodeId: string; state: string; summary: string | null; sections: unknown[]; seo: unknown }>
    expect(rows).toHaveLength(6)
    for (const row of rows) expect(row).toMatchObject({ sourceKind: expected.get(row.sourceId), syncState: "draft", state: "draft" })
    const cmsList = await adminAgent.get("/api/admin/v1/content/nodes?limit=20").expect(200)
    expect(cmsList.body.items.filter((item: { source: unknown }) => item.source !== null)).toHaveLength(6)
    for (const sourceKind of ["event", "program_occurrence"]) {
      const technicalDraft = rows.find((row) => row.sourceKind === sourceKind)!
      expect(technicalDraft.summary).toBeNull()
      expect(technicalDraft.sections).toEqual([])
      expect(JSON.stringify(technicalDraft.seo)).not.toContain(sourceKind === "event" ? eventSecret : occurrenceSecret)
      expect(JSON.stringify(technicalDraft)).not.toContain(eventPhone)
    }
    const resourceDraft = rows.find((row) => row.sourceKind === "resource")!
    const blocked = await adminAgent.post(`/api/admin/v1/content/nodes/${resourceDraft.nodeId}/publish`).send({ operationId: randomUUID(), idempotencyKey: `source-route-publish-${randomUUID()}`, expectedVersion: 1 }).expect(422)
    expect(blocked.body).toMatchObject({ code: "CMS_SOURCE_ROUTE_REQUIRED", fieldErrors: { "route.path": expect.any(Array) } })

    for (const sourceKind of ["event", "program_occurrence"] as const) {
      const technicalDraft = rows.find((row) => row.sourceKind === sourceKind)!
      const slug = sourceKind === "event" ? "private-operational-event" : "private-program-occurrence"
      const relationKind = sourceKind === "event" ? "public_event_offering" : "program_occurrence"
      const edited = await adminAgent.patch(`/api/admin/v1/content/nodes/${technicalDraft.nodeId}`).send({
        operationId: randomUUID(), idempotencyKey: `unsafe-source-edit-${sourceKind}-${randomUUID()}`, expectedVersion: 1,
        route: { path: `/${slug}`, slug, parentNodeId: null, sortOrder: 0 }, hero: { mode: "disabled" },
        relations: [{ kind: relationKind, entityId: technicalDraft.sourceId }],
      }).expect(200)
      const rejected = await adminAgent.post(`/api/admin/v1/content/nodes/${technicalDraft.nodeId}/publish`).send({
        operationId: randomUUID(), idempotencyKey: `unsafe-source-publish-${sourceKind}-${randomUUID()}`, expectedVersion: edited.body.node.version,
      }).expect(422)
      expect(rejected.body).toMatchObject({
        code: "CMS_PUBLICATION_VALIDATION_FAILED",
        details: { issues: expect.arrayContaining([expect.objectContaining({ code: "CMS_OPERATIONAL_SOURCE_PUBLIC_PROFILE_REQUIRED", route: `/${slug}` })]) },
      })
    }
  })

  it("publishes navigation and pages directly, then auto-forks the next edit from the published snapshot", async () => {
    const initialSettings = await adminAgent.get("/api/admin/v1/site-settings").expect(200)
    const savedSettings = await adminAgent.patch("/api/admin/v1/site-settings").send({
      operationId: randomUUID(), idempotencyKey: `site-settings-save-${randomUUID()}`, expectedVersion: initialSettings.body.version,
      value: {
        siteName: "Свистоплясово",
        headerNavigation: [{ id: randomUUID(), label: "Домики", link: { kind: "internal", path: "/", anchor: "houses" }, icon: "home", color: "forest", children: [] }],
        heroDefault: null,
        sectionDefaults: ["map", "faq", "directions", "calculator", "footer"].map((key, index) => ({ id: randomUUID(), key, renderer: key, rendererVersion: "1", schemaVersion: 1, order: 100 + index, config: {} })),
      },
    }).expect(200)
    const publishedSettings = await adminAgent.post("/api/admin/v1/site-settings/publish").send({
      operationId: randomUUID(), idempotencyKey: `site-settings-publish-${randomUUID()}`, expectedVersion: savedSettings.body.version,
    }).expect(200)
    expect(publishedSettings.body).toMatchObject({ draft: null, published: { value: { siteName: "Свистоплясово" } } })
    const publicSettings = await request(app.getHttpServer()).get("/api/public/v1/site-settings").expect(200)
    expect(publicSettings.body.value.headerNavigation[0]).toMatchObject({ icon: "home", color: "forest", link: { path: "/", anchor: "houses" } })

    const created = await adminAgent.post("/api/admin/v1/content/nodes").send({
      operationId: randomUUID(), idempotencyKey: `direct-page-create-${randomUUID()}`, kind: "landing",
      route: { path: "/simple", slug: "simple", parentNodeId: null, sortOrder: 0 }, title: "Первая версия", summary: null,
      hero: { mode: "override", config: { title: "Первая версия" } }, sections: [],
      seo: { title: "Первая версия", description: "Тест прямой публикации" }, relations: [], schemaVersion: 1,
    }).expect(201)
    const nodeId = created.body.node.id as string
    const firstPublication = await adminAgent.post(`/api/admin/v1/content/nodes/${nodeId}/publish`).send({
      operationId: randomUUID(), idempotencyKey: `direct-page-publish-${randomUUID()}`, expectedVersion: created.body.node.version,
    }).expect(200)
    expect(firstPublication.body).toMatchObject({ node: { version: 2 }, publishedRevision: { state: "published" } })
    expect((await adminAgent.get(`/api/admin/v1/content/nodes/${nodeId}`).expect(200)).body.currentRevision).toMatchObject({ state: "published" })
    const firstPage = (await request(app.getHttpServer()).get("/api/public/v1/pages/resolve").query({ path: "/simple" }).expect(200)).body
    expect(firstPage).toMatchObject({ title: "Первая версия", hero: { title: "Первая версия" } })
    expect(firstPage.sections.map((section: { key: string }) => section.key)).toEqual(["map", "faq", "directions", "calculator", "footer"])

    const edited = await adminAgent.patch(`/api/admin/v1/content/nodes/${nodeId}`).send({
      operationId: randomUUID(), idempotencyKey: `direct-page-edit-${randomUUID()}`, expectedVersion: firstPublication.body.node.version,
      title: "Вторая версия", hero: { mode: "override", config: { title: "Вторая версия" } },
    }).expect(200)
    expect(edited.body.currentRevision).toMatchObject({ state: "draft", revision: 2 })
    await adminAgent.post(`/api/admin/v1/content/nodes/${nodeId}/publish`).send({
      operationId: randomUUID(), idempotencyKey: `direct-page-republish-${randomUUID()}`, expectedVersion: edited.body.node.version,
    }).expect(200)
    expect((await request(app.getHttpServer()).get("/api/public/v1/pages/resolve").query({ path: "/simple" }).expect(200)).body).toMatchObject({ title: "Вторая версия" })
  })

  it("builds and atomically activates a materialized CMS release while editorial archive leaves it live", async () => {
    const homeSectionId = randomUUID()
    const home = await adminAgent.post("/api/admin/v1/content/nodes").send({
      operationId: randomUUID(),
      idempotencyKey: `cms-home-${randomUUID()}`,
      kind: "home",
      route: { path: "/", slug: "home", parentNodeId: null, sortOrder: 0 },
      title: "База отдыха",
      summary: null,
      hero: { mode: "disabled" },
      sections: [{
        id: homeSectionId,
        key: "hero",
        renderer: "hero",
        rendererVersion: "1",
        schemaVersion: 1,
        policy: {
          mode: "override",
          patch: {
            scalars: { title: { operation: "replace", value: "База отдыха" } },
            objects: {},
            keyedArrays: {},
          },
        },
        order: 10,
      }],
      seo: { title: "База отдыха", description: "Отдых на природе" },
      relations: [],
      schemaVersion: 1,
    }).expect(201)
    const homeNodeId = home.body.node.id as string
    const homeRevisionId = home.body.currentRevision.id as string

    const nodeInput = {
      operationId: randomUUID(),
      idempotencyKey: `cms-create-${randomUUID()}`,
      kind: "landing",
      route: { path: "/svadby", slug: "svadby", parentNodeId: homeNodeId, sortOrder: 10 },
      title: "Свадьбы",
      summary: "Площадки для праздника",
      sections: [{ id: randomUUID(), key: "hero", renderer: "hero", rendererVersion: "1", schemaVersion: 1, policy: { mode: "inherit" }, order: 10 }],
      seo: { title: "Свадьбы", description: "Площадки для праздника" },
      relations: [],
      schemaVersion: 1,
    }
    const created = await adminAgent.post("/api/admin/v1/content/nodes").send(nodeInput).expect(201)
    const nodeId = created.body.node.id as string
    const revisionId = created.body.currentRevision.id as string

    const duplicate = await adminAgent.post("/api/admin/v1/content/nodes").send({
      ...nodeInput,
      operationId: randomUUID(),
      idempotencyKey: `cms-duplicate-draft-${randomUUID()}`,
    }).expect(201)
    expect(duplicate.body.node.id).not.toBe(nodeId)

    await adminAgent.patch(`/api/admin/v1/content/nodes/${nodeId}`).send({
      operationId: randomUUID(),
      idempotencyKey: `cms-invalid-route-${randomUUID()}`,
      expectedVersion: 1,
      route: { path: "/wrong", slug: "correct", parentNodeId: null, sortOrder: 10 },
    }).expect(409)

    const homeReview = await adminAgent.post(`/api/admin/v1/content/nodes/${homeNodeId}/submit-review`).send({
      operationId: randomUUID(), idempotencyKey: `cms-home-review-${randomUUID()}`, expectedVersion: 1,
    }).expect(200)
    const homeApproved = await adminAgent.post(`/api/admin/v1/content/nodes/${homeNodeId}/approve`).send({
      operationId: randomUUID(), idempotencyKey: `cms-home-approve-${randomUUID()}`, expectedVersion: homeReview.body.node.version,
    }).expect(200)
    const childReview = await adminAgent.post(`/api/admin/v1/content/nodes/${nodeId}/submit-review`).send({
      operationId: randomUUID(), idempotencyKey: `cms-child-review-${randomUUID()}`, expectedVersion: 1,
    }).expect(200)
    const childApproved = await adminAgent.post(`/api/admin/v1/content/nodes/${nodeId}/approve`).send({
      operationId: randomUUID(), idempotencyKey: `cms-child-approve-${randomUUID()}`, expectedVersion: childReview.body.node.version,
    }).expect(200)

    const built = await adminAgent.post("/api/admin/v1/releases/build").send({
      operationId: randomUUID(),
      idempotencyKey: `cms-release-build-${randomUUID()}`,
      revisionIds: [homeRevisionId, revisionId],
      removeNodeIds: [],
    }).expect(201)
    expect(built.body).toMatchObject({ manifest: { state: "ready", routes: [{ path: "/" }, { path: "/svadby" }] }, activeReleaseId: null, activeReleaseVersion: 1 })
    const childRoute = built.body.manifest.routes.find((route: { path: string }) => route.path === "/svadby")
    expect(childRoute.dependencyRefs).toHaveLength(2)

    const releaseId = built.body.manifest.id as string
    await adminAgent.post(`/api/admin/v1/releases/${releaseId}/activate`).send({
      operationId: randomUUID(),
      idempotencyKey: `cms-release-activate-${randomUUID()}`,
      baseReleaseId: null,
      expectedActiveReleaseVersion: 1,
    }).expect(200)

    const published = await request(app.getHttpServer()).get("/api/public/v1/pages/resolve").query({ path: "/svadby" }).expect(200)
    expect(published.body).toMatchObject({ nodeId, revisionId, releaseId, sections: [{ key: "hero", config: { title: "База отдыха" } }] })
    expect(published.body.sections[0]).not.toHaveProperty("policy")
    expect(await dataSource.getRepository(ChangeLogEntity).countBy({ entityType: "cms_release", entityId: releaseId })).toBe(2)
    expect(await dataSource.getRepository(OutboxEventEntity).countBy({ aggregateType: "cms_release", aggregateId: releaseId })).toBe(2)

    await adminAgent.post(`/api/admin/v1/content/nodes/${nodeId}/archive`).send({
      operationId: randomUUID(), idempotencyKey: `cms-archive-${randomUUID()}`, expectedVersion: childApproved.body.node.version,
    }).expect(200)
    await request(app.getHttpServer()).get("/api/public/v1/pages/resolve").query({ path: "/svadby" }).expect(200)
    expect(homeApproved.body.currentRevision.state).toBe("approved")
  })

  it("serves release-pinned resource listings and rejects unknown filter parameters", async () => {
    const resourceId = randomUUID()
    await dataSource.getRepository(ResourceEntity).save({
      id: resourceId, code: "R-LIST-1", kind: "house", name: "CRM internal name", capacityMode: "fixed", capacityTotal: 4,
      settings: { showOnSite: true, secondaryType: "С чаном" }, createdBy: adminId, updatedBy: adminId, archivedAt: null,
    })
    const listingNodeId = randomUUID()
    const listingRevisionId = randomUUID()
    const profileNodeId = randomUUID()
    const profileRevisionId = randomUUID()
    const releaseId = randomUUID()
    const listingDefinition = {
      id: randomUUID(), entityKind: "resource",
      filters: [{ id: "kind", label: "Тип", field: "kind", source: "crm_public_projection", valueType: "enum", operators: ["eq"], control: "select", urlKey: "kind", options: [{ value: "house", label: "Домики" }], normalization: "none", indexPolicy: "canonical_to_base" }],
      sorts: [{ id: "title", label: "По названию", field: "title", direction: "asc", source: "cms" }],
      defaultSortId: "title", pageSize: 12,
    }
    const seo = { title: "Каталог", description: "Каталог", indexPolicy: "index_follow", canonical: { mode: "self" }, structuredData: [] }
    const listingContent = { kind: "resource_listing", path: "/catalog", title: "Каталог", summary: null, hero: null, sections: [{ id: randomUUID(), key: "catalog", renderer: "listing", rendererVersion: "site-ui@1", schemaVersion: 1, order: 10, config: { definition: listingDefinition } }], seo }
    const profileContent = { kind: "resource_detail", path: "/resources/gnezdo", title: "Домик «Гнездо»", summary: "Домик с чаном", hero: null, sections: [], seo: { ...seo, title: "Домик «Гнездо»" } }
    await dataSource.query(`INSERT INTO cms_nodes(id, kind, status, created_by, updated_by) VALUES ($1, 'resource_listing', 'active', $3, $3), ($2, 'resource_detail', 'active', $3, $3)`, [listingNodeId, profileNodeId, adminId])
    await dataSource.query(`INSERT INTO cms_node_revisions(id, node_id, revision, state, path, slug, parent_node_id, sort_order, title, summary, hero, sections, seo, relations, schema_version, content_hash, created_by)
      VALUES ($1, $2, 1, 'published', '/catalog', 'catalog', NULL, 0, 'Каталог', NULL, '{"mode":"disabled"}'::jsonb, '[]'::jsonb, $5::jsonb, '[]'::jsonb, 1, $6, $7),
             ($3, $4, 1, 'published', '/resources/gnezdo', 'gnezdo', NULL, 0, 'Домик «Гнездо»', 'Домик с чаном', '{"mode":"disabled"}'::jsonb, '[]'::jsonb, $5::jsonb, '[]'::jsonb, 1, $6, $7)`,
    [listingRevisionId, listingNodeId, profileRevisionId, profileNodeId, JSON.stringify(seo), "a".repeat(64), adminId])
    await dataSource.query(`INSERT INTO cms_releases(id, sequence, state, manifest_hash, created_by, published_at) VALUES ($1, 1, 'published', $2, $3, now())`, [releaseId, "b".repeat(64), adminId])
    await dataSource.query(`INSERT INTO cms_release_items(id, release_id, path, node_id, revision_id, resolved_content_hash, resolved_content, dependencies)
      VALUES ($1, $2, '/catalog', $3, $4, $5, $6::jsonb, '[]'::jsonb), ($7, $2, '/resources/gnezdo', $8, $9, $10, $11::jsonb, '[]'::jsonb)`,
    [randomUUID(), releaseId, listingNodeId, listingRevisionId, resolvedContentHash(listingContent), JSON.stringify(listingContent), randomUUID(), profileNodeId, profileRevisionId, resolvedContentHash(profileContent), JSON.stringify(profileContent)])
    await dataSource.query(`INSERT INTO cms_source_links(id, source_kind, source_id, source_version, node_id, sync_state, created_at) VALUES ($1, 'resource', $2, 1, $3, 'draft', now())`, [randomUUID(), resourceId, profileNodeId])
    await dataSource.query(`UPDATE cms_active_release SET release_id = $1, version = version + 1 WHERE singleton_key = 'public'`, [releaseId])

    const listing = await request(app.getHttpServer()).get("/api/public/v1/listings/resolve").query({ path: "/catalog", kind: "house" }).expect(200)
    expect(listing.headers["x-robots-tag"]).toBe("noindex, follow")
    expect(listing.body).toMatchObject({ releaseId, totalItems: 1, canonicalPath: "/catalog", items: [{ id: resourceId, title: "Домик «Гнездо»", href: "/resources/gnezdo" }] })
    await request(app.getHttpServer()).get("/api/public/v1/listings/resolve").query({ path: "/catalog", internal: "true" }).expect(400)
  })

  it("shares one house price editor across CRM and CMS and persists immutable quote provenance", async () => {
    const stay = futureStayDates()
    const calendarId = randomUUID()
    const offeringId = randomUUID()
    await dataSource.getRepository(BusinessCalendarEntity).save({
      id: calendarId, code: "RU-2026-P45B", name: "Производственный календарь 2026",
      timezone: "Europe/Moscow", countryCode: "RU", source: "official_ru",
      sourceVersion: "ru-2026-test", state: "active", importedAt: new Date("2026-08-01T00:00:00.000Z"),
      coverageFrom: stay.pricingStartDate, coverageToExclusive: stay.coverageEndDate, contentHash: "c".repeat(64),
      createdBy: adminId, updatedBy: adminId, archivedAt: null,
    })
    await dataSource.getRepository(BusinessCalendarDateEntity).save([
      { id: randomUUID(), calendarId, localDate: stay.pricingStartDate, officialClass: "weekday", officialLabel: null, sourceVersion: "ru-2026-test", createdBy: adminId, updatedBy: adminId, archivedAt: null },
      { id: randomUUID(), calendarId, localDate: stay.arrivalDate, officialClass: "weekday", officialLabel: null, sourceVersion: "ru-2026-test", createdBy: adminId, updatedBy: adminId, archivedAt: null },
      { id: randomUUID(), calendarId, localDate: stay.middleDate, officialClass: "holiday", officialLabel: "Тестовый праздник", sourceVersion: "ru-2026-test", createdBy: adminId, updatedBy: adminId, archivedAt: null },
      { id: randomUUID(), calendarId, localDate: stay.departureDate, officialClass: "weekday", officialLabel: null, sourceVersion: "ru-2026-test", createdBy: adminId, updatedBy: adminId, archivedAt: null },
    ])
    await dataSource.getRepository(CatalogOfferingEntity).save({
      id: offeringId, code: "HOUSE-P45B", kind: "house", operationalName: "Домик P4.5B",
      internalComment: "integration", state: "active", subjectVersion: 1, pricingVersion: 1,
      addonAssignmentsVersion: 1, salesMode: "quoted", priceDisplayMode: "exact",
      currency: "RUB", timezone: "Europe/Moscow", taxMode: "not_taxable",
      businessCalendarId: calendarId, leadDirection: "houses", defaultAssigneeId: null,
      scope: null, ownerOfferingId: null, activePriceBookId: null,
      createdBy: adminId, updatedBy: adminId, archivedAt: null,
    })
    const primaryResourceId = randomUUID()
    await dataSource.getRepository(ResourceEntity).save({
      id: primaryResourceId, code: "R-HOUSE-P45B", kind: "house", name: "Ресурс домика P4.5B",
      capacityMode: "shared", capacityTotal: 2, settings: {}, createdBy: adminId, updatedBy: adminId, archivedAt: null,
    })
    await dataSource.getRepository(OfferingBindingEntity).save({
      id: randomUUID(), offeringId, resourceId: primaryResourceId, resourceGroupId: null, programTemplateId: null,
      eventServiceTemplateId: null, role: "primary", quantityDefault: 1, capacityImpactDefault: 1,
      preparationBeforeMinutes: 0, preparationAfterMinutes: 0, availabilityRequired: true,
      createdBy: adminId, updatedBy: adminId, archivedAt: null,
    })
    expect((await dataSource.getRepository(CatalogOfferingEntity).findOneByOrFail({ id: offeringId })).pricingVersion).toBe(1)

    const operationId = randomUUID()
    const draftInput = {
      operationId,
      idempotencyKey: "house-price-draft-integration-0001",
      expectedPricingVersion: 1,
      supersedesPriceBookId: null,
      name: "Домики — сентябрь 2026",
      validFrom: stay.pricingStartDate,
      validToExclusive: stay.coverageEndDate,
      changeReason: "Первый house slice",
      ratePlans: [{
        key: "standard", label: "Стандарт", pricingBasis: "per_night",
        quantityMetric: "guests", baseAmount: 10_000, includedQuantity: 2,
        baseExtraUnitAmount: 1_000, minQuantity: 1, maxQuantity: 6,
        minDurationMinutes: null, maxDurationMinutes: null, isDefault: true, displayOrder: 0,
        rules: [
          { dateSelector: { type: "calendar_holiday" }, quantityRange: null, bookingLeadDays: null, durationMinutes: null, amount: 15_000, extraUnitAmount: null, priority: 10, reason: "Праздник", enabled: true },
          { dateSelector: { type: "custom_date_override", from: stay.middleDate, toExclusive: stay.departureDate, label: "Ручная дата" }, quantityRange: null, bookingLeadDays: null, durationMinutes: null, amount: 17_000, extraUnitAmount: null, priority: 10, reason: "Ручной override", enabled: true },
        ],
      }],
    }
    const created = await adminAgent.post(`/api/internal/v1/offerings/${offeringId}/price-books/drafts`).send(draftInput)
    expect(created.status, JSON.stringify(created.body)).toBe(201)
    expect(created.body).toMatchObject({ pricingVersion: 2, priceBook: { state: "draft", ratePlans: [{ key: "standard" }] } })
    const priceBookId = created.body.priceBook.id as string
    const replay = await adminAgent.post(`/api/admin/v1/offerings/${offeringId}/price-books/drafts`).send(draftInput).expect(201)
    expect(replay.body).toEqual(created.body)
    expect((await adminAgent.get(`/api/admin/v1/offerings/${offeringId}/editor`).expect(200)).body).toMatchObject({
      offering: { id: offeringId, kind: "house" }, ownerVersions: { pricing: 2, draftPriceBook: { id: priceBookId } },
      capabilities: { catalog: { canEdit: false }, pricing: { canEditDraft: true, canActivate: true } },
    })

    const activated = await adminAgent.post(`/api/admin/v1/offerings/${offeringId}/price-books/${priceBookId}/activate`).send({
      operationId: randomUUID(), idempotencyKey: "house-price-activate-integration-0001", expectedPricingVersion: 2, reason: "Проверено",
    })
    expect(activated.status, JSON.stringify(activated.body)).toBe(200)
    expect(activated.body).toMatchObject({ pricingVersion: 3, priceBook: { id: priceBookId, state: "active" } })

    const quoteInput = {
      operationId: randomUUID(), idempotencyKey: "house-quote-integration-0001", ratePlanKey: null,
      period: { type: "stay", arrivalDate: stay.arrivalDate, departureDate: stay.departureDate },
      quantities: { guests: 3, participants: null, units: 1 }, currency: "RUB", addOns: [],
    }
    const [quoted, quoteReplay] = await Promise.all([
      adminAgent.post(`/api/internal/v1/offerings/${offeringId}/quotes/preview`).send(quoteInput).expect(200),
      adminAgent.post(`/api/admin/v1/offerings/${offeringId}/quotes/preview`).send(quoteInput).expect(200),
    ])
    expect(quoted.body).toMatchObject({
      offeringId, immutableSnapshot: true, total: { amountMinor: 29_000, currency: "RUB" },
      lines: [{ serviceDate: stay.arrivalDate, amount: { amountMinor: 11_000 } }, { serviceDate: stay.middleDate, amount: { amountMinor: 18_000 } }],
      provenance: { pricingVersion: 3, priceBookId, businessCalendarId: calendarId },
    })
    expect(quoteReplay.body).toEqual(quoted.body)
    expect(await dataSource.getRepository(OfferingQuoteSnapshotEntity).countBy({ offeringId })).toBe(1)
    expect((await dataSource.getRepository(OfferingQuoteSnapshotEntity).findOneByOrFail({ id: quoted.body.quoteId })).operationalContext).toMatchObject({
      kind: "house_stay", subjectVersion: 1, primaryResourceId,
    })

    const resourceQuoteInput = {
      operationId: randomUUID(), idempotencyKey: "resource-quote-preview-integration-0001",
      arrivalDate: stay.arrivalDate, departureDate: stay.departureDate, quantity: 3, currency: "RUB",
    }
    const [resourceQuoted, resourceQuoteReplay] = await Promise.all([
      adminAgent.post(`/api/internal/v1/offerings/by-resource/${primaryResourceId}/quotes/preview`).send(resourceQuoteInput).expect(200),
      adminAgent.post(`/api/admin/v1/offerings/by-resource/${primaryResourceId}/quotes/preview`).send(resourceQuoteInput).expect(200),
    ])
    expect(resourceQuoted.body).toMatchObject({
      offeringId, immutableSnapshot: true, total: { amountMinor: 29_000, currency: "RUB" },
    })
    expect(resourceQuoteReplay.body).toEqual(resourceQuoted.body)
    expect(await dataSource.getRepository(OfferingQuoteSnapshotEntity).countBy({ offeringId })).toBe(2)

    const addOnOfferingId = randomUUID()
    const addOnPriceBookId = randomUUID()
    const addOnAssignmentId = randomUUID()
    await dataSource.getRepository(CatalogOfferingEntity).save({
      id: addOnOfferingId, code: `ADDON-BOOKING-${addOnOfferingId.slice(0, 8)}`, kind: "addon", operationalName: "Трансфер от станции",
      internalComment: "integration", state: "active", subjectVersion: 1, pricingVersion: 2, addonAssignmentsVersion: 1,
      salesMode: "selectable", priceDisplayMode: "exact", currency: "RUB", timezone: "Europe/Moscow", taxMode: "tax_included",
      businessCalendarId: calendarId, leadDirection: "services", defaultAssigneeId: null, scope: "reusable", ownerOfferingId: null,
      activePriceBookId: null, createdBy: adminId, updatedBy: adminId, archivedAt: null,
    })
    await dataSource.getRepository(AddonOfferingTermsEntity).save({
      offeringId: addOnOfferingId, offeringKind: "addon", serviceType: "quantity_service", standalone: true, categoryKey: "transfer",
      applicableOfferingKinds: ["house", "campground"], minimumQuantity: 1, maximumQuantity: 4, defaultQuantity: 1, quantityStep: 1,
      createdAt: new Date(), createdBy: adminId,
    })
    await dataSource.getRepository(PriceBookEntity).save({
      id: addOnPriceBookId, offeringId: addOnOfferingId, revision: 1, name: "Трансфер", currency: "RUB", timezone: "Europe/Moscow",
      state: "draft", validFrom: stay.pricingStartDate, validToExclusive: stay.coverageEndDate, supersedesPriceBookId: null,
      changeReason: "integration", scheduledActivationAt: null, scheduledBy: null, activatedAt: null, activatedBy: null,
      retiredAt: null, retiredBy: null, createdBy: adminId, updatedBy: adminId, archivedAt: null,
    })
    await dataSource.getRepository(RatePlanEntity).save({
      id: randomUUID(), priceBookId: addOnPriceBookId, key: "standard", label: "Одна поездка", pricingBasis: "per_unit",
      baseAmountMinor: 5_000, baseExtraUnitAmountMinor: null, quantityMetric: "units", includedQuantity: null,
      minimumQuantity: null, maximumQuantity: null, minimumDurationMinutes: null, maximumDurationMinutes: null,
      sortOrder: 0, isDefault: true, createdBy: adminId, updatedBy: adminId, archivedAt: null,
    })
    await dataSource.getRepository(PriceBookEntity).update({ id: addOnPriceBookId }, { state: "active", activatedAt: new Date(), activatedBy: adminId })
    await dataSource.getRepository(CatalogOfferingEntity).update({ id: addOnOfferingId }, { activePriceBookId: addOnPriceBookId })
    await dataSource.getRepository(OfferingAddonAssignmentEntity).save({
      id: addOnAssignmentId, offeringId, addonOfferingId: addOnOfferingId, addonOfferingKind: "addon", enabled: true,
      required: false, recommended: true, groupKey: "transfer", minimumQuantity: 1, maximumQuantity: 3, defaultQuantity: 1,
      displayOrder: 10, labelOverride: "Трансфер от станции", descriptionOverride: null, ratePlanKeyOverride: null,
      createdBy: adminId, updatedBy: adminId, archivedAt: null,
    })
    const compositeQuote = await adminAgent.post(`/api/internal/v1/offerings/by-resource/${primaryResourceId}/quotes/preview`).send({
      ...resourceQuoteInput,
      operationId: randomUUID(),
      idempotencyKey: `resource-addon-quote-${randomUUID()}`,
      addOns: [{ assignmentId: addOnAssignmentId, quantity: 2 }],
    }).expect(200)
    expect(compositeQuote.body).toMatchObject({
      total: { amountMinor: 39_000, currency: "RUB" },
      lines: expect.arrayContaining([expect.objectContaining({ kind: "addon", label: "Трансфер от станции", quantity: 2, amount: { amountMinor: 10_000, currency: "RUB" }, addOnAssignmentId, addOnOfferingId })]),
      provenance: { addOns: [{ assignmentId: addOnAssignmentId, addOnOfferingId, serviceType: "quantity_service", priceBookId: addOnPriceBookId }] },
    })

    const breakfastOfferingId = randomUUID()
    const breakfastPriceBookId = randomUUID()
    const breakfastAssignmentId = randomUUID()
    await dataSource.getRepository(CatalogOfferingEntity).save({
      id: breakfastOfferingId, code: `ADDON-BREAKFAST-${breakfastOfferingId.slice(0, 8)}`, kind: "addon", operationalName: "Завтрак в корзине",
      internalComment: "integration", state: "active", subjectVersion: 1, pricingVersion: 2, addonAssignmentsVersion: 1,
      salesMode: "selectable", priceDisplayMode: "exact", currency: "RUB", timezone: "Europe/Moscow", taxMode: "tax_included",
      businessCalendarId: calendarId, leadDirection: "services", defaultAssigneeId: null, scope: "reusable", ownerOfferingId: null,
      activePriceBookId: null, createdBy: adminId, updatedBy: adminId, archivedAt: null,
    })
    await dataSource.getRepository(AddonOfferingTermsEntity).save({
      offeringId: breakfastOfferingId, offeringKind: "addon", serviceType: "person_service", standalone: true, categoryKey: "catering",
      applicableOfferingKinds: ["house", "campground"], minimumQuantity: 1, maximumQuantity: 6, defaultQuantity: 4, quantityStep: 1,
      createdAt: new Date(), createdBy: adminId,
    })
    await dataSource.getRepository(PriceBookEntity).save({
      id: breakfastPriceBookId, offeringId: breakfastOfferingId, revision: 1, name: "Завтрак", currency: "RUB", timezone: "Europe/Moscow",
      state: "draft", validFrom: stay.pricingStartDate, validToExclusive: stay.coverageEndDate, supersedesPriceBookId: null,
      changeReason: "integration", scheduledActivationAt: null, scheduledBy: null, activatedAt: null, activatedBy: null,
      retiredAt: null, retiredBy: null, createdBy: adminId, updatedBy: adminId, archivedAt: null,
    })
    await dataSource.getRepository(RatePlanEntity).save({
      id: randomUUID(), priceBookId: breakfastPriceBookId, key: "adult", label: "Завтрак на гостя", pricingBasis: "per_person",
      baseAmountMinor: 85_000, baseExtraUnitAmountMinor: null, quantityMetric: "participants", includedQuantity: null,
      minimumQuantity: null, maximumQuantity: null, minimumDurationMinutes: null, maximumDurationMinutes: null,
      sortOrder: 0, isDefault: true, createdBy: adminId, updatedBy: adminId, archivedAt: null,
    })
    await dataSource.getRepository(PriceBookEntity).update({ id: breakfastPriceBookId }, { state: "active", activatedAt: new Date(), activatedBy: adminId })
    await dataSource.getRepository(CatalogOfferingEntity).update({ id: breakfastOfferingId }, { activePriceBookId: breakfastPriceBookId })
    await dataSource.getRepository(OfferingAddonAssignmentEntity).save({
      id: breakfastAssignmentId, offeringId, addonOfferingId: breakfastOfferingId, addonOfferingKind: "addon", enabled: true,
      required: false, recommended: true, groupKey: "food", minimumQuantity: 1, maximumQuantity: 6, defaultQuantity: 4,
      displayOrder: 20, labelOverride: null, descriptionOverride: null, ratePlanKeyOverride: "adult",
      createdBy: adminId, updatedBy: adminId, archivedAt: null,
    })
    const breakfastQuote = await adminAgent.post(`/api/internal/v1/offerings/by-resource/${primaryResourceId}/quotes/preview`).send({
      ...resourceQuoteInput,
      operationId: randomUUID(),
      idempotencyKey: `resource-breakfast-quote-${randomUUID()}`,
      addOns: [{ assignmentId: breakfastAssignmentId, quantity: 3 }],
    }).expect(200)
    expect(breakfastQuote.body).toMatchObject({
      total: { amountMinor: 284_000, currency: "RUB" },
      lines: expect.arrayContaining([expect.objectContaining({ kind: "addon", label: "Завтрак в корзине", quantity: 3, amount: { amountMinor: 255_000, currency: "RUB" }, addOnAssignmentId: breakfastAssignmentId, addOnOfferingId: breakfastOfferingId })]),
      provenance: { addOns: [{ assignmentId: breakfastAssignmentId, addOnOfferingId: breakfastOfferingId, serviceType: "person_service", priceBookId: breakfastPriceBookId }] },
    })

    const customerId = randomUUID()
    await dataSource.getRepository(CustomerEntity).save({
      id: customerId, type: "person", name: "Quote acceptance customer", phones: [], channels: [], email: null, notes: "", consent: {}, duplicateRisk: "none", assignees: [],
      leadCount: 0, activeLeadCount: 0, bookingCount: 0, futureBookingCount: 0, taskCount: 0, turnover: 0, debt: 0, nextContactAt: null, lastVisitAt: null,
      createdBy: adminId, updatedBy: adminId, archivedAt: null,
    })
    await adminAgent.post("/api/internal/v1/marketing/promotions").send({
      operationId: randomUUID(), idempotencyKey: `addon-promotion-${randomUUID()}`,
      terms: { code: "TRANSFER10", name: "Скидка только на трансфер", active: true, discountType: "percent", value: 10, minimumAmountMinor: 0, startsAt: null, endsAt: null, scope: "selected", resourceIds: [], offeringIds: [addOnOfferingId] },
    }).expect(201)
    const bookingWithAddOn = await adminAgent.post("/api/internal/v1/bookings").send({
      promoCode: "TRANSFER10",
      operationId: randomUUID(), idempotencyKey: `booking-with-addon-${randomUUID()}`, overrideConflict: false, customerId,
      items: [{
        type: "accommodation", resourceId: primaryResourceId,
        startAt: `${stay.arrivalDate}T09:00:00.000Z`, endAt: `${stay.departureDate}T09:00:00.000Z`, quantity: 3,
        price: { amountMinor: 39_000, currency: "RUB" }, discount: { amountMinor: 0, currency: "RUB" }, preparationMinutes: 0,
        quoteSnapshotId: compositeQuote.body.quoteId, addOns: [{ assignmentId: addOnAssignmentId, quantity: 2 }],
      }], note: null,
    })
    expect(bookingWithAddOn.status, JSON.stringify(bookingWithAddOn.body)).toBe(201)
    expect(bookingWithAddOn.body.total.amountMinor).toBe(38_000)
    expect(bookingWithAddOn.body.promotion).toMatchObject({ eligibleAmountMinor: 10_000, discountAmountMinor: 1_000 })
    expect(bookingWithAddOn.body.items[0]).toMatchObject({
      quoteSnapshotId: compositeQuote.body.quoteId,
      addOns: [{ assignmentId: addOnAssignmentId, addOnOfferingId, label: "Трансфер от станции", serviceType: "quantity_service", quantity: 2, price: { amountMinor: 10_000, currency: "RUB" } }],
    })
    expect(await dataSource.getRepository(BookingItemEntity).findOneByOrFail({ id: bookingWithAddOn.body.items[0].id })).toMatchObject({ quoteSnapshotId: compositeQuote.body.quoteId })
    const unchangedComposition = await adminAgent.patch(`/api/internal/v1/bookings/${bookingWithAddOn.body.id}`).send({
      operationId: randomUUID(), idempotencyKey: `booking-with-addon-note-${randomUUID()}`, expectedVersion: bookingWithAddOn.body.version,
      customerId, note: "Комментарий после истечения расчёта", assignees: [], overrideConflict: false,
      items: bookingWithAddOn.body.items.map((item: { type: string; resourceId: string | null; startAt: string; endAt: string; quantity: number; price: { amountMinor: number; currency: string }; discount: { amountMinor: number; currency: string }; preparationMinutes: number; quoteSnapshotId: string; addOns: Array<{ assignmentId: string; quantity: number }> }) => ({
        type: item.type, resourceId: item.resourceId, startAt: item.startAt, endAt: item.endAt, quantity: item.quantity,
        price: item.price, discount: item.discount, preparationMinutes: item.preparationMinutes,
        quoteSnapshotId: item.quoteSnapshotId, addOns: item.addOns.map((addOn) => ({ assignmentId: addOn.assignmentId, quantity: addOn.quantity })),
      })),
    }).expect(200)
    expect(unchangedComposition.body.items[0].id).toBe(bookingWithAddOn.body.items[0].id)
    const addOnUnconfirmed = await adminAgent.post(`/api/internal/v1/bookings/${bookingWithAddOn.body.id}/transition`).send({
      operationId: randomUUID(), idempotencyKey: `booking-with-addon-unconfirmed-${randomUUID()}`,
      expectedVersion: unchangedComposition.body.version, status: "unconfirmed",
    }).expect(201)
    const addOnConfirmed = await adminAgent.post(`/api/internal/v1/bookings/${bookingWithAddOn.body.id}/transition`).send({
      operationId: randomUUID(), idempotencyKey: `booking-with-addon-confirmed-${randomUUID()}`,
      expectedVersion: addOnUnconfirmed.body.version, status: "confirmed",
      quoteAcceptances: [{ quoteSnapshotId: compositeQuote.body.quoteId, bookingItemId: bookingWithAddOn.body.items[0].id }],
    }).expect(201)
    expect(addOnConfirmed.body.status).toBe("confirmed")
    expect(addOnConfirmed.body.total.amountMinor).toBe(38_000)
    expect(addOnConfirmed.body.items[0].price.amountMinor).toBe(39_000)
    await adminAgent.patch(`/api/internal/v1/bookings/${bookingWithAddOn.body.id}`).send({ promoCode: null, expectedVersion: addOnConfirmed.body.version, operationId: randomUUID(), idempotencyKey: `confirmed-promo-remove-${randomUUID()}` }).expect(409)
    expect(await dataSource.getRepository(AcceptedOfferingQuoteLinkEntity).findOneByOrFail({ quoteSnapshotId: compositeQuote.body.quoteId })).toMatchObject({ bookingItemId: bookingWithAddOn.body.items[0].id })
    const immutableComposition = await adminAgent.patch(`/api/internal/v1/bookings/${bookingWithAddOn.body.id}`).send({
      operationId: randomUUID(), idempotencyKey: `booking-with-addon-mutated-${randomUUID()}`, expectedVersion: addOnConfirmed.body.version,
      customerId, note: null, assignees: [], overrideConflict: true,
      items: [{
        type: "accommodation", resourceId: primaryResourceId,
        startAt: `${stay.arrivalDate}T09:00:00.000Z`, endAt: `${stay.departureDate}T09:00:00.000Z`, quantity: 2,
        price: { amountMinor: 39_000, currency: "RUB" }, discount: { amountMinor: 0, currency: "RUB" }, preparationMinutes: 0,
        quoteSnapshotId: compositeQuote.body.quoteId, addOns: [{ assignmentId: addOnAssignmentId, quantity: 2 }],
      }],
    }).expect(409)
    expect(immutableComposition.body.code).toBe("BOOKING_ACCEPTED_QUOTE_IMMUTABLE")
    await adminAgent.post(`/api/internal/v1/bookings/${bookingWithAddOn.body.id}/transition`).send({
      operationId: randomUUID(), idempotencyKey: `booking-with-addon-cancel-${randomUUID()}`,
      expectedVersion: addOnConfirmed.body.version, status: "cancelled",
    }).expect(201)
    const booking = await adminAgent.post("/api/internal/v1/bookings").send({
      operationId: randomUUID(), idempotencyKey: "quote-acceptance-booking-create-0001", overrideConflict: true, customerId,
      items: [{ type: "accommodation", resourceId: primaryResourceId, startAt: `${stay.arrivalDate}T09:00:00.000Z`, endAt: `${stay.departureDate}T09:00:00.000Z`, quantity: 3, price: { amountMinor: 29_000, currency: "RUB" }, discount: { amountMinor: 0, currency: "RUB" }, preparationMinutes: 0 }], note: null,
    }).expect(201)
    const unconfirmed = await adminAgent.post(`/api/internal/v1/bookings/${booking.body.id}/transition`).send({
      operationId: randomUUID(), idempotencyKey: "quote-acceptance-unconfirmed-0001", expectedVersion: booking.body.version, status: "unconfirmed",
    }).expect(201)
    const acceptanceInput = {
      operationId: randomUUID(), idempotencyKey: "quote-acceptance-confirm-0001", expectedVersion: unconfirmed.body.version, status: "confirmed",
      quoteAcceptances: [{ quoteSnapshotId: quoted.body.quoteId, bookingItemId: booking.body.items[0].id }],
    }
    const confirmed = await adminAgent.post(`/api/internal/v1/bookings/${booking.body.id}/transition`).send(acceptanceInput).expect(201)
    const acceptedLink = await dataSource.getRepository(AcceptedOfferingQuoteLinkEntity).findOneByOrFail({ quoteSnapshotId: quoted.body.quoteId })
    expect(confirmed.body).toMatchObject({ status: "confirmed", version: unconfirmed.body.version + 1 })
    expect(acceptedLink).toMatchObject({ bookingItemId: booking.body.items[0].id, targetVersion: confirmed.body.version, acceptedBy: adminId })
    expect((await adminAgent.post(`/api/internal/v1/bookings/${booking.body.id}/transition`).send(acceptanceInput).expect(201)).body).toEqual(confirmed.body)
    await adminAgent.post(`/api/internal/v1/bookings/${booking.body.id}/transition`).send({ ...acceptanceInput, operationId: randomUUID() }).expect(409)
    expect(await dataSource.getRepository(OutboxEventEntity).countBy({ topic: "crm.operational_quote.accepted", aggregateId: booking.body.items[0].id })).toBe(1)
    await expect(dataSource.query("UPDATE accepted_offering_quote_links SET request_id = 'tampered' WHERE id = $1", [acceptedLink.id])).rejects.toThrow(/immutable/i)
    const cancelled = await adminAgent.post(`/api/internal/v1/bookings/${booking.body.id}/transition`).send({
      operationId: randomUUID(), idempotencyKey: "quote-acceptance-cancel-0001", expectedVersion: confirmed.body.version, status: "cancelled",
    }).expect(201)
    expect(cancelled.body.status).toBe("cancelled")
    expect(await dataSource.getRepository(AcceptedOfferingQuoteLinkEntity).countBy({ quoteSnapshotId: quoted.body.quoteId })).toBe(1)

    const sourceQuote = await dataSource.getRepository(OfferingQuoteSnapshotEntity).findOneByOrFail({ id: quoted.body.quoteId })
    const cloneQuote = async (validUntil: Date) => {
      const id = randomUUID()
      await dataSource.getRepository(OfferingQuoteSnapshotEntity).save({
        ...sourceQuote, id, validUntil, calculatedAt: validUntil <= new Date() ? new Date(validUntil.getTime() - 1_000) : sourceQuote.calculatedAt, operationId: randomUUID(), idempotencyKey: `acceptance-clone-${id}`,
        resultPayload: { ...sourceQuote.resultPayload, quoteId: id }, createdAt: undefined as unknown as Date,
      })
      return id
    }
    const createUnconfirmed = async (key: string, priceAmount = 29_000, overrideConflict = false) => {
      const created = await adminAgent.post("/api/internal/v1/bookings").send({
        operationId: randomUUID(), idempotencyKey: `${key}-create`, overrideConflict, customerId,
        items: [{ type: "accommodation", resourceId: primaryResourceId, startAt: `${stay.arrivalDate}T09:00:00.000Z`, endAt: `${stay.departureDate}T09:00:00.000Z`, quantity: 3, price: { amountMinor: priceAmount, currency: "RUB" }, discount: { amountMinor: 0, currency: "RUB" }, preparationMinutes: 0 }], note: null,
      }).expect(201)
      const prepared = await adminAgent.post(`/api/internal/v1/bookings/${created.body.id}/transition`).send({ operationId: randomUUID(), idempotencyKey: `${key}-unconfirmed`, expectedVersion: created.body.version, status: "unconfirmed" }).expect(201)
      return { created, prepared }
    }
    // The quote lock is acquired before the service samples the database clock.
    // Holding it past validity proves a long-running SERIALIZABLE transaction
    // cannot accept based on its start timestamp.
    const clockQuoteId = await cloneQuote(new Date(Date.now() + 250))
    const clockBooking = await createUnconfirmed("quote-acceptance-clock")
    const quoteLock = dataSource.createQueryRunner()
    await quoteLock.connect()
    await quoteLock.startTransaction()
    await quoteLock.query("SELECT id FROM offering_quote_snapshots WHERE id = $1 FOR UPDATE", [clockQuoteId])
    const delayedAcceptance = adminAgent.post(`/api/internal/v1/bookings/${clockBooking.created.body.id}/transition`).send({
      operationId: randomUUID(), idempotencyKey: "quote-acceptance-clock-confirm", expectedVersion: clockBooking.prepared.body.version, status: "confirmed",
      quoteAcceptances: [{ quoteSnapshotId: clockQuoteId, bookingItemId: clockBooking.created.body.items[0].id }],
    }).then((response) => response)
    await new Promise<void>((resolve) => setTimeout(resolve, 500))
    await quoteLock.commitTransaction()
    await quoteLock.release()
    const delayed = await delayedAcceptance
    expect(delayed.status).toBe(422)
    expect(delayed.body.code).toBe("QUOTE_EXPIRED")
    expect(await dataSource.getRepository(BookingEntity).findOneByOrFail({ id: clockBooking.created.body.id })).toMatchObject({ status: "unconfirmed", version: clockBooking.prepared.body.version })
    await adminAgent.post(`/api/internal/v1/bookings/${clockBooking.created.body.id}/transition`).send({ operationId: randomUUID(), idempotencyKey: "quote-acceptance-clock-cancel", expectedVersion: clockBooking.prepared.body.version, status: "cancelled" }).expect(201)

    const expiredQuoteId = await cloneQuote(new Date("2000-01-01T00:00:00.000Z"))
    const expiredBooking = await createUnconfirmed("quote-acceptance-expired")
    const expired = await adminAgent.post(`/api/internal/v1/bookings/${expiredBooking.created.body.id}/transition`).send({
      operationId: randomUUID(), idempotencyKey: "quote-acceptance-expired-confirm", expectedVersion: expiredBooking.prepared.body.version, status: "confirmed",
      quoteAcceptances: [{ quoteSnapshotId: expiredQuoteId, bookingItemId: expiredBooking.created.body.items[0].id }],
    }).expect(422)
    expect(expired.body.code).toBe("QUOTE_EXPIRED")
    expect(await dataSource.getRepository(BookingEntity).findOneByOrFail({ id: expiredBooking.created.body.id })).toMatchObject({ status: "unconfirmed", version: expiredBooking.prepared.body.version })
    await adminAgent.post(`/api/internal/v1/bookings/${expiredBooking.created.body.id}/transition`).send({ operationId: randomUUID(), idempotencyKey: "quote-acceptance-expired-cancel", expectedVersion: expiredBooking.prepared.body.version, status: "cancelled" }).expect(201)

    const mismatchQuoteId = await cloneQuote(new Date(Date.now() + 60 * 60 * 1000))
    const mismatchBooking = await createUnconfirmed("quote-acceptance-mismatch", 28_999)
    const mismatch = await adminAgent.post(`/api/internal/v1/bookings/${mismatchBooking.created.body.id}/transition`).send({
      operationId: randomUUID(), idempotencyKey: "quote-acceptance-mismatch-confirm", expectedVersion: mismatchBooking.prepared.body.version, status: "confirmed",
      quoteAcceptances: [{ quoteSnapshotId: mismatchQuoteId, bookingItemId: mismatchBooking.created.body.items[0].id }],
    }).expect(422)
    expect(mismatch.body.code).toBe("QUOTE_AMOUNT_MISMATCH")
    expect(await dataSource.getRepository(BookingEntity).findOneByOrFail({ id: mismatchBooking.created.body.id })).toMatchObject({ status: "unconfirmed", version: mismatchBooking.prepared.body.version })
    await adminAgent.post(`/api/internal/v1/bookings/${mismatchBooking.created.body.id}/transition`).send({ operationId: randomUUID(), idempotencyKey: "quote-acceptance-mismatch-cancel", expectedVersion: mismatchBooking.prepared.body.version, status: "cancelled" }).expect(201)

    const racedQuoteId = await cloneQuote(new Date(Date.now() + 60 * 60 * 1000))
    // The race under test starts at quote acceptance. Create the two bookings
    // sequentially so the fixed-resource exclusion constraint cannot fail first.
    const raceLeft = await createUnconfirmed("quote-acceptance-race-left", 29_000, true)
    const raceRight = await createUnconfirmed("quote-acceptance-race-right", 29_000, true)
    const [leftAcceptance, rightAcceptance] = await Promise.all([
      adminAgent.post(`/api/internal/v1/bookings/${raceLeft.created.body.id}/transition`).send({ operationId: randomUUID(), idempotencyKey: "quote-acceptance-race-left-confirm", expectedVersion: raceLeft.prepared.body.version, status: "confirmed", quoteAcceptances: [{ quoteSnapshotId: racedQuoteId, bookingItemId: raceLeft.created.body.items[0].id }] }),
      adminAgent.post(`/api/internal/v1/bookings/${raceRight.created.body.id}/transition`).send({ operationId: randomUUID(), idempotencyKey: "quote-acceptance-race-right-confirm", expectedVersion: raceRight.prepared.body.version, status: "confirmed", quoteAcceptances: [{ quoteSnapshotId: racedQuoteId, bookingItemId: raceRight.created.body.items[0].id }] }),
    ])
    expect([leftAcceptance.status, rightAcceptance.status].sort()).toEqual([201, 422])
    expect(await dataSource.getRepository(AcceptedOfferingQuoteLinkEntity).countBy({ quoteSnapshotId: racedQuoteId })).toBe(1)
    const race = [{ response: leftAcceptance, booking: raceLeft }, { response: rightAcceptance, booking: raceRight }]
    const losingRace = race.find((entry) => entry.response.status === 422)!
    expect(await dataSource.getRepository(BookingEntity).findOneByOrFail({ id: losingRace.booking.created.body.id })).toMatchObject({ status: "unconfirmed", version: losingRace.booking.prepared.body.version })

    for (const entry of race) {
      const current = await dataSource.getRepository(BookingEntity).findOneByOrFail({ id: entry.booking.created.body.id })
      await adminAgent.post(`/api/internal/v1/bookings/${current.id}/transition`).send({ operationId: randomUUID(), idempotencyKey: `quote-acceptance-race-cancel-${current.id}`, expectedVersion: current.version, status: "cancelled" }).expect(201)
    }
    const batchQuotes = await Promise.all(Array.from({ length: 4 }, () => cloneQuote(new Date(Date.now() + 60 * 60 * 1000))))
    const createMultiUnconfirmed = async (key: string) => {
      const created = await adminAgent.post("/api/internal/v1/bookings").send({
        operationId: randomUUID(), idempotencyKey: `${key}-create`, overrideConflict: true, customerId,
        items: [0, 1].map(() => ({ type: "accommodation", resourceId: primaryResourceId, startAt: `${stay.arrivalDate}T09:00:00.000Z`, endAt: `${stay.departureDate}T09:00:00.000Z`, quantity: 3, price: { amountMinor: 29_000, currency: "RUB" }, discount: { amountMinor: 0, currency: "RUB" }, preparationMinutes: 0 })), note: null,
      }).expect(201)
      const prepared = await adminAgent.post(`/api/internal/v1/bookings/${created.body.id}/transition`).send({ operationId: randomUUID(), idempotencyKey: `${key}-unconfirmed`, expectedVersion: created.body.version, status: "unconfirmed" }).expect(201)
      return { created, prepared }
    }
    const batchLeft = await createMultiUnconfirmed("quote-acceptance-batch-left")
    const batchRight = await createMultiUnconfirmed("quote-acceptance-batch-right")
    const [batchLeftResult, batchRightResult] = await Promise.all([
      adminAgent.post(`/api/internal/v1/bookings/${batchLeft.created.body.id}/transition`).send({ operationId: randomUUID(), idempotencyKey: "quote-acceptance-batch-left-confirm", expectedVersion: batchLeft.prepared.body.version, status: "confirmed", quoteAcceptances: [{ quoteSnapshotId: batchQuotes[1], bookingItemId: batchLeft.created.body.items[1].id }, { quoteSnapshotId: batchQuotes[0], bookingItemId: batchLeft.created.body.items[0].id }] }),
      adminAgent.post(`/api/internal/v1/bookings/${batchRight.created.body.id}/transition`).send({ operationId: randomUUID(), idempotencyKey: "quote-acceptance-batch-right-confirm", expectedVersion: batchRight.prepared.body.version, status: "confirmed", quoteAcceptances: [{ quoteSnapshotId: batchQuotes[3], bookingItemId: batchRight.created.body.items[1].id }, { quoteSnapshotId: batchQuotes[2], bookingItemId: batchRight.created.body.items[0].id }] }),
    ])
    expect([batchLeftResult.status, batchRightResult.status], JSON.stringify([batchLeftResult.body, batchRightResult.body])).toEqual([201, 201])
    expect(await dataSource.getRepository(AcceptedOfferingQuoteLinkEntity).countBy({ quoteSnapshotId: batchQuotes[0]! })).toBe(1)
    expect(await dataSource.getRepository(AcceptedOfferingQuoteLinkEntity).countBy({ quoteSnapshotId: batchQuotes[1]! })).toBe(1)
    expect(await dataSource.getRepository(AcceptedOfferingQuoteLinkEntity).countBy({ quoteSnapshotId: batchQuotes[2]! })).toBe(1)
    expect(await dataSource.getRepository(AcceptedOfferingQuoteLinkEntity).countBy({ quoteSnapshotId: batchQuotes[3]! })).toBe(1)

    // An adversarial X→Y / Y→X fixture. The legacy per-item lock path would
    // reach A then B for the left booking and B then A for the right one.
    const secondOfferingId = randomUUID(), secondResourceId = randomUUID(), secondPriceBookId = randomUUID()
    const sourceBook = await dataSource.getRepository(PriceBookEntity).findOneByOrFail({ id: priceBookId })
    await dataSource.getRepository(CatalogOfferingEntity).save({
      id: secondOfferingId, code: "HOUSE-P45B-DEADLOCK", kind: "house", operationalName: "Домик P4.5B deadlock", internalComment: "", state: "active",
      subjectVersion: 1, pricingVersion: sourceQuote.pricingVersion, addonAssignmentsVersion: sourceQuote.addOnAssignmentsVersion,
      salesMode: "quoted", priceDisplayMode: "exact", currency: "RUB", timezone: "Europe/Moscow", taxMode: "not_taxable",
      businessCalendarId: calendarId, leadDirection: "houses", defaultAssigneeId: null, scope: null, ownerOfferingId: null, activePriceBookId: null,
      createdBy: adminId, updatedBy: adminId, archivedAt: null,
    })
    await dataSource.getRepository(PriceBookEntity).save({
      ...sourceBook, id: secondPriceBookId, offeringId: secondOfferingId, revision: 1, supersedesPriceBookId: null,
      createdBy: adminId, updatedBy: adminId, archivedAt: null,
    })
    await dataSource.getRepository(CatalogOfferingEntity).update({ id: secondOfferingId }, { activePriceBookId: secondPriceBookId })
    await dataSource.getRepository(ResourceEntity).save({ id: secondResourceId, code: "R-HOUSE-P45B-DEADLOCK", kind: "house", name: "Ресурс deadlock", capacityMode: "shared", capacityTotal: 2, settings: {}, createdBy: adminId, updatedBy: adminId, archivedAt: null })
    await dataSource.getRepository(OfferingBindingEntity).save({ id: randomUUID(), offeringId: secondOfferingId, resourceId: secondResourceId, resourceGroupId: null, programTemplateId: null, eventServiceTemplateId: null, role: "primary", quantityDefault: 1, capacityImpactDefault: 1, preparationBeforeMinutes: 0, preparationAfterMinutes: 0, availabilityRequired: true, createdBy: adminId, updatedBy: adminId, archivedAt: null })
    const cloneSecondOfferingQuote = async () => {
      const id = randomUUID()
      await dataSource.getRepository(OfferingQuoteSnapshotEntity).save({
        ...sourceQuote, id, offeringId: secondOfferingId, priceBookId: secondPriceBookId, priceBookVersion: 1, offeringVersion: 1,
        validUntil: new Date(Date.now() + 60 * 60 * 1000), operationId: randomUUID(), idempotencyKey: `deadlock-second-${id}`,
        requestPayload: { ...sourceQuote.requestPayload, offeringId: secondOfferingId },
        resultPayload: { ...sourceQuote.resultPayload, quoteId: id, offeringId: secondOfferingId },
        operationalContext: { kind: "house_stay", subjectVersion: 1, primaryResourceId: secondResourceId, primaryResourceVersion: 1 }, createdAt: undefined as unknown as Date,
      })
      return id
    }
    const [leftAQuote, rightAQuote, leftBQuote, rightBQuote] = await Promise.all([cloneQuote(new Date(Date.now() + 60 * 60 * 1000)), cloneQuote(new Date(Date.now() + 60 * 60 * 1000)), cloneSecondOfferingQuote(), cloneSecondOfferingQuote()])
    const leftBookingId = randomUUID(), rightBookingId = randomUUID()
    const leftAItemId = "10000000-0000-4000-8000-000000000001", leftBItemId = "10000000-0000-4000-8000-000000000002"
    const rightBItemId = "20000000-0000-4000-8000-000000000001", rightAItemId = "20000000-0000-4000-8000-000000000002"
    await dataSource.getRepository(BookingEntity).save([
      { id: leftBookingId, code: "B-DEADLOCK-L", customerId, status: "unconfirmed", currency: "RUB", totalAmount: 58_000, snapshot: {}, createdBy: adminId, updatedBy: adminId, archivedAt: null },
      { id: rightBookingId, code: "B-DEADLOCK-R", customerId, status: "unconfirmed", currency: "RUB", totalAmount: 58_000, snapshot: {}, createdBy: adminId, updatedBy: adminId, archivedAt: null },
    ])
    const makeDeadlockItem = (id: string, bookingId: string, resourceId: string) => ({ id, bookingId, type: "accommodation", resourceId, startAt: new Date(`${stay.arrivalDate}T09:00:00.000Z`), endAt: new Date(`${stay.departureDate}T09:00:00.000Z`), quantity: 3, priceAmount: 29_000, discountAmount: 0, currency: "RUB", preparationMinutes: 0, createdBy: adminId, updatedBy: adminId, archivedAt: null })
    await dataSource.getRepository(BookingItemEntity).save([
      makeDeadlockItem(leftAItemId, leftBookingId, primaryResourceId), makeDeadlockItem(leftBItemId, leftBookingId, secondResourceId),
      makeDeadlockItem(rightBItemId, rightBookingId, secondResourceId), makeDeadlockItem(rightAItemId, rightBookingId, primaryResourceId),
    ])
    const [adversarialLeft, adversarialRight] = await Promise.all([
      adminAgent.post(`/api/internal/v1/bookings/${leftBookingId}/transition`).send({ operationId: randomUUID(), idempotencyKey: "quote-acceptance-deadlock-left", expectedVersion: 1, status: "confirmed", quoteAcceptances: [{ quoteSnapshotId: leftAQuote, bookingItemId: leftAItemId }, { quoteSnapshotId: leftBQuote, bookingItemId: leftBItemId }] }),
      adminAgent.post(`/api/internal/v1/bookings/${rightBookingId}/transition`).send({ operationId: randomUUID(), idempotencyKey: "quote-acceptance-deadlock-right", expectedVersion: 1, status: "confirmed", quoteAcceptances: [{ quoteSnapshotId: rightBQuote, bookingItemId: rightBItemId }, { quoteSnapshotId: rightAQuote, bookingItemId: rightAItemId }] }),
    ])
    expect([adversarialLeft.status, adversarialRight.status]).toEqual([201, 201])
    expect(await dataSource.getRepository(AcceptedOfferingQuoteLinkEntity).countBy({ quoteSnapshotId: leftAQuote })).toBe(1)
    expect(await dataSource.getRepository(AcceptedOfferingQuoteLinkEntity).countBy({ quoteSnapshotId: leftBQuote })).toBe(1)
    expect(await dataSource.getRepository(AcceptedOfferingQuoteLinkEntity).countBy({ quoteSnapshotId: rightAQuote })).toBe(1)
    expect(await dataSource.getRepository(AcceptedOfferingQuoteLinkEntity).countBy({ quoteSnapshotId: rightBQuote })).toBe(1)

    const dbEventId = randomUUID(), dbTemplateId = randomUUID(), dbOccurrenceId = randomUUID(), dbRegistrationId = randomUUID()
    await dataSource.getRepository(EventEntity).save({ id: dbEventId, code: "E-QUOTE-DB-GUARD", name: "DB guard event", categoryId: null, customerId: null, phone: "", startsAt: new Date("2026-10-01T09:00:00.000Z"), endsAt: new Date("2026-10-01T12:00:00.000Z"), guestCount: 1, totalAmount: 0, paidAmount: 0, currency: "RUB", status: "planning", comment: "", requiresAction: false, assigneeIds: [], scenario: [], createdBy: adminId, updatedBy: adminId, archivedAt: null })
    await dataSource.getRepository(ProgramTemplateEntity).save({ id: dbTemplateId, code: "PT-QUOTE-DB-GUARD", name: "DB guard template", categoryId: null, durationMinutes: 60, minimumParticipants: null, participantLimit: 2, registrationCloseHours: null, basePriceAmount: 0, currency: "RUB", description: "", publication: "draft", assigneeIds: [], stages: [], createdBy: adminId, updatedBy: adminId, archivedAt: null })
    await dataSource.getRepository(ProgramOccurrenceEntity).save({ id: dbOccurrenceId, code: "PO-QUOTE-DB-GUARD", templateId: dbTemplateId, name: "DB guard occurrence", startsAt: new Date("2026-10-02T09:00:00.000Z"), endsAt: new Date("2026-10-02T10:00:00.000Z"), participantLimit: 2, registrationLimit: 2, status: "open", currency: "RUB", comment: "", assigneeIds: [], createdBy: adminId, updatedBy: adminId, archivedAt: null })
    await dataSource.getRepository(ProgramRegistrationEntity).save({ id: dbRegistrationId, code: "PR-QUOTE-DB-GUARD", occurrenceId: dbOccurrenceId, customerId: null, phone: "", participantCount: 1, participantNames: "", totalAmount: 0, discountAmount: 0, paidAmount: 0, currency: "RUB", status: "new", promo: "", source: "", comment: "", createdBy: adminId, updatedBy: adminId, archivedAt: null })
    const [bookingGuardQuote, eventGuardQuote, registrationGuardQuote] = await Promise.all([cloneQuote(new Date(Date.now() + 60 * 60 * 1000)), cloneQuote(new Date(Date.now() + 60 * 60 * 1000)), cloneQuote(new Date(Date.now() + 60 * 60 * 1000))])
    const insertGuardedLink = (quoteSnapshotId: string, target: "booking" | "event" | "registration", targetId: string, targetVersion: number) => dataSource.query(`INSERT INTO accepted_offering_quote_links (id, quote_snapshot_id, booking_item_id, event_id, program_registration_id, target_version, accepted_by, operation_id, request_id, entry_surface) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'internal')`, [randomUUID(), quoteSnapshotId, target === "booking" ? targetId : null, target === "event" ? targetId : null, target === "registration" ? targetId : null, targetVersion, adminId, randomUUID(), "direct-db-guard"])
    await expect(insertGuardedLink(bookingGuardQuote, "booking", clockBooking.created.body.items[0].id, clockBooking.prepared.body.version)).rejects.toThrow(/acceptance-compatible/i)
    await expect(insertGuardedLink(eventGuardQuote, "event", dbEventId, 1)).rejects.toThrow(/not implemented/i)
    await expect(insertGuardedLink(registrationGuardQuote, "registration", dbRegistrationId, 1)).rejects.toThrow(/not acceptance-compatible/i)
    expect(await dataSource.getRepository(ChangeLogEntity).countBy({ entityType: "catalog_offering_pricing", entityId: offeringId })).toBe(2)
    await app.get(OutboxDispatcherService).dispatchBatch()
    const remainingOfferingProjectionDeliveries = await dataSource.query(`
      SELECT COUNT(*)::int AS count FROM outbox_deliveries delivery
      JOIN outbox_events event ON event.id = delivery.event_id
      WHERE delivery.consumer = 'public_projection' AND event.aggregate_id = $1
        AND delivery.status <> 'succeeded'
    `, [offeringId]) as Array<{ count: number }>
    expect(remainingOfferingProjectionDeliveries[0]?.count).toBe(0)
    await expect(dataSource.query(`UPDATE offering_quote_snapshots SET request_id = 'tampered' WHERE offering_id = $1`, [offeringId])).rejects.toThrow(/immutable/i)
    await expect(dataSource.query(`UPDATE price_books SET name = 'tampered' WHERE id = $1`, [priceBookId])).rejects.toThrow(/immutable/i)
  })

  it("serves owned-tent and shared-pitch campground editors with fail-closed capacity guards", async () => {
    const stay = futureStayDates()
    const calendarId = randomUUID()
    const groupId = randomUUID()
    await dataSource.getRepository(BusinessCalendarEntity).save({
      id: calendarId, code: "RU-2026-CAMP", name: "Календарь кемпинга", timezone: "Europe/Moscow", countryCode: "RU",
      source: "official_ru", sourceVersion: "camp-test-v1", state: "active", importedAt: new Date(),
      coverageFrom: stay.pricingStartDate, coverageToExclusive: stay.coverageEndDate, contentHash: "d".repeat(64),
      createdBy: adminId, updatedBy: adminId, archivedAt: null,
    })
    await dataSource.getRepository(BusinessCalendarDateEntity).save([stay.pricingStartDate, stay.arrivalDate, stay.middleDate, stay.departureDate].map((localDate) => ({
      id: randomUUID(), calendarId, localDate, officialClass: "weekday", officialLabel: null,
      sourceVersion: "camp-test-v1", createdBy: adminId, updatedBy: adminId, archivedAt: null,
    })))
    await dataSource.getRepository(ResourceGroupEntity).save({
      id: groupId, code: "CAMP-INTEGRATION", kind: "campground", name: "Интеграционный кемпинг", state: "active",
      createdBy: adminId, updatedBy: adminId, archivedAt: null,
    })

    const createCampground = async (definition: {
      code: string; capacityMode: "fixed" | "shared"; capacityTotal: number; sellableUnit: "owned_tent" | "own_tent_pitch";
      inventoryMode: "discrete_inventory" | "shared_capacity"; memberRole: "owned_tent" | "own_tent_area"; amountMinor: number;
    }) => dataSource.transaction(async (manager) => {
      const offeringId = randomUUID(), resourceId = randomUUID(), priceBookId = randomUUID()
      await manager.getRepository(ResourceEntity).save({
        id: resourceId, code: `R-${definition.code}`, kind: `campground_${definition.sellableUnit}`, name: definition.code,
        capacityMode: definition.capacityMode, capacityTotal: definition.capacityTotal, settings: {},
        createdBy: adminId, updatedBy: adminId, archivedAt: null,
      })
      await manager.getRepository(ResourceGroupMemberEntity).save({
        id: randomUUID(), groupId, resourceId, role: definition.memberRole, sortOrder: 0,
        createdBy: adminId, updatedBy: adminId, archivedAt: null,
      })
      await manager.getRepository(CatalogOfferingEntity).save({
        id: offeringId, code: definition.code, kind: "campground", operationalName: definition.code, internalComment: "integration",
        state: "active", subjectVersion: 1, pricingVersion: 2, addonAssignmentsVersion: 1, salesMode: "quoted",
        priceDisplayMode: "exact", currency: "RUB", timezone: "Europe/Moscow", taxMode: "not_taxable",
        businessCalendarId: calendarId, leadDirection: "campgrounds", defaultAssigneeId: null, scope: null,
        ownerOfferingId: null, activePriceBookId: null, createdBy: adminId, updatedBy: adminId, archivedAt: null,
      })
      await manager.getRepository(CampgroundOfferingTermsEntity).save({
        offeringId, offeringKind: "campground", sellableUnit: definition.sellableUnit, inventoryMode: definition.inventoryMode,
        capacityUnit: "tent", pricingBasis: "per_night", createdAt: new Date(), createdBy: adminId,
      })
      await manager.getRepository(OfferingBindingEntity).save({
        id: randomUUID(), offeringId, resourceId, resourceGroupId: null, programTemplateId: null, eventServiceTemplateId: null,
        role: "primary", quantityDefault: 1, capacityImpactDefault: 1, preparationBeforeMinutes: 0, preparationAfterMinutes: 0,
        availabilityRequired: true, createdBy: adminId, updatedBy: adminId, archivedAt: null,
      })
      await manager.getRepository(PriceBookEntity).save({
        id: priceBookId, offeringId, revision: 1, name: definition.code, currency: "RUB", timezone: "Europe/Moscow",
        state: "draft", validFrom: stay.pricingStartDate, validToExclusive: stay.coverageEndDate, supersedesPriceBookId: null,
        changeReason: "integration", scheduledActivationAt: null, scheduledBy: null, activatedAt: null, activatedBy: null,
        retiredAt: null, retiredBy: null, createdBy: adminId, updatedBy: adminId, archivedAt: null,
      })
      await manager.getRepository(RatePlanEntity).save({
        id: randomUUID(), priceBookId, key: "standard", label: "Стандарт", pricingBasis: "per_night",
        baseAmountMinor: definition.amountMinor, baseExtraUnitAmountMinor: null,
        quantityMetric: definition.sellableUnit === "own_tent_pitch" ? "units" : null, includedQuantity: null,
        minimumQuantity: definition.sellableUnit === "own_tent_pitch" ? 1 : null,
        maximumQuantity: definition.sellableUnit === "own_tent_pitch" ? definition.capacityTotal : null,
        minimumDurationMinutes: null, maximumDurationMinutes: null, sortOrder: 0, isDefault: true,
        createdBy: adminId, updatedBy: adminId, archivedAt: null,
      })
      await manager.getRepository(PriceBookEntity).update({ id: priceBookId }, { state: "active", activatedAt: new Date(), activatedBy: adminId })
      await manager.getRepository(CatalogOfferingEntity).update({ id: offeringId }, { activePriceBookId: priceBookId })
      return { offeringId, resourceId }
    })

    const owned = await createCampground({ code: "CAMP-OWNED", capacityMode: "fixed", capacityTotal: 4, sellableUnit: "owned_tent", inventoryMode: "discrete_inventory", memberRole: "owned_tent", amountMinor: 650_000 })
    const shared = await createCampground({ code: "CAMP-SHARED", capacityMode: "shared", capacityTotal: 15, sellableUnit: "own_tent_pitch", inventoryMode: "shared_capacity", memberRole: "own_tent_area", amountMinor: 120_000 })

    const list = await adminAgent.get("/api/internal/v1/offerings?kind=campground&limit=25").expect(200)
    expect(list.body.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: owned.offeringId, fulfillment: expect.objectContaining({ salesUnit: "owned_tent" }) }),
      expect.objectContaining({ id: shared.offeringId, fulfillment: expect.objectContaining({ salesUnit: "own_tent_pitch" }) }),
    ]))
    expect((await adminAgent.get(`/api/admin/v1/offerings/${shared.offeringId}/editor`).expect(200)).body).toMatchObject({
      offering: { id: shared.offeringId, kind: "campground", fulfillment: { allocationMode: "shared_capacity" } },
      bindings: [{ target: { type: "resource", id: shared.resourceId }, role: "primary" }],
    })
    const editorial = await dataSource.transaction((manager) => ensureCatalogOfferingEditorialDraft(manager, {
      offeringId: shared.offeringId, actorId: adminId, requestId: "campground-editorial-integration",
    }))
    expect(editorial.status).toBe("created")
    expect(await dataSource.getRepository(CmsSourceLinkEntity).countBy({ sourceKind: "catalog_offering", sourceId: shared.offeringId })).toBe(1)

    const baseQuote = {
      ratePlanKey: null, period: { type: "stay", arrivalDate: stay.arrivalDate, departureDate: stay.departureDate },
      currency: "RUB", addOns: [], operationId: randomUUID(), idempotencyKey: `camp-quote-${randomUUID()}`,
    }
    const sharedQuote = await adminAgent.post(`/api/internal/v1/offerings/${shared.offeringId}/quotes/preview`).send({
      ...baseQuote, quantities: { guests: null, participants: null, units: 2 },
    }).expect(200)
    expect(sharedQuote.body).toMatchObject({
      total: { amountMinor: 480_000 }, lines: [{ quantity: 2 }, { quantity: 2 }], immutableSnapshot: true,
    })
    expect((await dataSource.getRepository(OfferingQuoteSnapshotEntity).findOneByOrFail({ id: sharedQuote.body.quoteId })).operationalContext).toBeNull()
    expect((await adminAgent.post(`/api/admin/v1/offerings/${shared.offeringId}/quotes/preview`).send({
      ...baseQuote, operationId: randomUUID(), idempotencyKey: `camp-over-${randomUUID()}`,
      quantities: { guests: null, participants: null, units: 16 },
    }).expect(422)).body.code).toBe("CAMPGROUND_CAPACITY_EXCEEDED")
    expect((await adminAgent.post(`/api/internal/v1/offerings/${owned.offeringId}/quotes/preview`).send({
      ...baseQuote, operationId: randomUUID(), idempotencyKey: `camp-guests-${randomUUID()}`,
      quantities: { guests: 5, participants: null, units: 1 },
    }).expect(422)).body.code).toBe("CAMPGROUND_CAPACITY_EXCEEDED")
    expect((await adminAgent.post(`/api/internal/v1/offerings/${owned.offeringId}/quotes/preview`).send({
      ...baseQuote, operationId: randomUUID(), idempotencyKey: `camp-shape-${randomUUID()}`,
      quantities: { guests: null, participants: null, units: 2 },
    }).expect(422)).body.code).toBe("CAMPGROUND_QUOTE_QUANTITIES_INVALID")
  })

  it("fails closed for unsupported Event and Program Registration quote acceptance without state changes", async () => {
    const eventId = randomUUID()
    await dataSource.getRepository(EventEntity).save({
      id: eventId, code: "E-QUOTE-UNSUPPORTED", name: "Unsupported quote event", categoryId: null, customerId: null, phone: "",
      startsAt: new Date("2026-10-01T09:00:00.000Z"), endsAt: new Date("2026-10-01T12:00:00.000Z"), guestCount: 2,
      totalAmount: 1_000, paidAmount: 0, currency: "RUB", status: "planning", comment: "", requiresAction: false, assigneeIds: [], scenario: [],
      createdBy: adminId, updatedBy: adminId, archivedAt: null,
    })
    const templateId = randomUUID(), occurrenceId = randomUUID(), registrationId = randomUUID()
    await dataSource.getRepository(ProgramTemplateEntity).save({
      id: templateId, code: "PT-QUOTE-UNSUPPORTED", name: "Unsupported quote template", categoryId: null, durationMinutes: 60, minimumParticipants: null,
      participantLimit: 10, registrationCloseHours: null, basePriceAmount: 1_000, currency: "RUB", description: "", publication: "draft", assigneeIds: [], stages: [],
      createdBy: adminId, updatedBy: adminId, archivedAt: null,
    })
    await dataSource.getRepository(ProgramOccurrenceEntity).save({
      id: occurrenceId, code: "PO-QUOTE-UNSUPPORTED", templateId, name: "Unsupported quote occurrence", startsAt: new Date("2026-10-02T09:00:00.000Z"), endsAt: new Date("2026-10-02T10:00:00.000Z"),
      participantLimit: 10, registrationLimit: 10, status: "open", currency: "RUB", comment: "", assigneeIds: [], createdBy: adminId, updatedBy: adminId, archivedAt: null,
    })
    await dataSource.getRepository(ProgramRegistrationEntity).save({
      id: registrationId, code: "PR-QUOTE-UNSUPPORTED", occurrenceId, customerId: null, phone: "", participantCount: 1, participantNames: "", totalAmount: 1_000,
      discountAmount: 0, paidAmount: 0, currency: "RUB", status: "new", promo: "", source: "", comment: "", createdBy: adminId, updatedBy: adminId, archivedAt: null,
    })
    await adminAgent.post(`/api/internal/v1/events/${eventId}/transition`).send({ version: 1, operationId: randomUUID(), idempotencyKey: "event-quote-unsupported-0001", status: "booked", quoteAcceptance: { quoteSnapshotId: randomUUID() } }).expect(422)
    await adminAgent.post(`/api/internal/v1/programs/registrations/${registrationId}/transition`).send({ version: 1, operationId: randomUUID(), idempotencyKey: "registration-quote-unsupported-0001", status: "confirmed", quoteAcceptance: { quoteSnapshotId: randomUUID() } }).expect(422)
    expect(await dataSource.getRepository(EventEntity).findOneByOrFail({ id: eventId })).toMatchObject({ status: "planning", version: 1 })
    expect(await dataSource.getRepository(ProgramRegistrationEntity).findOneByOrFail({ id: registrationId })).toMatchObject({ status: "new", version: 1 })
  })

  it("rejects expired price activation, finite calendar gaps and malformed offering ids", async () => {
    await adminAgent.get("/api/internal/v1/offerings/not-a-uuid/editor").expect(400)
    const dates = lifecycleGateDates()
    const calendarId = randomUUID()
    await dataSource.getRepository(BusinessCalendarEntity).save({
      id: calendarId, code: "RU-2026-P45B-GAPS", name: "Календарь lifecycle gates",
      timezone: "Europe/Moscow", countryCode: "RU", source: "official_ru", sourceVersion: "ru-2026-gaps",
      state: "active", importedAt: new Date("2026-08-01T00:00:00.000Z"),
      coverageFrom: dates.coverageFrom, coverageToExclusive: dates.coverageToExclusive, contentHash: "d".repeat(64),
      createdBy: adminId, updatedBy: adminId, archivedAt: null,
    })
    await dataSource.getRepository(BusinessCalendarDateEntity).save([
      { id: randomUUID(), calendarId, localDate: dates.coverageFrom, officialClass: "weekday", officialLabel: null, sourceVersion: "ru-2026-gaps", createdBy: adminId, updatedBy: adminId, archivedAt: null },
      { id: randomUUID(), calendarId, localDate: dates.coveredDate, officialClass: "weekday", officialLabel: null, sourceVersion: "ru-2026-gaps", createdBy: adminId, updatedBy: adminId, archivedAt: null },
    ])
    const makeOffering = async (code: string) => {
      const id = randomUUID()
      await dataSource.getRepository(CatalogOfferingEntity).save({
        id, code, kind: "house", operationalName: code, internalComment: "", state: "active",
        subjectVersion: 1, pricingVersion: 1, addonAssignmentsVersion: 1,
        salesMode: "quoted", priceDisplayMode: "exact", currency: "RUB", timezone: "Europe/Moscow", taxMode: "not_taxable",
        businessCalendarId: calendarId, leadDirection: "houses", defaultAssigneeId: null,
        scope: null, ownerOfferingId: null, activePriceBookId: null,
        createdBy: adminId, updatedBy: adminId, archivedAt: null,
      })
      return id
    }
    const createDraft = async (offeringId: string, key: string, validFrom: string, validToExclusive: string) => {
      const response = await adminAgent.post(`/api/internal/v1/offerings/${offeringId}/price-books/drafts`).send({
        operationId: randomUUID(), idempotencyKey: `${key}-draft-integration-0001`, expectedPricingVersion: 1,
        supersedesPriceBookId: null, name: key, validFrom, validToExclusive, changeReason: "lifecycle gate",
        ratePlans: [{
          key: "standard", label: "Стандарт", pricingBasis: "per_night", quantityMetric: null,
          baseAmount: 10_000, includedQuantity: null, baseExtraUnitAmount: null,
          minQuantity: null, maxQuantity: null, minDurationMinutes: null, maxDurationMinutes: null,
          isDefault: true, displayOrder: 0, rules: [],
        }],
      }).expect(201)
      return response.body.priceBook.id as string
    }

    const expiredOfferingId = await makeOffering("HOUSE-EXPIRED")
    const expiredBookId = await createDraft(expiredOfferingId, "expired", dates.expiredFrom, dates.expiredToExclusive)
    const expired = await adminAgent.post(`/api/admin/v1/offerings/${expiredOfferingId}/price-books/${expiredBookId}/activate`).send({
      operationId: randomUUID(), idempotencyKey: "expired-activate", expectedPricingVersion: 2, reason: "must fail",
    }).expect(409)
    expect(expired.body.code).toBe("PRICE_BOOK_ACTIVATION_EXPIRED")

    const gapOfferingId = await makeOffering("HOUSE-CALENDAR-GAP")
    const gapBookId = await createDraft(gapOfferingId, "calendar-gap", dates.gapFrom, dates.gapEndExclusive)
    const gap = await adminAgent.post(`/api/admin/v1/offerings/${gapOfferingId}/price-books/${gapBookId}/activate`).send({
      operationId: randomUUID(), idempotencyKey: "calendar-gap-activate", expectedPricingVersion: 2, reason: "must fail",
    }).expect(422)
    expect(gap.body.code).toBe("BUSINESS_CALENDAR_GAP")
  })

  it("shares calendar, house binding and add-on configuration commands across CRM and CMS", async () => {
    const calendarCreate = {
      operationId: randomUUID(), idempotencyKey: `calendar-create-${randomUUID()}`,
      code: `ru_test_${randomUUID().replaceAll("-", "").slice(0, 12)}`,
      name: "Тестовый производственный календарь", timezone: "Europe/Moscow",
    }
    const createdInternal = await adminAgent.post("/api/internal/v1/business-calendars").send(calendarCreate).expect(201)
    const createdAdminReplay = await adminAgent.post("/api/admin/v1/business-calendars").send(calendarCreate).expect(201)
    expect(createdAdminReplay.body).toEqual(createdInternal.body)
    const changedCreateReplay = await adminAgent.post("/api/admin/v1/business-calendars").send({
      ...calendarCreate,
      code: `changed_${randomUUID().replaceAll("-", "").slice(0, 12)}`,
      name: "Другой календарь с теми же ключами",
    }).expect(409)
    expect(changedCreateReplay.body.code).toBe("IDEMPOTENCY_CONFLICT")
    const calendarId = createdInternal.body.calendar.id as string

    const importInput = {
      operationId: randomUUID(), idempotencyKey: `calendar-import-${randomUUID()}`,
      expectedCalendarVersion: 1, sourceVersion: "integration-2026-v1",
      coverage: { from: "2026-10-01", toExclusive: "2026-10-03" },
      days: [
        { date: "2026-10-01", dayClass: "weekday", label: null },
        { date: "2026-10-02", dayClass: "weekend", label: null },
      ],
    }
    const [importedInternal, importedAdmin] = await Promise.all([
      adminAgent.put(`/api/internal/v1/business-calendars/${calendarId}/import`).send(importInput),
      adminAgent.put(`/api/admin/v1/business-calendars/${calendarId}/import`).send(importInput),
    ])
    expect(importedInternal.status).toBe(200)
    expect(importedAdmin.status).toBe(200)
    expect(importedAdmin.body).toEqual(importedInternal.body)
    expect(importedInternal.body.calendar).toMatchObject({ id: calendarId, version: 2, coverage: importInput.coverage })

    const overridden = await adminAgent.put(`/api/internal/v1/business-calendars/${calendarId}/overrides/2026-10-02`).send({
      operationId: randomUUID(), idempotencyKey: `calendar-override-${randomUUID()}`,
      expectedCalendarVersion: 2,
      override: { dayClass: "holiday", label: "Локальный праздник", reason: "Интеграционная проверка" },
    }).expect(200)
    expect(overridden.body.calendar).toMatchObject({ version: 3, days: [
      { date: "2026-10-01", source: "official_ru" },
      { date: "2026-10-02", dayClass: "holiday", source: "manual_override" },
    ] })
    expect(await dataSource.getRepository(BusinessCalendarDateOverrideEntity).countBy({ calendarId })).toBe(1)

    const overrideRemoved = await adminAgent.put(`/api/admin/v1/business-calendars/${calendarId}/overrides/2026-10-02`).send({
      operationId: randomUUID(), idempotencyKey: `calendar-override-remove-${randomUUID()}`,
      expectedCalendarVersion: 3, override: null,
    }).expect(200)
    expect(overrideRemoved.body.calendar).toMatchObject({ version: 4, days: [
      { date: "2026-10-01", source: "official_ru" },
      { date: "2026-10-02", dayClass: "weekend", source: "official_ru" },
    ] })

    const activated = await adminAgent.post(`/api/admin/v1/business-calendars/${calendarId}/state`).send({
      operationId: randomUUID(), idempotencyKey: `calendar-activate-${randomUUID()}`,
      expectedCalendarVersion: 4, targetState: "active", reason: "Проверено",
    }).expect(200)
    expect(activated.body.calendar).toMatchObject({ state: "active", version: 5 })
    await adminAgent.put(`/api/internal/v1/business-calendars/${calendarId}/overrides/2026-99-99`).send({
      operationId: randomUUID(), idempotencyKey: `calendar-invalid-date-${randomUUID()}`,
      expectedCalendarVersion: 5, override: null,
    }).expect(400)

    const guardedSourceId = randomUUID()
    const guardedTargetId = randomUUID()
    const calendarRepository = dataSource.getRepository(BusinessCalendarEntity)
    await calendarRepository.save([
      {
        id: guardedSourceId, code: `guard_source_${guardedSourceId.replaceAll("-", "").slice(0, 8)}`, name: "Retired source guard",
        timezone: "Europe/Moscow", countryCode: "RU", source: "official_ru", sourceVersion: "guard-v1", state: "active",
        importedAt: new Date(), coverageFrom: "2026-11-01", coverageToExclusive: "2026-11-02", contentHash: "a".repeat(64),
        createdBy: adminId, updatedBy: adminId, archivedAt: null,
      },
      {
        id: guardedTargetId, code: `guard_target_${guardedTargetId.replaceAll("-", "").slice(0, 8)}`, name: "Active target guard",
        timezone: "Europe/Moscow", countryCode: "RU", source: "official_ru", sourceVersion: "guard-v1", state: "active",
        importedAt: new Date(), coverageFrom: "2026-11-01", coverageToExclusive: "2026-11-02", contentHash: "b".repeat(64),
        createdBy: adminId, updatedBy: adminId, archivedAt: null,
      },
    ])
    const guardedDateId = randomUUID()
    const guardedOverrideId = randomUUID()
    await dataSource.getRepository(BusinessCalendarDateEntity).save({
      id: guardedDateId, calendarId: guardedSourceId, localDate: "2026-11-01", officialClass: "weekday",
      officialLabel: null, sourceVersion: "guard-v1", createdBy: adminId, updatedBy: adminId, archivedAt: null,
    })
    await dataSource.getRepository(BusinessCalendarDateOverrideEntity).save({
      id: guardedOverrideId, calendarId: guardedSourceId, localDate: "2026-11-01", overrideClass: "holiday",
      label: "Guard", reason: "immutability probe", state: "active", createdBy: adminId, updatedBy: adminId, archivedAt: null,
    })
    await calendarRepository.update({ id: guardedSourceId }, { state: "retired" })
    await expect(dataSource.query("UPDATE business_calendar_dates SET calendar_id = $1 WHERE id = $2", [guardedTargetId, guardedDateId])).rejects.toThrow(/parent is immutable/)
    await dataSource.getRepository(BusinessCalendarDateEntity).save({
      id: randomUUID(), calendarId: guardedTargetId, localDate: "2026-11-01", officialClass: "weekday",
      officialLabel: null, sourceVersion: "guard-v1", createdBy: adminId, updatedBy: adminId, archivedAt: null,
    })
    await expect(dataSource.query("UPDATE business_calendar_date_overrides SET calendar_id = $1 WHERE id = $2", [guardedTargetId, guardedOverrideId])).rejects.toThrow(/parent is immutable/)

    const resourceId = randomUUID()
    await dataSource.getRepository(ResourceEntity).save({
      id: resourceId, code: `R-config-${resourceId.slice(0, 8)}`, kind: "house", name: "Домик конфигурации",
      capacityMode: "fixed", capacityTotal: 1, settings: {}, createdBy: adminId, updatedBy: adminId, archivedAt: null,
    })
    const requestOnlyOfferingId = randomUUID()
    await dataSource.getRepository(CatalogOfferingEntity).save({
      id: requestOnlyOfferingId, code: `HOUSE-REQUEST-${requestOnlyOfferingId.slice(0, 8)}`, kind: "house", operationalName: "Домик по запросу",
      internalComment: "", state: "active", subjectVersion: 1, pricingVersion: 1, addonAssignmentsVersion: 1,
      salesMode: "request_only", priceDisplayMode: "request", currency: "RUB", timezone: "Europe/Moscow", taxMode: "not_taxable",
      businessCalendarId: calendarId, leadDirection: "houses", defaultAssigneeId: null, scope: null, ownerOfferingId: null,
      activePriceBookId: null, createdBy: adminId, updatedBy: adminId, archivedAt: null,
    })
    await adminAgent.put(`/api/internal/v1/offerings/${requestOnlyOfferingId}/bindings`).send({
      operationId: randomUUID(), idempotencyKey: `request-only-binding-${randomUUID()}`, expectedSubjectVersion: 1,
      bindings: [{ target: { type: "resource", id: resourceId }, role: "primary", availabilityRequired: true,
        defaultQuantity: 1, defaultCapacityImpact: 1, preparationBeforeMinutes: 0, preparationAfterMinutes: 0 }],
    }).expect(200)
    const requestOnlyInvalidations = await dataSource.query(`
      SELECT COUNT(*)::int AS count FROM outbox_events event
      JOIN outbox_deliveries delivery ON delivery.event_id = event.id
      WHERE event.topic = 'public.offering_projection.invalidated'
        AND event.aggregate_id = $1 AND delivery.consumer = 'public_projection'
    `, [requestOnlyOfferingId]) as Array<{ count: number }>
    expect(requestOnlyInvalidations[0]?.count).toBe(1)
    const requestOnlyAddOn = await adminAgent.post("/api/internal/v1/offerings/addons").send({
      operationId: randomUUID(), idempotencyKey: `request-only-addon-${randomUUID()}`,
      operationalName: "Встреча у ворот", internalComment: "", businessCalendarId: calendarId,
      scope: "reusable", ownerOfferingId: null, standalone: true, salesMode: "request_only", priceDisplayMode: "request",
      currency: "RUB", timezone: "Europe/Moscow", taxMode: "not_taxable",
      terms: {
        serviceType: "quantity_service", categoryKey: "transfer", applicableOfferingKinds: ["house"],
        quantity: { metric: "units", min: 1, max: 4, default: 1, step: 1 },
      },
    }).expect(201)
    expect(requestOnlyAddOn.body).toMatchObject({
      offering: { state: "active", activePriceBookId: null },
      editorial: { currentRevision: { state: "draft" }, publication: { eligible: false } },
    })
    await adminAgent.put(`/api/internal/v1/offerings/${requestOnlyOfferingId}/add-ons`).send({
      operationId: randomUUID(), idempotencyKey: `request-only-addon-assign-${randomUUID()}`,
      expectedAddOnsVersion: 1, assignments: [{ addOnOfferingId: requestOnlyAddOn.body.offering.id }],
    }).expect(200)
    const offeringId = randomUUID()
    await dataSource.getRepository(CatalogOfferingEntity).save({
      id: offeringId, code: `HOUSE-CONFIG-${offeringId.slice(0, 8)}`, kind: "house", operationalName: "Домик конфигурации",
      internalComment: "", state: "active", subjectVersion: 1, pricingVersion: 1, addonAssignmentsVersion: 1,
      salesMode: "quoted", priceDisplayMode: "exact", currency: "RUB", timezone: "Europe/Moscow", taxMode: "not_taxable",
      businessCalendarId: calendarId, leadDirection: "houses", defaultAssigneeId: null, scope: null, ownerOfferingId: null,
      activePriceBookId: null, createdBy: adminId, updatedBy: adminId, archivedAt: null,
    })
    const priceBookId = randomUUID()
    await dataSource.getRepository(PriceBookEntity).save({
      id: priceBookId, offeringId, revision: 1, name: "Active integration price", currency: "RUB", timezone: "Europe/Moscow",
      state: "active", validFrom: "2026-10-01", validToExclusive: null, supersedesPriceBookId: null, changeReason: "integration",
      scheduledActivationAt: null, scheduledBy: null, activatedAt: new Date(), activatedBy: adminId,
      retiredAt: null, retiredBy: null, createdBy: adminId, updatedBy: adminId, archivedAt: null,
    })
    await dataSource.getRepository(CatalogOfferingEntity).update({ id: offeringId }, { activePriceBookId: priceBookId })

    const bindingInput = {
      operationId: randomUUID(), idempotencyKey: `binding-create-${randomUUID()}`, expectedSubjectVersion: 1,
      bindings: [{ target: { type: "resource", id: resourceId }, role: "primary", availabilityRequired: true,
        defaultQuantity: 1, defaultCapacityImpact: 1, preparationBeforeMinutes: 0, preparationAfterMinutes: 0 }],
    }
    const bound = await adminAgent.put(`/api/internal/v1/offerings/${offeringId}/bindings`).send(bindingInput).expect(200)
    expect(bound.body).toMatchObject({ offeringId, subjectVersion: 2, bindings: [{ target: { type: "resource", id: resourceId }, role: "primary" }] })
    const bindingId = bound.body.bindings[0].id as string
    const bindingVersion = bound.body.bindings[0].version as number

    const rebound = await adminAgent.put(`/api/admin/v1/offerings/${offeringId}/bindings`).send({
      ...bindingInput, operationId: randomUUID(), idempotencyKey: `binding-update-${randomUUID()}`,
      expectedSubjectVersion: 2, bindings: [{ ...bindingInput.bindings[0], preparationAfterMinutes: 30 }],
    }).expect(200)
    expect(rebound.body).toMatchObject({ subjectVersion: 3, bindings: [{ id: bindingId, version: bindingVersion + 1, preparationAfterMinutes: 30 }] })

    const noOp = await adminAgent.put(`/api/internal/v1/offerings/${offeringId}/bindings`).send({
      ...bindingInput, operationId: randomUUID(), idempotencyKey: `binding-noop-${randomUUID()}`,
      expectedSubjectVersion: 3, bindings: [{ ...bindingInput.bindings[0], preparationAfterMinutes: 30 }],
    }).expect(200)
    expect(noOp.body).toMatchObject({ subjectVersion: 3, bindings: [{ id: bindingId, version: bindingVersion + 1 }] })
    const stale = await adminAgent.put(`/api/admin/v1/offerings/${offeringId}/bindings`).send({
      ...bindingInput, operationId: randomUUID(), idempotencyKey: `binding-stale-${randomUUID()}`, expectedSubjectVersion: 2,
    }).expect(409)
    expect(stale.body).toMatchObject({ code: "VERSION_CONFLICT", details: { segment: "subject", serverVersion: 3 } })
    expect(await dataSource.getRepository(OfferingBindingEntity).countBy({ offeringId })).toBe(1)

    const custom = await adminAgent.post(`/api/admin/v1/offerings/${offeringId}/add-ons/custom`).send({
      operationId: randomUUID(), idempotencyKey: `custom-addon-${randomUUID()}`, expectedAddOnsVersion: 1,
      addOn: { code: `addon_${offeringId.replaceAll("-", "").slice(0, 12)}`, operationalName: "Поздний выезд",
        serviceType: "quantity_service", categoryKey: "comfort", standalone: false,
        salesMode: "request_only", priceDisplayMode: "request" },
      assignment: {},
    }).expect(201)
    expect(custom.body).toMatchObject({ addOnAssignmentsVersion: 2, addOn: { offering: { state: "active", activePriceBookId: null }, scope: "offering_specific", ownerOfferingId: offeringId }, assignment: { offeringId, enabled: false } })
    const addOnId = custom.body.addOn.offering.id as string
    expect(await dataSource.getRepository(AddonOfferingTermsEntity).countBy({ offeringId: addOnId })).toBe(1)
    expect(await dataSource.getRepository(OfferingAddonAssignmentEntity).countBy({ offeringId, addonOfferingId: addOnId })).toBe(1)
    const library = await adminAgent.get(`/api/internal/v1/addons?q=${encodeURIComponent("Поздний выезд")}&scope=offering_specific`).expect(200)
    expect(library.body.items).toEqual([expect.objectContaining({ offering: expect.objectContaining({ id: addOnId }) })])
    await dataSource.query(`
      UPDATE offering_addon_assignments SET enabled = true
      WHERE offering_id = $1 AND addon_offering_id = $2
    `, [offeringId, addOnId])
    await expect(dataSource.getRepository(CatalogOfferingEntity).update({ id: addOnId }, { state: "paused" })).rejects.toThrow(/may not become incompatible/)

    const invalidations = await dataSource.query(`
      SELECT COUNT(*)::int AS count
      FROM outbox_events event
      JOIN outbox_deliveries delivery ON delivery.event_id = event.id
      WHERE event.topic = 'public.offering_projection.invalidated'
        AND event.aggregate_id = $1 AND delivery.consumer = 'public_projection'
    `, [offeringId]) as Array<{ count: number }>
    expect(invalidations[0]?.count).toBeGreaterThanOrEqual(3)
  })

  it("reclaims an expired processing lease for the SSE outbox consumer", async () => {
    const eventId = randomUUID()
    const availableAt = new Date(Date.now() - 60_000)
    const leaseAcquiredAt = new Date(availableAt.getTime() - 60_000)
    await dataSource.getRepository(OutboxEventEntity).save({
      id: eventId, topic: "crm.price_book.activated", aggregateType: "catalog_offering", aggregateId: randomUUID(),
      payload: { pricingVersion: 7 }, availableAt, processedAt: null, attempts: 0, createdAt: availableAt,
    })
    await dataSource.getRepository(OutboxDeliveryEntity).save({
      eventId, consumer: "sse", status: "processing", attempts: 1, deliveryEpoch: 1, replayCount: 0, maxAttempts: 8,
      availableAt, processedAt: null, lastError: null, leaseToken: randomUUID(), leaseOwner: "integration-expired",
      leaseAcquiredAt, leaseExpiresAt: availableAt, lastAttemptAt: null, lastFailureAt: null,
      lastErrorCode: null, deadLetteredAt: null, createdAt: availableAt, updatedAt: availableAt,
    })
    expect(await app.get(OutboxDispatcherService).dispatchBatch()).toBeGreaterThanOrEqual(1)
    const delivery = await dataSource.getRepository(OutboxDeliveryEntity).findOneByOrFail({ eventId, consumer: "sse" })
    expect(delivery).toMatchObject({ status: "succeeded", attempts: 2, lastError: null })
    expect((await dataSource.getRepository(OutboxEventEntity).findOneByOrFail({ id: eventId })).processedAt).not.toBeNull()
  })

  it("dead-letters an expired lease which already exhausted its attempt budget", async () => {
    app.get(OutboxDispatcherService).onModuleDestroy()
    const eventId = randomUUID()
    const availableAt = new Date(Date.now() - 60_000)
    const leaseAcquiredAt = new Date(availableAt.getTime() - 60_000)
    await dataSource.getRepository(OutboxEventEntity).save({
      id: eventId, topic: "crm.price_book.activated", aggregateType: "catalog_offering", aggregateId: randomUUID(),
      payload: { pricingVersion: 7 }, availableAt, processedAt: null, attempts: 0, createdAt: availableAt,
    })
    await dataSource.getRepository(OutboxDeliveryEntity).save({
      eventId, consumer: "sse", status: "processing", attempts: 1, deliveryEpoch: 1, replayCount: 0, maxAttempts: 1,
      availableAt, processedAt: null, lastError: null, leaseToken: randomUUID(), leaseOwner: "integration-exhausted",
      leaseAcquiredAt, leaseExpiresAt: availableAt, lastAttemptAt: null, lastFailureAt: null,
      lastErrorCode: null, deadLetteredAt: null, createdAt: availableAt, updatedAt: availableAt,
    })
    const store = app.get(OutboxDeliveryStore, { strict: false })
    expect(await store.claim("sse", "integration-exhausted-reclaimer", 1)).toEqual([])
    expect(await dataSource.getRepository(OutboxDeliveryEntity).findOneByOrFail({ eventId, consumer: "sse" }))
      .toMatchObject({ status: "dead_letter", attempts: 1, lastErrorCode: "LEASE_ATTEMPTS_EXHAUSTED", leaseToken: null })
    expect(await dataSource.query(`
      SELECT outcome, error_code FROM outbox_delivery_attempts
      WHERE event_id = $1 AND consumer = 'sse' AND delivery_epoch = 1 AND attempt = 1
    `, [eventId])).toEqual([{ outcome: "lease_expired", error_code: "LEASE_EXPIRED" }])
    expect(await store.claim("sse", "integration-exhausted-repeat", 1)).toEqual([])
    expect((await dataSource.getRepository(OutboxDeliveryEntity).findOneByOrFail({ eventId, consumer: "sse" })).attempts).toBe(1)
    expect((await dataSource.getRepository(OutboxEventEntity).findOneByOrFail({ id: eventId })).processedAt).toBeNull()
  })

  it("fences concurrent delivery claims and applies typed offering invalidations exactly once", async () => {
    // Stop the background interval so this test owns every lease transition.
    app.get(OutboxDispatcherService).onModuleDestroy()
    const store = app.get(OutboxDeliveryStore, { strict: false })
    const consumer = app.get(PublicOfferingProjectionConsumer, { strict: false })
    const engine = app.get(OutboxDeliveryEngine, { strict: false })
    const calendarId = randomUUID()
    const offeringId = randomUUID()
    const now = new Date()
    await dataSource.getRepository(BusinessCalendarEntity).save({
      id: calendarId, code: `delivery_${calendarId.replaceAll("-", "").slice(0, 10)}`, name: "Delivery calendar",
      timezone: "Europe/Moscow", countryCode: "RU", source: "official_ru", sourceVersion: "delivery-v1", state: "active",
      importedAt: now, coverageFrom: "2026-09-01", coverageToExclusive: "2026-09-02", contentHash: "a".repeat(64),
      createdBy: adminId, updatedBy: adminId, archivedAt: null,
    })
    await dataSource.getRepository(CatalogOfferingEntity).save({
      id: offeringId, code: `HOUSE-DELIVERY-${offeringId.slice(0, 8)}`, kind: "house", operationalName: "Delivery house",
      internalComment: "", state: "active", subjectVersion: 1, pricingVersion: 1, addonAssignmentsVersion: 1,
      salesMode: "quoted", priceDisplayMode: "exact", currency: "RUB", timezone: "Europe/Moscow", taxMode: "not_taxable",
      businessCalendarId: calendarId, leadDirection: "houses", defaultAssigneeId: null, scope: null, ownerOfferingId: null,
      activePriceBookId: null, createdBy: adminId, updatedBy: adminId, archivedAt: null,
    })

    const makePayload = (eventId: string, aggregateId = offeringId) => ({
      eventId, eventType: "public.offering_projection.invalidated", occurredAt: now.toISOString(), actorId: adminId,
      requestId: `delivery-${eventId}`, operationId: randomUUID(), entrySurface: "internal",
      aggregate: { type: "catalog_offering", id: aggregateId },
      versions: { calendar: 1, subject: 1, addOns: 1 }, configurationHash: "b".repeat(64),
    })
    const insertTypedInvalidation = async (eventId: string, createdAt: Date, payload = makePayload(eventId)) => {
      await dataSource.getRepository(OutboxEventEntity).save({
        id: eventId, topic: "public.offering_projection.invalidated", aggregateType: "catalog_offering", aggregateId: offeringId,
        payload, availableAt: now, processedAt: null, attempts: 0, createdAt,
      })
      await dataSource.getRepository(OutboxDeliveryEntity).save([
        { eventId, consumer: "public_projection", status: "pending", attempts: 0, deliveryEpoch: 1, replayCount: 0, maxAttempts: 8, availableAt: now, processedAt: null, lastError: null, leaseToken: null, leaseOwner: null, leaseAcquiredAt: null, leaseExpiresAt: null, lastAttemptAt: null, lastFailureAt: null, lastErrorCode: null, deadLetteredAt: null },
        { eventId, consumer: "sse", status: "pending", attempts: 0, deliveryEpoch: 1, replayCount: 0, maxAttempts: 8, availableAt: now, processedAt: null, lastError: null, leaseToken: null, leaseOwner: null, leaseAcquiredAt: null, leaseExpiresAt: null, lastAttemptAt: null, lastFailureAt: null, lastErrorCode: null, deadLetteredAt: null },
      ])
    }

    const firstEventId = randomUUID()
    await insertTypedInvalidation(firstEventId, now)
    const [leftClaims, rightClaims] = await Promise.all([
      store.claim("public_projection", "integration-left", 1),
      store.claim("public_projection", "integration-right", 1),
    ])
    const firstClaim = [...leftClaims, ...rightClaims]
    expect(firstClaim).toHaveLength(1)
    await expect(store.succeed(firstClaim[0]!)).rejects.toThrow(/applied receipt/i)
    expect(await dataSource.getRepository(OutboxDeliveryEntity).findOneByOrFail({ eventId: firstEventId, consumer: "public_projection" }))
      .toMatchObject({ status: "processing", attempts: 1 })
    const firstCompletion = await consumer.consume(firstClaim[0]!)
    expect(await store.completePublicProjection(firstClaim[0]!, firstCompletion.effect)).toBe(true)
    expect(await dataSource.getRepository(PublicOfferingProjectionStateEntity).findOneByOrFail({ offeringId }))
      .toMatchObject({ generation: 1, lastInvalidationEventId: firstEventId })
    expect(await dataSource.getRepository(PublicOfferingProjectionInvalidationReceiptEntity).findOneByOrFail({ eventId: firstEventId }))
      .toMatchObject({ generation: 1, cacheTags: [`public-offering:${offeringId}`, "public-offering-kind:house", "public-offering-collection"], effect: "applied", effectAttempts: 1 })
    // The summary event remains open until the independent SSE checkpoint succeeds.
    expect((await dataSource.getRepository(OutboxEventEntity).findOneByOrFail({ id: firstEventId })).processedAt).toBeNull()
    const firstSseClaim = await store.claim("sse", "integration-sse", 1)
    expect(firstSseClaim).toHaveLength(1)
    expect(await store.succeed(firstSseClaim[0]!)).toBe(true)
    expect((await dataSource.getRepository(OutboxEventEntity).findOneByOrFail({ id: firstEventId })).processedAt).not.toBeNull()

    // Insert the next event with an older timestamp; receipt order is delivery
    // order, and its generation must still advance strictly.
    const secondEventId = randomUUID()
    await insertTypedInvalidation(secondEventId, new Date(now.getTime() - 60_000))
    const initialSecondClaim = (await store.claim("public_projection", "integration-crash", 1))[0]!
    const secondInvalidation = normalizePublicOfferingInvalidation(initialSecondClaim.payload)
    expect(secondInvalidation).not.toBeNull()
    expect(await store.preparePublicProjection(initialSecondClaim, secondInvalidation!)).toMatchObject({ effectAlreadyApplied: false })
    expect((await dataSource.getRepository(PublicOfferingProjectionStateEntity).findOneByOrFail({ offeringId })).generation).toBe(2)
    // Simulated process crash: the new worker reclaims the expired lease; the
    // old token cannot write a late success, and repeated prepare is idempotent.
    await dataSource.query(`
      UPDATE outbox_deliveries
      SET lease_acquired_at = clock_timestamp() - interval '2 minutes',
          lease_expires_at = clock_timestamp() - interval '1 minute',
          available_at = clock_timestamp() - interval '1 minute'
      WHERE event_id = $1 AND consumer = 'public_projection'
    `, [secondEventId])
    expect(await store.succeed(initialSecondClaim)).toBe(false)
    const reclaimedSecondClaim = (await store.claim("public_projection", "integration-reclaimer", 1))[0]!
    expect(reclaimedSecondClaim.attempt).toBe(2)
    expect(await store.preparePublicProjection(reclaimedSecondClaim, secondInvalidation!)).toMatchObject({ effectAlreadyApplied: false })
    expect((await dataSource.getRepository(PublicOfferingProjectionStateEntity).findOneByOrFail({ offeringId })).generation).toBe(2)
    const reclaimedCompletion = await consumer.consume(reclaimedSecondClaim)
    expect(await store.completePublicProjection(reclaimedSecondClaim, reclaimedCompletion.effect)).toBe(true)
    expect(await dataSource.getRepository(PublicOfferingProjectionInvalidationReceiptEntity).countBy({ eventId: secondEventId })).toBe(1)

    const poisonedEventId = randomUUID()
    await insertTypedInvalidation(
      poisonedEventId,
      new Date(now.getTime() + 60_000),
      makePayload(poisonedEventId, randomUUID()),
    )
    expect(await engine.dispatch("public_projection", (claim) => consumer.consume(claim))).toBe(1)
    expect(await dataSource.getRepository(OutboxDeliveryEntity).findOneByOrFail({ eventId: poisonedEventId, consumer: "public_projection" }))
      .toMatchObject({ status: "dead_letter", attempts: 1, lastErrorCode: "INVALID_PUBLIC_PROJECTION_PAYLOAD" })

    const directSucceededEventId = randomUUID()
    await dataSource.getRepository(OutboxEventEntity).save({
      id: directSucceededEventId, topic: "public.offering_projection.invalidated", aggregateType: "catalog_offering", aggregateId: offeringId,
      payload: makePayload(directSucceededEventId), availableAt: now, processedAt: null, attempts: 0, createdAt: now,
    })
    await expect(dataSource.query(`
      INSERT INTO outbox_deliveries (
        event_id, consumer, status, attempts, delivery_epoch, replay_count, max_attempts,
        available_at, processed_at, last_error, lease_token, lease_owner, lease_acquired_at, lease_expires_at,
        last_attempt_at, last_failure_at, last_error_code, dead_lettered_at, created_at, updated_at
      ) VALUES ($1, 'public_projection', 'succeeded', 0, 1, 0, 8,
        clock_timestamp(), clock_timestamp(), NULL, NULL, NULL, NULL, NULL,
        NULL, NULL, NULL, NULL, clock_timestamp(), clock_timestamp())
    `, [directSucceededEventId])).rejects.toThrow(/applied receipt/i)

    const mutableIdentityEventId = randomUUID()
    await dataSource.getRepository(OutboxEventEntity).save({
      id: mutableIdentityEventId, topic: "public.offering_projection.invalidated", aggregateType: "catalog_offering", aggregateId: offeringId,
      payload: makePayload(mutableIdentityEventId), availableAt: now, processedAt: null, attempts: 0, createdAt: now,
    })
    await dataSource.getRepository(OutboxDeliveryEntity).save({
      eventId: mutableIdentityEventId, consumer: "public_projection", status: "pending", attempts: 0, deliveryEpoch: 1, replayCount: 0, maxAttempts: 8,
      availableAt: now, processedAt: null, lastError: null, leaseToken: null, leaseOwner: null, leaseAcquiredAt: null,
      leaseExpiresAt: null, lastAttemptAt: null, lastFailureAt: null, lastErrorCode: null, deadLetteredAt: null,
    })
    await expect(dataSource.query(`
      UPDATE outbox_deliveries
      SET consumer = 'sse', status = 'succeeded', processed_at = clock_timestamp()
      WHERE event_id = $1 AND consumer = 'public_projection'
    `, [mutableIdentityEventId])).rejects.toThrow(/immutable|identity/i)

    const deliveryPath = `/api/admin/v1/deliveries/public_projection/${poisonedEventId}`
    await readonlyAgent.get("/api/admin/v1/deliveries").expect(403)
    const list = await adminAgent.get("/api/admin/v1/deliveries?consumer=public_projection&status=dead_letter").expect(200)
    const listed = list.body.items.find((item: { eventId: string }) => item.eventId === poisonedEventId)
    expect(listed).toMatchObject({ eventId: poisonedEventId, consumer: "public_projection", status: "dead_letter", lastErrorCode: "INVALID_PUBLIC_PROJECTION_PAYLOAD" })
    expect(listed).not.toHaveProperty("payload")
    expect(listed).not.toHaveProperty("lastError")
    const health = await adminAgent.get("/api/admin/v1/deliveries/health").expect(200)
    expect(health.body).toEqual(expect.objectContaining({ consumers: expect.arrayContaining([expect.objectContaining({ consumer: "public_projection", deadLetter: expect.any(Number) })]) }))
    expect(JSON.stringify(health.body)).not.toContain("payload")
    expect(JSON.stringify(health.body)).not.toContain("lastError\"")
    const detail = await adminAgent.get(deliveryPath).expect(200)
    expect(detail.body).toMatchObject({ eventId: poisonedEventId, consumer: "public_projection", status: "dead_letter", lastErrorCode: "INVALID_PUBLIC_PROJECTION_PAYLOAD" })
    expect(detail.body).not.toHaveProperty("payload")
    expect(detail.body).not.toHaveProperty("lastError")

    const replayInput = {
      operationId: randomUUID(), idempotencyKey: "delivery-replay-integration-0001", expectedStatus: "dead_letter",
      expectedDeliveryEpoch: 1, expectedAttempts: 1, reason: "Исправлен источник invalidation",
    }
    const replay = await adminAgent.post(`${deliveryPath}/replay`).send(replayInput).expect(200)
    expect(replay.body).toMatchObject({
      delivery: { eventId: poisonedEventId, consumer: "public_projection", status: "pending", attempts: 0, deliveryEpoch: 2, replayCount: 1 },
      replay: { eventId: poisonedEventId, consumer: "public_projection", previousDeliveryEpoch: 1, previousAttempts: 1, reason: replayInput.reason },
    })
    expect(await dataSource.query(`SELECT COUNT(*)::int AS count FROM outbox_delivery_replays WHERE event_id = $1 AND consumer = 'public_projection'`, [poisonedEventId]))
      .toEqual([{ count: 1 }])
    expect(await dataSource.getRepository(ChangeLogEntity).countBy({ entityType: "outbox_delivery", entityId: poisonedEventId, action: "replayed" })).toBe(1)
    expect((await adminAgent.post(`${deliveryPath}/replay`).send(replayInput).expect(200)).body).toEqual(replay.body)
    await adminAgent.post(`${deliveryPath}/replay`).send({ ...replayInput, reason: "Другая причина" }).expect(409)
    await adminAgent.post(`${deliveryPath}/replay`).send({ ...replayInput, operationId: randomUUID() }).expect(409)
    await adminAgent.post(`${deliveryPath}/replay`).send({ ...replayInput, idempotencyKey: "delivery-replay-integration-0002" }).expect(409)
    await adminAgent.post(`${deliveryPath}/replay`).send({
      ...replayInput, operationId: randomUUID(), idempotencyKey: "delivery-replay-integration-aba-0001",
    }).expect(409)

    const adminOpenApi = await adminAgent.get("/api/admin/v1/openapi.json").expect(200)
    expect(adminOpenApi.body.paths).toHaveProperty("/deliveries")
    expect(adminOpenApi.body.paths).toHaveProperty("/deliveries/{consumer}/{eventId}")
    expect(adminOpenApi.body.paths).toHaveProperty("/deliveries/{consumer}/{eventId}/replay")
    expect((await request(app.getHttpServer()).get("/api/public/v1/deliveries").expect(404)).body).toBeDefined()
    const publicOpenApi = await request(app.getHttpServer()).get("/api/public/v1/openapi.json").expect(200)
    expect(Object.keys(publicOpenApi.body.paths).some((path) => path.includes("deliveries"))).toBe(false)
  })

  it("processes signed private uploads into immutable WebP/AVIF and blocks published usage archive", async () => {
    const image = await sharp({ create: { width: 10, height: 10, channels: 4, background: { r: 43, g: 158, b: 71, alpha: 1 } } }).png().toBuffer()
    const checksum = createHash("sha256").update(image).digest("hex")
    const grant = await adminAgent.post("/api/admin/v1/media/uploads").send({
      filename: "hero.png", mimeType: "image/png", byteSize: image.byteLength, checksumSha256: checksum,
    }).expect(201)
    const uploadUrl = new URL(grant.body.uploadUrl as string)
    const uploaded = await request(app.getHttpServer()).put(`${uploadUrl.pathname}${uploadUrl.search}`)
      .set("content-type", "image/png").set("x-content-sha256", checksum).send(image).expect(200)
    expect(uploaded.body).toMatchObject({ state: "ready", mimeType: "image/png", width: 10, height: 10 })
    expect(uploaded.body.variants.map((variant: { format: string }) => variant.format).sort()).toEqual(["avif", "webp"])

    const webp = uploaded.body.variants.find((variant: { format: string }) => variant.format === "webp")
    const delivered = await request(app.getHttpServer()).get(webp.url).expect(200).expect("content-type", "image/webp")
    expect(delivered.headers["cache-control"]).toContain("immutable")
    expect(Buffer.isBuffer(delivered.body)).toBe(true)

    const assetId = uploaded.body.id as string
    const nodeId = randomUUID()
    const revisionId = randomUUID()
    const mediaHero = CmsHeroPolicySchema.parse({
      mode: "override",
      config: {
        variant: "default", eyebrow: "Тест медиа", title: "Проверка медиа", subtitle: null,
        backgroundAssetId: assetId, foregroundAssetId: null,
        background: {
          assetId, alt: "Тестовый зелёный фон", variants: uploaded.body.variants.map((variant: { url: string; format: string; width: number | null; height: number | null }) => ({
            url: variant.url, format: variant.format, width: variant.width, height: variant.height,
          })),
        },
        foreground: null, overlay: "soft", align: "left", actions: [], slides: [], badge: null, featureCards: [], autoplayMs: null,
      },
    })
    const mediaSeo = SeoMetadataSchema.parse({
      title: "Проверка медиа", description: "Контрактный integration fixture для проверки использования media.",
      indexPolicy: "noindex_nofollow", canonical: { mode: "self" }, structuredData: [],
    })
    const mediaContentHash = revisionContentHash({
      route: { path: "/media-test", slug: "media-test", parentNodeId: null, sortOrder: 0 }, title: "Проверка медиа", summary: null,
      hero: mediaHero, sections: [], seo: mediaSeo, relations: [], schemaVersion: 1,
    })
    await dataSource.query(`INSERT INTO cms_nodes(id, kind, status, created_by, updated_by) VALUES ($1, 'landing', 'active', $2, $2)`, [nodeId, adminId])
    await dataSource.query(`INSERT INTO cms_node_revisions(id, node_id, revision, state, path, slug, parent_node_id, sort_order, title, summary, hero, sections, seo, relations, schema_version, content_hash, created_by)
      VALUES ($1, $2, 1, 'published', '/media-test', 'media-test', NULL, 0, 'Проверка медиа', NULL, $3::jsonb, '[]'::jsonb, $4::jsonb, '[]'::jsonb, 1, $5, $6)`,
    [revisionId, nodeId, JSON.stringify(mediaHero), JSON.stringify(mediaSeo), mediaContentHash, adminId])

    const detail = await adminAgent.get(`/api/admin/v1/media/assets/${assetId}`).expect(200)
    expect(detail.body.asset).toMatchObject({ usageCount: 2, publishedUsage: true })
    expect(detail.body.usages[0]).toMatchObject({ ownerType: "cms_revision", ownerId: revisionId, published: true })
    await adminAgent.post(`/api/admin/v1/media/assets/${assetId}/archive`).send({ expectedVersion: uploaded.body.version }).expect(409)

    const spoof = Buffer.from("not-png")
    const spoofChecksum = createHash("sha256").update(spoof).digest("hex")
    const spoofGrant = await adminAgent.post("/api/admin/v1/media/uploads").send({ filename: "spoof.png", mimeType: "image/png", byteSize: spoof.byteLength, checksumSha256: spoofChecksum }).expect(201)
    const spoofUrl = new URL(spoofGrant.body.uploadUrl as string)
    const rejected = await request(app.getHttpServer()).put(`${spoofUrl.pathname}${spoofUrl.search}`).set("content-type", "image/png").set("x-content-sha256", spoofChecksum).send(spoof).expect(422)
    expect(rejected.body.code).toBe("MEDIA_MAGIC_MISMATCH")
  })
})
