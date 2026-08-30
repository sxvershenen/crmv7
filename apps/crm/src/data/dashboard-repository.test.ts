import { describe, expect, it } from "vitest"

import { fixtureDashboardRepository } from "./dashboard-repository"

describe("dashboard repository boundary", () => {
  it("returns cloned fixture data", async () => {
    const first = await fixtureDashboardRepository.getOverview("all")
    const second = await fixtureDashboardRepository.getOverview("all")

    expect(first).not.toBe(second)
    expect(first.attention.length).toBeGreaterThan(0)
    expect(first.today.length).toBeGreaterThan(0)
  })

  it("filters the mine scope before data reaches the screen", async () => {
    const data = await fixtureDashboardRepository.getOverview("mine")
    const items = [...data.attention, ...data.today].flatMap((section) => section.items)

    expect(items.length).toBeGreaterThan(0)
    expect(items.every((item) => item.assignedToMe)).toBe(true)
  })

  it("keeps typed people counts for every booking, program, and event summary", async () => {
    const data = await fixtureDashboardRepository.getOverview("all")
    const itemsById = new Map([...data.attention, ...data.today].flatMap((section) => section.items).map((item) => [item.id, item]))
    const summaryIds = [
      "conflict-1048",
      "debt-1031",
      "debt-1037",
      "cancel-1029",
      "update-1044",
      "arrival-1041",
      "departure-1026",
      "program-36",
      "event-14",
    ]

    for (const id of summaryIds) {
      expect(itemsById.get(id)?.contentSummary?.peopleCount).toEqual(expect.any(Number))
    }
  })
})
