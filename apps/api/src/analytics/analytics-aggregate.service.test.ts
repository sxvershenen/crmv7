import { describe, expect, it, vi } from "vitest"

import {
  ANALYTICS_ACTION_EVENTS,
  ANALYTICS_AGGREGATE_TIMEZONE,
  AnalyticsAggregateService,
} from "./analytics-aggregate.service.js"

const pageNodeId = "11111111-1111-4111-8111-111111111111"

describe("AnalyticsAggregateService", () => {
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

  it("zero-fills bounded periods and maps database counts through the public contract", async () => {
    const database = { query: vi.fn().mockResolvedValue([{
      period: "2026-09-02", page_views: "7", unique_visitors: "5", actions: "3", leads: "2", bookings: "1",
    }]) }
    const service = new AnalyticsAggregateService(database as never)

    await expect(service.get({ from: "2026-09-01", to: "2026-09-03", interval: "day" })).resolves.toEqual({
      items: [
        { period: "2026-09-01", pageNodeId: null, sectionKey: null, pageViews: 0, uniqueVisitors: 0, actions: 0, leads: 0, bookings: 0 },
        { period: "2026-09-02", pageNodeId: null, sectionKey: null, pageViews: 7, uniqueVisitors: 5, actions: 3, leads: 2, bookings: 1 },
        { period: "2026-09-03", pageNodeId: null, sectionKey: null, pageViews: 0, uniqueVisitors: 0, actions: 0, leads: 0, bookings: 0 },
      ],
    })
  })

  it("uses fixed-timezone parameterized consent, dimension, action and conversion aggregation", async () => {
    const database = { query: vi.fn().mockResolvedValue([]) }
    const service = new AnalyticsAggregateService(database as never)

    const result = await service.get({
      from: "2026-09-01", to: "2026-09-01", interval: "day", pageNodeId, sectionKey: "hero.primary",
    })

    const [sql, parameters] = database.query.mock.calls[0] as [string, unknown[]]
    expect(parameters).toEqual([
      "2026-09-01", "2026-09-01", "day", ANALYTICS_AGGREGATE_TIMEZONE,
      pageNodeId, "hero.primary", [...ANALYTICS_ACTION_EVENTS],
    ])
    expect(sql).toContain("event.purpose = 'analytics'")
    expect(sql).toContain("event.consent IN ('analytics', 'analytics_and_marketing')")
    expect(sql).toContain("event.context->>'pageNodeId' = parameters.page_node_id::text")
    expect(sql).toContain("event.context->>'sectionKey' = parameters.section_key")
    expect(sql).toContain("event.event_name = ANY($7::text[])")
    expect(sql).toContain("count(DISTINCT fact.source_event_id)")
    expect(sql).toContain("parameters.section_key IS NULL")
    expect(sql).not.toContain(pageNodeId)
    expect(sql).not.toContain("hero.primary")
    expect(result.items[0]).toMatchObject({ pageNodeId, sectionKey: "hero.primary", leads: 0, bookings: 0 })
  })

  it("returns conversion-only month rows and fills missing months", async () => {
    const database = { query: vi.fn().mockResolvedValue([{
      period: "2026-02", page_views: 0, unique_visitors: 0, actions: 0, leads: "4", bookings: "2",
    }]) }
    const service = new AnalyticsAggregateService(database as never)

    const result = await service.get({ from: "2026-01-31", to: "2026-03-01", interval: "month", pageNodeId })

    expect(result.items.map((item) => [item.period, item.leads, item.bookings])).toEqual([
      ["2026-01", 0, 0], ["2026-02", 4, 2], ["2026-03", 0, 0],
    ])
    expect(result.items.every((item) => item.pageNodeId === pageNodeId && item.sectionKey === null)).toBe(true)
  })
})
