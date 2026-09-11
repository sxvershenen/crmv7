import { describe, expect, it } from "vitest"

import { AnalyticsDailyAggregates1788206000000 } from "./1788206000000-analytics-daily-aggregates.js"

describe("AnalyticsDailyAggregates migration", () => {
  it("creates a recomputable PII-free daily dimension rollup", async () => {
    const statements: string[] = []
    await new AnalyticsDailyAggregates1788206000000().up({
      query: async (sql: string) => { statements.push(sql); return [] },
    } as never)
    const sql = statements.join("\n")

    expect(sql).toContain("period_date date NOT NULL")
    expect(sql).toContain("UNIQUE NULLS NOT DISTINCT (period_date, page_node_id, section_key)")
    expect(sql).toContain("analytics_daily_aggregates_counts_check")
    expect(sql).toContain("analytics_daily_aggregates_section_key_check")
    expect(sql).toContain("analytics_daily_aggregates_period_idx")
    expect(sql).toContain("analytics_daily_aggregates_dimensions_idx")
    expect(sql).not.toMatch(/raw_ip|referrer|email|phone|visitor_id|session_id/iu)
  })
})
