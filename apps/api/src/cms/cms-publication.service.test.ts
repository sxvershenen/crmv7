import { describe, expect, it } from "vitest"

import { materializeRelease } from "./cms-publication.service.js"

const rootId = "11111111-1111-4111-8111-111111111111"
const childId = "22222222-2222-4222-8222-222222222222"
const rootRevisionId = "33333333-3333-4333-8333-333333333333"
const childRevisionId = "44444444-4444-4444-8444-444444444444"

function candidate(input: { nodeId: string; revisionId: string; kind: string; path: string; slug: string; parentNodeId?: string | null; sections: unknown[]; relations?: unknown[]; sourceKind?: string | null; safeProjectionDependency?: unknown }) {
  return {
    node: { id: input.nodeId, kind: input.kind, status: "active" },
    sourceKind: input.sourceKind ?? null,
    safeProjectionDependency: input.safeProjectionDependency ?? null,
    revision: {
      id: input.revisionId, nodeId: input.nodeId, revision: 1, state: "approved", path: input.path, slug: input.slug,
      parentNodeId: input.parentNodeId ?? null, title: input.slug, summary: null, sections: input.sections,
      seo: { title: input.slug, description: `${input.slug} description` }, relations: input.relations ?? [], contentHash: "a".repeat(64),
    },
  }
}

const heroOverride = {
  id: "55555555-5555-4555-8555-555555555555", key: "hero", renderer: "hero", rendererVersion: "1", schemaVersion: 1, order: 10,
  policy: { mode: "override", patch: { scalars: { title: { operation: "replace", value: "База отдыха" } }, objects: {}, keyedArrays: {} } },
}

describe("materializeRelease", () => {
  it("pins deterministic parent inheritance into the child release snapshot", () => {
    const root = candidate({ nodeId: rootId, revisionId: rootRevisionId, kind: "home", path: "/", slug: "home", sections: [heroOverride] })
    const child = candidate({ nodeId: childId, revisionId: childRevisionId, kind: "landing", path: "/svadby", slug: "svadby", parentNodeId: rootId, sections: [{ ...heroOverride, id: "66666666-6666-4666-8666-666666666666", policy: { mode: "inherit" } }] })
    const result = materializeRelease([root, child] as never)
    expect(result.issues).toEqual([])
    const childRoute = result.routes.find((route) => route.content.path === "/svadby")!
    expect(childRoute.content.sections).toEqual([expect.objectContaining({ key: "hero", config: { title: "База отдыха" } })])
    expect(childRoute.dependencies).toEqual([
      expect.objectContaining({ type: "node_revision", id: rootRevisionId }),
      expect.objectContaining({ type: "node_revision", id: childRevisionId }),
    ])
  })

  it("blocks an inherited section when no persisted parent/site/type base exists", () => {
    const root = candidate({ nodeId: rootId, revisionId: rootRevisionId, kind: "home", path: "/", slug: "home", sections: [{ ...heroOverride, policy: { mode: "inherit" } }] })
    const result = materializeRelease([root] as never)
    expect(result.issues).toEqual([expect.objectContaining({ code: "CMS_INHERITANCE_BASE_MISSING", route: "/" })])
  })

  it("does not fabricate CRM projections and rejects conflicting release paths", () => {
    const first = candidate({ nodeId: rootId, revisionId: rootRevisionId, kind: "landing", path: "/one", slug: "one", sections: [heroOverride], relations: [{ kind: "resource", entityId: childId }] })
    const second = candidate({ nodeId: childId, revisionId: childRevisionId, kind: "landing", path: "/one", slug: "one", sections: [heroOverride] })
    const result = materializeRelease([first, second] as never)
    expect(result.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining(["CRM_PROJECTION_UNRESOLVED", "CMS_RELEASE_PATH_CONFLICT"]))
  })

  it("fails closed for operational Event and ProgramOccurrence source drafts even when a relation is added", () => {
    const event = candidate({
      nodeId: rootId, revisionId: rootRevisionId, kind: "event_detail", path: "/events/private-order", slug: "private-order",
      sections: [heroOverride], sourceKind: "event", relations: [{ kind: "public_event_offering", entityId: rootId }],
    })
    const occurrence = candidate({
      nodeId: childId, revisionId: childRevisionId, kind: "program_occurrence", path: "/programs/private-run", slug: "private-run",
      sections: [heroOverride], sourceKind: "program_occurrence", relations: [{ kind: "program_occurrence", entityId: childId }],
    })
    const result = materializeRelease([event, occurrence] as never)
    expect(result.issues.filter((item) => item.code === "CMS_OPERATIONAL_SOURCE_PUBLIC_PROFILE_REQUIRED")).toEqual([
      expect.objectContaining({ route: "/events/private-order" }),
      expect.objectContaining({ route: "/programs/private-run" }),
    ])
    expect(result.routes.map((route) => route.content.summary)).toEqual([null, null])
  })

  it("fails closed for catalog offering nodes even when the revision has a matching relation", () => {
    const house = candidate({
      nodeId: rootId, revisionId: rootRevisionId, kind: "resource_detail", path: "/houses/sosna", slug: "sosna",
      sections: [heroOverride], sourceKind: "catalog_offering", relations: [{ kind: "catalog_offering", entityId: rootId }],
    })
    const result = materializeRelease([house] as never)
    expect(result.issues).toEqual([
      expect.objectContaining({ code: "CMS_CATALOG_OFFERING_SAFE_PROJECTION_REQUIRED", route: "/houses/sosna" }),
    ])
    expect(result.routes).toHaveLength(1)
  })

  it("pins an approved add-on projection dependency without copying operational fields into content", () => {
    const addon = candidate({
      nodeId: rootId, revisionId: rootRevisionId, kind: "addon_detail", path: "/services/firewood", slug: "firewood",
      sections: [heroOverride], sourceKind: "catalog_offering", relations: [{ kind: "catalog_offering", entityId: rootId }],
      safeProjectionDependency: { type: "crm_projection", id: rootId, version: "public.addon-summary.v1", contentHash: "b".repeat(64) },
    })
    const result = materializeRelease([addon] as never)
    expect(result.issues).toEqual([])
    expect(result.routes[0]?.dependencies).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "node_revision", id: rootRevisionId }),
      { type: "crm_projection", id: rootId, version: "public.addon-summary.v1", contentHash: "b".repeat(64) },
    ]))
    expect(JSON.stringify(result.routes[0]?.content)).not.toContain("pricing")
  })
})
