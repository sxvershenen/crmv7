import { describe, expect, it, vi } from "vitest"

import { PublicListingService } from "./public-listing.service.js"
import { resolvedContentHash } from "./public-content.service.js"

const listingId = "11111111-1111-4111-8111-111111111111"
const releaseId = "22222222-2222-4222-8222-222222222222"
const resourceA = "33333333-3333-4333-8333-333333333333"
const resourceB = "44444444-4444-4444-8444-444444444444"

const definition = {
  id: listingId,
  entityKind: "resource",
  filters: [{
    id: "kind", label: "Тип", field: "kind", source: "crm_public_projection", valueType: "enum",
    operators: ["eq"], control: "select", urlKey: "kind",
    options: [{ value: "house", label: "Домики" }, { value: "venue", label: "Площадки" }],
    normalization: "none", indexPolicy: "canonical_to_base",
  }],
  sorts: [{ id: "title", label: "По названию", field: "title", direction: "asc", source: "cms" }],
  defaultSortId: "title",
  pageSize: 1,
}

const listingPage = {
  kind: "resource_listing",
  path: "/catalog",
  title: "Каталог",
  summary: null,
  sections: [{ id: "55555555-5555-4555-8555-555555555555", key: "catalog", renderer: "listing", rendererVersion: "1", schemaVersion: 1, order: 10, config: { definition } }],
  seo: { title: "Каталог", description: "Каталог", indexPolicy: "index_follow", canonical: { mode: "self" }, structuredData: [] },
}

function item(id: string, path: string, title: string, kind: string) {
  const resolvedContent = {
    kind: "resource_detail", path, title, summary: `${title} — описание`, sections: [],
    seo: { title, description: title, indexPolicy: "index_follow", canonical: { mode: "self" }, structuredData: [] },
  }
  return {
    sourceKind: "resource",
    sourceId: id,
    path,
    resolvedContent,
    resolvedContentHash: resolvedContentHash(resolvedContent),
    resourceKind: kind,
    resourceCapacity: kind === "house" ? 4 : 100,
    resourceSettings: { showOnSite: true, secondaryType: kind === "house" ? "С чаном" : "Крытая" },
    programCategoryId: null,
    programDuration: null,
    programCapacity: null,
    programPrice: null,
    programCurrency: null,
  }
}

function setup() {
  const dataSource = { query: vi.fn()
    .mockResolvedValueOnce([{
      releaseId,
      releaseCreatedAt: new Date("2026-08-31T10:00:00.000Z"),
      releasePublishedAt: new Date("2026-08-31T10:01:00.000Z"),
      resolvedContent: listingPage,
      resolvedContentHash: resolvedContentHash(listingPage),
    }])
    .mockResolvedValueOnce([
      item(resourceA, "/resources/alpha", "Альфа", "house"),
      item(resourceB, "/resources/beta", "Бета", "venue"),
    ]),
  }
  return { dataSource, service: new PublicListingService(dataSource as never) }
}

describe("PublicListingService", () => {
  it("returns release-pinned safe cards with deterministic filtering and pagination", async () => {
    const subject = setup()
    const result = await subject.service.resolve({ path: "/catalog", page: 1, sort: null, filters: { kind: "house" } })
    expect(result).toMatchObject({ releaseId, totalItems: 1, totalPages: 1, robots: "noindex_follow", appliedFilters: { kind: "house" } })
    expect(result.items).toEqual([expect.objectContaining({ id: resourceA, href: "/resources/alpha", title: "Альфа", attributes: expect.objectContaining({ capacity: 4 }) })])
    expect(result.items[0]).not.toHaveProperty("settings")
    expect(subject.dataSource.query.mock.calls[1]?.[0]).not.toContain("events")
  })

  it("rejects unknown dynamic query keys instead of silently broadening the listing", async () => {
    const subject = setup()
    await expect(subject.service.resolve({ path: "/catalog", page: 1, sort: null, filters: { secret: "1" } })).rejects.toMatchObject({ response: { code: "VALIDATION_ERROR" } })
    expect(subject.dataSource.query).toHaveBeenCalledTimes(1)
  })

  it("fails closed when the published ListingDefinition addresses a non-public operational kind", async () => {
    const subject = setup()
    const unsafe = { ...listingPage, sections: [{ ...listingPage.sections[0], config: { definition: { ...definition, entityKind: "public_event_offering" } } }] }
    subject.dataSource.query.mockReset().mockResolvedValueOnce([{
      releaseId,
      releaseCreatedAt: new Date("2026-08-31T10:00:00.000Z"),
      releasePublishedAt: new Date("2026-08-31T10:01:00.000Z"),
      resolvedContent: unsafe,
      resolvedContentHash: resolvedContentHash(unsafe),
    }])
    await expect(subject.service.resolve({ path: "/catalog", page: 1, sort: null, filters: {} })).rejects.toMatchObject({ response: { code: "LISTING_KIND_UNAVAILABLE" } })
    expect(subject.dataSource.query).toHaveBeenCalledTimes(1)
  })
})
