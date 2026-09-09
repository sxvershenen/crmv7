import { describe, expect, it } from "vitest";

import {
  AddOnLibraryQuerySchema,
  AddOnLibraryResponseSchema,
  AddOnCatalogItemSchema,
  AddOnOfferingCreateBodySchema,
  AddOnOfferingListQuerySchema,
  AddOnServiceTermsSchema,
  AddOnTermsMutationBodySchema,
  BusinessCalendarCreateSchema,
  BusinessCalendarDaySchema,
  BusinessCalendarImportSchema,
  BusinessCalendarImportBodySchema,
  BusinessCalendarOverrideReplaceSchema,
  BusinessCalendarStateTransitionSchema,
  HouseOfferingBindingsReplaceSchema,
  HouseOfferingBindingsReplaceBodySchema,
  CampgroundOfferingBindingsReplaceBodySchema,
  CatalogOfferingCreateSchema,
  CatalogOfferingKindSchema,
  CatalogOfferingOperationalMutationSchema,
  InternalOfferingQuoteRequestSchema,
  InternalHouseOfferingQuoteBodySchema,
  InternalCampgroundOfferingQuoteBodySchema,
  OfferingBindingTargetLookupQuerySchema,
  OfferingBindingTargetLookupResponseSchema,
  OfferingBindingTargetSummarySchema,
  ResourcePrimaryStayOfferingLookupResponseSchema,
  ResourceStayOfferingCreateBodySchema,
  ResourceStayOfferingCreateResultSchema,
  ResourceStayOfferingQuotePreviewBodySchema,
  HouseOfferingListQuerySchema,
  StayOfferingListQuerySchema,
  HousePriceBookActivateBodySchema,
  HousePriceBookDraftCreateBodySchema,
  HousePriceBookDraftReplaceBodySchema,
  HousePriceBookScheduleBodySchema,
  OfferingPricingOutboxEventSchema,
  OfferingAddOnAssignmentCreateSchema,
  OfferingAddOnAssignmentsReplaceSchema,
  OfferingAddOnAssignmentsReplaceBodySchema,
  OfferingConfigurationOutboxEventSchema,
  OfferingEditorialLocatorSchema,
  OfferingCustomAddOnCreateSchema,
  OfferingCustomAddOnCreateBodySchema,
  OfferingBindingSchema,
  PriceBookDraftMutationSchema,
  PriceDisplayModeSchema,
  PriceDateSelectorSchema,
  PriceRuleDraftSchema,
  PublicOfferingQuoteSchema,
  PublicOfferingSummarySchema,
  PublicAddOnListQuerySchema,
  PublicAddOnListResponseSchema,
  PublicAddOnProjectionPinSchema,
  PublicAddOnSummaryParamsSchema,
  PublicAddOnSummarySchema,
} from "../src/index.js";

const id = "11111111-1111-4111-8111-111111111111";
const secondId = "22222222-2222-4222-8222-222222222222";
const thirdId = "33333333-3333-4333-8333-333333333333";
const timestamp = "2026-08-31T12:00:00+03:00";
const operation = {
  operationId: id,
  idempotencyKey: "offering-operation-0001",
};

function offeringCreate(fulfillment: Record<string, unknown>) {
  return {
    ...operation,
    kind: fulfillment.kind,
    operationalName: "Предложение",
    salesMode: "quoted",
    priceDisplayMode: "from",
    currency: "RUB",
    timezone: "Europe/Moscow",
    taxMode: "not_taxable",
    businessCalendarId: secondId,
    fulfillment,
  };
}

describe("P4.5A offering contracts", () => {
  it("accepts a unique recurring weekday set for stay pricing", () => {
    expect(PriceDateSelectorSchema.parse({ type: "recurring_weekdays", days: ["fri", "sat", "sun"] })).toEqual({ type: "recurring_weekdays", days: ["fri", "sat", "sun"] });
    expect(PriceDateSelectorSchema.safeParse({ type: "recurring_weekdays", days: ["fri", "fri"] }).success).toBe(false);
  });
  it("locks the six offering kinds and the three public price modes", () => {
    expect(CatalogOfferingKindSchema.options).toEqual([
      "house",
      "campground",
      "addon",
      "venue",
      "event_service",
      "program",
    ]);
    expect(PriceDisplayModeSchema.options).toEqual(["exact", "from", "request"]);
  });

  it("supports only individual owned tents and shared own-tent pitches", () => {
    expect(CatalogOfferingCreateSchema.parse(offeringCreate({
      kind: "campground",
      salesUnit: "owned_tent",
      allocationMode: "discrete_inventory",
      capacityUnit: "tent",
      stayPricing: "sum_each_local_night",
    })).fulfillment).toMatchObject({ salesUnit: "owned_tent", stayPricing: "sum_each_local_night" });

    expect(CatalogOfferingCreateSchema.parse(offeringCreate({
      kind: "campground",
      salesUnit: "own_tent_pitch",
      allocationMode: "shared_capacity",
      capacityUnit: "tent",
      stayPricing: "sum_each_local_night",
    })).fulfillment).toMatchObject({ salesUnit: "own_tent_pitch", allocationMode: "shared_capacity" });

    expect(CatalogOfferingCreateSchema.safeParse(offeringCreate({
      kind: "campground",
      salesUnit: "whole_camp",
      allocationMode: "shared_capacity",
      capacityUnit: "tent",
      stayPricing: "sum_each_local_night",
    })).success).toBe(false);
    expect(CatalogOfferingCreateSchema.safeParse(offeringCreate({
      kind: "campground",
      salesUnit: "own_tent_pitch",
      allocationMode: "discrete_inventory",
      capacityUnit: "tent",
      stayPricing: "sum_each_local_night",
    })).success).toBe(false);
  });

  it("keeps fulfillment kind aligned and content-only add-ons request-only", () => {
    expect(CatalogOfferingCreateSchema.safeParse({
      ...offeringCreate({ kind: "house", stayPricing: "sum_each_local_night" }),
      kind: "venue",
    }).success).toBe(false);
    expect(CatalogOfferingCreateSchema.safeParse(offeringCreate({
      kind: "addon",
      serviceType: "content_only",
      standalone: false,
      scope: "reusable",
      ownerOfferingId: null,
    })).success).toBe(false);
    expect(CatalogOfferingCreateSchema.safeParse({
      ...offeringCreate({ kind: "addon", serviceType: "content_only", standalone: false, scope: "reusable", ownerOfferingId: null }),
      salesMode: "request_only",
    }).success).toBe(true);
    expect(CatalogOfferingCreateSchema.safeParse({
      ...offeringCreate({ kind: "addon", serviceType: "package_service", standalone: false, scope: "offering_specific", ownerOfferingId: null }),
      salesMode: "request_only",
    }).success).toBe(false);
  });

  it("uses typed bindings and rejects untyped or operational occurrence targets", () => {
    const binding = {
      id,
      offeringId: secondId,
      version: 1,
      target: { type: "resource", id: thirdId },
      role: "inventory_unit",
      availabilityRequired: true,
      defaultQuantity: 1,
      defaultCapacityImpact: 1,
      preparationBeforeMinutes: 0,
      preparationAfterMinutes: 30,
    };
    expect(OfferingBindingSchema.parse(binding).target.type).toBe("resource");
    expect(OfferingBindingSchema.safeParse({ ...binding, target: { type: "program_occurrence", id: thirdId } }).success).toBe(false);
    expect(OfferingBindingSchema.safeParse({ ...binding, target: { type: "resource", id: thirdId, arbitrary: true } }).success).toBe(false);
  });

  it("keeps resource binding target lookup typed, cursor-based and free of resource settings", () => {
    expect(OfferingBindingTargetLookupQuerySchema.parse({
      targetType: "resource", q: "Дом", kind: "house", cursor: "opaque-cursor", limit: "10",
    })).toMatchObject({ targetType: "resource", q: "Дом", kind: "house", limit: 10 });
    expect(OfferingBindingTargetLookupQuerySchema.safeParse({ targetType: "resource", targetId: thirdId }).success).toBe(false);
    expect(OfferingBindingTargetLookupQuerySchema.safeParse({ targetType: "program_template" }).success).toBe(false);

    expect(OfferingBindingTargetLookupResponseSchema.parse({
      items: [{
        type: "resource", id: thirdId, version: 2, code: "R-HOUSE-1", name: "Дом у озера", kind: "house",
        capacity: { mode: "fixed", total: 4 }, archived: false,
      }],
      nextCursor: null,
    }).items[0]).toMatchObject({ type: "resource", capacity: { total: 4 }, archived: false });
    expect(OfferingBindingTargetLookupResponseSchema.safeParse({
      items: [{
        type: "resource", id: thirdId, version: 2, code: "R-HOUSE-1", name: "Дом у озера", kind: "house",
        capacity: { mode: "fixed", total: 4 }, archived: true,
      }],
      nextCursor: null,
    }).success).toBe(false);
    expect(OfferingBindingTargetSummarySchema.parse({
      type: "resource", id: thirdId, version: 3, code: "R-ARCHIVED", name: "Архивный дом", kind: "house",
      capacity: { mode: "fixed", total: 1 }, archived: true,
    }).archived).toBe(true);
    expect(OfferingBindingTargetLookupResponseSchema.safeParse({
      items: [{
        type: "resource", id: thirdId, version: 2, code: "R-HOUSE-1", name: "Дом у озера", kind: "house",
        capacity: { mode: "fixed", total: 4 }, archived: false, settings: { internal: true },
      }],
      nextCursor: null,
    }).success).toBe(false);
  });

  it("makes the resource-to-offering resolver explicit when legacy primary bindings are ambiguous", () => {
    const linked = ResourcePrimaryStayOfferingLookupResponseSchema.parse({
      resolution: "linked",
      offering: { offeringId: id, kind: "house", code: "HOUSE-SOSNA", operationalName: "Дом Сосна", state: "active" },
    });
    expect(linked).toMatchObject({ resolution: "linked", offering: { kind: "house", state: "active" } });
    expect(ResourcePrimaryStayOfferingLookupResponseSchema.parse({ resolution: "none" }).resolution).toBe("none");
    expect(ResourcePrimaryStayOfferingLookupResponseSchema.parse({
      resolution: "ambiguous",
      candidates: [
        { offeringId: id, kind: "house", code: "HOUSE-SOSNA", operationalName: "Дом Сосна", state: "draft" },
        { offeringId: secondId, kind: "campground", code: "CAMP-1", operationalName: "Кемпинг 1", state: "active" },
      ],
    }).resolution).toBe("ambiguous");
    expect(ResourcePrimaryStayOfferingLookupResponseSchema.safeParse({ resolution: "ambiguous", candidates: [] }).success).toBe(false);
    expect(ResourcePrimaryStayOfferingLookupResponseSchema.safeParse({
      resolution: "linked",
      offering: { offeringId: id, kind: "addon", code: "ADDON", operationalName: "Дополнение", state: "active" },
    }).success).toBe(false);
  });

  it("accepts only idempotency metadata for guided Resource stay-offering creation", () => {
    expect(ResourceStayOfferingCreateBodySchema.parse(operation)).toEqual(operation);
    expect(ResourceStayOfferingCreateBodySchema.safeParse({ ...operation, operationalName: "Не принимается с клиента" }).success).toBe(false);
    expect(ResourceStayOfferingCreateResultSchema.parse({
      offeringId: id, kind: "campground", code: "CAMP-1", operationalName: "Кемпинг", state: "draft",
    })).toMatchObject({ kind: "campground", state: "draft" });
  });

  it("keeps assigned add-on catalog summaries display-safe while preserving scope terms and blockers", () => {
    const item = AddOnCatalogItemSchema.parse({
      offering: {
        id: thirdId, version: 2, code: "ADDON-SAUNA", operationalName: "Баня", state: "active", archived: false,
      },
      serviceType: "scheduled_resource", scope: "reusable", ownerOfferingId: null,
      categoryKey: "wellness", standalone: true,
      availability: { status: "available", blocker: null },
    })
    expect(item).toMatchObject({ offering: { code: "ADDON-SAUNA" }, scope: "reusable", availability: { status: "available" } })
    expect(AddOnCatalogItemSchema.safeParse({
      ...item,
      offering: { ...item.offering, internalComment: "must not leak" },
    }).success).toBe(false)
    expect(AddOnCatalogItemSchema.safeParse({
      ...item,
      availability: { status: "available", blocker: "not_active" },
    }).success).toBe(false)
  });

  it("exposes a locator-only editorial summary without operational or public payloads", () => {
    const locator = OfferingEditorialLocatorSchema.parse({
      source: { sourceKind: "catalog_offering", sourceId: id, sourceVersion: 3, createdAt: timestamp },
      node: { id: secondId, version: 2, kind: "resource_detail", status: "active" },
      currentRevision: { id: thirdId, revision: 4, state: "draft", path: "/houses/sosna", title: "Дом Сосна", contentHash: "a".repeat(64) },
      latestPublished: null,
      publication: { eligible: false, blockers: ["public_profile_missing", "safe_public_projection_missing"] },
    });
    expect(locator.source.sourceKind).toBe("catalog_offering");
    expect(OfferingEditorialLocatorSchema.safeParse({
      ...locator,
      publication: { eligible: true, blockers: [] },
    }).success).toBe(true);
    expect(OfferingEditorialLocatorSchema.safeParse({
      ...locator,
      publication: { eligible: true, blockers: ["public_profile_missing"] },
    }).success).toBe(false);
    expect(OfferingEditorialLocatorSchema.safeParse({
      ...locator,
      internalComment: "must not leak",
    }).success).toBe(false);
  });

  it("requires an atomic house resource binding set", () => {
    const binding = {
      target: { type: "resource", id: thirdId }, role: "primary", availabilityRequired: true,
      defaultQuantity: 1, defaultCapacityImpact: 1, preparationBeforeMinutes: 0, preparationAfterMinutes: 0,
    };
    expect(HouseOfferingBindingsReplaceSchema.parse({ ...operation, expectedSubjectVersion: 2, offeringId: id, bindings: [binding] }).bindings).toHaveLength(1);
    expect(HouseOfferingBindingsReplaceBodySchema.parse({ ...operation, expectedSubjectVersion: 2, bindings: [binding] }).bindings).toHaveLength(1);
    expect(HouseOfferingBindingsReplaceBodySchema.safeParse({ ...operation, expectedSubjectVersion: 2, offeringId: id, bindings: [binding] }).success).toBe(false);
    expect(HouseOfferingBindingsReplaceSchema.safeParse({ ...operation, expectedSubjectVersion: 2, offeringId: id, bindings: [{ ...binding, role: "required" }] }).success).toBe(false);
    expect(HouseOfferingBindingsReplaceSchema.safeParse({ ...operation, expectedSubjectVersion: 2, offeringId: id, bindings: [{ ...binding, target: { type: "resource_group", id: thirdId } }] }).success).toBe(false);
  });

  it("lists campground separately and keeps ResourceGroup non-sellable", () => {
    expect(StayOfferingListQuerySchema.parse({ kind: "campground" }).kind).toBe("campground");
    const binding = {
      target: { type: "resource", id: thirdId }, role: "primary", availabilityRequired: true,
      defaultQuantity: 1, defaultCapacityImpact: 1, preparationBeforeMinutes: 0, preparationAfterMinutes: 0,
    };
    expect(CampgroundOfferingBindingsReplaceBodySchema.parse({ ...operation, expectedSubjectVersion: 1, bindings: [binding] }).bindings).toHaveLength(1);
    expect(CampgroundOfferingBindingsReplaceBodySchema.safeParse({
      ...operation, expectedSubjectVersion: 1, bindings: [{ ...binding, target: { type: "resource_group", id: thirdId } }],
    }).success).toBe(false);
  });

  it("accepts typed campground stay preview quantities without widening house units", () => {
    const campground = InternalCampgroundOfferingQuoteBodySchema.parse({
      ...operation, ratePlanKey: null, period: { type: "stay", arrivalDate: "2026-09-10", departureDate: "2026-09-12" },
      quantities: { guests: null, participants: null, units: 3 }, currency: "RUB", addOns: [],
    });
    expect(campground.quantities.units).toBe(3);
    expect(InternalHouseOfferingQuoteBodySchema.safeParse({ ...campground, quantities: { guests: 2, participants: null, units: 3 } }).success).toBe(false);
  });

  it("keeps official calendar holidays distinct from custom price overrides", () => {
    expect(BusinessCalendarDaySchema.parse({
      calendarId: id,
      date: "2027-01-01",
      dayClass: "holiday",
      label: "Новый год",
      source: "official_ru",
      sourceVersion: "2027-v1",
      version: 1,
    }).dayClass).toBe("holiday");

    const baseRule = {
      quantityRange: null,
      bookingLeadDays: null,
      durationMinutes: null,
      amount: 12_000,
      extraUnitAmount: null,
      priority: 100,
      reason: "",
      enabled: true,
    };
    expect(PriceRuleDraftSchema.parse({
      ...baseRule,
      dateSelector: { type: "calendar_holiday" },
    }).dateSelector.type).toBe("calendar_holiday");
    expect(PriceRuleDraftSchema.parse({
      ...baseRule,
      dateSelector: {
        type: "custom_date_override",
        from: "2027-02-14",
        toExclusive: "2027-02-15",
        label: "14 февраля",
      },
    }).dateSelector.type).toBe("custom_date_override");
    expect(PriceRuleDraftSchema.safeParse({
      ...baseRule,
      dateSelector: {
        type: "custom_date_override",
        from: "2027-02-15",
        toExclusive: "2027-02-15",
        label: "Неверный диапазон",
      },
    }).success).toBe(false);
    expect(PriceRuleDraftSchema.safeParse({
      ...baseRule,
      dateSelector: { type: "calendar_holiday", from: "2027-01-01" },
    }).success).toBe(false);
  });

  it("validates full calendar command envelopes before runtime work", () => {
    expect(BusinessCalendarCreateSchema.parse({ ...operation, code: "ru_2027", name: "Россия 2027" }).timezone).toBe("Europe/Moscow");
    const imported = {
      ...operation, expectedCalendarVersion: 1, calendarId: id, sourceVersion: "ru-2027-v1",
      coverage: { from: "2027-01-01", toExclusive: "2027-01-03" },
      days: [{ date: "2027-01-01", dayClass: "holiday", label: "Новый год" }, { date: "2027-01-02", dayClass: "weekend", label: null }],
    };
    expect(BusinessCalendarImportSchema.parse(imported).days).toHaveLength(2);
    expect(BusinessCalendarImportBodySchema.parse({
      ...operation,
      expectedCalendarVersion: imported.expectedCalendarVersion,
      sourceVersion: imported.sourceVersion,
      coverage: imported.coverage,
      days: imported.days,
    }).days).toHaveLength(2);
    expect(BusinessCalendarImportBodySchema.safeParse(imported).success).toBe(false);
    expect(BusinessCalendarImportSchema.safeParse({ ...imported, days: [...imported.days, { ...imported.days[0] }] }).success).toBe(false);
    expect(BusinessCalendarOverrideReplaceSchema.parse({ ...operation, expectedCalendarVersion: 2, calendarId: id, date: "2027-01-02", override: null }).override).toBeNull();
    expect(BusinessCalendarStateTransitionSchema.safeParse({ ...operation, expectedCalendarVersion: 2, calendarId: id, targetState: "draft", reason: "Нет" }).success).toBe(false);
  });

  it("models add-on library replacement and atomic custom add-on creation", () => {
    const assignment = { addOnOfferingId: secondId, enabled: true, required: false, recommended: true, groupKey: null, ratePlanKeyOverride: null, labelOverride: null, descriptionOverride: null, minQuantityOverride: null, maxQuantityOverride: null, defaultQuantityOverride: null, displayOrder: 0 };
    expect(OfferingAddOnAssignmentsReplaceSchema.parse({ ...operation, expectedAddOnsVersion: 1, offeringId: id, assignments: [assignment] }).assignments).toHaveLength(1);
    expect(OfferingAddOnAssignmentsReplaceBodySchema.parse({ ...operation, expectedAddOnsVersion: 1, assignments: [assignment] }).assignments).toHaveLength(1);
    expect(OfferingAddOnAssignmentsReplaceSchema.safeParse({ ...operation, expectedAddOnsVersion: 1, offeringId: id, assignments: [assignment, assignment] }).success).toBe(false);
    expect(OfferingCustomAddOnCreateSchema.parse({
      ...operation, expectedAddOnsVersion: 1, offeringId: id,
      addOn: { operationalName: "Чан", serviceType: "scheduled_resource", categoryKey: "hot_tub" },
      assignment: {},
    }).assignment.enabled).toBe(false);
    expect(OfferingCustomAddOnCreateBodySchema.parse({
      ...operation, expectedAddOnsVersion: 1,
      addOn: { operationalName: "Чан", serviceType: "scheduled_resource", categoryKey: "hot_tub" },
      assignment: {},
    }).assignment.enabled).toBe(false);
    expect(AddOnLibraryResponseSchema.parse({ items: [], nextCursor: null }).items).toEqual([]);
  });

  it("keeps configuration events typed without leaking pricing fields", () => {
    expect(OfferingConfigurationOutboxEventSchema.parse({
      eventId: id, eventType: "crm.business_calendar.imported", occurredAt: timestamp, actorId: null,
      requestId: "request-1", operationId: id, entrySurface: "internal",
      aggregate: { type: "business_calendar", id }, versions: { calendar: 2, subject: null, addOns: null }, configurationHash: "a".repeat(64),
    }).aggregate.type).toBe("business_calendar");
    expect(OfferingConfigurationOutboxEventSchema.parse({
      eventId: id, eventType: "crm.offering.addon_terms_replaced", occurredAt: timestamp, actorId: null,
      requestId: "request-2", operationId: id, entrySurface: "admin",
      aggregate: { type: "catalog_offering", id }, versions: { calendar: null, subject: 2, addOns: null }, configurationHash: "b".repeat(64),
    }).eventType).toBe("crm.offering.addon_terms_replaced");
  });

  it("makes early-booking lead-day selection optional and explicit", () => {
    const rule = {
      dateSelector: { type: "any_date" },
      quantityRange: null,
      durationMinutes: null,
      amount: 9_000,
      extraUnitAmount: null,
      priority: 200,
      reason: "Раннее бронирование",
      enabled: true,
    };
    expect(PriceRuleDraftSchema.safeParse({ ...rule, bookingLeadDays: null }).success).toBe(false);
    expect(PriceRuleDraftSchema.parse({
      ...rule,
      bookingLeadDays: { min: 30, max: null },
    }).bookingLeadDays).toEqual({ min: 30, max: null });
  });

  it("models a reusable add-on as an addon offering plus an assignment", () => {
    expect(CatalogOfferingCreateSchema.parse(offeringCreate({
      kind: "addon",
      serviceType: "person_service",
      standalone: false,
      scope: "reusable",
      ownerOfferingId: null,
    })).kind).toBe("addon");

    const assignment = {
      ...operation,
      expectedAddOnsVersion: 2,
      offeringId: secondId,
      addOnOfferingId: thirdId,
      ratePlanKeyOverride: "child_catering",
      labelOverride: "Детское меню",
    };
    expect(OfferingAddOnAssignmentCreateSchema.parse(assignment)).toMatchObject({
      enabled: true,
      required: false,
      recommended: false,
      groupKey: null,
      descriptionOverride: null,
      defaultQuantityOverride: null,
    });
    expect(OfferingAddOnAssignmentCreateSchema.safeParse({
      ...assignment,
      addOnOfferingId: secondId,
    }).success).toBe(false);
    expect(AddOnLibraryQuerySchema.parse({ q: "кейтеринг" })).toMatchObject({ limit: 25 });
  });

  it("keeps first-slice add-on terms discriminated and separately versioned", () => {
    const terms = AddOnServiceTermsSchema.parse({
      serviceType: "person_service",
      categoryKey: "catering",
      applicableOfferingKinds: ["house", "campground", "venue"],
      quantity: { metric: "participants", min: 1, max: 50, default: 2, step: 1 },
    });
    expect(terms.quantity?.metric).toBe("participants");
    expect(AddOnServiceTermsSchema.safeParse({
      ...terms,
      quantity: { ...terms.quantity, metric: "units" },
    }).success).toBe(false);
    expect(AddOnServiceTermsSchema.safeParse({
      serviceType: "quantity_service",
      categoryKey: "equipment",
      applicableOfferingKinds: ["house"],
      quantity: { metric: "units", min: 1, max: 5, default: 2, step: 3 },
    }).success).toBe(false);
    expect(AddOnServiceTermsSchema.parse({
      serviceType: "scheduled_resource",
      categoryKey: "spa",
      applicableOfferingKinds: ["house"],
      quantity: null,
    }).serviceType).toBe("scheduled_resource");
    expect(AddOnTermsMutationBodySchema.parse({
      ...operation,
      expectedSubjectVersion: 3,
      standalone: true,
      terms,
    }).expectedSubjectVersion).toBe(3);
    expect(AddOnOfferingListQuerySchema.parse({ kind: "addon", standalone: "true", categoryKey: "catering" })).toMatchObject({ standalone: true, limit: 25 });
    expect(AddOnOfferingListQuerySchema.parse({ kind: "addon", standalone: "false" }).standalone).toBe(false);
  });

  it("creates an add-on with one operational identity and canonical typed terms", () => {
    const created = AddOnOfferingCreateBodySchema.parse({
      ...operation,
      operationalName: "Завтрак в корзине",
      businessCalendarId: secondId,
      standalone: true,
      terms: {
        serviceType: "quantity_service",
        categoryKey: "catering",
        applicableOfferingKinds: ["house"],
        quantity: { metric: "units", min: 1, max: 10, default: 1, step: 1 },
      },
    });
    expect(created).toMatchObject({ scope: "reusable", ownerOfferingId: null, standalone: true });
    expect(AddOnOfferingCreateBodySchema.safeParse({ ...created, scope: "offering_specific", ownerOfferingId: null }).success).toBe(false);
    expect(OfferingEditorialLocatorSchema.parse({
      source: { sourceKind: "catalog_offering", sourceId: id, sourceVersion: 1, createdAt: timestamp },
      node: { id: secondId, version: 1, kind: "addon_detail", status: "active" },
      currentRevision: null,
      latestPublished: null,
      publication: { eligible: false, blockers: ["public_profile_missing", "safe_public_projection_missing"] },
    }).node.kind).toBe("addon_detail");
  });

  it("applies compare-and-swap only to the mutated owner segment", () => {
    const operational = {
      ...operation,
      expectedCatalogVersion: 3,
      operationalName: "Новое имя",
    };
    expect(CatalogOfferingOperationalMutationSchema.parse(operational).expectedCatalogVersion).toBe(3);
    expect(CatalogOfferingOperationalMutationSchema.safeParse({
      ...operational,
      expectedPricingVersion: 7,
    }).success).toBe(false);

    const pricing = {
      ...operation,
      expectedPricingVersion: 7,
      priceBookId: thirdId,
      name: "Сезон 2027",
    };
    expect(PriceBookDraftMutationSchema.parse(pricing).expectedPricingVersion).toBe(7);
    expect(PriceBookDraftMutationSchema.safeParse({
      ...pricing,
      expectedCatalogVersion: 3,
    }).success).toBe(false);
  });

  it("defines path-owned house pricing commands without duplicated aggregate IDs", () => {
    const draft = {
      ...operation,
      expectedPricingVersion: 2,
      name: "Домики 2027",
      validFrom: "2027-01-01",
      validToExclusive: null,
      changeReason: "Новый сезон",
      ratePlans: [],
    };
    expect(HouseOfferingListQuerySchema.parse({})).toMatchObject({ kind: "house", limit: 25 });
    expect(HousePriceBookDraftCreateBodySchema.parse(draft).supersedesPriceBookId).toBeNull();
    expect(HousePriceBookDraftReplaceBodySchema.parse(draft).name).toBe("Домики 2027");
    expect(HousePriceBookDraftCreateBodySchema.safeParse({ ...draft, offeringId: secondId }).success).toBe(false);
    expect(HousePriceBookDraftReplaceBodySchema.safeParse({ ...draft, priceBookId: thirdId }).success).toBe(false);
    expect(HousePriceBookActivateBodySchema.parse({ ...operation, expectedPricingVersion: 3, reason: "Проверено" }).reason).toBe("Проверено");
    expect(HousePriceBookScheduleBodySchema.parse({
      ...operation,
      expectedPricingVersion: 3,
      reason: "Смена сезона",
      scheduledActivationAt: "2027-01-01T00:00:00+03:00",
    }).scheduledActivationAt).toContain("2027-01-01");
  });

  it("locks typed pricing events shared by CRM, CMS and scheduler entry surfaces", () => {
    expect(OfferingPricingOutboxEventSchema.parse({
      eventId: id,
      eventType: "crm.price_book.activated",
      occurredAt: timestamp,
      actorId: secondId,
      requestId: "request-1",
      operationId: thirdId,
      entrySurface: "admin",
      offeringId: id,
      pricingVersion: 3,
      priceBookId: secondId,
      priceBookVersion: 2,
    }).entrySurface).toBe("admin");
  });

  it("does not accept a client-controlled booking instant in quote calculation", () => {
    const request = {
      ...operation,
      offeringId: secondId,
      ratePlanKey: "standard",
      period: { type: "stay", arrivalDate: "2027-01-01", departureDate: "2027-01-03" },
      quantities: { guests: 2, participants: null, units: 1 },
      currency: "RUB",
      addOns: [],
    };
    expect(InternalOfferingQuoteRequestSchema.parse(request).period.type).toBe("stay");
    expect(InternalOfferingQuoteRequestSchema.safeParse({
      ...request,
      bookingInstant: timestamp,
    }).success).toBe(false);
    expect(InternalOfferingQuoteRequestSchema.safeParse({
      ...request,
      period: { type: "stay", arrivalDate: "2027-01-03", departureDate: "2027-01-01" },
    }).success).toBe(false);
    const body = { ...request };
    delete (body as Partial<typeof body>).offeringId;
    expect(InternalHouseOfferingQuoteBodySchema.parse(body).quantities.units).toBe(1);
    expect(InternalHouseOfferingQuoteBodySchema.safeParse({ ...body, offeringId: secondId }).success).toBe(false);
    expect(InternalHouseOfferingQuoteBodySchema.safeParse({ ...body, quantities: { ...body.quantities, units: 2 } }).success).toBe(false);
  });

  it("keeps public summary and quote free of internal pricing provenance", () => {
    expect(PublicOfferingSummarySchema.parse({
      offeringId: id,
      kind: "house",
      title: "Домик у леса",
      summary: "Тихий домик на двоих",
      price: { mode: "from", amount: { amountMinor: 12_000, currency: "RUB" } },
      priceBasisLabel: "за ночь",
      quoteAvailable: true,
      requestAvailable: true,
      capacity: { unit: "guests", available: 4 },
      readiness: "ready",
      timezone: "Europe/Moscow",
      currency: "RUB",
      sourceVersions: {
        offering: 1,
        pricing: 2,
        priceBook: 3,
        calendar: 4,
        contentReleaseId: secondId,
        profileRevisionId: thirdId,
      },
      asOf: timestamp,
    }).price.mode).toBe("from");

    const publicQuote = {
      status: "quoted",
      quoteId: id,
      calculatedAt: timestamp,
      validUntil: "2026-08-31T12:15:00+03:00",
      currency: "RUB",
      lines: [{
        kind: "night",
        label: "Ночь 1 января",
        serviceDate: "2027-01-01",
        quantity: 1,
        amount: { amountMinor: 12_000, currency: "RUB" },
        explanationCode: "calendar_holiday",
      }],
      total: { amountMinor: 12_000, currency: "RUB" },
      asOf: timestamp,
    };
    expect(PublicOfferingQuoteSchema.parse(publicQuote).status).toBe("quoted");
    expect(PublicOfferingQuoteSchema.safeParse({
      ...publicQuote,
      provenance: { priceBookId: secondId, matchedRuleIds: [thirdId] },
    }).success).toBe(false);
  });

  it("accepts only a compact, strict resource quote preview command", () => {
    const body = {
      operationId: id,
      idempotencyKey: "resource-quote-preview-0001",
      arrivalDate: "2027-01-01",
      departureDate: "2027-01-03",
      quantity: 2,
      currency: "RUB",
    };
    expect(ResourceStayOfferingQuotePreviewBodySchema.parse(body).quantity).toBe(2);
    expect(ResourceStayOfferingQuotePreviewBodySchema.safeParse({ ...body, ratePlanKey: "standard" }).success).toBe(false);
    expect(ResourceStayOfferingQuotePreviewBodySchema.safeParse({ ...body, quantity: 0 }).success).toBe(false);
    expect(ResourceStayOfferingQuotePreviewBodySchema.safeParse({ ...body, departureDate: body.arrivalDate }).success).toBe(false);
  });

  it("exposes only release-pinned allowlisted add-on summaries", () => {
    const summary = PublicAddOnSummarySchema.parse({
      offeringId: id,
      kind: "addon",
      title: "Баня",
      summary: "Три часа отдыха",
      price: { mode: "request" },
      priceBasisLabel: null,
      quoteAvailable: false,
      requestAvailable: true,
      capacity: null,
      readiness: "request_only",
      timezone: "Europe/Moscow",
      currency: "RUB",
      sourceVersions: { offering: 1, pricing: null, priceBook: null, calendar: 2, contentReleaseId: secondId, profileRevisionId: thirdId },
      asOf: timestamp,
      terms: { serviceType: "quantity_service", standalone: true, categoryKey: "wellness", quantity: { unit: "unit", minimum: 1, maximum: 10, default: 1, step: 1 } },
    });
    expect(summary.terms.quantity.unit).toBe("unit");
    expect(PublicAddOnSummarySchema.safeParse({ ...summary, internalComment: "must not leak" }).success).toBe(false);
    expect(PublicAddOnSummarySchema.safeParse({ ...summary, terms: { ...summary.terms, rawRule: "must not leak" } }).success).toBe(false);
    expect(PublicAddOnSummaryParamsSchema.parse({ offeringId: id }).offeringId).toBe(id);
    expect(PublicAddOnSummaryParamsSchema.safeParse({ offeringId: id, internalComment: "must not leak" }).success).toBe(false);

    expect(PublicAddOnListQuerySchema.parse({ categoryKey: "wellness", standalone: "true", cursor: "cursor", limit: "10" })).toMatchObject({ categoryKey: "wellness", standalone: true, limit: 10 });
    expect(PublicAddOnListQuerySchema.safeParse({ state: "active" }).success).toBe(false);
    expect(PublicAddOnListResponseSchema.parse({ items: [summary], nextCursor: null, releaseId: secondId, asOf: timestamp }).items).toHaveLength(1);
    expect(PublicAddOnProjectionPinSchema.parse({ contract: "public.addon-summary.v1", offeringId: id, kind: "addon", nodeId: secondId, profileRevisionId: thirdId }).contract).toBe("public.addon-summary.v1");
    expect(PublicAddOnProjectionPinSchema.safeParse({ contract: "public.addon-summary.v1", offeringId: id, kind: "addon", nodeId: secondId, profileRevisionId: thirdId, hash: "a".repeat(64) }).success).toBe(false);
  });
});
