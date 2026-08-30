import { describe, expect, it } from "vitest"

import { FixtureGlobalSearchRepository } from "./global-search-repository"

describe("FixtureGlobalSearchRepository", () => {
  it("finds entities by #ID, normalized phone and resource name", async () => {
    const repository = new FixtureGlobalSearchRepository()

    await expect(repository.search("#2051")).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ href: "/bookings/2051", kind: "booking" })]),
    )
    await expect(repository.search("8 921 107-77-63")).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ href: "/customers/1006" }),
        expect.objectContaining({ href: "/leads/1279" }),
        expect.objectContaining({ href: "/bookings/2064" }),
      ]),
    )
    await expect(repository.search("Дом Сосна")).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ href: "/resources/houses/house-pine", kind: "resource" })]),
    )
  })
})
