import { describe, expect, it } from "vitest"

import { AnalyticsCollectorFoundation1788205200000 } from "./1788205200000-analytics-collector-foundation.js"

describe("AnalyticsCollectorFoundation migration", () => {
  it("keeps event identity and raw-network data bounded", async () => {
    const statements: string[] = []
    await new AnalyticsCollectorFoundation1788205200000().up({ query: async (sql: string) => { statements.push(sql); return [] } } as never)
    const sql = statements.join("\n")
    expect(sql).toContain("analytics_ingest_dedup")
    expect(sql).toContain("analytics_events_event_unique")
    expect(sql).toContain("network_pseudonym")
    expect(sql).not.toContain("raw_ip")
    expect(sql).not.toContain("cookie_value")
  })
})
