import { describe, expect, it, vi } from "vitest"

import { BusinessCalendarEntity, CampgroundOfferingTermsEntity, CatalogOfferingEntity, CmsActiveReleaseEntity, CmsNodeEntity, CmsNodeRevisionEntity, CmsPublicProfileEntity, CmsReleaseEntity, CmsReleaseItemEntity, CmsSourceLinkEntity, IdempotencyKeyEntity, OfferingBindingEntity, PriceBookEntity, ResourceEntity } from "@crm/db"
import { CmsHeroPolicySchema, CmsSiteSettingsStoredValueSchema } from "@crm/contracts"

import { CmsPublicationService, materializeRelease, publicationPreview, unpublishBlockers } from "./cms-publication.service.js"
import { createPublicHouseProjectionDependency } from "../offerings/public-house-projection.js"
import { createPublicCampgroundProjectionDependency } from "../offerings/public-campground-projection.js"
import { createPublicProgramProjectionDependency } from "../offerings/public-program-projection.js"
import { createPublicEventServiceProjectionDependency } from "../offerings/public-event-service-projection.js"

const rootId = "11111111-1111-4111-8111-111111111111"
const childId = "22222222-2222-4222-8222-222222222222"
const rootRevisionId = "33333333-3333-4333-8333-333333333333"
const childRevisionId = "44444444-4444-4444-8444-444444444444"

const publishedHome = { kind: "home", path: "/", title: "Главная", summary: null, hero: null, sections: [], seo: { title: "Главная", description: "Описание", indexPolicy: "index_follow", canonical: { mode: "self" }, structuredData: [] } }
const familyItem = { nodeId: childId, revisionId: childRevisionId, path: "/family", resolvedContentHash: "b".repeat(64), resolvedContent: { ...publishedHome, kind: "landing", path: "/family" }, dependencies: [{ type: "node_revision", id: childRevisionId, version: "1" }] }
const homeItem = { nodeId: rootId, revisionId: rootRevisionId, path: "/", resolvedContentHash: "a".repeat(64), resolvedContent: publishedHome, dependencies: [{ type: "node_revision", id: rootRevisionId, version: "1" }] }

describe("unpublishBlockers", () => {
  it("blocks a published child that inherits from the removed page", () => {
    expect(unpublishBlockers(homeItem as never, [{ ...familyItem, dependencies: [...familyItem.dependencies, { type: "node_revision", id: rootRevisionId, version: "1" }] }] as never, null))
      .toEqual(expect.arrayContaining([expect.objectContaining({ code: "CMS_UNPUBLISH_HOME_REQUIRED" }), expect.objectContaining({ code: "CMS_UNPUBLISH_DEPENDENT_PAGE", route: "/family" })]))
  })

  it("blocks visible navigation and editorial links, but not unrelated pages", () => {
    const settings = CmsSiteSettingsStoredValueSchema.parse({ siteName: "Сайт", headerNavigation: [{ id: rootId, label: "Семейный отдых", link: { kind: "internal", path: "/family" }, children: [] }] })
    const linked = { ...homeItem, resolvedContent: { ...publishedHome, sections: [{ id: rootId, key: "text", renderer: "editorial-content", rendererVersion: "1", schemaVersion: 1, order: 10, config: { heading: "Текст", lead: null, blocks: [{ type: "paragraph", text: "Узнайте больше." }], links: [{ label: "Подробнее", href: "/family" }] } }] } }
    const issues = unpublishBlockers(familyItem as never, [linked] as never, settings)
    expect(issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: "CMS_UNPUBLISH_NAVIGATION_LINK" }), expect.objectContaining({ code: "CMS_UNPUBLISH_INTERNAL_LINK" })]))
    expect(unpublishBlockers(familyItem as never, [homeItem] as never, null)).toEqual([])
  })

  it("blocks an action in a published homepage section", () => {
    const linked = { ...homeItem, resolvedContent: { ...publishedHome, sections: [{ id: rootId, key: "events", renderer: "homepage-section", rendererVersion: "1", schemaVersion: 1, order: 10, config: { eyebrow: null, title: "События", description: "", action: { label: "Подробнее", href: "/family" } } }] } }
    expect(unpublishBlockers(familyItem as never, [linked] as never, null)).toEqual(expect.arrayContaining([expect.objectContaining({ code: "CMS_UNPUBLISH_INTERNAL_LINK", route: "/" })]))
  })
})

describe("CmsPublicationService unpublish", () => {
  const input = { operationId: "55555555-5555-4555-8555-555555555555", idempotencyKey: "unpublish-page-test", expectedVersion: 3, baseReleaseId: rootId, expectedActiveReleaseVersion: 7, expectedPublishedRevisionId: childRevisionId }
  const actor = { id: "66666666-6666-4666-8666-666666666666", capabilities: { canPublishContent: true } } as never

  function setup(activeVersion = 7, replay: unknown = null) {
    const save = vi.fn().mockImplementation(async (...args: unknown[]) => args.at(-1))
    const execute = vi.fn().mockResolvedValue({ affected: 1 })
    const manager = {
      getRepository: (entity: unknown) => entity === IdempotencyKeyEntity ? { findOne: vi.fn().mockResolvedValue(replay) }
        : entity === CmsActiveReleaseEntity ? { findOneBy: vi.fn().mockResolvedValue({ releaseId: rootId, version: activeVersion }) }
        : entity === CmsNodeEntity ? { findOneBy: vi.fn().mockResolvedValue({ id: childId, version: 3, status: "archived" }) }
        : entity === CmsReleaseEntity ? { findOneBy: vi.fn().mockResolvedValue({ id: rootId, siteSettingsRevisionId: null }) }
        : entity === CmsReleaseItemEntity ? { findBy: vi.fn().mockResolvedValue([homeItem, familyItem]) } : {},
      create: (_entity: unknown, value: unknown) => value,
      save,
      query: vi.fn().mockResolvedValue([{ next: 10 }]),
      createQueryBuilder: () => ({ update: () => ({ set: () => ({ where: () => ({ execute }) }) }) }),
      findOneByOrFail: vi.fn().mockResolvedValue({ releaseId: rootId, version: 8 }),
    }
    const dataSource = { transaction: (_isolation: unknown, run: (manager: unknown) => Promise<unknown>) => run(manager) }
    return { service: new CmsPublicationService(dataSource as never), save, execute }
  }

  it("publishes a new active manifest without the page, preserving node and revision history", async () => {
    const { service, save, execute } = setup()
    const result = await service.unpublishNode(childId, input, actor, "request-unpublish")
    expect(result).toMatchObject({ unpublishedPath: "/family", publicationVersion: 8 })
    expect(save).toHaveBeenCalledWith(CmsReleaseItemEntity, [expect.objectContaining({ nodeId: rootId, path: "/" })])
    expect(save.mock.calls.find((call) => call[0] === CmsReleaseItemEntity)?.[1]).toHaveLength(1)
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ topic: "cms.release.unpublished" }))
    expect(execute).toHaveBeenCalledOnce()
  })

  it("rejects a stale active publication before creating a release", async () => {
    const { service, save } = setup(8)
    await expect(service.unpublishNode(childId, input, actor, "request-unpublish")).rejects.toMatchObject({ response: { code: "CMS_RELEASE_STALE" } })
    expect(save).not.toHaveBeenCalled()
  })

  it("replays the original result without creating a second release", async () => {
    const first = setup()
    const result = await first.service.unpublishNode(childId, input, actor, "request-unpublish")
    const stored = first.save.mock.calls.map((call) => call.at(-1)).find((row) => row && typeof row === "object" && "idempotencyKey" in row)
    const retry = setup(9, stored)
    await expect(retry.service.unpublishNode(childId, input, actor, "request-retry")).resolves.toEqual(result)
    expect(retry.save).not.toHaveBeenCalled()
  })
})

describe("CmsPublicationService republish selection", () => {
  it("reuses the last published revision only when the node is absent from the active release", async () => {
    const findOne = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({ id: childRevisionId, state: "published" })
    const service = new CmsPublicationService({} as never) as unknown as { publishableRevision: (manager: unknown, nodeId: string, items: unknown[]) => Promise<unknown> }
    const manager = { getRepository: () => ({ findOne }) }
    await expect(service.publishableRevision(manager, childId, [])).resolves.toMatchObject({ id: childRevisionId })
    expect(findOne).toHaveBeenCalledTimes(2)
    findOne.mockReset().mockResolvedValue(null)
    await expect(service.publishableRevision(manager, childId, [familyItem])).resolves.toBeNull()
    expect(findOne).toHaveBeenCalledOnce()
  })
})

describe("CmsPublicationService node publication status", () => {
  it.each([true, false])("reads active-release membership when present=%s, regardless of old published revisions", async (present) => {
    const item = present ? { path: "/family", revisionId: rootRevisionId, resolvedContent: { ...publishedHome, path: "/family" } } : null
    const nodeLookup = vi.fn().mockResolvedValue({ id: rootId, status: "archived" })
    const itemLookup = vi.fn().mockResolvedValue(item)
    const manager = { getRepository: (entity: unknown) => entity === CmsNodeEntity ? { findOneBy: nodeLookup }
      : entity === CmsActiveReleaseEntity ? { findOneBy: vi.fn().mockResolvedValue({ releaseId: childId, version: 7 }) }
      : entity === CmsReleaseItemEntity ? { findOneBy: itemLookup } : {} }
    const service = new CmsPublicationService({ manager } as never)
    const result = await service.nodePublicationStatus(rootId, { capabilities: { canViewContent: true } } as never)
    expect(result).toEqual({ active: present, path: present ? "/family" : null, revisionId: present ? rootRevisionId : null, activeReleaseId: childId, activeReleaseVersion: 7,
      publishedSeo: present ? { title: "Главная", description: "Описание", indexPolicy: "index_follow", canonical: { mode: "self" } } : null })
    expect(itemLookup).toHaveBeenCalledWith({ releaseId: childId, nodeId: rootId })
  })

  it("keeps membership visible when a stored release has invalid SEO metadata", async () => {
    const manager = { getRepository: (entity: unknown) => entity === CmsNodeEntity ? { findOneBy: vi.fn().mockResolvedValue({ id: rootId }) }
      : entity === CmsActiveReleaseEntity ? { findOneBy: vi.fn().mockResolvedValue({ releaseId: childId, version: 7 }) }
      : entity === CmsReleaseItemEntity ? { findOneBy: vi.fn().mockResolvedValue({ path: "/family", revisionId: rootRevisionId, resolvedContent: { seo: { title: "Некорректно" } } }) } : {} }
    const status = await new CmsPublicationService({ manager } as never).nodePublicationStatus(rootId, { capabilities: { canViewContent: true } } as never)
    expect(status).toMatchObject({ active: true, path: "/family", publishedSeo: null })
  })
})

describe("CmsPublicationService signed draft materialization", () => {
  it("renders a saved CRM draft before the first release without writing publication state", async () => {
    const node = { id: childId, kind: "resource_detail", status: "active" }
    const revision = { id: childRevisionId, nodeId: childId, revision: 1, state: "draft", path: "/drafts/new", slug: "new", parentNodeId: null,
      title: "Новый домик", summary: "Редакционный черновик", hero: { mode: "disabled" }, sections: [],
      seo: { title: "Новый домик", description: "Описание домика" }, relations: [], contentHash: "a".repeat(64) }
    const save = vi.fn()
    const manager = { getRepository: (entity: unknown) => entity === CmsActiveReleaseEntity ? { findOneBy: vi.fn().mockResolvedValue({ releaseId: null, version: 1 }) }
      : entity === CmsNodeRevisionEntity ? { findBy: vi.fn().mockResolvedValue([revision]) }
      : entity === CmsNodeEntity ? { findBy: vi.fn().mockResolvedValue([node]) }
      : entity === CmsSourceLinkEntity ? { findBy: vi.fn().mockResolvedValue([{ nodeId: childId, sourceKind: "resource", sourceId: rootId }]) } : {}, save }
    const service = new CmsPublicationService({ manager } as never)

    const result = await service.materializePreviewRevision(node as never, revision as never)
    expect(result.content).toMatchObject({ path: "/drafts/new", title: "Новый домик" })
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "CMS_SOURCE_ROUTE_REQUIRED" }),
      expect.objectContaining({ code: "CMS_RESOURCE_PUBLIC_PROJECTION_REQUIRED" }),
    ]))
    expect(save).not.toHaveBeenCalled()
  })
})

describe("CmsPublicationService archived Resource dependencies", () => {
  it.each([
    ["house", "/domiki/forest", "house", "safeHouseProjectionDependency"],
    ["campground", "/kemping/pitches", "camping", "safeCampgroundProjectionDependency"],
    ["venue", "/poshadki/meadow", "venue", "safeVenueProjectionDependency"],
  ] as const)("keeps %s publishable when its CRM Resource is archived", async (kind, path, resourceKind, method) => {
    const offeringId = "55555555-5555-4555-8555-555555555555"
    const resourceId = "66666666-6666-4666-8666-666666666666"
    const resourceLookup = vi.fn().mockResolvedValue({ id: resourceId, kind: resourceKind, capacityMode: kind === "campground" ? "shared" : "fixed", capacityTotal: 4, archivedAt: new Date() })
    const rows = new Map<unknown, unknown>([
      [CatalogOfferingEntity, { id: offeringId, kind, state: "active", archivedAt: null, businessCalendarId: rootId, activePriceBookId: childId }],
      [CmsPublicProfileEntity, { nodeId: rootId, kind: "catalog_offering", entityId: offeringId, archivedAt: null }],
      [BusinessCalendarEntity, { id: rootId, state: "active", archivedAt: null }],
      [PriceBookEntity, { id: childId, state: "active", archivedAt: null }],
      [CampgroundOfferingTermsEntity, { offeringId, offeringKind: "campground", capacityUnit: "tent", pricingBasis: "per_night", sellableUnit: "own_tent_pitch", inventoryMode: "shared_capacity" }],
    ])
    const manager = {
      getRepository: (entity: unknown) => entity === ResourceEntity ? { findOneBy: resourceLookup }
        : entity === OfferingBindingEntity ? { find: vi.fn().mockResolvedValue([{ resourceId, quantityDefault: 1, capacityImpactDefault: 1, availabilityRequired: true }]) }
        : { findOneBy: vi.fn().mockResolvedValue(rows.get(entity)) },
      query: vi.fn().mockResolvedValue([{ id: childId }]),
    }
    const service = new CmsPublicationService({} as never) as unknown as Record<string, (...args: unknown[]) => Promise<unknown>>
    const result = await service[method]!(manager, {
      node: { id: rootId, kind: "resource_detail", status: "active", archivedAt: null },
      revision: { id: rootRevisionId, path, relations: [{ kind: "catalog_offering", entityId: offeringId }] },
    }, { sourceId: offeringId })
    expect(result).toMatchObject({ type: "crm_projection", id: offeringId })
    expect(resourceLookup).toHaveBeenCalledWith({ id: resourceId })
  })
})

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
  it("requires a resolved public variant for the optional mobile hero background", () => {
    const assetId = childId
    const page = candidate({ nodeId: rootId, revisionId: rootRevisionId, kind: "home", path: "/", slug: "home", sections: [] })
    const unresolved = CmsHeroPolicySchema.parse({ mode: "override", config: { title: "Главная", mobileBackgroundAssetId: assetId } })
    expect(materializeRelease([{ ...page, revision: { ...page.revision, hero: unresolved } }] as never).issues).toEqual([expect.objectContaining({ code: "CMS_MEDIA_NOT_RESOLVED" })])

    const resolved = CmsHeroPolicySchema.parse({ mode: "override", config: { title: "Главная", mobileBackgroundAssetId: assetId,
      mobileBackground: { assetId, alt: "Лес", variants: [{ url: "/mobile.webp", format: "webp", width: 480, height: 720 }] },
    } })
    expect(materializeRelease([{ ...page, revision: { ...page.revision, hero: resolved } }] as never).issues).toEqual([])
  })
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

  it("materializes authored article blocks and rejects an empty published body", () => {
    const config = { heading: "История места", lead: null, authorName: "Марина Кириллова", blocks: [{ type: "paragraph", text: "О природе" }, { type: "list", items: ["Лес", "Река"] }], links: [] }
    const editorial = { ...heroOverride, key: "body", renderer: "editorial-content", policy: { mode: "override", patch: {
      scalars: Object.fromEntries(Object.entries(config).map(([key, value]) => [key, { operation: "replace", value }])), objects: {}, keyedArrays: {},
    } } }
    const home = candidate({ nodeId: rootId, revisionId: rootRevisionId, kind: "home", path: "/", slug: "home", sections: [] })
    const article = candidate({ nodeId: childId, revisionId: childRevisionId, kind: "article", path: "/story", slug: "story", parentNodeId: rootId, sections: [editorial] })
    const result = materializeRelease([home, article] as never)
    expect(result.issues).toEqual([])
    expect(result.routes[1]?.content.sections[0]?.config).toEqual(config)
    const articleWithSchema = {
      ...article, revision: { ...article.revision, seo: { ...article.revision.seo, structuredData: [
        { id: childId, schemaType: "Article", enabled: true, payload: { headline: "История места", author: { "@type": "Person", name: "Старое имя" }, datePublished: "2026-09-27" } },
        { id: rootId, schemaType: "BlogPosting", enabled: true, payload: { headline: "История места", datePublished: "2026-09-27" } },
      ] } },
    }
    const withSchema = materializeRelease([home, articleWithSchema] as never)
    expect(withSchema.issues).toEqual([])
    expect(withSchema.routes[1]?.content.seo.structuredData[0]?.payload.author).toEqual({ "@type": "Person", name: "Марина Кириллова" })
    expect(withSchema.routes[1]?.content.seo.structuredData[1]?.payload.author).toEqual({ "@type": "Person", name: "Марина Кириллова" })
    expect(articleWithSchema.revision.seo.structuredData[0]?.payload.author).toEqual({ "@type": "Person", name: "Старое имя" })
    expect(articleWithSchema.revision.seo.structuredData[1]?.payload.author).toBeUndefined()
    const legacyScalars = { ...editorial.policy.patch.scalars }
    delete legacyScalars.authorName
    const legacyEditorial = { ...editorial, policy: { ...editorial.policy, patch: { ...editorial.policy.patch, scalars: legacyScalars } } }
    const legacyArticle = { ...articleWithSchema, revision: { ...articleWithSchema.revision, sections: [legacyEditorial], seo: {
      ...articleWithSchema.revision.seo, structuredData: articleWithSchema.revision.seo.structuredData.slice(0, 1),
    } } }
    const legacyResult = materializeRelease([home, legacyArticle] as never)
    expect(legacyResult.issues).toEqual([])
    expect(legacyResult.routes[1]?.content.seo.structuredData[0]?.payload.author).toEqual({ "@type": "Person", name: "Старое имя" })
    const empty = { ...editorial, policy: { mode: "override", patch: { scalars: { ...editorial.policy.patch.scalars, blocks: { operation: "replace", value: [] } }, objects: {}, keyedArrays: {} } } }
    expect(materializeRelease([home, { ...article, revision: { ...article.revision, sections: [empty] } }] as never).issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: "CMS_EDITORIAL_SECTION_INVALID" })]))
    const blankAuthor = { ...editorial, policy: { mode: "override", patch: { scalars: { ...editorial.policy.patch.scalars, authorName: { operation: "replace", value: "   " } }, objects: {}, keyedArrays: {} } } }
    expect(materializeRelease([home, { ...article, revision: { ...article.revision, sections: [blankAuthor] } }] as never).issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: "CMS_EDITORIAL_SECTION_INVALID" })]))
  })

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

  it("rejects a source-less event_detail before it can enter a release", () => {
    const eventService = candidate({
      nodeId: rootId, revisionId: rootRevisionId, kind: "event_detail", path: "/events/unlinked", slug: "unlinked",
      sections: [heroOverride],
    })
    expect(materializeRelease([eventService] as never).issues).toEqual([
      expect.objectContaining({ code: "CMS_EVENT_SERVICE_PUBLIC_PROJECTION_REQUIRED", route: "/events/unlinked" }),
    ])
  })

  it("keeps an unpromoted CRM Resource draft out of a public release", () => {
    const resource = candidate({
      nodeId: rootId, revisionId: rootRevisionId, kind: "resource_detail", path: "/domiki/forest", slug: "forest",
      sections: [heroOverride], sourceKind: "resource",
    })
    expect(materializeRelease([resource] as never).issues).toEqual([
      expect.objectContaining({ code: "CMS_RESOURCE_PUBLIC_PROJECTION_REQUIRED", route: "/domiki/forest" }),
    ])
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
      nodeId: rootId, revisionId: rootRevisionId, kind: "addon_detail", path: "/dopy/firewood", slug: "firewood",
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

  it("pins an approved event-service projection for the vertical route", () => {
    const eventServiceDependency = createPublicEventServiceProjectionDependency({ offeringId: rootId, nodeId: rootId, profileRevisionId: rootRevisionId })
    const eventService = candidate({
      nodeId: rootId, revisionId: rootRevisionId, kind: "event_detail", path: "/events/corporate", slug: "corporate",
      sections: [heroOverride], sourceKind: "catalog_offering", relations: [{ kind: "catalog_offering", entityId: rootId }],
      safeProjectionDependency: eventServiceDependency,
    })
    const result = materializeRelease([eventService] as never)
    expect(result.issues).toEqual([])
    expect(result.routes[0]?.dependencies).toContainEqual(eventServiceDependency)
  })

  it("rejects an event-service projection attached to a non-event canonical path", () => {
    const eventServiceDependency = createPublicEventServiceProjectionDependency({ offeringId: rootId, nodeId: rootId, profileRevisionId: rootRevisionId })
    const eventService = candidate({
      nodeId: rootId, revisionId: rootRevisionId, kind: "event_detail", path: "/programs/corporate", slug: "corporate",
      sections: [heroOverride], sourceKind: "catalog_offering", relations: [{ kind: "catalog_offering", entityId: rootId }],
      safeProjectionDependency: eventServiceDependency,
    })
    expect(materializeRelease([eventService] as never).issues).toEqual([
      expect.objectContaining({ code: "CMS_CATALOG_OFFERING_SAFE_PROJECTION_REQUIRED", route: "/programs/corporate" }),
    ])
  })
})

describe("publicationPreview", () => {
  it("reports a canonical move, dependencies and a stable guard hash before publish", () => {
    const next = candidate({ nodeId: rootId, revisionId: rootRevisionId, kind: "landing", path: "/domiki", slug: "domiki", sections: [heroOverride] })
    const result = materializeRelease([next] as never)
    const preview = publicationPreview({ releaseId: childId, version: 7 }, rootId, rootRevisionId, [{ nodeId: rootId, path: "/houses", revisionId: childRevisionId, resolvedContentHash: "b".repeat(64), dependencies: [] }] as never, result)
    expect(preview).toMatchObject({ baseReleaseId: childId, activeReleaseVersion: 7, canPublish: true, changes: [{ change: "updated", beforePath: "/domiki", afterPath: "/domiki" }] })
    expect(preview.previewHash).toMatch(/^[a-f0-9]{64}$/)
    expect(preview.dependencies).toEqual([expect.objectContaining({ id: rootRevisionId })])
  })
})
