import { describe, expect, it, vi } from "vitest"
import { ApiMarketingRepository, FixtureMarketingRepository } from "./marketing-repository"

const terms = { code: "SUMMER", name: "Лето", active: true, discountType: "fixed" as const, value: 150_025, minimumAmountMinor: 100_000, startsAt: null, endsAt: null, scope: "all" as const, resourceIds: [], offeringIds: [] }
const operationId = "11111111-1111-4111-8111-111111111111"

describe("ApiMarketingRepository", () => {
  it("uses typed real endpoints and preserves minor units and retry identity", async () => {
    const client = { get: vi.fn(), post: vi.fn(), patch: vi.fn() }
    const repository = new ApiMarketingRepository(client as never)
    const input = { terms, operationId, idempotencyKey: operationId }
    await repository.list()
    await repository.get("promo-id")
    await repository.create(input)
    await repository.update("promo-id", { ...input, expectedVersion: 3 })
    await repository.report({ from: "2026-09-01", to: "2026-09-30" })
    expect(client.get).toHaveBeenCalledWith("marketing/promotions", expect.anything())
    expect(client.get).toHaveBeenCalledWith("marketing/promotions/promo-id", expect.anything())
    expect(client.post).toHaveBeenCalledWith("marketing/promotions", input, expect.anything())
    expect(client.patch).toHaveBeenCalledWith("marketing/promotions/promo-id", { ...input, expectedVersion: 3 }, expect.anything())
    expect(client.get).toHaveBeenCalledWith("marketing/report?from=2026-09-01&to=2026-09-30", expect.anything())
  })

  it("rejects invalid terms and reversed periods before sending a request", () => {
    const client = { get: vi.fn(), post: vi.fn(), patch: vi.fn() }
    const repository = new ApiMarketingRepository(client as never)
    expect(() => repository.create({ terms: { ...terms, discountType: "percent", value: 101 }, operationId, idempotencyKey: operationId })).toThrow()
    expect(() => repository.report({ from: "2026-09-30", to: "2026-09-01" })).toThrow()
    expect(client.post).not.toHaveBeenCalled()
    expect(client.get).not.toHaveBeenCalled()
  })
})

describe("FixtureMarketingRepository", () => {
  it("provides a complete local walkthrough dataset and keeps mutations in memory", async () => {
    const repository = new FixtureMarketingRepository()
    const listed = await repository.list()
    expect(listed.items).toHaveLength(3)
    expect(listed.items.map((item) => item.terms.code)).toEqual(["GLAMP3000", "DETI1000", "BIRTHDAY20"])

    const report = await repository.report({ from: "2026-09-01", to: "2026-09-30" })
    expect(report.campaigns).toHaveLength(3)
    expect(report.promotions[0]).toMatchObject({ bookings: 8, paidAmountMinor: 12_400_000 })

    const updated = await repository.update(listed.items[0]!.id, { terms: { ...listed.items[0]!.terms, active: false }, operationId, idempotencyKey: operationId, expectedVersion: listed.items[0]!.version })
    expect(updated.terms.active).toBe(false)
    expect((await repository.get(listed.items[0]!.id)).version).toBe(3)
  })
})
