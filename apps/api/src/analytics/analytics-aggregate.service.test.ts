import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  ANALYTICS_ACTION_EVENTS,
  ANALYTICS_AGGREGATE_TIMEZONE,
  AnalyticsAggregateService,
} from "./analytics-aggregate.service.js"

const pageNodeId = "11111111-1111-4111-8111-111111111111"

describe("AnalyticsAggregateService", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-09-11T21:30:00.000Z"))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it.each([
    [{ from: "2026-09-02", to: "2026-09-01", interval: "day" }, "ANALYTICS_DATE_RANGE_INVALID"],
    [{ from: "2026-02-30", to: "2026-03-01", interval: "day" }, "ANALYTICS_DATE_RANGE_INVALID"],
    [{ from: "2025-01-01", to: "2026-01-02", interval: "day" }, "ANALYTICS_DATE_RANGE_TOO_LARGE"],
    [{ from: "2023-01-01", to: "2026-01-01", interval: "month" }, "ANALYTICS_DATE_RANGE_TOO_LARGE"],
  ] as const)("rejects invalid or unbounded range %#", async (query, code) => {
    const database = { query: vi.fn() }
    const service = new AnalyticsAggregateService(database as never)

    await expect(service.get(query as never)).rejects.toMatchObject({ response: { code } })
    expect(database.query).not.toHaveBeenCalled()
  })

  it("uses fully covered completed-day rollups and zero-fills missing dimension rows", async () => {
    const database = { query: vi.fn()
      .mockResolvedValueOnce([{ covered_periods: "3" }])
      .mockResolvedValueOnce([{
        period: "2026-09-10", page_views: "7", unique_visitors: "5", actions: "3", leads: "0", bookings: "0", payments: "0",
      }])
      .mockResolvedValueOnce([{ unique_visitors: "4" }]) }
    const service = new AnalyticsAggregateService(database as never)

    await expect(service.get({
      from: "2026-09-09", to: "2026-09-11", interval: "day", sectionKey: "hero.primary",
    })).resolves.toEqual({
      uniqueVisitors: 4,
      items: [
        { period: "2026-09-09", pageNodeId: null, sectionKey: "hero.primary", pageViews: 0, uniqueVisitors: 0, actions: 0, leads: 0, bookings: 0, payments: 0 },
        { period: "2026-09-10", pageNodeId: null, sectionKey: "hero.primary", pageViews: 7, uniqueVisitors: 5, actions: 3, leads: 0, bookings: 0, payments: 0 },
        { period: "2026-09-11", pageNodeId: null, sectionKey: "hero.primary", pageViews: 0, uniqueVisitors: 0, actions: 0, leads: 0, bookings: 0, payments: 0 },
      ],
    })

    const [coverageSql, coverageParameters] = database.query.mock.calls[0] as [string, unknown[]]
    const [rollupSql, rollupParameters] = database.query.mock.calls[1] as [string, unknown[]]
    expect(coverageParameters).toEqual(["2026-09-09", "2026-09-11"])
    expect(coverageSql).toContain("count(DISTINCT period_date)")
    expect(coverageSql).toContain("page_node_id IS NULL")
    expect(coverageSql).toContain("section_key IS NULL")
    expect(rollupParameters).toEqual(["2026-09-09", "2026-09-11", null, "hero.primary"])
    expect(rollupSql).toContain("page_node_id IS NOT DISTINCT FROM $3::uuid")
    expect(rollupSql).toContain("section_key IS NOT DISTINCT FROM $4::text")
    expect(rollupSql).not.toContain("hero.primary")
    const [uniqueSql, uniqueParameters] = database.query.mock.calls[2] as [string, unknown[]]
    expect(uniqueSql).toContain("count(DISTINCT event.visitor_id)")
    expect(uniqueParameters).toEqual(["2026-09-09", "2026-09-11", ANALYTICS_AGGREGATE_TIMEZONE, null, "hero.primary"])
  })

  it.each([
    ["global", {}, null, null],
    ["page", { pageNodeId }, pageNodeId, null],
    ["section", { sectionKey: "hero.primary" }, null, "hero.primary"],
    ["page and section", { pageNodeId, sectionKey: "hero.primary" }, pageNodeId, "hero.primary"],
  ] as const)("maps the %s dimension to null-safe rollup parameters", async (_name, dimensions, expectedPage, expectedSection) => {
    const database = { query: vi.fn()
      .mockResolvedValueOnce([{ covered_periods: 1 }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ unique_visitors: 0 }]) }
    const service = new AnalyticsAggregateService(database as never)

    const result = await service.get({
      from: "2026-09-11", to: "2026-09-11", interval: "day", ...dimensions,
    })

    const [sql, parameters] = database.query.mock.calls[1] as [string, unknown[]]
    expect(parameters).toEqual(["2026-09-11", "2026-09-11", expectedPage, expectedSection])
    expect(sql).toContain("page_node_id IS NOT DISTINCT FROM $3::uuid")
    expect(sql).toContain("section_key IS NOT DISTINCT FROM $4::text")
    expect(sql).not.toContain(pageNodeId)
    expect(sql).not.toContain("hero.primary")
    expect(result.items[0]).toMatchObject({ pageNodeId: expectedPage, sectionKey: expectedSection })
  })

  it("falls back to raw aggregation when completed-day rollup coverage is incomplete", async () => {
    const database = { query: vi.fn()
      .mockResolvedValueOnce([{ covered_periods: "2" }])
      .mockResolvedValueOnce([{
        period: "2026-09-10", page_views: "7", unique_visitors: "5", actions: "3", leads: "2", bookings: "1", payments: "1",
      }])
      .mockResolvedValueOnce([{ unique_visitors: "4" }]) }
    const service = new AnalyticsAggregateService(database as never)

    const result = await service.get({ from: "2026-09-09", to: "2026-09-11", interval: "day" })

    expect(database.query).toHaveBeenCalledTimes(3)
    expect(String(database.query.mock.calls[0]?.[0])).toContain("analytics_daily_aggregates")
    expect(String(database.query.mock.calls[1]?.[0])).toContain("FROM analytics_events event")
    expect(result.items[1]).toMatchObject({ period: "2026-09-10", pageViews: 7, leads: 2 })
  })

  it("uses raw aggregation for the current Moscow day", async () => {
    const database = { query: vi.fn().mockResolvedValue([]) }
    const service = new AnalyticsAggregateService(database as never)

    await service.get({ from: "2026-09-12", to: "2026-09-12", interval: "day" })

    expect(database.query).toHaveBeenCalledTimes(2)
    expect(String(database.query.mock.calls[0]?.[0])).toContain("FROM analytics_events event")
  })

  it("uses fixed-timezone parameterized consent, dimension, action and conversion raw aggregation", async () => {
    const database = { query: vi.fn().mockResolvedValue([]) }
    const service = new AnalyticsAggregateService(database as never)

    const result = await service.get({
      from: "2026-09-12", to: "2026-09-12", interval: "day", pageNodeId, sectionKey: "hero.primary",
    })

    const [sql, parameters] = database.query.mock.calls[0] as [string, unknown[]]
    expect(parameters).toEqual([
      "2026-09-12", "2026-09-12", "day", ANALYTICS_AGGREGATE_TIMEZONE,
      pageNodeId, "hero.primary", [...ANALYTICS_ACTION_EVENTS],
    ])
    expect(sql).toContain("event.purpose = 'analytics'")
    expect(sql).toContain("event.consent IN ('analytics', 'analytics_and_marketing')")
    expect(sql).toContain("event.context->>'pageNodeId' = parameters.page_node_id::text")
    expect(sql).toContain("event.context->>'sectionKey' = parameters.section_key")
    expect(sql).toContain("event.event_name = ANY($7::text[])")
    expect(sql).toContain("count(DISTINCT fact.source_event_id)")
    expect(sql).toContain("fact.kind = 'payment_recorded'")
    expect(sql).toContain("parameters.page_node_id IS NULL")
    expect(sql).toContain("parameters.section_key IS NULL")
    expect(sql).not.toContain(pageNodeId)
    expect(sql).not.toContain("hero.primary")
    const [uniqueSql, uniqueParameters] = database.query.mock.calls[1] as [string, unknown[]]
    expect(uniqueSql).toContain("count(DISTINCT event.visitor_id)")
    expect(uniqueSql).toContain("event.consent IN ('analytics', 'analytics_and_marketing')")
    expect(uniqueParameters).toEqual(["2026-09-12", "2026-09-12", ANALYTICS_AGGREGATE_TIMEZONE, pageNodeId, "hero.primary"])
    expect(result.items[0]).toMatchObject({ pageNodeId, sectionKey: "hero.primary", leads: 0, bookings: 0, payments: 0 })
  })

  it("uses raw aggregation for month rows and fills missing months", async () => {
    const database = { query: vi.fn().mockResolvedValue([{
      period: "2026-02", page_views: 0, unique_visitors: 0, actions: 0, leads: "4", bookings: "2", payments: "1",
    }]) }
    const service = new AnalyticsAggregateService(database as never)

    const result = await service.get({ from: "2026-01-31", to: "2026-03-01", interval: "month", pageNodeId })

    expect(database.query).toHaveBeenCalledTimes(2)
    expect(String(database.query.mock.calls[0]?.[0])).toContain("FROM analytics_events event")
    expect(result.items.map((item) => [item.period, item.leads, item.bookings, item.payments])).toEqual([
      ["2026-01", 0, 0, 0], ["2026-02", 4, 2, 1], ["2026-03", 0, 0, 0],
    ])
    expect(result.items.every((item) => item.pageNodeId === pageNodeId && item.sectionKey === null)).toBe(true)
  })

  it("propagates coverage and rollup read errors without hiding them behind raw aggregation", async () => {
    const coverageError = new Error("coverage unavailable")
    const coverageDatabase = { query: vi.fn().mockRejectedValue(coverageError) }
    await expect(new AnalyticsAggregateService(coverageDatabase as never).get({
      from: "2026-09-11", to: "2026-09-11", interval: "day",
    })).rejects.toBe(coverageError)
    expect(coverageDatabase.query).toHaveBeenCalledTimes(1)

    const readError = new Error("rollup unavailable")
    const readDatabase = { query: vi.fn()
      .mockResolvedValueOnce([{ covered_periods: 1 }])
      .mockRejectedValueOnce(readError) }
    await expect(new AnalyticsAggregateService(readDatabase as never).get({
      from: "2026-09-11", to: "2026-09-11", interval: "day",
    })).rejects.toBe(readError)
    expect(readDatabase.query).toHaveBeenCalledTimes(2)
  })
})
