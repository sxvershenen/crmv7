import { describe, expect, it } from "vitest"

import { AnalyticsConversionFacts1788205600000 } from "./1788205600000-analytics-conversion-facts.js"

describe("AnalyticsConversionFacts migration", () => {
  it("stores append-only outbox-derived conversion facts without attribution identity data", async () => {
    const statements: string[] = []
    await new AnalyticsConversionFacts1788205600000().up({ query: async (sql: string) => { statements.push(sql); return [] } } as never)
    const sql = statements.join("\n")
    expect(sql).toContain("source_event_id uuid NOT NULL")
    expect(sql).toContain("REFERENCES outbox_events(id) ON DELETE RESTRICT")
    expect(sql).toContain("analytics_conversion_facts_source_event_unique")
    expect(sql).toContain("analytics_conversion_facts_kind_check")
    expect(sql).toContain("analytics_conversion_facts_attribution_model_check")
    expect(sql).toContain("analytics_conversion_facts_immutable_guard")
    expect(sql).toContain("BEFORE UPDATE OR DELETE")
    expect(sql).not.toContain("customer_id")
    expect(sql).not.toContain("email")
    expect(sql).not.toContain("phone")
  })
})
