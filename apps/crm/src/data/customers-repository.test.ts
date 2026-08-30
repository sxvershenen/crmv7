import { describe, expect, it } from "vitest"

import type { CustomerQuery } from "@app/entities/customers"
import { customersFixture } from "@app/fixtures/customers"

import { FixtureCustomerRepository, selectCustomers } from "./customers-repository"

const baseQuery: CustomerQuery = {
  type: "all",
  channel: "all",
  flags: [],
  lastVisitDays: null,
  sort: { key: "client", direction: "asc" },
}

describe("CustomerRepository fixture adapter", () => {
  it("combines type, channel, flags and last-visit filters", () => {
    const result = selectCustomers(customersFixture, {
      ...baseQuery,
      type: "organizer",
      channel: "Сайт",
      flags: ["active", "debt", "duplicates"],
      lastVisitDays: 30,
    })

    expect(result.map((customer) => customer.id)).toEqual(["1029"])
  })

  it("keeps archive out by default and sorts numeric fields", () => {
    const result = selectCustomers(customersFixture, { ...baseQuery, sort: { key: "debt", direction: "desc" } })

    expect(result.every((customer) => !customer.archived)).toBe(true)
    expect(result[0]?.debt).toBeGreaterThanOrEqual(result[1]?.debt ?? 0)
  })

  it("shows archived records only when the archive flag is selected", () => {
    const result = selectCustomers(customersFixture, { ...baseQuery, flags: ["archive"] })
    expect(result).toHaveLength(1)
    expect(result[0]?.archived).toBe(true)
  })

  it("loads and saves an individual customer behind the editor boundary", async () => {
    const repository = new FixtureCustomerRepository()
    const customer = await repository.get("1042")
    expect(customer?.name).toBe("Анна Ковалёва")
    await repository.save({ ...customer!, name: "Анна Ковалёва — обновлено" })
    expect((await repository.get("1042"))?.name).toBe("Анна Ковалёва — обновлено")
  })
})
