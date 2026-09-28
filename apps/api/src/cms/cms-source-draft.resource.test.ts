import { describe, expect, it, vi } from "vitest"
import { CatalogOfferingEntity, CmsNodeEntity, CmsNodeRevisionEntity, CmsPublicProfileEntity, CmsSourceLinkEntity } from "@crm/db"
import { ensureCatalogOfferingEditorialDraft, ensureCmsSourceDraft, inspectLegacyCatalogOfferingPromotion, suggestedCmsSlug } from "./cms-source-draft.js"

function newResourceDraftManager(occupiedPaths: string[] = []) {
  const saved: Array<Record<string, unknown>> = []
  let link: Record<string, unknown> | null = null
  const manager = {
    getRepository: (entity: unknown) => ({ findOneBy: async () => entity === CmsSourceLinkEntity ? link : null }),
    query: vi.fn(async (sql: string, params: unknown[]) => sql.includes("pg_advisory_xact_lock") ? [] : occupiedPaths.some((path) => (params[0] as string[]).includes(path)) ? [{ occupied: true }] : []),
    create: (_entity: unknown, value: Record<string, unknown>) => value,
    save: vi.fn(async (value: Record<string, unknown>) => { saved.push(value); if ("sourceKind" in value) link = value; return value }),
  }
  return { manager, saved }
}

describe("CRM resource page draft", () => {
  const sourceId = "77777777-7777-4777-8777-777777777777"
  const request = { sourceKind: "resource" as const, sourceId, sourceVersion: 1, title: "Дом у озера", actorId: sourceId, requestId: "draft-test" }

  it.each(["house", "houses"])("suggests a readable path for %s at resource creation without publishing", async (resourceKind) => {
    const { manager, saved } = newResourceDraftManager()
    await ensureCmsSourceDraft(manager as never, { ...request, resourceKind })
    expect(saved.find((entry) => "path" in entry)).toMatchObject({ path: "/domiki/dom-u-ozera", slug: "dom-u-ozera", state: "draft", parentNodeId: null })
    expect(saved.find((entry) => "sourceKind" in entry)).toMatchObject({ sourceKind: "resource", sourceId })
  })

  it("avoids a published legacy alias and reuses the same link on repeat", async () => {
    const { manager, saved } = newResourceDraftManager(["/houses/dom-u-ozera"])
    const first = await ensureCmsSourceDraft(manager as never, { ...request, resourceKind: "house" })
    expect(saved.find((entry) => "path" in entry)).toMatchObject({ path: "/domiki/dom-u-ozera-2", slug: "dom-u-ozera-2" })
    const savedCount = saved.length
    expect(await ensureCmsSourceDraft(manager as never, { ...request, resourceKind: "house" })).toEqual(first)
    expect(saved).toHaveLength(savedCount)
  })

  it("keeps every resource as a draft, including one without a public contract", async () => {
    const { manager, saved } = newResourceDraftManager()
    await ensureCmsSourceDraft(manager as never, { ...request, resourceKind: "internal_only" })
    expect(saved.find((entry) => "path" in entry)).toMatchObject({ path: `/drafts/resources/${sourceId}`, state: "draft" })
    expect(saved.find((entry) => "sourceKind" in entry)).toMatchObject({ sourceKind: "resource", sourceId })
  })

  it("transliterates Cyrillic and keeps a valid fallback for an unnamed public label", () => {
    expect(suggestedCmsSlug("Баня и чан «Кедр»", sourceId)).toBe("banya-i-chan-kedr")
    expect(suggestedCmsSlug("— ✨ —", sourceId)).toBe("resource-77777777")
  })
})

function fixture(kind: "house" | "campground" | "venue", candidates = ["offering"], primary = [{ resourceId: "resource" }], affected = 1, legacyPresent = true) {
  const offering = { id: "offering", kind, version: 7, archivedAt: null }
  const link = { id: "link", nodeId: "node", sourceKind: "resource", sourceId: "resource", sourceVersion: 2 }
  let profile: Record<string, unknown> | null = null
  let revision: Record<string, unknown> = { id: "revision-1", nodeId: "node", revision: 1, state: "draft", path: "/domiki/authored", slug: "authored", parentNodeId: null, sortOrder: 0, title: "Авторский заголовок", summary: "Авторское описание", hero: { mode: "inherit" }, sections: [], seo: { title: "Авторский заголовок" }, relations: [], schemaVersion: 1 }
  let patch: Record<string, unknown> = {}
  let target: unknown = null
  const builder = { update: vi.fn((entity) => { target = entity; return builder }), set: vi.fn((value) => { patch = value; return builder }), where: vi.fn().mockReturnThis(), execute: vi.fn(async () => { if (affected && target === CmsSourceLinkEntity) Object.assign(link, patch); return { affected } }) }
  const manager = {
    getRepository: (entity: unknown) => ({
      findOneBy: async (query: Record<string, string>) => entity === CatalogOfferingEntity ? offering : entity === CmsNodeEntity ? { id: "node", kind: "resource_detail" } : entity === CmsPublicProfileEntity ? profile : entity === CmsSourceLinkEntity && query.sourceKind === link.sourceKind && query.sourceId === link.sourceId && (legacyPresent || query.sourceKind !== "resource") ? link : null,
      findOneByOrFail: async () => link,
      findOne: async () => entity === CmsNodeRevisionEntity ? revision : null,
      update: vi.fn(async (_where: unknown, patch: Record<string, unknown>) => { if (entity === CmsNodeRevisionEntity) Object.assign(revision, patch); return { affected: 1 } }),
    }),
    query: vi.fn(async (sql: string) => sql.includes('SELECT resource_id AS') ? primary : candidates.map((id) => ({ id, matchesKind: true }))),
    createQueryBuilder: () => builder,
    create: (_entity: unknown, value: Record<string, unknown>) => value,
    save: vi.fn(async (value: Record<string, unknown>) => { if ("kind" in value && "entityId" in value) profile = value; if ("revision" in value && "nodeId" in value) revision = value; return value }),
  }
  return { manager, link, builder, getRevision: () => revision, getProfile: () => profile }
}
const input = { offeringId: "offering", actorId: "actor", requestId: "request" }

describe("canonical resource offering CMS source", () => {
  it("repairs an incomplete existing link once without replacing the editorial page", async () => {
    const { manager, link, getRevision, getProfile } = fixture("venue")
    Object.assign(link, { sourceKind: "catalog_offering", sourceId: "offering" })
    expect(await ensureCatalogOfferingEditorialDraft(manager as never, input)).toEqual({ status: "linked", link })
    expect(getProfile()).toMatchObject({ kind: "catalog_offering", entityId: "offering", nodeId: "node" })
    expect(getRevision()).toMatchObject({ revision: 2, title: "Авторский заголовок", relations: [{ kind: "catalog_offering", entityId: "offering" }] })
    expect(manager.save).toHaveBeenCalledWith(expect.objectContaining({ action: "catalog_offering_source_repaired" }))
    const saves = manager.save.mock.calls.length
    expect(await ensureCatalogOfferingEditorialDraft(manager as never, input)).toEqual({ status: "linked", link })
    expect(manager.save).toHaveBeenCalledTimes(saves)
  })

  it.each(["house", "campground", "venue"] as const)("promotes the same %s page, preserves authored fields and replays without duplicates", async (kind) => {
    const { manager, link, builder, getRevision, getProfile } = fixture(kind)
    expect(await ensureCatalogOfferingEditorialDraft(manager as never, input)).toMatchObject({ status: "promoted", link: { id: "link", nodeId: "node", sourceKind: "catalog_offering", sourceId: "offering", sourceVersion: 7 } })
    expect(manager.query).toHaveBeenLastCalledWith(expect.stringContaining("offering.kind = $2"), ["resource", kind])
    expect(builder.set).toHaveBeenCalledWith({ sourceKind: "catalog_offering", sourceId: "offering", sourceVersion: 7 })
    expect(builder.where).toHaveBeenCalledWith("id = :id AND source_kind = 'resource' AND source_id = :resourceId", { id: "link", resourceId: "resource" })
    expect(getProfile()).toMatchObject({ kind: "catalog_offering", entityId: "offering", nodeId: "node" })
    expect(getRevision()).toMatchObject({ revision: 2, state: "draft", path: "/domiki/authored", title: "Авторский заголовок", summary: "Авторское описание", relations: [{ kind: "catalog_offering", entityId: "offering" }] })
    expect(manager.save).toHaveBeenCalledTimes(3)
    expect(manager.save).toHaveBeenCalledWith(expect.objectContaining({ entityType: "cms_node", entityId: "node", action: "catalog_offering_source_promoted" }))
    expect(await ensureCatalogOfferingEditorialDraft(manager as never, input)).toEqual({ status: "linked", link })
    expect(manager.save).toHaveBeenCalledTimes(3)
  })
  it.each(["house", "campground", "venue"] as const)("does not guess between ambiguous %s candidates", async (kind) => {
    const { manager, link, builder } = fixture(kind, ["offering", "other"])
    expect(await ensureCatalogOfferingEditorialDraft(manager as never, input)).toMatchObject({ status: "report_only", report: { status: "ambiguous" } })
    expect(link.sourceKind).toBe("resource")
    expect(builder.update).not.toHaveBeenCalled()
    expect(manager.save).not.toHaveBeenCalled()
  })
  it.each([{ primary: [] }, { primary: [{ resourceId: "one" }, { resourceId: "two" }] }])("rejects missing or multiple exact primary bindings", async ({ primary }) => {
    const { manager, builder } = fixture("venue", ["offering"], primary)
    await expect(ensureCatalogOfferingEditorialDraft(manager as never, input)).rejects.toThrow("requires one exact primary Resource binding")
    expect(builder.update).not.toHaveBeenCalled()
    expect(manager.save).not.toHaveBeenCalled()
  })
  it("does not record success after a concurrent link change", async () => {
    const { manager, link } = fixture("campground", ["offering"], [{ resourceId: "resource" }], 0)
    await expect(ensureCatalogOfferingEditorialDraft(manager as never, input)).rejects.toThrow("changed during promotion")
    expect(link.sourceKind).toBe("resource")
    expect(manager.save).not.toHaveBeenCalled()
  })
  it("keeps the read-only reconciliation default scoped to houses", async () => {
    const { manager } = fixture("house")
    await inspectLegacyCatalogOfferingPromotion(manager as never, "resource")
    expect(manager.query).toHaveBeenCalledWith(expect.any(String), ["resource", "house"])
  })
  it("does not promote a resource whose sole candidate has another kind", async () => {
    const { manager, link, builder } = fixture("venue")
    manager.query.mockImplementation(async (sql: string) => sql.includes('SELECT resource_id AS') ? [{ resourceId: "resource" }] : [{ id: "house-offering", matchesKind: false }])
    expect(await ensureCatalogOfferingEditorialDraft(manager as never, input)).toMatchObject({ status: "report_only", report: { status: "no_exact_primary", candidateOfferingIds: ["house-offering"] } })
    expect(link.sourceKind).toBe("resource")
    expect(builder.update).not.toHaveBeenCalled()
  })

  it("does not create a second node when another offering has already taken the resource link", async () => {
    const { manager, builder } = fixture("venue", ["offering", "legacy-house"], [{ resourceId: "resource" }], 1, false)
    expect(await ensureCatalogOfferingEditorialDraft(manager as never, input)).toMatchObject({ status: "report_only", report: { status: "ambiguous", legacyLinkId: null } })
    expect(builder.update).not.toHaveBeenCalled()
    expect(manager.save).not.toHaveBeenCalled()
  })

})
