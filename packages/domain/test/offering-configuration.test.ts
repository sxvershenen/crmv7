import { describe, expect, it } from "vitest";

import { DomainError } from "../src/errors.js";
import {
  assertBusinessCalendarMutable,
  businessCalendarContentHash,
  validateBusinessCalendarActivation,
  validateBusinessCalendarCoverageChange,
  validateBusinessCalendarImport,
  validateHouseOfferingBindings,
  validateCampgroundOfferingBindings,
  validateOfferingAddOnAssignments,
} from "../src/offering-configuration.js";

const coverage = { from: "2027-01-01", toExclusive: "2027-01-04" } as const;
const days = [
  { date: "2027-01-01", dayClass: "holiday" as const, label: "Новый год" },
  { date: "2027-01-02", dayClass: "weekend" as const, label: null },
  { date: "2027-01-03", dayClass: "weekend" as const, label: null },
];

function domainCode(action: () => unknown): string {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(DomainError);
    return (error as DomainError).code;
  }
  throw new Error("Expected DomainError");
}

describe("offering configuration validation", () => {
  it("requires contiguous calendar coverage and hashes independent of day order", () => {
    validateBusinessCalendarImport(coverage, days);
    expect(domainCode(() => validateBusinessCalendarImport(coverage, days.slice(1)))).toBe("CALENDAR_INVALID_COVERAGE");
    const hash = businessCalendarContentHash("ru-2027-v1", coverage, days);
    expect(businessCalendarContentHash("ru-2027-v1", coverage, [...days].reverse())).toBe(hash);
    expect(businessCalendarContentHash("ru-2027-v1", coverage, days, [{ date: "2027-01-02", dayClass: "holiday", label: null, reason: "Перенос", active: true }])).not.toBe(hash);
  });

  it("activates a complete draft, allows active corrections/extensions, and freezes retired calendar", () => {
    const hash = businessCalendarContentHash("ru-2027-v1", coverage, days);
    validateBusinessCalendarActivation({ currentState: "draft", sourceVersion: "ru-2027-v1", coverage, importedDays: days, contentHash: hash });
    expect(domainCode(() => validateBusinessCalendarActivation({ currentState: "active", sourceVersion: "ru-2027-v1", coverage, importedDays: days, contentHash: hash }))).toBe("CALENDAR_INVALID_TRANSITION");
    validateBusinessCalendarCoverageChange(coverage, { from: "2027-01-01", toExclusive: "2027-01-10" });
    expect(domainCode(() => validateBusinessCalendarCoverageChange(coverage, { from: "2027-01-02", toExclusive: "2027-01-04" }))).toBe("CALENDAR_INVALID_COVERAGE");
    assertBusinessCalendarMutable("active");
    expect(domainCode(() => assertBusinessCalendarMutable("retired"))).toBe("CALENDAR_IMMUTABLE");
  });

  it("only permits a resource primary house binding", () => {
    const primary = { target: { type: "resource" as const, id: "resource-1" }, role: "primary" as const, availabilityRequired: true, defaultQuantity: 1, defaultCapacityImpact: 1, preparationBeforeMinutes: 0, preparationAfterMinutes: 0 };
    validateHouseOfferingBindings([primary]);
    expect(domainCode(() => validateHouseOfferingBindings([{ ...primary, target: { type: "resource_group", id: "group-1" } }]))).toBe("OFFERING_BINDING_INVALID");
  });

  it("binds campground sales to a compatible active group member, never the group", () => {
    const primary = { target: { type: "resource" as const, id: "pitch-area" }, role: "primary" as const, availabilityRequired: true, defaultQuantity: 1, defaultCapacityImpact: 1, preparationBeforeMinutes: 0, preparationAfterMinutes: 0 };
    validateCampgroundOfferingBindings(
      { salesUnit: "own_tent_pitch", allocationMode: "shared_capacity" }, [primary],
      [{ id: "pitch-area", capacityMode: "shared", archived: false }],
      [{ resourceId: "pitch-area", role: "own_tent_area", groupState: "active", archived: false }],
    );
    expect(domainCode(() => validateCampgroundOfferingBindings(
      { salesUnit: "own_tent_pitch", allocationMode: "shared_capacity" }, [primary],
      [{ id: "pitch-area", capacityMode: "fixed", archived: false }],
      [{ resourceId: "pitch-area", role: "own_tent_area", groupState: "active", archived: false }],
    ))).toBe("OFFERING_BINDING_INVALID");
    expect(domainCode(() => validateCampgroundOfferingBindings(
      { salesUnit: "owned_tent", allocationMode: "discrete_inventory" }, [{ ...primary, target: { type: "resource_group", id: "camp" } }],
      [], [],
    ))).toBe("OFFERING_BINDING_INVALID");
  });

  it("rejects retired, foreign-specific, duplicate and invalid add-on assignments", () => {
    const assignment = { addOnOfferingId: "addon-1", enabled: true, required: false, recommended: true, minQuantityOverride: null, maxQuantityOverride: null, defaultQuantityOverride: null };
    const reusable = { id: "addon-1", kind: "addon", state: "active" as const, archived: false, scope: "reusable" as const, ownerOfferingId: null };
    validateOfferingAddOnAssignments("offering-1", [assignment], [reusable]);
    expect(domainCode(() => validateOfferingAddOnAssignments("offering-1", [assignment, assignment], [reusable]))).toBe("OFFERING_ADDON_INVALID");
    expect(domainCode(() => validateOfferingAddOnAssignments("offering-1", [{ ...assignment, addOnOfferingId: "addon-2" }], [{ ...reusable, id: "addon-2", scope: "offering_specific", ownerOfferingId: "other" }]))).toBe("OFFERING_ADDON_INVALID");
  });
});
