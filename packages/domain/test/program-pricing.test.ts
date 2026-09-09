import { describe, expect, it } from "vitest";

import { DomainError } from "../src/errors.js";
import { resolveProgramTemplateQuote, validateProgramPricingForActivation, type ProgramPricingSnapshot } from "../src/program-pricing.js";

function snapshot(basis: "per_person" | "flat_package" = "per_person"): ProgramPricingSnapshot {
  return {
    offering: { id: "offering", version: 2, subjectVersion: 3, pricingVersion: 4, kind: "program", state: "active", currency: "RUB", timezone: "Europe/Moscow", businessCalendarId: "calendar", activePriceBookId: "book" },
    template: { id: "template", version: 7, durationMinutes: 120, minimumParticipants: 2, participantLimit: 20 },
    priceBook: { id: "book", version: 5, revision: 2, offeringId: "offering", state: "active", currency: "RUB", timezone: "Europe/Moscow", validFrom: "2027-01-01", validToExclusive: "2027-01-03" },
    ratePlans: [{
      id: "rate", version: 6, priceBookId: "book", key: "standard", label: "Стандарт", pricingBasis: basis,
      quantityMetric: "participants", baseAmountMinor: basis === "per_person" ? 1_000 : 10_000,
      includedQuantity: basis === "flat_package" ? 10 : null, baseExtraUnitAmountMinor: basis === "flat_package" ? 500 : null,
      minQuantity: 2, maxQuantity: 20, minDurationMinutes: 120, maxDurationMinutes: 120, isDefault: true,
      rules: [{ id: "duration-tier", version: 3, dateSelector: { type: "any_date" }, quantityRange: { min: 11, max: 20 }, bookingLeadDays: null, durationMinutes: { min: 120, max: 120 }, amountMinor: basis === "per_person" ? 900 : 9_000, extraUnitAmountMinor: basis === "flat_package" ? 400 : null, priority: 4, reason: "group", enabled: true }],
    }],
    calendar: { id: "calendar", version: 8, state: "active", timezone: "Europe/Moscow", sourceVersion: "ru-2027-v1", dates: ["2027-01-01", "2027-01-02"].map((date) => ({ date, official: { id: `day-${date}`, version: 1, dayClass: "holiday" as const, sourceVersion: "ru-2027-v1" }, activeOverride: null })) },
  };
}

function quote(value: ProgramPricingSnapshot, participants = 12) {
  return resolveProgramTemplateQuote(value, { offeringId: "offering", programTemplateId: "template", ratePlanKey: null, serviceDate: "2027-01-01", participants, durationMinutes: 120, currency: "RUB" }, { quoteId: "quote", calculatedAt: new Date("2026-12-01T21:30:00Z"), quoteTtlSeconds: 900, nextPricingActivationAt: new Date("2026-12-02T00:10:00Z") });
}

describe("program pricing", () => {
  it("prices per person and supports duration-aware rules", () => {
    const result = quote(snapshot());
    expect(result).toMatchObject({ quoteType: "template_preview", acceptanceReady: false, totalAmountMinor: 10_800, leadDays: 30, subjectVersion: 3, programTemplateVersion: 7 });
    expect(result.lines).toEqual([expect.objectContaining({ kind: "base", quantity: 12, unitAmountMinor: 900 })]);
  });

  it("prices a package base plus explicit extra participants", () => {
    const result = quote(snapshot("flat_package"));
    expect(result.totalAmountMinor).toBe(9_800);
    expect(result.lines).toEqual([expect.objectContaining({ kind: "base", totalAmountMinor: 9_000 }), expect.objectContaining({ kind: "extra_unit", quantity: 2, unitAmountMinor: 400 })]);
  });

  it("rejects equal best matches and mismatched template duration", () => {
    const original = snapshot();
    const ambiguous = { ...original, ratePlans: [{ ...original.ratePlans[0]!, rules: [...original.ratePlans[0]!.rules, { ...original.ratePlans[0]!.rules[0]!, id: "same-rank" }] }] };
    expect(() => quote(ambiguous)).toThrowError(expect.objectContaining({ code: "PRICE_RULE_AMBIGUOUS" }) as DomainError);
    expect(() => resolveProgramTemplateQuote(original, { offeringId: "offering", programTemplateId: "template", ratePlanKey: null, serviceDate: "2027-01-01", participants: 3, durationMinutes: 90, currency: "RUB" }, { quoteId: "quote", calculatedAt: new Date("2026-12-01T00:00:00Z"), quoteTtlSeconds: 900, nextPricingActivationAt: null })).toThrowError(expect.objectContaining({ code: "PROGRAM_DURATION_MISMATCH" }) as DomainError);
  });

  it("validates supported bases, participant metric and inclusive rule ambiguity", () => {
    expect(validateProgramPricingForActivation(snapshot(), "2027-01-01", "2027-01-03")).toEqual([]);
    const original = snapshot();
    const invalid = { ...original, ratePlans: [{ ...original.ratePlans[0]!, quantityMetric: "guests" as const, rules: [...original.ratePlans[0]!.rules, { ...original.ratePlans[0]!.rules[0]!, id: "overlap" }] }] };
    expect(validateProgramPricingForActivation(invalid, "2027-01-01", "2027-01-03").map((issue) => issue.code)).toEqual(expect.arrayContaining(["PRICE_RULE_INVALID", "PRICE_RULE_AMBIGUOUS"]));
  });
});
