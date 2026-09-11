import { describe, expect, it, vi } from "vitest"

import { ANALYTICS_ACTION_EVENTS, ANALYTICS_AGGREGATE_TIMEZONE } from "./analytics-aggregate.service.js"
import { AnalyticsDailyRollupService } from "./analytics-daily-rollup.service.js"

function database(inserted = [{ id: "rollup" }]) {
  const query = vi.fn()
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce(inserted)
  const transaction = vi.fn(async (work: (manager: { query: typeof query }) => Promise<number>) => work({ query }))
  return { source: { transaction }, query, transaction }
}

describe("AnalyticsDailyRollupService", () => {
  it.each(["2026-02-30", "2026-9-01", "0000-01-01", "not-a-date"])("rejects invalid date %s before opening a transaction", async (date) => {
    const db = database()
    await expect(new AnalyticsDailyRollupService(db.source as never).rebuildDay(date)).rejects.toBeInstanceOf(TypeError)
    expect(db.transaction).not.toHaveBeenCalled()
  })

  it("atomically replaces the day and always inserts the zero-capable global grouping", async () => {
    const db = database()
    await expect(new AnalyticsDailyRollupService(db.source as never).rebuildDay("2026-09-11")).resolves.toBe(1)

    const [lockSql, lockParameters] = db.query.mock.calls[0] as [string, unknown[]]
    const [deleteSql, deleteParameters] = db.query.mock.calls[1] as [string, unknown[]]
    const [insertSql, insertParameters] = db.query.mock.calls[2] as [string, unknown[]]
    expect(lockSql).toContain("pg_advisory_xact_lock")
    expect(lockParameters).toEqual(["analytics-daily-rollup:2026-09-11"])
    expect(deleteSql).toContain("DELETE FROM analytics_daily_aggregates")
    expect(deleteParameters).toEqual(["2026-09-11"])
    expect(insertParameters).toEqual(["2026-09-11", ANALYTICS_AGGREGATE_TIMEZONE, [...ANALYTICS_ACTION_EVENTS]])
    expect(insertSql).toContain("GROUP BY GROUPING SETS ((), (page_node_id), (section_key), (page_node_id, section_key))")
    expect(insertSql).toContain("event.purpose = 'analytics'")
    expect(insertSql).toContain("event.consent IN ('analytics', 'analytics_and_marketing')")
    expect(insertSql).toContain("count(DISTINCT visitor_id)")
  })

  it("sanitizes dimensions and keeps conversions on the global row only", async () => {
    const db = database()
    await new AnalyticsDailyRollupService(db.source as never).rebuildDay("2026-09-11")
    const sql = String(db.query.mock.calls[2]?.[0])

    expect(sql).toContain("THEN (event.context->>'pageNodeId')::uuid")
    expect(sql).toContain("event.context->>'sectionKey' ~ '^[a-z][a-z0-9._-]*$'")
    expect(sql).toContain("event_rows.page_node_id IS NULL AND event_rows.section_key IS NULL")
    expect(sql).toContain("WHERE NOT EXISTS")
    expect(sql).not.toMatch(/raw_ip|normalized_referrer_host|network_pseudonym|email|phone/iu)
  })

  it("uses the same locked delete-and-insert protocol on every rebuild", async () => {
    const query = vi.fn(async (sql: string) => sql.includes("RETURNING id") ? [{ id: "rollup" }] : [])
    const transaction = vi.fn(async (work: (manager: { query: typeof query }) => Promise<number>) => work({ query }))
    const service = new AnalyticsDailyRollupService({ transaction } as never)

    await expect(Promise.all([service.rebuildDay("2026-09-11"), service.rebuildDay("2026-09-11")])).resolves.toEqual([1, 1])
    expect(transaction).toHaveBeenCalledTimes(2)
    expect(query.mock.calls.filter(([sql]) => String(sql).includes("DELETE FROM analytics_daily_aggregates"))).toHaveLength(2)
  })
})
