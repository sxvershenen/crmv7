import "reflect-metadata"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { DataSource } from "typeorm"
import { assertSafeTestDatabaseConnection, assertSafeTestDatabaseEnvironment, BusinessCalendarEntity, CatalogOfferingEntity, ChangeLogEntity, CmsNodeEntity, CmsNodeRevisionEntity, CmsSourceLinkEntity, CustomerEntity, databaseEntities, databaseMigrations, OfferingBindingEntity, ResourceGroupEntity, ResourceGroupMemberEntity, UserEntity } from "@crm/db"
import { roleCapabilities } from "@crm/domain"
import { CmsNodeMutationSchema, ResourceCreateSchema } from "@crm/contracts"
import { CmsContentService } from "../cms/cms-content.service.js"
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
    expect(applied.report.counts.cmsSourceNodes).toBe(15)
    const afterCreation = await snapshot()
    for (const [table, rows] of Object.entries(baseline)) expect(afterCreation[table]).toEqual(expect.arrayContaining(rows as string[]))
    expect(applied.report.counts).toMatchObject({ customers: 4, leads: 6, resources: 5, offerings: 8, programTemplates: 2, occurrences: 3, registrations: 3, events: 2, bookings: 3, payments: 2, promotions: 2, tasks: 4, cmsDrafts: 8, priceBooks: 8 })
    const [bath] = await ds.query("SELECT capacity_total FROM resources WHERE code = $1", [`${DEMO_NAMESPACE}-BATH`]) as Array<{ capacity_total: number }>
    expect(bath?.capacity_total).toBe(15)
    const [bathBooking] = await ds.query("SELECT price_amount FROM booking_items WHERE booking_id = $1 AND type = 'bath'", [applied.report.ids.bookings![0]]) as Array<{ price_amount: number }>
    expect(bathBooking?.price_amount).toBe(600_000)
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
    expect(await ds.getRepository(CmsNodeEntity).findOneByOrFail({ id: originalNode.id })).toEqual(beforeNode)
    expect(await ds.getRepository(CmsNodeRevisionEntity).find({ where: { nodeId: originalNode.id }, order: { revision: "ASC" } })).toEqual(beforeRevisions)
    expect(await ds.getRepository(CmsSourceLinkEntity).countBy({ sourceKind: "resource", sourceId: resource.id })).toBe(0)
    const replay = await ds.transaction((manager) => ensureCatalogOfferingEditorialDraft(manager, { offeringId: offering.offeringId, actorId: actor.id, requestId: "promotion-replay" }))
    expect(replay.status).toBe("linked")
    expect(await ds.getRepository(CmsNodeEntity).count()).toBe(nodeCount)
    expect(await ds.getRepository(ChangeLogEntity).countBy({ entityId: originalNode.id, action: "catalog_offering_source_promoted" })).toBe(1)
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
