import { describe, expect, it } from "vitest";
import { calculateBookingPromotion } from "../src/promotions.js";

const now = new Date("2026-09-04T10:00:00Z");
const promo = { id: "promo", version: 1, terms: { code: "FALL10", active: true, startsAt: null, endsAt: null, scope: "all" as "all" | "selected", resourceIds: [] as string[], offeringIds: [] as string[], minimumAmountMinor: 0, discountType: "percent" as "percent" | "fixed", value: 10 } };
const lines = [{ resourceId: "house", offeringId: "stay", amountMinor: 100_000 }, { resourceId: null, offeringId: "breakfast", amountMinor: 30_000 }];
describe("booking promotion", () => {
  it("discounts inclusive amount once, preserving integer minor units", () => {
    expect(calculateBookingPromotion(promo, lines, 0, now)).toMatchObject({ eligibleAmountMinor: 130_000, discountAmountMinor: 13_000 });
    expect(calculateBookingPromotion(promo, [{ ...lines[0]!, amountMinor: 1099 }], 0, now).discountAmountMinor).toBe(110);
  });
  it("unions resource/offering scopes without discounting unrelated addons or doubling", () => {
    const selected = { ...promo, terms: { ...promo.terms, scope: "selected" as const, resourceIds: ["house"], offeringIds: ["stay"] } };
    expect(calculateBookingPromotion(selected, lines, 0, now).eligibleAmountMinor).toBe(100_000);
    selected.terms.resourceIds = []; selected.terms.offeringIds = ["breakfast"];
    expect(calculateBookingPromotion(selected, lines, 0, now).discountAmountMinor).toBe(3000);
  });
  it("caps fixed discount to eligible amount", () => {
    expect(calculateBookingPromotion({ ...promo, terms: { ...promo.terms, discountType: "fixed", value: 200_000 } }, lines, 0, now).discountAmountMinor).toBe(130_000);
  });
  it("rejects manual stacking, expired, inactive, noneligible and minimum", () => {
    expect(() => calculateBookingPromotion(promo, lines, 1, now)).toThrow("не суммируются");
    expect(() => calculateBookingPromotion({ ...promo, terms: { ...promo.terms, endsAt: now.toISOString() } }, lines, 0, now)).toThrow("не действует");
    expect(() => calculateBookingPromotion({ ...promo, terms: { ...promo.terms, active: false } }, lines, 0, now)).toThrow("не действует");
    expect(() => calculateBookingPromotion({ ...promo, terms: { ...promo.terms, scope: "selected", offeringIds: ["other"] } }, lines, 0, now)).toThrow("не распространяется");
    expect(() => calculateBookingPromotion({ ...promo, terms: { ...promo.terms, minimumAmountMinor: 130_001 } }, lines, 0, now)).toThrow("минимальная");
  });
});
