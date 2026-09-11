import { describe, expect, it, vi } from "vitest"

import { OutboxDeliveryStore } from "./outbox-delivery.store.js"

describe("OutboxDeliveryStore analytics fan-out", () => {
  it("seeds analytics deliveries before claiming and exposes the authoritative event timestamp", async () => {
    const statements: string[] = []
    const occurredAt = new Date("2026-09-11T10:15:30.000Z")
    const manager = {
      query: vi.fn().mockImplementation(async (sql: string) => {
        statements.push(sql)
        if (sql.includes("SELECT event.id, event.topic")) {
          return [{
            id: "11111111-1111-4111-8111-111111111111",
            topic: "lead.created",
            aggregate_type: "lead",
            aggregate_id: "22222222-2222-4222-8222-222222222222",
            event_created_at: occurredAt,
            payload: { leadId: "22222222-2222-4222-8222-222222222222" },
            consumer: "analytics",
            status: "pending",
            attempts: 0,
            max_attempts: 8,
            delivery_epoch: 1,
            lease_token: null,
            lease_acquired_at: null,
          }]
        }
        return []
      }),
    }
    const dataSource = { transaction: vi.fn(async (work: (value: typeof manager) => unknown) => work(manager)) }

    const claims = await new OutboxDeliveryStore(dataSource as never).claim("analytics", "test-worker", 8)

    const selectIndex = statements.findIndex((sql) => sql.includes("SELECT event.id, event.topic"))
    const analyticsSeedIndex = statements.findIndex((sql) => sql.includes("SELECT event.id, 'analytics'"))
    expect(analyticsSeedIndex).toBeGreaterThanOrEqual(0)
    expect(selectIndex).toBeGreaterThan(analyticsSeedIndex)
    expect(statements[analyticsSeedIndex]).toContain("WHERE event.processed_at IS NULL")
    expect(statements[analyticsSeedIndex]).not.toContain("public_projection")
    expect(claims).toEqual([expect.objectContaining({ consumer: "analytics", occurredAt: occurredAt.toISOString() })])
  })
})
