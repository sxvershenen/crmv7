import { describe, expect, it } from "vitest"

import { ensureCatalogOfferingEditorialDraft } from "./cms-source-draft.js"

describe("event-service CMS source mapping", () => {
  it("creates an editorial-only event_detail draft without using legacy event links", async () => {
    const saved: Array<Record<string, unknown>> = []
    const offering = { id: "11111111-1111-4111-8111-111111111111", kind: "event_service", operationalName: "Corporate", version: 1, archivedAt: null }
    const manager = {
      getRepository: (entity: { name?: string }) => ({ findOneBy: async () => entity.name === "CatalogOfferingEntity" ? offering : null }),
      query: async () => [{ eventServiceTemplateId: "22222222-2222-4222-8222-222222222222" }],
      create: (_entity: unknown, values: Record<string, unknown>) => values,
      save: async (entity: Record<string, unknown>) => { saved.push(entity); return entity },
    }
    const result = await ensureCatalogOfferingEditorialDraft(manager as never, { offeringId: offering.id, actorId: "33333333-3333-4333-8333-333333333333", requestId: "request-1" })
    expect(result.status).toBe("created")
    expect(saved).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "event_detail" }),
      expect.objectContaining({ path: `/drafts/event-services/${offering.id}`, state: "draft" }),
      expect.objectContaining({ relations: [{ kind: "catalog_offering", entityId: offering.id }] }),
    ]))
  })

  it("fails closed on an ambiguous event-service primary binding", async () => {
    const manager = {
      getRepository: (entity: { name?: string }) => ({ findOneBy: async () => entity.name === "CatalogOfferingEntity" ? { id: "11111111-1111-4111-8111-111111111111", kind: "event_service", operationalName: "Corporate", version: 1, archivedAt: null } : null }),
      query: async () => [{ eventServiceTemplateId: "22222222-2222-4222-8222-222222222222" }, { eventServiceTemplateId: "44444444-4444-4444-8444-444444444444" }],
    }
    await expect(ensureCatalogOfferingEditorialDraft(manager as never, { offeringId: "11111111-1111-4111-8111-111111111111", actorId: "33333333-3333-4333-8333-333333333333", requestId: "request-1" })).rejects.toThrow(/requires one exact primary/)
  })
})
