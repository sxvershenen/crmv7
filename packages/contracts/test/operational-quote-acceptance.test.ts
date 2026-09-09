import { describe, expect, it } from "vitest";

import {
  BookingTransitionSchema,
  EventTransitionSchema,
  OperationalQuoteAcceptanceOutboxEventSchema,
  OfferingQuoteOperationalContextSchema,
  ProgramRegistrationTransitionSchema,
} from "../src/index.js";

const bookingId = "11111111-1111-4111-8111-111111111111";
const itemId = "22222222-2222-4222-8222-222222222222";
const quoteId = "33333333-3333-4333-8333-333333333333";
const operationId = "44444444-4444-4444-8444-444444444444";

describe("operational quote acceptance contracts", () => {
  it("permits booking item acceptance only on confirmed transition with unique items and snapshots", () => {
    const accepted = BookingTransitionSchema.parse({
      expectedVersion: 3, operationId, idempotencyKey: "quote-acceptance-booking", status: "confirmed",
      quoteAcceptances: [{ bookingItemId: itemId, quoteSnapshotId: quoteId }],
    });
    expect(accepted.quoteAcceptances?.[0]?.bookingItemId).toBe(itemId);
    expect(BookingTransitionSchema.safeParse({ ...accepted, status: "cancelled" }).success).toBe(false);
    expect(BookingTransitionSchema.safeParse({ ...accepted, quoteAcceptances: [...accepted.quoteAcceptances!, { bookingItemId: itemId, quoteSnapshotId: bookingId }] }).success).toBe(false);
  });

  it("keeps event and registration acceptance opt-in at their lifecycle boundaries", () => {
    expect(EventTransitionSchema.parse({ version: 1, operationId, idempotencyKey: "quote-acceptance-event", status: "booked", quoteAcceptance: { quoteSnapshotId: quoteId } }).quoteAcceptance?.quoteSnapshotId).toBe(quoteId);
    expect(EventTransitionSchema.safeParse({ version: 1, operationId, idempotencyKey: "quote-acceptance-event", status: "planning", quoteAcceptance: { quoteSnapshotId: quoteId } }).success).toBe(false);
    expect(ProgramRegistrationTransitionSchema.parse({ version: 1, operationId, idempotencyKey: "quote-acceptance-registration", status: "confirmed", quoteAcceptance: { quoteSnapshotId: quoteId } }).quoteAcceptance?.quoteSnapshotId).toBe(quoteId);
    expect(ProgramRegistrationTransitionSchema.safeParse({ version: 1, operationId, idempotencyKey: "quote-acceptance-registration", status: "paid", quoteAcceptance: { quoteSnapshotId: quoteId } }).success).toBe(false);
  });

  it("uses strict operational context and a non-PII outbox envelope", () => {
    const context = OfferingQuoteOperationalContextSchema.parse({ kind: "house_stay", subjectVersion: 2, primaryResourceId: itemId, primaryResourceVersion: 4 });
    expect(context.kind).toBe("house_stay");
    expect(OfferingQuoteOperationalContextSchema.safeParse({ ...context, note: "private" }).success).toBe(false);
    const event = OperationalQuoteAcceptanceOutboxEventSchema.parse({
      schemaVersion: 1, eventId: bookingId, eventType: "crm.operational_quote.accepted", occurredAt: "2026-09-01T12:00:00.000Z",
      actorId: null, requestId: "request-acceptance", operationId, entrySurface: "internal",
      target: { type: "booking_item", id: itemId, aggregateId: bookingId, version: 5 },
      quote: { quoteSnapshotId: quoteId, offeringId: "55555555-5555-4555-8555-555555555555", offeringVersion: 2, pricingVersion: 3, addOnsVersion: 4, priceBookVersion: 5, calendarVersion: 6, currency: "RUB" },
    });
    expect(event.target.type).toBe("booking_item");
    expect(OperationalQuoteAcceptanceOutboxEventSchema.safeParse({ ...event, customerId: bookingId }).success).toBe(false);
  });
});
