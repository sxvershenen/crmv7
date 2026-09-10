import { describe, expect, it, vi } from "vitest"

vi.mock("../cms/cms-source-draft.js", () => ({
  ensureCatalogOfferingEditorialDraft: vi.fn(async () => ({ status: "created", link: {} })),
}))

import { OfferingEditorApplicationService } from "./offering-editor-application.service.js"
import { BusinessCalendarEntity, CampgroundOfferingTermsEntity, CmsNodeEntity, CmsNodeRevisionEntity, CmsPublicProfileEntity, CmsSourceLinkEntity, OfferingBindingEntity, ResourceEntity } from "@crm/db"

describe("OfferingEditorApplicationService binding target lookup guards", () => {
  const service = new OfferingEditorApplicationService({} as never)

  it("fails closed before persistence when an admin caller lacks content view capability", () => {
    expect(() => (service as unknown as { assertRead(context: unknown): void }).assertRead({
      actor: { capabilities: { canView: true, canViewContent: false } },
      requestId: "request-id",
      entrySurface: "admin",
    })).toThrow(/Недостаточно прав/)
  })

  it("returns an explicit ambiguous resolution instead of selecting one legacy primary binding", async () => {
    const calls: string[] = []
    const rows = [
      { id: "11111111-1111-4111-8111-111111111111", kind: "house", code: "HOUSE-A", operationalName: "Дом А", state: "draft" },
      { id: "22222222-2222-4222-8222-222222222222", kind: "campground", code: "CAMP-B", operationalName: "Кемпинг Б", state: "active" },
    ]
    const query = {
      innerJoin: () => query,
      where: (clause: string) => { calls.push(clause); return query },
      andWhere: (clause: string) => { calls.push(clause); return query },
      orderBy: () => query,
      addOrderBy: () => query,
      getMany: async () => rows,
    }
    const resolvingService = new OfferingEditorApplicationService({ getRepository: () => ({ createQueryBuilder: () => query }) } as never)

    await expect(resolvingService.primaryStayOfferingForResource("33333333-3333-4333-8333-333333333333", {
      actor: { capabilities: { canView: true } }, requestId: "request-id", entrySurface: "internal",
    } as never)).resolves.toEqual({
      resolution: "ambiguous",
      candidates: [
        { offeringId: "11111111-1111-4111-8111-111111111111", kind: "house", code: "HOUSE-A", operationalName: "Дом А", state: "draft" },
        { offeringId: "22222222-2222-4222-8222-222222222222", kind: "campground", code: "CAMP-B", operationalName: "Кемпинг Б", state: "active" },
      ],
    })
    expect(calls).toContain("binding.archived_at IS NULL")
    expect(calls).toContain("offering.archived_at IS NULL")
  })

  it("creates a draft house offering from a locked Resource with server-derived commercial defaults", async () => {
    const resource = { id: "33333333-3333-4333-8333-333333333333", kind: "houses", code: "HOUSE-NEW", name: "Новый дом", capacityMode: "fixed", capacityTotal: 4, archivedAt: null }
    const calendar = { id: "44444444-4444-4444-8444-444444444444", version: 2, timezone: "Europe/Moscow" }
    const query = (resourceLock = false) => {
      const builder = {
        setLock: () => builder,
        innerJoin: () => builder,
        where: () => builder,
        andWhere: () => builder,
        orderBy: () => builder,
        addOrderBy: () => builder,
        getOne: async () => resourceLock ? resource : null,
        getMany: async () => [],
      }
      return builder
    }
    const saved: Array<Record<string, unknown> | Array<Record<string, unknown>>> = []
    const manager = {
      createQueryBuilder: (entity: { name?: string }) => query(entity.name === "ResourceEntity"),
      getRepository: () => ({ createQueryBuilder: () => query(false) }),
      find: async () => [calendar],
      findOne: async () => null,
      query: async () => [],
      create: (_entity: unknown, value: Record<string, unknown>) => value,
      save: async (value: Record<string, unknown> | Array<Record<string, unknown>>) => { saved.push(value); return value },
    }
    const dataSource = { transaction: async (_level: string, operation: (current: typeof manager) => Promise<unknown>) => operation(manager) }
    const creatingService = new OfferingEditorApplicationService(dataSource as never)
    const response = await creatingService.createStayOfferingFromResource(resource.id, {
      operationId: "11111111-1111-4111-8111-111111111111", idempotencyKey: "resource-stay-create-0001",
    }, { actor: { id: "55555555-5555-4555-8555-555555555555", capabilities: { canCreate: true, canEdit: true } }, requestId: "request-id", entrySurface: "internal" } as never)

    expect(response).toMatchObject({ kind: "house", operationalName: "Новый дом", state: "draft" })
    const offering = saved.flat().find((row) => row.kind === "house")
    expect(offering).toMatchObject({ salesMode: "quoted", priceDisplayMode: "from", currency: "RUB", businessCalendarId: calendar.id })
    expect(saved.flat().find((row) => row.role === "primary")).toMatchObject({ resourceId: resource.id, availabilityRequired: true })
  })

  it("marks a house editorial locator eligible once its typed public resolver is available", async () => {
    const offeringId = "11111111-1111-4111-8111-111111111111"
    const nodeId = "22222222-2222-4222-8222-222222222222"
    const revisionId = "33333333-3333-4333-8333-333333333333"
    const now = "2026-09-10T10:00:00.000Z"
    const offering = { id: offeringId, kind: "house", state: "active", archivedAt: null }
    const link = { sourceKind: "catalog_offering", sourceId: offeringId, sourceVersion: 3, nodeId, createdAt: new Date(now) }
    const node = { id: nodeId, version: 2, kind: "resource_detail", status: "active", archivedAt: null }
    const revision = { id: revisionId, revision: 2, state: "draft", path: "/houses/forest", title: "Домик", contentHash: "a".repeat(64), relations: [{ kind: "catalog_offering", entityId: offeringId }] }
    const profile = { kind: "catalog_offering", entityId: offeringId, nodeId, archivedAt: null }
    const manager = {
      findOne: vi.fn(async (entity: unknown) => entity === CmsSourceLinkEntity ? link : entity === CmsNodeEntity ? node : entity === ResourceEntity ? { id: "44444444-4444-4444-8444-444444444444", kind: "houses", capacityMode: "fixed", capacityTotal: 4, archivedAt: null } : entity === BusinessCalendarEntity ? { id: "55555555-5555-4555-8555-555555555555", state: "active", archivedAt: null } : null),
      find: vi.fn(async (entity: unknown) => entity === CmsNodeRevisionEntity ? [revision] : entity === CmsPublicProfileEntity ? [profile] : entity === OfferingBindingEntity ? [{ role: "primary", resourceId: "44444444-4444-4444-8444-444444444444", quantityDefault: 1, capacityImpactDefault: 1, availabilityRequired: true }] : []),
    }

    const locator = await (new OfferingEditorApplicationService({} as never) as unknown as { editorialLocator(manager: unknown, offering: unknown): Promise<{ publication: unknown }> }).editorialLocator(manager, offering)
    expect(locator.publication).toEqual({ eligible: true, blockers: [] })
  })

  it("marks a shared-capacity campground locator eligible only with its campground membership", async () => {
    const offeringId = "11111111-1111-4111-8111-111111111111"
    const nodeId = "22222222-2222-4222-8222-222222222222"
    const revisionId = "33333333-3333-4333-8333-333333333333"
    const resourceId = "44444444-4444-4444-8444-444444444444"
    const calendarId = "55555555-5555-4555-8555-555555555555"
    const offering = { id: offeringId, kind: "campground", state: "active", archivedAt: null, businessCalendarId: calendarId }
    const link = { sourceKind: "catalog_offering", sourceId: offeringId, sourceVersion: 3, nodeId, createdAt: new Date("2026-09-10T10:00:00.000Z") }
    const node = { id: nodeId, version: 2, kind: "resource_detail", status: "active", archivedAt: null }
    const revision = { id: revisionId, revision: 2, state: "draft", path: "/campgrounds/pitches", title: "Своя палатка", contentHash: "a".repeat(64), relations: [{ kind: "catalog_offering", entityId: offeringId }] }
    const terms = { offeringId, offeringKind: "campground", sellableUnit: "own_tent_pitch", inventoryMode: "shared_capacity", capacityUnit: "tent", pricingBasis: "per_night" }
    const resource = { id: resourceId, kind: "campground_own_tent_area", capacityMode: "shared", capacityTotal: 15, archivedAt: null }
    const profile = { kind: "catalog_offering", entityId: offeringId, nodeId, archivedAt: null }
    const manager = {
      findOne: vi.fn(async (entity: unknown) => entity === CmsSourceLinkEntity ? link : entity === CmsNodeEntity ? node : entity === CampgroundOfferingTermsEntity ? terms : entity === ResourceEntity ? resource : entity === BusinessCalendarEntity ? { id: calendarId, state: "active", archivedAt: null } : null),
      find: vi.fn(async (entity: unknown) => entity === CmsNodeRevisionEntity ? [revision] : entity === CmsPublicProfileEntity ? [profile] : entity === OfferingBindingEntity ? [{ role: "primary", resourceId, quantityDefault: 1, capacityImpactDefault: 1, availabilityRequired: true }] : []),
      query: vi.fn().mockResolvedValue([{ id: "66666666-6666-4666-8666-666666666666" }]),
    }

    const locator = await (new OfferingEditorApplicationService({} as never) as unknown as { editorialLocator(manager: unknown, offering: unknown): Promise<{ publication: unknown }> }).editorialLocator(manager, offering)
    expect(locator.publication).toEqual({ eligible: true, blockers: [] })
  })
})
