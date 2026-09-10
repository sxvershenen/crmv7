import { describe, expect, it } from "vitest"

import { materializeRelease } from "./cms-publication.service.js"
import { createPublicHouseProjectionDependency } from "../offerings/public-house-projection.js"
import { createPublicCampgroundProjectionDependency } from "../offerings/public-campground-projection.js"
import { createPublicProgramProjectionDependency } from "../offerings/public-program-projection.js"

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
  const partnersConfig = { title: "Наши партнёры", description: "Работаем вместе", items: [{ id: childId, label: "Пекарня" }] }
  const partners = { ...heroOverride, key: "partners", renderer: "partners", policy: { mode: "override", patch: {
    scalars: Object.fromEntries(Object.entries(partnersConfig).map(([key, value]) => [key, { operation: "replace", value }])), objects: {}, keyedArrays: {},
  } } }
  const whyUsConfig = {
    eyebrow: "Почему мы", title: "Почему выбирают нас", description: "Доказательства", facts: [{ id: "distance", number: "30 мин", title: "От центра", description: "Удобно добираться." }],
    team: { label: "Команда", title: "Рядом на каждом этапе", description: "Помогаем гостям." },
  }
  const whyUs = { ...heroOverride, key: "why-us", renderer: "why-us", policy: { mode: "override", patch: {
    scalars: Object.fromEntries(Object.entries(whyUsConfig).map(([key, value]) => [key, { operation: "replace", value }])), objects: {}, keyedArrays: {},
  } } }
  const homepageConfig = { eyebrow: "Афиша", title: "События из CMS", description: "Редакционный текст", action: null }
  const homepage = { ...heroOverride, key: "events", renderer: "homepage-section", policy: { mode: "override", patch: {
    scalars: Object.fromEntries(Object.entries(homepageConfig).map(([key, value]) => [key, { operation: "replace", value }])), objects: {}, keyedArrays: {},
  } } }

  it("pins partners content through inherited revisions without mutable draft reads", () => {
    const root = candidate({ nodeId: rootId, revisionId: rootRevisionId, kind: "home", path: "/", slug: "home", sections: [partners] })
    const child = candidate({ nodeId: childId, revisionId: childRevisionId, kind: "landing", path: "/family", slug: "family", parentNodeId: rootId, sections: [{ ...partners, policy: { mode: "inherit" } }] })
    const result = materializeRelease([root, child] as never)
    expect(result.issues).toEqual([])
    expect(result.routes[1]?.content.sections[0]?.config).toEqual(partnersConfig)
    expect(result.routes[1]?.dependencies).toEqual(expect.arrayContaining([expect.objectContaining({ id: rootRevisionId })]))
  })

  it.each([
    { ...partners, rendererVersion: "2" }, { ...partners, renderer: "unknown" },
    { ...partners, policy: { mode: "override", patch: { scalars: {}, objects: {}, keyedArrays: {} } } },
  ])("blocks unsupported or incomplete partners before publication", (section) => {
    const root = candidate({ nodeId: rootId, revisionId: rootRevisionId, kind: "home", path: "/", slug: "home", sections: [section] })
    expect(materializeRelease([root] as never).issues).toEqual([expect.objectContaining({ code: "CMS_PARTNERS_SECTION_INVALID" })])
  })

  it("pins why-us content through inherited revisions", () => {
    const root = candidate({ nodeId: rootId, revisionId: rootRevisionId, kind: "home", path: "/", slug: "home", sections: [whyUs] })
    const child = candidate({ nodeId: childId, revisionId: childRevisionId, kind: "landing", path: "/family", slug: "family", parentNodeId: rootId, sections: [{ ...whyUs, id: childId, policy: { mode: "inherit" } }] })
    const result = materializeRelease([root, child] as never)
    expect(result.issues).toEqual([])
    expect(result.routes[1]?.content.sections[0]?.config).toEqual(whyUsConfig)
  })

  it.each([
    { ...whyUs, rendererVersion: "2" }, { ...whyUs, renderer: "unknown" },
    { ...whyUs, policy: { mode: "override", patch: { scalars: {}, objects: {}, keyedArrays: {} } } },
  ])("blocks unsupported or incomplete why-us before publication", (section) => {
    const root = candidate({ nodeId: rootId, revisionId: rootRevisionId, kind: "home", path: "/", slug: "home", sections: [section] })
    expect(materializeRelease([root] as never).issues).toEqual([expect.objectContaining({ code: "CMS_WHY_US_SECTION_INVALID" })])
  })

  it("pins the ordered homepage editorial snapshot through inherited revisions", () => {
    const root = candidate({ nodeId: rootId, revisionId: rootRevisionId, kind: "home", path: "/", slug: "home", sections: [homepage] })
    const child = candidate({ nodeId: childId, revisionId: childRevisionId, kind: "landing", path: "/family", slug: "family", parentNodeId: rootId, sections: [{ ...homepage, id: childId, policy: { mode: "inherit" } }] })
    const result = materializeRelease([root, child] as never)
    expect(result.issues).toEqual([])
    expect(result.routes[1]?.content.sections[0]?.config).toEqual(homepageConfig)
  })

  it.each([
    { ...homepage, rendererVersion: "2" }, { ...homepage, renderer: "events" },
    { ...homepage, policy: { mode: "override", patch: { scalars: {}, objects: {}, keyedArrays: {} } } },
  ])("blocks unsupported or incomplete homepage sections before publication", (section) => {
    const root = candidate({ nodeId: rootId, revisionId: rootRevisionId, kind: "home", path: "/", slug: "home", sections: [section] })
    expect(materializeRelease([root] as never).issues).toEqual([expect.objectContaining({ code: "CMS_HOMEPAGE_SECTION_INVALID" })])
  })

  it("validates inherited global partners and allows an explicit disabled slot", () => {
    const defaults = { hero: null, sections: [{ id: childId, key: "partners", renderer: "partners", rendererVersion: "1", schemaVersion: 1, order: 10, config: {} }] }
    const root = candidate({ nodeId: rootId, revisionId: rootRevisionId, kind: "home", path: "/", slug: "home", sections: [] })
    expect(materializeRelease([root] as never, defaults).issues).toEqual([expect.objectContaining({ code: "CMS_PARTNERS_SECTION_INVALID" })])
    root.revision.sections = [{ ...partners, policy: { mode: "disabled" } }]
    const result = materializeRelease([root] as never, defaults)
    expect(result.issues).toEqual([])
    expect(result.routes[0]?.content.sections).toEqual([])
  })

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

  it("pins an approved house projection dependency for the vertical route", () => {
    const houseDependency = createPublicHouseProjectionDependency({ offeringId: rootId, nodeId: rootId, profileRevisionId: rootRevisionId })
    const house = candidate({
      nodeId: rootId, revisionId: rootRevisionId, kind: "resource_detail", path: "/houses/sosna", slug: "sosna",
      sections: [heroOverride], sourceKind: "catalog_offering", relations: [{ kind: "catalog_offering", entityId: rootId }],
      safeProjectionDependency: houseDependency,
    })
    const result = materializeRelease([house] as never)
    expect(result.issues).toEqual([])
    expect(result.routes[0]?.dependencies).toContainEqual(houseDependency)
  })

  it("rejects a house projection attached to a non-house canonical path", () => {
    const houseDependency = createPublicHouseProjectionDependency({ offeringId: rootId, nodeId: rootId, profileRevisionId: rootRevisionId })
    const house = candidate({
      nodeId: rootId, revisionId: rootRevisionId, kind: "resource_detail", path: "/venues/sosna", slug: "sosna",
      sections: [heroOverride], sourceKind: "catalog_offering", relations: [{ kind: "catalog_offering", entityId: rootId }],
      safeProjectionDependency: houseDependency,
    })
    expect(materializeRelease([house] as never).issues).toEqual([
      expect.objectContaining({ code: "CMS_CATALOG_OFFERING_SAFE_PROJECTION_REQUIRED", route: "/venues/sosna" }),
    ])
  })

  it("pins an approved campground projection dependency for the vertical route", () => {
    const campgroundDependency = createPublicCampgroundProjectionDependency({ offeringId: rootId, nodeId: rootId, profileRevisionId: rootRevisionId })
    const campground = candidate({
      nodeId: rootId, revisionId: rootRevisionId, kind: "resource_detail", path: "/campgrounds/pitches", slug: "pitches",
      sections: [heroOverride], sourceKind: "catalog_offering", relations: [{ kind: "catalog_offering", entityId: rootId }],
      safeProjectionDependency: campgroundDependency,
    })
    const result = materializeRelease([campground] as never)
    expect(result.issues).toEqual([])
    expect(result.routes[0]?.dependencies).toContainEqual(campgroundDependency)
  })

  it("rejects a campground projection attached to a non-campground canonical path", () => {
    const campgroundDependency = createPublicCampgroundProjectionDependency({ offeringId: rootId, nodeId: rootId, profileRevisionId: rootRevisionId })
    const campground = candidate({
      nodeId: rootId, revisionId: rootRevisionId, kind: "resource_detail", path: "/houses/pitches", slug: "pitches",
      sections: [heroOverride], sourceKind: "catalog_offering", relations: [{ kind: "catalog_offering", entityId: rootId }],
      safeProjectionDependency: campgroundDependency,
    })
    expect(materializeRelease([campground] as never).issues).toEqual([
      expect.objectContaining({ code: "CMS_CATALOG_OFFERING_SAFE_PROJECTION_REQUIRED", route: "/houses/pitches" }),
    ])
  })

  it("pins an approved program projection for the vertical route", () => {
    const programDependency = createPublicProgramProjectionDependency({ offeringId: rootId, nodeId: rootId, profileRevisionId: rootRevisionId })
    const program = candidate({
      nodeId: rootId, revisionId: rootRevisionId, kind: "program_detail", path: "/programs/rafting", slug: "rafting",
      sections: [heroOverride], sourceKind: "catalog_offering", relations: [{ kind: "catalog_offering", entityId: rootId }],
      safeProjectionDependency: programDependency,
    })
    const result = materializeRelease([program] as never)
    expect(result.issues).toEqual([])
    expect(result.routes[0]?.dependencies).toContainEqual(programDependency)
  })

  it("rejects a program projection attached to a non-program canonical path", () => {
    const programDependency = createPublicProgramProjectionDependency({ offeringId: rootId, nodeId: rootId, profileRevisionId: rootRevisionId })
    const program = candidate({
      nodeId: rootId, revisionId: rootRevisionId, kind: "program_detail", path: "/events/rafting", slug: "rafting",
      sections: [heroOverride], sourceKind: "catalog_offering", relations: [{ kind: "catalog_offering", entityId: rootId }],
      safeProjectionDependency: programDependency,
    })
    expect(materializeRelease([program] as never).issues).toEqual([
      expect.objectContaining({ code: "CMS_CATALOG_OFFERING_SAFE_PROJECTION_REQUIRED", route: "/events/rafting" }),
    ])
  })
})
