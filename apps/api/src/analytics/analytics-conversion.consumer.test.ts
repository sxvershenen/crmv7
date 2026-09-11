import { describe, expect, it, vi } from "vitest"

import { AnalyticsConversionConsumer } from "./analytics-conversion.consumer.js"
import { PermanentDeliveryError, type ClaimedOutboxDelivery } from "../delivery/outbox-delivery.types.js"

const ids = {
  event: "11111111-1111-4111-8111-111111111111",
  entity: "22222222-2222-4222-8222-222222222222",
  aggregate: "33333333-3333-4333-8333-333333333333",
  lease: "44444444-4444-4444-8444-444444444444",
  pii: "55555555-5555-4555-8555-555555555555",
}
const occurredAt = "2026-09-11T10:15:30.000Z"

function claim(overrides: Partial<ClaimedOutboxDelivery> = {}): ClaimedOutboxDelivery {
  return {
    eventId: ids.event,
    consumer: "analytics",
    topic: "lead.created",
    aggregateType: "lead",
    aggregateId: ids.entity,
    occurredAt,
    payload: { leadId: ids.entity },
    deliveryEpoch: 1,
    attempt: 1,
    maxAttempts: 8,
    leaseToken: ids.lease,
    ...overrides,
  }
}

describe("AnalyticsConversionConsumer", () => {
  it.each([
    {
      topic: "lead.created",
      aggregateType: "lead",
      aggregateId: ids.entity,
      payload: { leadId: ids.entity, customerId: ids.pii, status: "new", source: "public_intake" },
      expected: { kind: "lead_created", entityId: ids.entity, leadId: ids.entity, bookingId: null },
    },
    {
      topic: "booking.created",
      aggregateType: "booking",
      aggregateId: ids.entity,
      payload: { bookingId: ids.entity, version: 1 },
      expected: { kind: "booking_created", entityId: ids.entity, leadId: null, bookingId: ids.entity },
    },
    {
      topic: "payment.charge",
      aggregateType: "booking",
      aggregateId: ids.aggregate,
      payload: { paymentId: ids.entity, operationId: ids.pii, targetVersion: 2 },
      expected: { kind: "payment_recorded", entityId: ids.entity, leadId: null, bookingId: ids.aggregate },
    },
    {
      topic: "payment.charge",
      aggregateType: "event",
      aggregateId: ids.aggregate,
      payload: { paymentId: ids.entity },
      expected: { kind: "payment_recorded", entityId: ids.entity, leadId: null, bookingId: null },
    },
  ])("maps $topic/$aggregateType without copying payload data", async ({ expected, ...input }) => {
    const query = vi.fn().mockResolvedValue([])
    const consumer = new AnalyticsConversionConsumer({ query } as never)

    await consumer.consume(claim(input))

    expect(query).toHaveBeenCalledOnce()
    const [sql, parameters] = query.mock.calls[0] as [string, unknown[]]
    expect(sql).toContain("ON CONFLICT (source_event_id) DO NOTHING")
    expect(parameters.slice(1)).toEqual([
      ids.event,
      expected.kind,
      occurredAt,
      expected.entityId,
      expected.leadId,
      expected.bookingId,
      null,
      null,
      null,
      null,
      "unattributed",
    ])
    expect(parameters).not.toContain(ids.pii)
  })

  it.each(["customer.created", "booking.updated", "payment.refund", "payment.adjustment"])("ignores non-conversion topic %s", async (topic) => {
    const query = vi.fn()
    await new AnalyticsConversionConsumer({ query } as never).consume(claim({ topic }))
    expect(query).not.toHaveBeenCalled()
  })

  it.each([
    ["lead.created", { leadId: "not-a-uuid" }, "ANALYTICS_LEAD_CREATED_PAYLOAD_INVALID"],
    ["booking.created", {}, "ANALYTICS_BOOKING_CREATED_PAYLOAD_INVALID"],
    ["payment.charge", { paymentId: null }, "ANALYTICS_PAYMENT_CHARGE_PAYLOAD_INVALID"],
  ])("permanently rejects malformed %s payload", async (topic, payload, code) => {
    const query = vi.fn()
    await expect(new AnalyticsConversionConsumer({ query } as never).consume(claim({ topic, payload })))
      .rejects.toEqual(expect.objectContaining<Partial<PermanentDeliveryError>>({ code }))
    expect(query).not.toHaveBeenCalled()
  })

  it("is idempotent by authoritative source event identity", async () => {
    const sourceEvents = new Set<string>()
    const query = vi.fn().mockImplementation(async (_sql: string, parameters: unknown[]) => {
      sourceEvents.add(parameters[1] as string)
      return []
    })
    const consumer = new AnalyticsConversionConsumer({ query } as never)

    await consumer.consume(claim())
    await consumer.consume(claim({ attempt: 2, leaseToken: ids.pii }))

    expect(query).toHaveBeenCalledTimes(2)
    expect(sourceEvents).toEqual(new Set([ids.event]))
  })

  it("rejects a mismatched authoritative envelope instead of fabricating identity", async () => {
    const query = vi.fn()
    await expect(new AnalyticsConversionConsumer({ query } as never).consume(claim({ aggregateId: ids.aggregate })))
      .rejects.toEqual(expect.objectContaining<Partial<PermanentDeliveryError>>({ code: "ANALYTICS_LEAD_CREATED_PAYLOAD_INVALID" }))
    expect(query).not.toHaveBeenCalled()
  })
})
