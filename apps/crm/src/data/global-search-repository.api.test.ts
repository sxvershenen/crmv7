import { describe, expect, it, vi } from "vitest"

import { ApiGlobalSearchRepository } from "./global-search-repository"

describe("ApiGlobalSearchRepository", () => {
  it("uses the internal search endpoint and maps the canonical projection", async () => {
    const get = vi.fn(async () => [{
      kind: "booking", id: "22222222-2222-4222-8222-222222222222", code: "B-2051", title: "Алексей",
      meta: "Бронь B-2051 · Дом", href: "/bookings/B-2051", phone: "+7 900 000-00-00", email: null,
      archived: false, capabilities: { canView: true, canEdit: false, canArchive: false },
    }])
    const repository = new ApiGlobalSearchRepository({ client: { get } } as never)

    await expect(repository.search("2051")).resolves.toEqual([{
      kind: "booking", id: "B-2051", title: "Алексей", meta: "Бронь B-2051 · Дом", href: "/bookings/B-2051", phone: "+7 900 000-00-00",
    }])
    expect(get).toHaveBeenCalledWith("/search?q=2051&limit=24", expect.anything())
  })

  it("does not call the API for an empty command", async () => {
    const get = vi.fn()
    await expect(new ApiGlobalSearchRepository({ client: { get } } as never).search("   ")).resolves.toEqual([])
    expect(get).not.toHaveBeenCalled()
  })
})
