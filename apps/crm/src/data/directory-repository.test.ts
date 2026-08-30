import { describe, expect, it } from "vitest"

import { FixtureDirectoryRepository, loadDirectoryData } from "./directory-repository"

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
