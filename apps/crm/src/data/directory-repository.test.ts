import { describe, expect, it, vi } from "vitest"

import { ApiDirectoryRepository, FixtureDirectoryRepository, loadDirectoryData } from "./directory-repository"

describe("FixtureDirectoryRepository", () => {
  it("returns narrow, cloned cross-entity lookup data", async () => {
    const repository = new FixtureDirectoryRepository()
    const data = await loadDirectoryData(repository)

    expect(data.customers[0]).toEqual(expect.objectContaining({ id: expect.any(String), name: expect.any(String), phone: expect.any(String) }))
    expect(data.customers[0]).not.toHaveProperty("turnover")
    expect(data.bookings[0]).not.toHaveProperty("amount")
    expect(data.assignees.program.length).toBeGreaterThan(0)

    data.customers[0]!.name = "Изменено снаружи"
    expect((await repository.listCustomers())[0]?.name).not.toBe("Изменено снаружи")
  })
})

describe("ApiDirectoryRepository", () => {
  it("lists a multi-resource booking once for relation pickers", async () => {
    const get = vi.fn().mockResolvedValue({ bookings: [
      { id: "booking-1", clientName: "Гость", date: "2026-11-20", phone: "", resourceName: "Дом", sourceLeadId: null },
      { id: "booking-1", clientName: "Гость", date: "2026-11-20", phone: "", resourceName: "Баня", sourceLeadId: null },
    ] })
    const repository = new ApiDirectoryRepository({ get, getWithMeta: vi.fn() } as never)

    expect(await repository.listBookings()).toEqual([{ id: "booking-1", clientName: "Гость", date: "2026-11-20", phone: "", resourceName: "Дом", sourceLeadId: null }])
  })
})
