import { describe, expect, it, vi } from "vitest"
import { CatalogOfferingEntity, CmsNodeEntity, CmsSourceLinkEntity } from "@crm/db"
import { ensureCatalogOfferingEditorialDraft, inspectLegacyCatalogOfferingPromotion } from "./cms-source-draft.js"

function fixture(kind: "house" | "campground" | "venue", candidates = ["offering"], primary = [{ resourceId: "resource" }], affected = 1, legacyPresent = true) {
  const offering = { id: "offering", kind, version: 7, archivedAt: null }
  const link = { id: "link", nodeId: "node", sourceKind: "resource", sourceId: "resource", sourceVersion: 2 }
  let patch: Record<string, unknown> = {}
  const builder = { update: vi.fn().mockReturnThis(), set: vi.fn((value) => { patch = value; return builder }), where: vi.fn().mockReturnThis(), execute: vi.fn(async () => { if (affected) Object.assign(link, patch); return { affected } }) }
  const manager = {
    getRepository: (entity: unknown) => ({
      findOneBy: async (query: Record<string, string>) => entity === CatalogOfferingEntity ? offering : entity === CmsNodeEntity ? { id: "node", kind: "resource_detail" } : entity === CmsSourceLinkEntity && query.sourceKind === link.sourceKind && query.sourceId === link.sourceId && (legacyPresent || query.sourceKind !== "resource") ? link : null,
      findOneByOrFail: async () => link,
    }),
    query: vi.fn(async (sql: string) => sql.includes('SELECT resource_id AS') ? primary : candidates.map((id) => ({ id, matchesKind: true }))),
    createQueryBuilder: () => builder,
    create: (_entity: unknown, value: Record<string, unknown>) => value,
    save: vi.fn(async (value) => value),
  }
  return { manager, link, builder }
}
const input = { offeringId: "offering", actorId: "actor", requestId: "request" }

describe("canonical resource offering CMS source", () => {
  it.each(["house", "campground", "venue"] as const)("promotes the same %s link and replays without creating nodes or revisions", async (kind) => {
    const { manager, link, builder } = fixture(kind)
    expect(await ensureCatalogOfferingEditorialDraft(manager as never, input)).toMatchObject({ status: "promoted", link: { id: "link", nodeId: "node", sourceKind: "catalog_offering", sourceId: "offering", sourceVersion: 7 } })
    expect(manager.query).toHaveBeenLastCalledWith(expect.stringContaining("offering.kind = $2"), ["resource", kind])
    expect(builder.set).toHaveBeenCalledWith({ sourceKind: "catalog_offering", sourceId: "offering", sourceVersion: 7 })
    expect(builder.where).toHaveBeenCalledWith("id = :id AND source_kind = 'resource' AND source_id = :resourceId", { id: "link", resourceId: "resource" })
    expect(manager.save).toHaveBeenCalledOnce()
    expect(manager.save).toHaveBeenCalledWith(expect.objectContaining({ entityType: "cms_node", entityId: "node", action: "catalog_offering_source_promoted" }))
    expect(await ensureCatalogOfferingEditorialDraft(manager as never, input)).toEqual({ status: "linked", link })
    expect(manager.save).toHaveBeenCalledOnce()
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
