import { describe, expect, it } from "vitest";
import { PromotionTermsSchema, MarketingReportSchema, BookingUpdateSchema } from "../src/index.js";
const terms = { code: " fall10 ", name: "Осень", active: true, discountType: "percent", value: 10, minimumAmountMinor: 0, startsAt: null, endsAt: null, scope: "all", resourceIds: [], offeringIds: [] };
describe("marketing contracts", () => {
  it("normalizes code and validates percent, scope and times", () => {
    expect(PromotionTermsSchema.parse(terms).code).toBe("FALL10");
    expect(PromotionTermsSchema.safeParse({ ...terms, value: 101 }).success).toBe(false);
    expect(PromotionTermsSchema.safeParse({ ...terms, scope: "selected" }).success).toBe(false);
    expect(PromotionTermsSchema.safeParse({ ...terms, startsAt: "2026-09-05T00:00:00Z", endsAt: "2026-09-04T00:00:00Z" }).success).toBe(false);
  });
  it("does not turn sparse booking patch into promo removal", () => {
    expect(BookingUpdateSchema.parse({ expectedVersion: 1, operationId: "00000000-0000-4000-8000-000000000001", idempotencyKey: "patch-booking-123" })).not.toHaveProperty("promoCode");
  });
  it("unavailable visitors must be null, never fabricated zero", () => {
    const report = { period: { from: "2026-09-01", to: "2026-09-04" }, visitorsStatus: "not_configured", visitors: null, attributionModel: "lead_snapshot", campaigns: [], promotions: [] };
    expect(MarketingReportSchema.safeParse(report).success).toBe(true);
    expect(MarketingReportSchema.safeParse({ ...report, visitors: 0 }).success).toBe(false);
  });
});
