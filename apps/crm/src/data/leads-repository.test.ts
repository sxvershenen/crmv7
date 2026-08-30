import { describe, expect, it } from "vitest"

import { filterAndSortLeads } from "./leads-repository"
import { leadsFixture } from "@app/fixtures/leads"

describe("LeadRepository fixture adapter", () => {
  it("combines real filters without leaking archived records into active pipeline", () => {
    const result = filterAndSortLeads(leadsFixture, {
      scope: "mine",
      stage: "all",
      direction: "all",
      source: "all",
      promo: "all",
      utm: "all",
      sort: { key: "id", direction: "desc" },
    })

    expect(result.length).toBeGreaterThan(0)
    expect(result.every((lead) => lead.assignedToMe && lead.stage !== "archive")).toBe(true)
  })

  it("sorts useful table fields in the requested direction", () => {
    const result = filterAndSortLeads(leadsFixture, {
      scope: "all",
      stage: "all",
      direction: "all",
      source: "all",
      promo: "all",
      utm: "all",
      sort: { key: "client", direction: "asc" },
    })

    expect(result[0]?.clientName.localeCompare(result[1]?.clientName ?? "", "ru-RU")).toBeLessThanOrEqual(0)
  })

  it("keeps fixture directions aligned with the generated direction select", () => {
    const result = filterAndSortLeads(leadsFixture, {
      scope: "all",
      stage: "all",
      direction: "Мероприятия",
      source: "all",
      promo: "all",
      utm: "all",
      sort: { key: "id", direction: "desc" },
    })

    expect(result.length).toBeGreaterThan(0)
    expect(result.every((lead) => lead.direction === "Мероприятия")).toBe(true)
  })
})
