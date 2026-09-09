import { describe, expect, it, vi } from "vitest"
import { ApiMarketingRepository } from "./marketing-repository"

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
