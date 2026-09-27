import { expect, it, vi } from "vitest"
import { createPublicContentSource, resolveHomepageCommerce, type ContentSource } from "./source"

const releaseId = "44444444-4444-4444-8444-444444444444"
const revisionId = "33333333-3333-4333-8333-333333333333"
function house(offeringId: string) {
  return {
    offeringId, kind: "house", path: `/domiki/${offeringId}`, releaseId, title: offeringId,
    summary: "Домик", price: { mode: "request" }, priceBasisLabel: null,
    quoteAvailable: false, requestAvailable: true, capacity: null, readiness: "request_only",
    timezone: "Europe/Moscow", currency: "RUB",
    sourceVersions: { offering: 1, pricing: 1, priceBook: 1, calendar: 1, contentReleaseId: releaseId, profileRevisionId: revisionId },
    asOf: "2026-09-10T10:00:00.000Z",
    fulfillment: { allocationMode: "exclusive_resource", capacityUnit: "guests", capacityTotal: 4, pricingMode: "rate_plan", spaceType: "mixed", availabilityMode: "request_only" },
  }
}
function response(items: unknown[], nextCursor: string | null, currentReleaseId = releaseId) {
  return new Response(JSON.stringify({ items, nextCursor, releaseId: currentReleaseId, asOf: "2026-09-10T10:00:00.000Z" }), { status: 200, headers: { "Content-Type": "application/json" } })
}

it("loads every public card page, including a manually selected item beyond the first page", async () => {
  const first = house("11111111-1111-4111-8111-111111111111")
  const second = house("22222222-2222-4222-8222-222222222222")
  const request = vi.fn().mockResolvedValueOnce(response([first], "next-page")).mockResolvedValueOnce(response([second], null))
  const result = await createPublicContentSource("http://localhost:3000", request as typeof fetch).houses()
  expect(result).toMatchObject({ status: "published", value: { items: [first, second], nextCursor: null } })
  expect(request.mock.calls[1]?.[0]).toContain("cursor=next-page")
})

it("fails closed when a collection crosses active releases", async () => {
  const first = house("11111111-1111-4111-8111-111111111111")
  const request = vi.fn().mockResolvedValueOnce(response([first], "next-page")).mockResolvedValueOnce(response([], null, "55555555-5555-4555-8555-555555555555"))
  expect(await createPublicContentSource("http://localhost:3000", request as typeof fetch).houses()).toEqual({ status: "unavailable" })
})

it("renders preview cards from the current public release without loading disabled calculator data", async () => {
  const selected = house("11111111-1111-4111-8111-111111111111")
  const houses = vi.fn().mockResolvedValue({ status: "published", value: { items: [selected], nextCursor: null, releaseId, asOf: selected.asOf } })
  const addons = vi.fn()
  const source = { houses, addons } as unknown as ContentSource
  expect(await resolveHomepageCommerce(source, [{ key: "houses" }, { key: "calculator" }], releaseId, false)).toMatchObject({ status: "published", value: { houses: [selected], addons: [] } })
  expect(houses).toHaveBeenCalledOnce()
  expect(addons).not.toHaveBeenCalled()
})
