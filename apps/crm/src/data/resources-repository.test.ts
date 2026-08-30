import { describe, expect, it } from "vitest"

import { resourcesFixture } from "@app/fixtures/resources"
import { FixtureResourceRepository, selectResources } from "./resources-repository"

describe("ResourceRepository fixture adapter", () => {
  it("keeps category selection strict", () => {
    const result = selectResources(resourcesFixture, { block: "all", kind: "bath", warning: "all" })
    expect(result.length).toBeGreaterThan(0)
    expect(result.every((resource) => resource.kind === "bath")).toBe(true)
  })

  it("combines blocking and warning filters", () => {
    const result = selectResources(resourcesFixture, { block: "active", kind: "houses", warning: "with" })
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ hasActiveBlock: true, id: "house-lake" })
    expect(result[0]?.warning).not.toBeNull()
  })

  it("marks shared camping capacity explicitly instead of matching its name", () => {
    const result = selectResources(resourcesFixture, { block: "all", kind: "camping", warning: "all" })
    expect(result.find((resource) => resource.id === "camp-common")?.capacity.mode).toBe("shared")
  })

  it("keeps editor rules and block mutations behind the repository boundary", async () => {
    const repository = new FixtureResourceRepository()
    const resource = await repository.get("house-pine")
    if (!resource) throw new Error("Fixture resource house-pine is missing")

    resource.rules.bookingStepMinutes = "30"
    resource.blocks.push({ id: "block-test", from: "2026-09-01T10:00", to: "2026-09-01T14:00", reason: "Проверка", status: "active" })
    resource.hasActiveBlock = true
    await repository.save(resource)

    expect((await repository.get("house-pine"))?.rules.bookingStepMinutes).toBe("30")
    expect((await repository.list({ block: "active", kind: "houses", warning: "all" })).resources.some((item) => item.id === "house-pine")).toBe(true)
  })
})
