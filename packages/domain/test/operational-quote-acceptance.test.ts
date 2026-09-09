import { describe, expect, it } from "vitest";

import { DomainError } from "../src/errors.js";
import { assertQuoteAcceptanceTarget, assertQuoteSnapshotAcceptable, assertUniqueQuoteAcceptances } from "../src/operational-quote-acceptance.js";

const context = { kind: "house_stay" as const, subjectVersion: 2, primaryResourceId: "resource-1", primaryResourceVersion: 3 };

function errorCode(action: () => unknown): string {
  try { action(); } catch (error) { expect(error).toBeInstanceOf(DomainError); return (error as DomainError).code; }
  throw new Error("Expected DomainError");
}

describe("operational quote acceptance guards", () => {
  it("fails closed for legacy or expired quote snapshots", () => {
    const acceptedAt = new Date("2026-09-01T12:00:00.000Z");
    assertQuoteSnapshotAcceptable({ id: "quote-1", validUntil: new Date("2026-09-01T12:01:00.000Z"), operationalContext: context }, acceptedAt);
    expect(errorCode(() => assertQuoteSnapshotAcceptable({ id: "legacy", validUntil: new Date("2026-09-01T12:01:00.000Z"), operationalContext: null }, acceptedAt))).toBe("QUOTE_NOT_ACCEPTANCE_READY");
    expect(errorCode(() => assertQuoteSnapshotAcceptable({ id: "expired", validUntil: acceptedAt, operationalContext: context }, acceptedAt))).toBe("QUOTE_SNAPSHOT_EXPIRED");
  });

  it("requires the locked target lifecycle state and version", () => {
    assertQuoteAcceptanceTarget({ type: "booking_item", id: "item-1", expectedVersion: 4, actualVersion: 4, status: "confirmed", archived: false });
    expect(errorCode(() => assertQuoteAcceptanceTarget({ type: "event", id: "event-1", expectedVersion: 4, actualVersion: 3, status: "booked", archived: false }))).toBe("QUOTE_ACCEPTANCE_TARGET_VERSION_CONFLICT");
    expect(errorCode(() => assertQuoteAcceptanceTarget({ type: "program_registration", id: "registration-1", expectedVersion: 4, actualVersion: 4, status: "new", archived: false }))).toBe("QUOTE_ACCEPTANCE_INVALID");
  });

  it("does not allow one quote or one target to be accepted twice", () => {
    assertUniqueQuoteAcceptances([{ targetId: "item-1", quoteSnapshotId: "quote-1" }]);
    expect(errorCode(() => assertUniqueQuoteAcceptances([{ targetId: "item-1", quoteSnapshotId: "quote-1" }, { targetId: "item-2", quoteSnapshotId: "quote-1" }]))).toBe("QUOTE_ALREADY_ACCEPTED");
  });
});
