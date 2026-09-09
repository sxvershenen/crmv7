import { describe, expect, it, vi } from "vitest"

import { PriceRuleEntity, RatePlanEntity } from "@crm/db"

import { createPublicAddOnProjectionDependency } from "../offerings/public-addon-projection.js"
import { PublicAddonOfferingService } from "./public-addon-offering.service.js"
import { resolvedContentHash } from "./public-content.service.js"

const offeringId = "11111111-1111-4111-8111-111111111111"
const nodeId = "22222222-2222-4222-8222-222222222222"
const revisionId = "33333333-3333-4333-8333-333333333333"
const releaseId = "44444444-4444-4444-8444-444444444444"
const priceBookId = "55555555-5555-4555-8555-555555555555"
const ratePlanId = "66666666-6666-4666-8666-666666666666"

const content = {
  kind: "addon_detail",
  path: "/services/firewood",
  title: "Берёзовые дрова",
  summary: "Связка сухих дров",
  hero: null,
  sections: [],
  seo: { title: "Берёзовые дрова", description: "Сухие берёзовые дрова", indexPolicy: "index_follow", canonical: { mode: "self" }, structuredData: [] },
}

const dependency = createPublicAddOnProjectionDependency({ offeringId, nodeId, profileRevisionId: revisionId })

function row(overrides: Record<string, unknown> = {}) {
  return {
    releaseId,
    releaseCreatedAt: new Date("2026-09-02T08:00:00.000Z"),
    releasePublishedAt: new Date("2026-09-02T08:05:00.000Z"),
    nodeId,
    revisionId,
    resolvedContent: content,
    resolvedContentHash: resolvedContentHash(content),
    dependencies: [{ type: "node_revision", id: revisionId, version: "2", contentHash: "a".repeat(64) }, dependency],
    offeringId,
    offeringVersion: 3,
    offeringUpdatedAt: new Date("2026-09-02T08:10:00.000Z"),
    pricingVersion: 4,
    salesMode: "selectable",
    priceDisplayMode: "exact",
    currency: "RUB",
    timezone: "Europe/Moscow",
    categoryKey: "comfort",
    serviceType: "quantity_service",
    standalone: true,
    minimumQuantity: 1,
    maximumQuantity: 10,
    defaultQuantity: 2,
    quantityStep: 1,
    calendarVersion: 2,
    calendarUpdatedAt: new Date("2026-09-01T08:00:00.000Z"),
    priceBookId,
    priceBookRevision: 2,
    priceBookState: "active",
    priceBookValidFrom: "2026-01-01",
    priceBookValidToExclusive: "2027-01-01",
    priceBookUpdatedAt: new Date("2026-09-02T08:09:00.000Z"),
    titleKey: "берёзовые дрова",
    ...overrides,
  }
}

function subject(projectionRows = [row()]) {
  const query = vi.fn()
    .mockResolvedValueOnce(projectionRows)
    .mockResolvedValueOnce([{ id: releaseId, asOf: new Date("2026-09-02T08:05:00.000Z") }])
  const repositories = new Map<unknown, { findBy: ReturnType<typeof vi.fn> }>([
    [RatePlanEntity, { findBy: vi.fn().mockResolvedValue([{ id: ratePlanId, priceBookId, baseAmountMinor: 900 }]) }],
    [PriceRuleEntity, { findBy: vi.fn().mockResolvedValue([]) }],
  ])
  const dataSource = { query, getRepository: vi.fn((entity) => repositories.get(entity)) }
  return { service: new PublicAddonOfferingService(dataSource as never), query, repositories }
}

describe("PublicAddonOfferingService", () => {
  it("serves a strict release-pinned detail with conservative public unit pricing", async () => {
    const test = subject()
    const result = await test.service.detail(offeringId)

    expect(result.data).toMatchObject({
      offeringId,
      kind: "addon",
      title: "Берёзовые дрова",
      price: { mode: "exact", amount: { amountMinor: 900, currency: "RUB" } },
      quoteAvailable: false,
      readiness: "ready",
      terms: { serviceType: "quantity_service", quantity: { unit: "unit", minimum: 1, maximum: 10, default: 2, step: 1 } },
      sourceVersions: { offering: 3, pricing: 4, priceBook: 2, calendar: 2, contentReleaseId: releaseId, profileRevisionId: revisionId },
    })
    expect(result.cacheTags).toContain(`public-offering:${offeringId}`)
    expect(JSON.stringify(result.data)).not.toMatch(/internal|rule|binding|scope/i)
  })

  it("returns a bounded list and degrades missing price authority to request-only", async () => {
    const test = subject([row({ priceBookId: null, priceBookRevision: null, priceBookState: null, priceBookValidFrom: null, priceBookUpdatedAt: null, priceDisplayMode: "from" })])
    test.repositories.get(RatePlanEntity)!.findBy.mockResolvedValue([])
    const result = await test.service.list({ categoryKey: "comfort", standalone: true, limit: 25 })

    expect(result.data).toMatchObject({ releaseId, nextCursor: null, items: [{ price: { mode: "request" }, readiness: "request_only" }] })
    expect(test.query.mock.calls[0]?.[1]).toEqual([null, "comfort", true, null, null, 26])
  })

  it("fails closed when the release dependency hash is stale", async () => {
    const test = subject([row({ dependencies: [{ ...dependency, contentHash: "f".repeat(64) }] })])
    await expect(test.service.detail(offeringId)).rejects.toMatchObject({ status: 503 })
  })
})
