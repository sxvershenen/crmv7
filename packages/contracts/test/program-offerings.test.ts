import { describe, expect, it } from "vitest";

import { ProgramOfferingLookupResultSchema, ProgramOfferingPrepareBodySchema, ProgramOfferingQuotePreviewBodySchema, ProgramOfferingQuoteResultSchema } from "../src/offerings.js";

const operationId = "11111111-1111-4111-8111-111111111111";

describe("program offering contracts", () => {
  it("uses a named template CAS and reserves registration as a distinct future quote type", () => {
    expect(ProgramOfferingPrepareBodySchema.parse({ operationId, idempotencyKey: "program-prepare-0001", expectedProgramTemplateVersion: 3 })).toMatchObject({ expectedProgramTemplateVersion: 3 });
    expect(ProgramOfferingQuotePreviewBodySchema.parse({ ratePlanKey: null, serviceDate: "2027-01-02", participants: 4, currency: "RUB", operationId, idempotencyKey: "program-preview-0001" })).toMatchObject({ quoteType: "template_preview", addOns: [] });
    expect(ProgramOfferingQuotePreviewBodySchema.safeParse({ quoteType: "program_registration", ratePlanKey: null, serviceDate: "2027-01-02", participants: 4, currency: "RUB", operationId, idempotencyKey: "program-preview-0001" }).success).toBe(false);
  });

  it("marks a template preview as not acceptance-ready and pins all owner versions", () => {
    const id = "22222222-2222-4222-8222-222222222222";
    expect(ProgramOfferingQuoteResultSchema.parse({
      quoteType: "template_preview", acceptanceReady: false, quoteId: id, offeringId: id, programTemplateId: id,
      calculatedAt: "2026-12-01T00:00:00.000Z", validUntil: "2026-12-01T00:15:00.000Z", leadDays: 32, currency: "RUB",
      inputs: { serviceDate: "2027-01-02", participants: 4, durationMinutes: 120 },
      lines: [{ kind: "base", label: "Участники", serviceDate: "2027-01-02", quantity: 4, unitAmount: { amountMinor: 1000, currency: "RUB" }, amount: { amountMinor: 4000, currency: "RUB" }, ratePlanId: id, ratePlanVersion: 1, matchedRuleId: null, matchedRuleVersion: null, explanation: "base" }],
      total: { amountMinor: 4000, currency: "RUB" }, provenance: { offeringVersion: 1, subjectVersion: 1, programTemplateVersion: 2, pricingVersion: 3, addOnsVersion: 1, priceBookId: id, priceBookVersion: 4, businessCalendarId: id, businessCalendarVersion: 5, businessCalendarSourceVersion: "ru-2027", matchedRuleIds: [] }, immutableSnapshot: true,
    })).toMatchObject({ quoteType: "template_preview", acceptanceReady: false });
  });

  it("returns a reload-safe unprepared, linked or ambiguous resolution", () => {
    const id = "22222222-2222-4222-8222-222222222222";
    expect(ProgramOfferingLookupResultSchema.parse({ resolution: "unprepared", programTemplateId: id, programTemplateVersion: 2 })).toEqual({ resolution: "unprepared", programTemplateId: id, programTemplateVersion: 2 });
    const offering = { offeringId: id, offeringVersion: 1, subjectVersion: 1, pricingVersion: 2, addOnAssignmentsVersion: 1, programTemplateId: id, programTemplateVersion: 2, state: "active", cmsReady: true, publicReady: false, editorialNodeId: id };
    expect(ProgramOfferingLookupResultSchema.parse({ resolution: "linked", offering })).toMatchObject({ resolution: "linked", offering: { offeringId: id, cmsReady: true, publicReady: false } });
    expect(ProgramOfferingLookupResultSchema.safeParse({ resolution: "ambiguous", programTemplateId: id, programTemplateVersion: 2, candidates: [offering] }).success).toBe(false);
  });
});
