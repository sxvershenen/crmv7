import { describe, expect, it } from "vitest";

import {
  resolveHousePerNightQuote,
  resolveCampgroundPerNightQuote,
  resolveAddOnServiceDateQuote,
  validateAddOnPricingForActivation,
  validateCampgroundPricingForActivation,
  validateHousePricingForActivation,
  type HousePriceRule,
  type HousePricingSnapshot,
} from "../src/offering-pricing.js";
import { DomainError } from "../src/errors.js";

const dates = ["2027-01-01", "2027-01-02", "2027-01-03", "2027-01-04"] as const;

function rule(patch: Partial<HousePriceRule> = {}): HousePriceRule {
  return {
    id: "rule-base",
    version: 1,
    dateSelector: { type: "day_class", dayClass: "weekday" },
    quantityRange: null,
    bookingLeadDays: null,
    durationMinutes: null,
    amountMinor: 12_000,
    extraUnitAmountMinor: null,
    priority: 0,
    reason: "",
    enabled: true,
    ...patch,
  };
}

function snapshot(rules: readonly HousePriceRule[] = []): HousePricingSnapshot {
  return {
    offering: {
      id: "offering-house",
      version: 2,
      pricingVersion: 5,
      kind: "house",
      state: "active",
      currency: "RUB",
      timezone: "Europe/Moscow",
      businessCalendarId: "calendar-ru",
      activePriceBookId: "book-active",
    },
    priceBook: {
      id: "book-active",
      version: 3,
      revision: 2,
      offeringId: "offering-house",
      state: "active",
      currency: "RUB",
      timezone: "Europe/Moscow",
      validFrom: "2027-01-01",
      validToExclusive: "2027-01-05",
    },
    ratePlans: [{
      id: "rate-standard",
      version: 4,
      priceBookId: "book-active",
      key: "standard",
      label: "Стандарт",
      pricingBasis: "per_night",
      quantityMetric: "guests",
      baseAmountMinor: 10_000,
      includedQuantity: 2,
      baseExtraUnitAmountMinor: 1_000,
      minQuantity: 1,
      maxQuantity: 8,
      minDurationMinutes: null,
      maxDurationMinutes: null,
      isDefault: true,
      rules,
    }],
    calendar: {
      id: "calendar-ru",
      version: 7,
      state: "active",
      timezone: "Europe/Moscow",
      sourceVersion: "ru-2027-v1",
      dates: dates.map((date, index) => ({
        date,
        official: {
          id: `official-${date}`,
          version: 1,
          dayClass: index === 0 ? "holiday" as const : index < 3 ? "weekend" as const : "weekday" as const,
          sourceVersion: "ru-2027-v1",
        },
        activeOverride: null,
      })),
    },
  };
}

function quote(snapshotValue: HousePricingSnapshot) {
  return resolveHousePerNightQuote(snapshotValue, {
    offeringId: "offering-house",
    ratePlanKey: null,
    arrivalDate: "2027-01-01",
    departureDate: "2027-01-04",
    guests: 3,
    units: 1,
    currency: "RUB",
  }, {
    quoteId: "quote-1",
    calculatedAt: new Date("2026-12-01T21:30:00.000Z"),
    quoteTtlSeconds: 900,
    nextPricingActivationAt: null,
  });
}

function errorCode(action: () => unknown) {
  try {
    action();
    return null;
  } catch (error) {
    expect(error).toBeInstanceOf(DomainError);
    return (error as DomainError).code;
  }
}

describe("house per-night pricing", () => {
  it("sums every occupied local night and applies extra guests per night", () => {
    const result = quote(snapshot());
    expect(result.lines.map((line) => line.serviceDate)).toEqual(["2027-01-01", "2027-01-02", "2027-01-03"]);
    expect(result.lines.map((line) => line.totalAmountMinor)).toEqual([11_000, 11_000, 11_000]);
    expect(result.totalAmountMinor).toBe(33_000);
    expect(result.leadDays).toBe(30);
  });

  it("uses custom date, holiday, day class, any-date and base precedence", () => {
    const result = quote(snapshot([
      rule({ id: "any", dateSelector: { type: "any_date" }, amountMinor: 11_000 }),
      rule({ id: "weekend", dateSelector: { type: "day_class", dayClass: "weekend" }, amountMinor: 12_000 }),
      rule({ id: "holiday", dateSelector: { type: "calendar_holiday" }, amountMinor: 13_000 }),
      rule({ id: "custom", dateSelector: { type: "custom_date_override", from: "2027-01-01", toExclusive: "2027-01-02", label: "Новый год" }, amountMinor: 14_000 }),
    ]));
    expect(result.lines.map((line) => line.matchedRule?.id)).toEqual(["custom", "weekend", "weekend"]);
    expect(result.lines.map((line) => line.baseAmountMinor)).toEqual([14_000, 12_000, 12_000]);
  });

  it("supports an exact recurring Friday through Sunday price", () => {
    const result = quote(snapshot([
      rule({ id: "fri-sun", dateSelector: { type: "recurring_weekdays", days: ["fri", "sat", "sun"] }, amountMinor: 12_500 }),
    ]));
    expect(result.lines.map((line) => line.matchedRule?.id)).toEqual(["fri-sun", "fri-sun", "fri-sun"]);
    expect(result.totalAmountMinor).toBe(40_500);
  });

  it("lets a manual calendar override change the effective class without outranking a custom price override", () => {
    const original = snapshot([
      rule({ id: "holiday", dateSelector: { type: "calendar_holiday" }, amountMinor: 13_000 }),
      rule({ id: "custom", dateSelector: { type: "custom_date_override", from: "2027-01-02", toExclusive: "2027-01-03", label: "Спецдата" }, amountMinor: 15_000 }),
    ]);
    const value: HousePricingSnapshot = {
      ...original,
      calendar: {
        ...original.calendar,
        dates: original.calendar.dates.map((day, index) => index === 1 ? {
          ...day,
          activeOverride: { id: "manual-1", version: 2, dayClass: "holiday", reason: "Решение площадки" },
        } : day),
      },
    };
    const result = quote(value);
    expect(result.lines[1]).toMatchObject({ baseAmountMinor: 15_000, matchedRule: { id: "custom" }, calendar: { effectiveClass: "holiday", overrideId: "manual-1" } });
  });

  it("chooses more matched typed dimensions before priority", () => {
    const result = quote(snapshot([
      rule({ id: "high-priority", dateSelector: { type: "calendar_holiday" }, amountMinor: 13_000, priority: 999 }),
      rule({ id: "quantity-specific", dateSelector: { type: "calendar_holiday" }, quantityRange: { min: 3, max: 4 }, amountMinor: 9_000, priority: 1 }),
    ]));
    expect(result.lines[0]!.matchedRule?.id).toBe("quantity-specific");
  });

  it("fails closed when two matching rules have the same full rank", () => {
    expect(errorCode(() => quote(snapshot([
      rule({ id: "a", dateSelector: { type: "calendar_holiday" }, amountMinor: 13_000, priority: 10 }),
      rule({ id: "b", dateSelector: { type: "calendar_holiday" }, amountMinor: 13_000, priority: 10 }),
    ])))).toBe("PRICE_RULE_AMBIGUOUS");
  });

  it("uses the server instant in offering timezone for lead-day rules", () => {
    const result = quote(snapshot([
      rule({ id: "early", dateSelector: { type: "any_date" }, bookingLeadDays: { min: 31, max: null }, amountMinor: 8_000 }),
    ]));
    expect(result.quoteLocalDate).toBe("2026-12-02");
    expect(result.leadDays).toBe(30);
    expect(result.lines.every((line) => line.matchedRule === null)).toBe(true);
  });

  it("truncates validity at the next scheduled activation", () => {
    const value = resolveHousePerNightQuote(snapshot(), {
      offeringId: "offering-house", ratePlanKey: "standard", arrivalDate: "2027-01-02", departureDate: "2027-01-03", guests: 2, units: 1, currency: "RUB",
    }, {
      quoteId: "quote-2", calculatedAt: new Date("2026-12-01T12:00:00.000Z"), quoteTtlSeconds: 3_600, nextPricingActivationAt: new Date("2026-12-01T12:10:00.000Z"),
    });
    expect(value.validUntil).toBe("2026-12-01T12:10:00.000Z");
  });

  it("rejects missing calendar coverage and price-book boundary crossing", () => {
    const missingOriginal = snapshot();
    const missing: HousePricingSnapshot = {
      ...missingOriginal,
      calendar: { ...missingOriginal.calendar, dates: missingOriginal.calendar.dates.filter((_, index) => index !== 1) },
    };
    expect(errorCode(() => quote(missing))).toBe("CALENDAR_DATE_MISSING");

    const endingOriginal = snapshot();
    const ending: HousePricingSnapshot = { ...endingOriginal, priceBook: { ...endingOriginal.priceBook, validToExclusive: "2027-01-03" } };
    expect(errorCode(() => quote(ending))).toBe("PRICE_BOOK_COVERAGE_GAP");
  });

  it("returns a deeply immutable calculation without mutating rule order", () => {
    const rules = [
      rule({ id: "weekend", dateSelector: { type: "day_class", dayClass: "weekend" }, amountMinor: 12_000 }),
      rule({ id: "holiday", dateSelector: { type: "calendar_holiday" }, amountMinor: 13_000 }),
    ];
    const before = rules.map((item) => item.id);
    const result = quote(snapshot(rules));
    expect(rules.map((item) => item.id)).toEqual(before);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.lines[0])).toBe(true);
    expect(() => (result.lines as Array<unknown>).push({})).toThrow();
  });
});

describe("add-on service-date pricing", () => {
  it("applies the service-date rule once and multiplies the authoritative unit price", () => {
    const source = snapshot([
      rule({ id: "holiday", dateSelector: { type: "calendar_holiday" }, amountMinor: 1_200 }),
    ]);
    const addOn: HousePricingSnapshot = {
      ...source,
      offering: { ...source.offering, id: "addon-transfer", kind: "addon" },
      priceBook: { ...source.priceBook, offeringId: "addon-transfer" },
      ratePlans: source.ratePlans.map((plan) => ({
        ...plan,
        pricingBasis: "per_unit",
        quantityMetric: "units",
        baseAmountMinor: 900,
        includedQuantity: null,
        baseExtraUnitAmountMinor: null,
        minQuantity: null,
        maxQuantity: null,
      })),
    };
    const result = resolveAddOnServiceDateQuote(addOn, {
      offeringId: "addon-transfer",
      ratePlanKey: null,
      serviceDate: "2027-01-01",
      quantity: 3,
      serviceType: "quantity_service",
      currency: "RUB",
    }, { quoteId: "unused", calculatedAt: new Date("2026-12-01T12:00:00.000Z"), quoteTtlSeconds: 900, nextPricingActivationAt: null });
    expect(result).toMatchObject({ unitAmountMinor: 1_200, totalAmountMinor: 3_600, matchedRule: { id: "holiday" } });
    expect(Object.isFrozen(result)).toBe(true);
  });
});

describe("house price-book activation validation", () => {
  it("reports equal-rank overlaps before activation", () => {
    const value = snapshot([
      rule({ id: "a", dateSelector: { type: "custom_date_override", from: "2027-01-01", toExclusive: "2027-01-03", label: "A" }, amountMinor: 10_000, priority: 5 }),
      rule({ id: "b", dateSelector: { type: "custom_date_override", from: "2027-01-02", toExclusive: "2027-01-04", label: "B" }, amountMinor: 11_000, priority: 5 }),
    ]);
    expect(validateHousePricingForActivation(value, { from: "2027-01-01", toExclusive: "2027-01-05" })).toContainEqual(expect.objectContaining({ code: "PRICE_RULE_AMBIGUOUS", ruleIds: ["a", "b"] }));
  });

  it("reports calendar gaps and unsupported duration pricing", () => {
    const original = snapshot([rule({ id: "duration", durationMinutes: { min: 60, max: 120 } })]);
    const value: HousePricingSnapshot = {
      ...original,
      calendar: { ...original.calendar, dates: original.calendar.dates.filter((_, index) => index !== 2) },
    };
    const codes = validateHousePricingForActivation(value, { from: "2027-01-01", toExclusive: "2027-01-05" }).map((issue) => issue.code);
    expect(codes).toContain("CALENDAR_DATE_MISSING");
    expect(codes).toContain("UNSUPPORTED_PRICING_DIMENSION");
  });
});

describe("add-on price-book activation validation", () => {
  it("accepts only direct unit and participant pricing for the first slice", () => {
    const original = snapshot();
    const quantity: HousePricingSnapshot = {
      ...original,
      offering: { ...original.offering, id: "addon-units", kind: "addon" },
      priceBook: { ...original.priceBook, offeringId: "addon-units" },
      ratePlans: original.ratePlans.map((plan) => ({
        ...plan, pricingBasis: "per_unit", quantityMetric: "units" as const,
        includedQuantity: null, baseExtraUnitAmountMinor: null, minQuantity: null, maxQuantity: null, rules: [],
      })),
    };
    expect(validateAddOnPricingForActivation(quantity, { from: "2027-01-01", toExclusive: "2027-01-05" }, "quantity_service")).toEqual([]);

    const person: HousePricingSnapshot = {
      ...quantity,
      offering: { ...quantity.offering, id: "addon-person" },
      priceBook: { ...quantity.priceBook, offeringId: "addon-person" },
      ratePlans: quantity.ratePlans.map((plan) => ({ ...plan, pricingBasis: "per_person", quantityMetric: "participants" as const })),
    };
    expect(validateAddOnPricingForActivation(person, { from: "2027-01-01", toExclusive: "2027-01-05" }, "person_service")).toEqual([]);
  });

  it("rejects stay bases and unresolved quantity dimensions", () => {
    const value = snapshot([rule({ id: "quantity-rule", quantityRange: { min: 1, max: 3 } })]);
    const issues = validateAddOnPricingForActivation(value, { from: "2027-01-01", toExclusive: "2027-01-05" }, "quantity_service");
    expect(issues).toContainEqual(expect.objectContaining({ code: "RATE_PLAN_BASIS_UNSUPPORTED" }));
    expect(issues).toContainEqual(expect.objectContaining({ code: "UNSUPPORTED_PRICING_DIMENSION" }));
  });
});

describe("campground per-night pricing", () => {
  it("prices each shared tent place per occupied night", () => {
    const original = snapshot();
    const value: HousePricingSnapshot = {
      ...original,
      offering: { ...original.offering, id: "camp-pitch", kind: "campground" },
      priceBook: { ...original.priceBook, offeringId: "camp-pitch" },
      ratePlans: original.ratePlans.map((plan) => ({
        ...plan, quantityMetric: "units" as const, includedQuantity: null, baseExtraUnitAmountMinor: null,
        minQuantity: 1, maxQuantity: 15, rules: [],
      })),
    };
    const result = resolveCampgroundPerNightQuote(value, {
      offeringId: "camp-pitch", ratePlanKey: null, arrivalDate: "2027-01-01", departureDate: "2027-01-03",
      guests: null, units: 3, currency: "RUB", salesUnit: "own_tent_pitch", allocationMode: "shared_capacity",
    }, { quoteId: "camp-quote", calculatedAt: new Date("2026-12-01T12:00:00.000Z"), quoteTtlSeconds: 900, nextPricingActivationAt: null });
    expect(result.lines.map((line) => line.totalAmountMinor)).toEqual([30_000, 30_000]);
    expect(result.totalAmountMinor).toBe(60_000);
    expect(validateCampgroundPricingForActivation(value, { from: "2027-01-01", toExclusive: "2027-01-05" }, "own_tent_pitch")).toEqual([]);
  });

  it("fails closed on owned-tent quantity greater than one", () => {
    const original = snapshot();
    const value: HousePricingSnapshot = {
      ...original,
      offering: { ...original.offering, id: "camp-tent", kind: "campground" },
      priceBook: { ...original.priceBook, offeringId: "camp-tent" },
      ratePlans: original.ratePlans.map((plan) => ({ ...plan, quantityMetric: null, includedQuantity: null, baseExtraUnitAmountMinor: null, minQuantity: null, maxQuantity: null, rules: [] })),
    };
    expect(errorCode(() => resolveCampgroundPerNightQuote(value, {
      offeringId: "camp-tent", ratePlanKey: null, arrivalDate: "2027-01-01", departureDate: "2027-01-02",
      guests: null, units: 2, currency: "RUB", salesUnit: "owned_tent", allocationMode: "discrete_inventory",
    }, { quoteId: "camp-quote", calculatedAt: new Date("2026-12-01T12:00:00.000Z"), quoteTtlSeconds: 900, nextPricingActivationAt: null }))).toBe("CAMPGROUND_QUOTE_UNSUPPORTED_QUANTITY");
  });
});
