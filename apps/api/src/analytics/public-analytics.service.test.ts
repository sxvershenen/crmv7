import { randomUUID } from "node:crypto"

import { describe, expect, it, vi } from "vitest"

import type { AnalyticsEventBatch } from "@crm/contracts"

import { PublicAnalyticsService } from "./public-analytics.service.js"

function input(consent: AnalyticsEventBatch["events"][number]["consent"] = "denied"): AnalyticsEventBatch {
  return { events: [{
    eventId: randomUUID(), schemaVersion: 1, occurredAt: new Date().toISOString(), eventName: "page_view", consent, purpose: "analytics",
    context: { path: "/", pageNodeId: null, releaseId: null, referrer: null }, properties: { kind: "page_view", title: "Главная" },
  }] }
}

describe("PublicAnalyticsService consent boundary", () => {
  it("drops analytics events before consent without issuing identity or opening a transaction", async () => {
    const transaction = vi.fn()
    const service = new PublicAnalyticsService({ transaction } as never, { get: vi.fn((key: string, fallback?: unknown) => fallback) } as never, { issue: vi.fn() } as never)
    const result = await service.collect(input(), { header: () => undefined } as never, { cookie: vi.fn() } as never)
    expect(result).toMatchObject({ accepted: 0, duplicates: 0, dropped: 1 })
    expect(transaction).not.toHaveBeenCalled()
  })
})
