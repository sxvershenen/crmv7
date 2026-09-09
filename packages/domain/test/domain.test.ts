import { describe, expect, it } from "vitest";
import { assertAvailable, calculatePaymentSummary, canTransitionTask, capabilitiesForRoles, checkAvailability, createInterval, normalizePhone, overlaps, phonesEqual, roleCapabilities, validateIdempotencyInput } from "../src";
import { DomainError } from "../src/errors";

const date = (value: string) => new Date(`2026-01-01T${value}:00.000Z`);
const allocation = (startAt: string, endAt: string, quantity = 1) => ({ id: "a", resourceId: "r", sourceId: "s", startAt: date(startAt), endAt: date(endAt), quantity, status: "active" as const });

describe("interval and availability rules", () => {
  it("uses half-open intervals", () => {
    expect(overlaps(createInterval(date("10:00"), date("11:00")), createInterval(date("11:00"), date("12:00")))).toBe(false);
  });
  it("detects a single-capacity conflict and honors exclusion", () => {
    const request = { resourceId: "r", startAt: date("10:30"), endAt: date("11:30"), quantity: 1 };
    expect(checkAvailability(request, [allocation("10:00", "11:00")]).available).toBe(false);
    expect(checkAvailability({ ...request, excludeSourceId: "s" }, [allocation("10:00", "11:00")]).available).toBe(true);
  });
  it("checks aggregate capacity conservatively", () => {
    expect(checkAvailability({ resourceId: "r", startAt: date("10:30"), endAt: date("11:30"), quantity: 2 }, [allocation("10:00", "11:00", 2)], { capacity: 3 }).available).toBe(false);
    expect(checkAvailability({ resourceId: "r", startAt: date("10:30"), endAt: date("11:30"), quantity: 1 }, [allocation("10:00", "11:00", 2), { ...allocation("10:15", "11:15", 2), id: "b", sourceId: "t" }], { capacity: 4 }).available).toBe(false);
  });
  it("throws a domain error for unavailable operation", () => {
    expect(() => assertAvailable({ available: false, conflicts: [] })).toThrow(DomainError);
  });
});

describe("task, RBAC and payment rules", () => {
  it("allows completion and reopening but not direct cancellation of a completed task", () => {
    expect(canTransitionTask("open", "completed")).toBe(true);
    expect(canTransitionTask("completed", "cancelled")).toBe(false);
  });
  it("merges role capabilities", () => {
    const capabilities = capabilitiesForRoles(["readonly", "manager"]);
    expect(capabilities.canView).toBe(true);
    expect(capabilities.canEdit).toBe(true);
    expect(capabilities.canManageUsers).toBe(false);
  });
  it("keeps CMS authority conservative by role", () => {
    expect(roleCapabilities("admin").canPublishContent).toBe(true);
    expect(roleCapabilities("technical_admin")).toMatchObject({ canViewContent: true, canManageSiteCode: true, canManageIntegrations: true, canManageSiteSettings: true, canEditContent: false });
    expect(roleCapabilities("manager")).toMatchObject({ canViewContent: true, canEditContent: true, canReviewContent: true, canManageSeo: true, canManageMedia: true, canViewAnalytics: true, canPublishContent: false, canViewRawAnalytics: false, canManageSiteCode: false });
    expect(roleCapabilities("readonly")).toMatchObject({ canViewContent: true, canEditContent: false, canViewAnalytics: false });
  });
  it("calculates immutable payment totals in minor units", () => {
    const summary = calculatePaymentSummary({ amountMinor: 10_000, currency: "RUB" }, [
      { type: "charge", amount: { amountMinor: 10_000, currency: "RUB" }, operationId: "charge-1" },
      { type: "refund", amount: { amountMinor: 1_000, currency: "RUB" }, operationId: "refund-1" },
    ]);
    expect(summary.state).toBe("partial");
    expect(summary.balance).toBe(1_000);
  });
  it("rejects malformed idempotency inputs", () => {
    expect(() => validateIdempotencyInput({ operationId: "nope", idempotencyKey: "short", expectedVersion: 0 })).toThrow(DomainError);
  });
});

describe("phone normalization", () => {
  it("uses one Russian comparison key without changing display values", () => {
    expect(normalizePhone("8 (921) 450-12-40")).toBe("79214501240");
    expect(normalizePhone("+7 921 450 12 40")).toBe("79214501240");
    expect(normalizePhone("9214501240")).toBe("79214501240");
    expect(phonesEqual("8 921 450-12-40", "+7 921 450-12-40")).toBe(true);
  });

  it("does not treat empty values as a duplicate", () => {
    expect(normalizePhone("—")).toBeNull();
    expect(phonesEqual(null, null)).toBe(false);
  });
});
