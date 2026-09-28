import "reflect-metadata"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { DataSource } from "typeorm"
import { AddonOfferingTermsEntity, assertSafeTestDatabaseConnection, assertSafeTestDatabaseEnvironment, BusinessCalendarDateEntity, BusinessCalendarEntity, CatalogOfferingEntity, ChangeLogEntity, CmsNodeEntity, CmsNodeRevisionEntity, CmsSourceLinkEntity, CustomerEntity, databaseEntities, databaseMigrations, OfferingBindingEntity, ResourceGroupEntity, ResourceGroupMemberEntity, ScheduledResourceEditorialLink1788207200000, UserEntity } from "@crm/db"
import { roleCapabilities } from "@crm/domain"
import { BookingCreateSchema, BookingTransitionSchema, BookingUpdateSchema, CmsNodeMutationSchema, ResourceCreateSchema } from "@crm/contracts"
import { CmsContentService } from "../cms/cms-content.service.js"
import { BookingsService } from "../bookings/bookings.service.js"
import { MarketingService } from "../marketing/marketing.service.js"
import { OperationalQuoteAcceptanceService } from "../offerings/operational-quote-acceptance.service.js"
import { ensureCatalogOfferingEditorialDraft, inspectLegacyCatalogOfferingPromotion } from "../cms/cms-source-draft.js"
import { ResourcesService } from "../resources/resources.service.js"
import { OfferingEditorApplicationService } from "../offerings/offering-editor-application.service.js"
import { demoId, DEMO_NAMESPACE, seedDemoWorkspace } from "./demo-workspace.js"

// Separate opt-in target; never falls back to the development DATABASE_URL.
describe.skipIf(process.env.DEMO_WORKSPACE_DB_TEST !== "1")("demo seed with real service transactions", () => {
  let ds: DataSource
  let environment: NodeJS.ProcessEnv
  beforeAll(async () => {
    const target = assertSafeTestDatabaseEnvironment(process.env)
    ds = new DataSource({ type: "postgres", url: target.url, entities: databaseEntities, migrations: databaseMigrations, synchronize: false, migrationsRun: false })
    await ds.initialize()
    await assertSafeTestDatabaseConnection(ds, target)
    // Guarded disposable database owned exclusively by this opt-in test.
    await ds.query("DROP SCHEMA public CASCADE")
    await ds.query("CREATE SCHEMA public")
    await ds.runMigrations()
    environment = { APP_ENV: "development", DATABASE_URL: target.url }
    await ds.getRepository(UserEntity).insert({ id: demoId("test-actor"), email: "actor@example.invalid", displayName: "Демо тест", passwordHash: "not-a-login-password", role: "admin", status: "active", createdBy: null, updatedBy: null, archivedAt: null })
    await ds.getRepository(BusinessCalendarEntity).insert({ id: demoId("test-calendar"), code: "TEST-DEMO-CALENDAR", name: "Test calendar", timezone: "Europe/Moscow", countryCode: "RU", source: "official_ru", sourceVersion: "test", state: "active", importedAt: new Date(), coverageFrom: "2026-01-01", coverageToExclusive: "2028-01-01", contentHash: "0".repeat(64), createdBy: null, updatedBy: null, archivedAt: null })
    await ds.getRepository(BusinessCalendarDateEntity).insert({ id: demoId("test-calendar-date"), calendarId: demoId("test-calendar"), localDate: "2026-09-12", officialClass: "weekend", officialLabel: null, sourceVersion: "test", createdBy: null, updatedBy: null, archivedAt: null })
  }, 120000)
  afterAll(async () => { if (ds?.isInitialized) await ds.destroy() })

  async function snapshot() {
    const result: Record<string, unknown> = {}
    for (const table of ds.entityMetadatas.map((entity) => entity.tableName).sort()) {
      const rows = await ds.query(`SELECT to_jsonb(row) AS value FROM "${table.replaceAll('"', '""')}" row`)
      result[table] = rows.map((row: { value: unknown }) => JSON.stringify(row.value)).sort()
    }
    return result
  }

  it("rolls back every service write, creates linked facts, and preserves edited rows on replay", async () => {
    const baseline = await snapshot()
    const rehearsal = await seedDemoWorkspace(ds, environment, { now: new Date("2026-09-12T10:00:00Z"), rehearse: true })
    expect(rehearsal.status).toBe("rehearsed")
    expect(await snapshot()).toEqual(baseline)
    const applied = await seedDemoWorkspace(ds, environment, { now: new Date("2026-09-12T10:00:00Z") })
    expect(applied.status).toBe("created")
    expect(applied.report.counts.cmsSourceNodes).toBe(18)
    const afterCreation = await snapshot()
    for (const [table, rows] of Object.entries(baseline)) expect(afterCreation[table]).toEqual(expect.arrayContaining(rows as string[]))
    expect(applied.report.counts).toMatchObject({ customers: 4, leads: 6, resources: 6, offerings: 12, programTemplates: 2, occurrences: 3, registrations: 3, events: 2, bookings: 3, payments: 2, promotions: 2, tasks: 4, cmsDrafts: 12, priceBooks: 12 })
    const [bath] = await ds.query("SELECT capacity_total FROM resources WHERE code = $1", [`${DEMO_NAMESPACE}-BATH`]) as Array<{ capacity_total: number }>
    expect(bath?.capacity_total).toBe(15)
    const [bathBooking] = await ds.query("SELECT price_amount FROM booking_items WHERE booking_id = $1 AND type = 'bath'", [applied.report.ids.bookings![0]]) as Array<{ price_amount: number }>
    expect(bathBooking?.price_amount).toBe(300_000)
    const [bathOffering] = await ds.query("SELECT offering.id FROM catalog_offerings offering JOIN offering_bindings binding ON binding.offering_id = offering.id JOIN resources resource ON resource.id = binding.resource_id WHERE resource.code = $1 AND offering.kind = 'addon'", [`${DEMO_NAMESPACE}-BATH`]) as Array<{ id: string }>
    const bathRates = await ds.query("SELECT plan.rate_key, plan.base_amount_minor FROM rate_plans plan JOIN price_books book ON book.id = plan.price_book_id WHERE book.offering_id = $1 ORDER BY plan.sort_order", [bathOffering!.id]) as Array<{ rate_key: string; base_amount_minor: number }>
    expect(bathRates.map((row) => row.base_amount_minor)).toEqual([300_000, 350_000, 400_000, 600_000, 700_000, 800_000])
    const accessoryPrices = await ds.query("SELECT offering.operational_name, plan.base_amount_minor FROM catalog_offerings offering JOIN price_books book ON book.offering_id = offering.id JOIN rate_plans plan ON plan.price_book_id = book.id WHERE offering.code IN ($1, $2) ORDER BY offering.code", [`${DEMO_NAMESPACE}-ADDON-3`, `${DEMO_NAMESPACE}-ADDON-4`]) as Array<{ operational_name: string; base_amount_minor: number }>
    expect(accessoryPrices).toEqual([
      { operational_name: `${DEMO_NAMESPACE} · Аренда большого полотенца`, base_amount_minor: 25_000 },
      { operational_name: `${DEMO_NAMESPACE} · Аренда халата`, base_amount_minor: 50_000 },
    ])
    expect((await ds.query("SELECT count(*)::int AS count FROM accepted_offering_quote_links"))[0].count).toBe(0)
    expect((await ds.query("SELECT count(*)::int AS count FROM cms_releases"))[0].count).toBe(0)
    const customerId = applied.report.ids.customers![0]!
    await ds.getRepository(CustomerEntity).update({ id: customerId }, { name: "Operator edited demo customer" })
    const edited = await snapshot()
    const replay = await seedDemoWorkspace(ds, environment, { now: new Date("2027-04-01T10:00:00Z") })
    expect(replay.status).toBe("unchanged")
    expect(replay.report.namespace).toBe(DEMO_NAMESPACE)
    expect(await snapshot()).toEqual(edited)
  }, 120000)
  it.each(["house", "campground", "venue"] as const)("keeps the edited resource draft identity when preparing %s", async (kind) => {
    const actor = { id: demoId("test-actor"), name: "Демо тест", role: "admin" as const, capabilities: roleCapabilities("admin") }
    const resource = await new ResourcesService(ds).create(ResourceCreateSchema.parse({ code: `TEST-PROMOTION-${kind.toUpperCase()}`, kind: kind === "campground" ? "campground_owned_tent" : kind, name: `Resource ${kind}`, capacityMode: "fixed", capacityTotal: 4, settings: {} }), actor, "promotion-test")
    if (kind === "campground") {
      const group = await ds.getRepository(ResourceGroupEntity).save({ id: demoId("promotion-group"), code: "TEST-PROMOTION-CAMP", kind: "campground", name: "Test camp", state: "active", createdBy: actor.id, updatedBy: actor.id, archivedAt: null })
      await ds.getRepository(ResourceGroupMemberEntity).insert({ id: demoId("promotion-member"), groupId: group.id, resourceId: resource.id, role: "owned_tent", sortOrder: 0, createdBy: actor.id, updatedBy: actor.id, archivedAt: null })
    }
    const originalLink = await ds.getRepository(CmsSourceLinkEntity).findOneByOrFail({ sourceKind: "resource", sourceId: resource.id })
    const originalNode = await ds.getRepository(CmsNodeEntity).findOneByOrFail({ id: originalLink.nodeId })
    const initialRevision = await ds.getRepository(CmsNodeRevisionEntity).findOneByOrFail({ nodeId: originalNode.id })
    const technicalRoute = { path: initialRevision.path, slug: initialRevision.slug, parentNodeId: initialRevision.parentNodeId, sortOrder: initialRevision.sortOrder }
    const technicalEdited = await new CmsContentService(ds).update(originalLink.nodeId, CmsNodeMutationSchema.parse({ operationId: demoId(`technical-edit-${kind}`), idempotencyKey: `test.promotion.${kind}.technical`, expectedVersion: originalNode.version, route: technicalRoute, title: `Text-only ${kind}` }), actor, "promotion-test")
    expect(technicalEdited.currentRevision?.route).toEqual(technicalRoute)
    expect(technicalEdited.currentRevision?.title).toBe(`Text-only ${kind}`)
    await new CmsContentService(ds).update(originalLink.nodeId, CmsNodeMutationSchema.parse({ operationId: demoId(`edit-${kind}`), idempotencyKey: `test.promotion.${kind}.edit`, expectedVersion: technicalEdited.node.version, route: { path: `/authored-${kind}`, slug: `authored-${kind}`, parentNodeId: null, sortOrder: 0 }, title: `Authored ${kind}`, summary: "Сохранить редакторский текст", hero: { mode: "disabled" } }), actor, "promotion-test")
    const beforeNode = await ds.getRepository(CmsNodeEntity).findOneByOrFail({ id: originalNode.id })
    const beforeRevisions = await ds.getRepository(CmsNodeRevisionEntity).find({ where: { nodeId: originalNode.id }, order: { revision: "ASC" } })
    const nodeCount = await ds.getRepository(CmsNodeEntity).count()
    const editor = new OfferingEditorApplicationService(ds)
    const operation = { operationId: demoId(`promote-${kind}`), idempotencyKey: `test.promotion.${kind}.create` }
    const context = { actor, requestId: "promotion-test", entrySurface: "internal" as const }
    const offering = kind === "venue" ? await editor.createVenueOfferingFromResource(resource.id, operation, context) : await editor.createStayOfferingFromResource(resource.id, operation, context)
    const promoted = await ds.getRepository(CmsSourceLinkEntity).findOneByOrFail({ sourceKind: "catalog_offering", sourceId: offering.offeringId })
    expect(promoted.id).toBe(originalLink.id)
    expect(promoted.nodeId).toBe(originalNode.id)
    expect(await ds.getRepository(CmsNodeEntity).count()).toBe(nodeCount)
    expect(await ds.getRepository(CmsNodeEntity).findOneByOrFail({ id: originalNode.id })).toMatchObject({ id: beforeNode.id, kind: beforeNode.kind, version: beforeNode.version + 1 })
    const afterRevisions = await ds.getRepository(CmsNodeRevisionEntity).find({ where: { nodeId: originalNode.id }, order: { revision: "ASC" } })
    expect(afterRevisions).toHaveLength(beforeRevisions.length + 1)
    expect(afterRevisions.slice(0, -1).map((revision) => ({ ...revision, state: null }))).toEqual(beforeRevisions.map((revision) => ({ ...revision, state: null })))
    expect(afterRevisions.at(-1)).toMatchObject({ path: beforeRevisions.at(-1)!.path, title: beforeRevisions.at(-1)!.title, summary: beforeRevisions.at(-1)!.summary, hero: beforeRevisions.at(-1)!.hero, sections: beforeRevisions.at(-1)!.sections, seo: beforeRevisions.at(-1)!.seo, relations: [...beforeRevisions.at(-1)!.relations, { kind: "catalog_offering", entityId: offering.offeringId }] })
    expect(await ds.getRepository(CmsSourceLinkEntity).countBy({ sourceKind: "resource", sourceId: resource.id })).toBe(0)
    const replay = await ds.transaction((manager) => ensureCatalogOfferingEditorialDraft(manager, { offeringId: offering.offeringId, actorId: actor.id, requestId: "promotion-replay" }))
    expect(replay.status).toBe("linked")
    expect(await ds.getRepository(CmsNodeEntity).count()).toBe(nodeCount)
    expect(await ds.getRepository(ChangeLogEntity).countBy({ entityId: originalNode.id, action: "catalog_offering_source_promoted" })).toBe(1)
  })

  it("prepares bath pricing on the existing CMS resource draft and replays without a duplicate page", async () => {
    const actor = { id: demoId("test-actor"), name: "Демо тест", role: "admin" as const, capabilities: roleCapabilities("admin") }
    const resource = await new ResourcesService(ds).create(ResourceCreateSchema.parse({ code: "TEST-BATH-PRICING", kind: "bath", name: "Баня Кедр", capacityMode: "fixed", capacityTotal: 15, settings: { active: true } }), actor, "bath-pricing-test")
    const before = await ds.getRepository(CmsSourceLinkEntity).findOneByOrFail({ sourceKind: "resource", sourceId: resource.id })
    const nodeCount = await ds.getRepository(CmsNodeEntity).count()
    const editor = new OfferingEditorApplicationService(ds)
    const operation = { operationId: demoId("bath-offering-create"), idempotencyKey: "test.bath-offering.create" }
    const context = { actor, requestId: "bath-pricing-test", entrySurface: "internal" as const }
    const result = await editor.createScheduledOfferingFromResource(resource.id, operation, context)
    expect(result).toMatchObject({ kind: "addon", operationalName: "Баня Кедр", state: "draft" })
    expect(await ds.getRepository(AddonOfferingTermsEntity).findOneByOrFail({ offeringId: result.offeringId })).toMatchObject({ serviceType: "scheduled_resource", standalone: true })
    expect(await ds.getRepository(CmsSourceLinkEntity).findOneByOrFail({ sourceKind: "catalog_offering", sourceId: result.offeringId })).toMatchObject({ id: before.id, nodeId: before.nodeId })
    expect(await ds.getRepository(CmsNodeEntity).count()).toBe(nodeCount)
    expect(await editor.primaryScheduledOfferingForResource(resource.id, context)).toMatchObject({ resolution: "linked", offering: { offeringId: result.offeringId } })
    expect(await editor.createScheduledOfferingFromResource(resource.id, operation, context)).toEqual(result)
    await expect(editor.createScheduledOfferingFromResource(resource.id, { operationId: demoId("bath-offering-duplicate"), idempotencyKey: "test.bath-offering.duplicate" }, context)).rejects.toMatchObject({ response: { code: "RESOURCE_SCHEDULED_OFFERING_ALREADY_LINKED" } })
    const initialEditor = await editor.editor(result.offeringId, context)
    const priceDraft = await editor.createDraft(result.offeringId, {
      operationId: demoId("bath-price-draft"), idempotencyKey: "test.bath-price.draft", expectedPricingVersion: initialEditor.ownerVersions.pricing,
      supersedesPriceBookId: null, name: "Тарифы бани", validFrom: "2026-09-12", validToExclusive: null, changeReason: "Первый прайс",
      ratePlans: [
        { key: "standard_6", label: "Стандарт", pricingBasis: "per_hour", quantityMetric: "guests", baseAmount: 300_000, includedQuantity: null, baseExtraUnitAmount: null, minQuantity: 1, maxQuantity: 6, minDurationMinutes: null, maxDurationMinutes: null, isDefault: true, displayOrder: 0, rules: [] },
        { key: "standard_10", label: "Стандарт", pricingBasis: "per_hour", quantityMetric: "guests", baseAmount: 350_000, includedQuantity: null, baseExtraUnitAmount: null, minQuantity: 7, maxQuantity: 10, minDurationMinutes: null, maxDurationMinutes: null, isDefault: false, displayOrder: 1, rules: [] },
      ],
    }, context)
    const activePrice = await editor.activate(result.offeringId, priceDraft.priceBook.id, { operationId: demoId("bath-price-activate"), idempotencyKey: "test.bath-price.activate", expectedPricingVersion: priceDraft.pricingVersion, reason: "Первый прайс" }, context)
    expect(activePrice.priceBook).toMatchObject({ state: "active", ratePlans: [{ baseAmount: 300_000 }, { baseAmount: 350_000 }] })
    expect((await editor.editor(result.offeringId, context)).offering).toMatchObject({ state: "active", activePriceBookId: activePrice.priceBook.id })
    const preview = await editor.previewScheduledResourceQuote(resource.id, { startsAt: "2026-09-12T09:00:00.000Z", endsAt: "2026-09-12T10:30:00.000Z", guests: 6, ratePlanKey: "standard_6", currency: "RUB" }, context)
    expect(preview).toMatchObject({ mode: "priced", billableHours: 2, total: { amountMinor: 600_000, currency: "RUB" } })
    const customer = (await ds.getRepository(CustomerEntity).find({ take: 1 }))[0]!
    const bookings = new BookingsService(ds, new OperationalQuoteAcceptanceService(), new MarketingService(ds))
    const booking = await bookings.create(BookingCreateSchema.parse({
      customerId: customer.id, operationId: demoId("bath-priced-booking"), idempotencyKey: "test.bath-priced-booking", promoCode: null, note: null, assignees: [], overrideConflict: false,
      items: [{ type: "bath", resourceId: resource.id, startAt: "2026-09-12T09:00:00.000Z", endAt: "2026-09-12T10:30:00.000Z", quantity: 6, ratePlanKey: "standard_6", price: { amountMinor: 100, currency: "RUB" }, discount: { amountMinor: 0, currency: "RUB" }, preparationMinutes: 0, quoteSnapshotId: null, addOns: [] }],
    }), actor, "bath-pricing-test")
    expect(booking.items[0]).toMatchObject({ price: { amountMinor: 600_000, currency: "RUB" }, ratePlanKey: "standard_6" })
    const [storedItem] = await ds.query("SELECT price_amount, pricing_snapshot FROM booking_items WHERE id = $1", [booking.items[0]!.id]) as Array<{ price_amount: number; pricing_snapshot: Record<string, unknown> }>
    expect(storedItem).toMatchObject({ price_amount: 600_000, pricing_snapshot: { ratePlanKey: "standard_6", billableHours: 2, totalAmountMinor: 600_000 } })
    const oneHour = await bookings.create(BookingCreateSchema.parse({
      customerId: customer.id, operationId: demoId("bath-one-hour-booking"), idempotencyKey: "test.bath-one-hour-booking", promoCode: null, note: null, assignees: [], overrideConflict: false,
      items: [{ type: "bath", resourceId: resource.id, startAt: "2026-09-12T15:00:00.000Z", endAt: "2026-09-12T16:00:00.000Z", quantity: 6, ratePlanKey: "standard_6", price: { amountMinor: 1, currency: "RUB" }, discount: { amountMinor: 0, currency: "RUB" }, preparationMinutes: 0, quoteSnapshotId: null, addOns: [] }],
    }), actor, "bath-pricing-test")
    expect(oneHour.items[0]).toMatchObject({ endAt: "2026-09-12T16:00:00.000Z", preparationMinutes: 30, price: { amountMinor: 300_000, currency: "RUB" } })
    const [oneHourStorage] = await ds.query("SELECT item.end_at AS service_end, item.preparation_minutes, item.pricing_snapshot, allocation.end_at AS occupied_until FROM booking_items item JOIN resource_allocations allocation ON allocation.source_id = item.id AND allocation.source_type = 'booking_item' WHERE item.id = $1", [oneHour.items[0]!.id]) as Array<{ service_end: Date; preparation_minutes: number; pricing_snapshot: { billableHours: number }; occupied_until: Date }>
    expect(oneHourStorage).toMatchObject({ preparation_minutes: 30, pricing_snapshot: { billableHours: 1 } })
    expect(oneHourStorage!.service_end.toISOString()).toBe("2026-09-12T16:00:00.000Z")
    expect(oneHourStorage!.occupied_until.toISOString()).toBe("2026-09-12T16:30:00.000Z")
    const noteOnly = await bookings.update(booking.id, BookingUpdateSchema.parse({
      expectedVersion: booking.version, operationId: demoId("bath-priced-note"), idempotencyKey: "test.bath-priced-note", note: "Уточнить время прибытия", overrideConflict: false,
      items: [{ type: "bath", resourceId: resource.id, startAt: "2026-09-12T09:00:00.000Z", endAt: "2026-09-12T10:30:00.000Z", quantity: 6, ratePlanKey: "standard_6", price: { amountMinor: 600_000, currency: "RUB" }, discount: { amountMinor: 0, currency: "RUB" }, preparationMinutes: 0, quoteSnapshotId: null, addOns: [] }],
    }), actor, "bath-pricing-test")
    expect(noteOnly.items[0]!.id).toBe(booking.items[0]!.id)
    expect(noteOnly.total.amountMinor).toBe(600_000)
    const unconfirmed = await bookings.transition(booking.id, BookingTransitionSchema.parse({ expectedVersion: noteOnly.version, operationId: demoId("bath-priced-unconfirmed"), idempotencyKey: "test.bath-priced-unconfirmed", status: "unconfirmed" }), actor, "bath-pricing-test")
    const confirmed = await bookings.transition(booking.id, BookingTransitionSchema.parse({ expectedVersion: unconfirmed.version, operationId: demoId("bath-priced-confirmed"), idempotencyKey: "test.bath-priced-confirmed", status: "confirmed" }), actor, "bath-pricing-test")
    await expect(bookings.update(booking.id, BookingUpdateSchema.parse({
      expectedVersion: confirmed.version, operationId: demoId("bath-priced-change-confirmed"), idempotencyKey: "test.bath-priced-change-confirmed", overrideConflict: false,
      items: [{ type: "bath", resourceId: resource.id, startAt: "2026-09-12T09:00:00.000Z", endAt: "2026-09-12T11:00:00.000Z", quantity: 6, ratePlanKey: "standard_6", price: { amountMinor: 600_000, currency: "RUB" }, discount: { amountMinor: 0, currency: "RUB" }, preparationMinutes: 0, quoteSnapshotId: null, addOns: [] }],
    }), actor, "bath-pricing-test")).rejects.toMatchObject({ response: { code: "BOOKING_PRICED_ITEM_IMMUTABLE" } })
    await expect(bookings.create(BookingCreateSchema.parse({
      customerId: customer.id, operationId: demoId("bath-priced-over-capacity"), idempotencyKey: "test.bath-priced-over-capacity", promoCode: null, note: null, assignees: [], overrideConflict: false,
      items: [{ type: "bath", resourceId: resource.id, startAt: "2026-09-12T13:00:00.000Z", endAt: "2026-09-12T14:00:00.000Z", quantity: 16, ratePlanKey: "standard_6", price: { amountMinor: 1, currency: "RUB" }, discount: { amountMinor: 0, currency: "RUB" }, preparationMinutes: 0, quoteSnapshotId: null, addOns: [] }],
    }), actor, "bath-pricing-test")).rejects.toMatchObject({ response: { code: "RESOURCE_CAPACITY_EXCEEDED" } })
    await expect(ds.transaction((manager) => new ScheduledResourceEditorialLink1788207200000().down(manager.queryRunner!))).rejects.toThrow("rollback is unsafe")
  })

  it("refuses to take a venue resource draft from a competing legacy house binding", async () => {
    const actor = { id: demoId("test-actor"), name: "Демо тест", role: "admin" as const, capabilities: roleCapabilities("admin") }
    const resource = await new ResourcesService(ds).create(ResourceCreateSchema.parse({ code: "TEST-CROSS-KIND-VENUE", kind: "venue", name: "Legacy shared resource", capacityMode: "fixed", capacityTotal: 20, settings: {} }), actor, "cross-kind-test")
    const link = await ds.getRepository(CmsSourceLinkEntity).findOneByOrFail({ sourceKind: "resource", sourceId: resource.id })
    const base = await ds.getRepository(CatalogOfferingEntity).findOneByOrFail({ kind: "house" })
    const competitor = await ds.getRepository(CatalogOfferingEntity).save({ ...base, id: demoId("cross-kind-house"), code: "TEST-CROSS-KIND-HOUSE", version: 1, pricingVersion: 1 })
    await ds.getRepository(OfferingBindingEntity).insert({ id: demoId("cross-kind-binding"), offeringId: competitor.id, resourceId: resource.id, resourceGroupId: null, programTemplateId: null, eventServiceTemplateId: null, role: "primary", quantityDefault: 1, capacityImpactDefault: 1, preparationBeforeMinutes: 0, preparationAfterMinutes: 0, availabilityRequired: true, createdBy: actor.id, updatedBy: actor.id, archivedAt: null })
    expect(await inspectLegacyCatalogOfferingPromotion(ds.manager, resource.id, "venue")).toMatchObject({ status: "no_exact_primary", candidateOfferingIds: [competitor.id] })
    const count = await ds.getRepository(CmsNodeEntity).count()
    await expect(new OfferingEditorApplicationService(ds).createVenueOfferingFromResource(resource.id, { operationId: demoId("cross-kind-create"), idempotencyKey: "test.cross-kind.create" }, { actor, requestId: "cross-kind-test", entrySurface: "internal" })).rejects.toMatchObject({ response: { code: "OFFERING_EDITORIAL_RECONCILIATION_REQUIRED", details: { status: "ambiguous" } } })
    expect(await ds.getRepository(CmsSourceLinkEntity).findOneByOrFail({ id: link.id })).toEqual(link)
    expect(await ds.getRepository(CmsNodeEntity).count()).toBe(count)
    expect(await ds.getRepository(OfferingBindingEntity).countBy({ resourceId: resource.id })).toBe(1)
  })

})
