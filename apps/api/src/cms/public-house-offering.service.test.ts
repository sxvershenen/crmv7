import { describe, expect, it, vi } from "vitest"

import { PriceRuleEntity, RatePlanEntity } from "@crm/db"

import { createPublicHouseProjectionDependency } from "../offerings/public-house-projection.js"
import { PublicHouseOfferingService } from "./public-house-offering.service.js"
import { resolvedContentHash } from "./public-content.service.js"

const offeringId = "11111111-1111-4111-8111-111111111111"
const nodeId = "22222222-2222-4222-8222-222222222222"
const revisionId = "33333333-3333-4333-8333-333333333333"
const releaseId = "44444444-4444-4444-8444-444444444444"
const priceBookId = "55555555-5555-4555-8555-555555555555"
const ratePlanId = "66666666-6666-4666-8666-666666666666"

const content = {
  kind: "resource_detail",
  path: "/houses/forest",
  title: "Домик «Лесной»",
  summary: "Домик в сосновом лесу",
  hero: null,
  sections: [],
  seo: { title: "Домик «Лесной»", description: "Домик в сосновом лесу", indexPolicy: "index_follow", canonical: { mode: "self" }, structuredData: [] },
}
const dependency = createPublicHouseProjectionDependency({ offeringId, nodeId, profileRevisionId: revisionId })

function row(overrides: Record<string, unknown> = {}) {
  return {
    releaseId,
    releaseCreatedAt: new Date("2026-09-02T08:00:00.000Z"),
    releasePublishedAt: new Date("2026-09-02T08:05:00.000Z"),
    nodeId,
    revisionId,
    path: "/houses/forest",
    resolvedContent: content,
    resolvedContentHash: resolvedContentHash(content),
    dependencies: [{ type: "node_revision", id: revisionId, version: "2", contentHash: "a".repeat(64) }, dependency],
    offeringId,
    offeringVersion: 3,
    offeringUpdatedAt: new Date("2026-09-02T08:10:00.000Z"),
    pricingVersion: 4,
    salesMode: "quoted",
    priceDisplayMode: "from",
    currency: "RUB",
    timezone: "Europe/Moscow",
    calendarVersion: 2,
    calendarUpdatedAt: new Date("2026-09-01T08:00:00.000Z"),
    priceBookId,
    priceBookRevision: 2,
    priceBookState: "active",
    priceBookValidFrom: "2026-01-01",
    priceBookValidToExclusive: "2027-01-01",
    priceBookUpdatedAt: new Date("2026-09-02T08:09:00.000Z"),
    capacityTotal: 4,
    spaceType: "mixed",
    resourceActive: true,
    titleKey: "домик «лесной»",
    ...overrides,
  }
}

function subject(projectionRows = [row()]) {
  const query = vi.fn()
    .mockResolvedValueOnce(projectionRows)
    .mockResolvedValueOnce([{ id: releaseId, asOf: new Date("2026-09-02T08:05:00.000Z") }])
  const repositories = new Map<unknown, { findBy: ReturnType<typeof vi.fn> }>([
    [RatePlanEntity, { findBy: vi.fn().mockResolvedValue([{ id: ratePlanId, priceBookId, pricingBasis: "per_night", baseAmountMinor: 650000 }]) }],
    [PriceRuleEntity, { findBy: vi.fn().mockResolvedValue([]) }],
  ])
  return { service: new PublicHouseOfferingService({ query, getRepository: vi.fn((entity) => repositories.get(entity)) } as never), query, repositories }
}

describe("PublicHouseOfferingService", () => {
  it("serves a release-pinned house detail with safe capacity and price readiness", async () => {
    const test = subject()
    const result = await test.service.detail({ path: "/houses/forest" })

    expect(result.data).toMatchObject({
      kind: "house",
      path: "/domiki/forest",
      title: "Домик «Лесной»",
      price: { mode: "from", amount: { amountMinor: 650000, currency: "RUB" } },
      fulfillment: { capacityTotal: 4, availabilityMode: "resource", spaceType: "mixed" },
      readiness: "ready",
    })
    expect(result.cacheTags).toContain(`public-offering:${offeringId}`)
    expect(JSON.stringify(result.data)).not.toMatch(/internal|binding|settings/i)
  })

  it("lists bounded houses and degrades missing price authority to request-only", async () => {
    const test = subject([row({ priceBookId: null, priceBookRevision: null, priceBookState: null, priceBookValidFrom: null, priceBookUpdatedAt: null })])
    const result = await test.service.list({ limit: 25 })

    expect(result.data).toMatchObject({ releaseId, nextCursor: null, items: [{ price: { mode: "request" }, readiness: "request_only" }] })
    expect(test.query.mock.calls[0]?.[1]).toEqual([null, null, null, 26])
  })

  it("fails closed when the release dependency hash is stale", async () => {
    const test = subject([row({ dependencies: [{ ...dependency, contentHash: "f".repeat(64) }] })])
    await expect(test.service.detail({ path: "/houses/forest" })).rejects.toMatchObject({ status: 503 })
  })

  it("guards the public SQL against ambiguous primary bindings", async () => {
    const test = subject()
    await test.service.detail({ path: "/houses/forest" })
    expect(test.query.mock.calls[0]?.[0]).toContain("SELECT COUNT(*) FROM offering_bindings primary_binding")
    expect(test.query.mock.calls[0]?.[0]).toContain("primary_binding.archived_at IS NULL) = 1")
  })
})
