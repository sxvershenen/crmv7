import { UnprocessableEntityException } from "@nestjs/common"

import { AddOnCatalogItemSchema, InternalOfferingQuoteResultSchema, type AddOnServiceTerms, type CatalogOffering, type InternalOfferingQuoteResult } from "@crm/contracts"
import { AddonOfferingTermsEntity, CampgroundOfferingTermsEntity, CatalogOfferingEntity, OfferingAddonAssignmentEntity, OfferingBindingEntity, ResourceEntity } from "@crm/db"
import { resolveHousePerNightQuote } from "@crm/domain"

export type AddOnTermsRow = {
  offeringId: string; offeringKind: string; serviceType: string; standalone: boolean; categoryKey: string
  applicableOfferingKinds: string[]; minimumQuantity: number | null; maximumQuantity: number | null
  defaultQuantity: number | null; quantityStep: number | null; createdAt: Date; createdBy: string | null
}

function unprocessable(code: string, message: string, details?: Record<string, unknown>): never { throw new UnprocessableEntityException({ code, message, ...(details ? { details } : {}) }) }

export function quoteDto(calculation: ReturnType<typeof resolveHousePerNightQuote>, addOnsVersion: number): InternalOfferingQuoteResult {
    const lines = calculation.lines.map((line) => ({
      kind: "night" as const,
      label: `Ночь ${line.serviceDate}`,
      serviceDate: line.serviceDate,
      quantity: calculation.input.units,
      amount: { amountMinor: line.totalAmountMinor, currency: calculation.currency },
      ratePlanId: line.ratePlan.id,
      ratePlanVersion: line.ratePlan.version,
      matchedRuleId: line.matchedRule?.id ?? null,
      matchedRuleVersion: line.matchedRule?.version ?? null,
      addOnAssignmentId: null,
      explanation: line.matchedRule?.selector.type ?? "base",
    }))
    return InternalOfferingQuoteResultSchema.parse({
      quoteId: calculation.quoteId, offeringId: calculation.offeringId,
      calculatedAt: calculation.calculatedAt, validUntil: calculation.validUntil,
      leadDays: calculation.leadDays, currency: calculation.currency, lines,
      total: { amountMinor: calculation.totalAmountMinor, currency: calculation.currency },
      provenance: {
        offeringVersion: calculation.offeringVersion, pricingVersion: calculation.pricingVersion,
        addOnsVersion,
        priceBookId: calculation.priceBookId, priceBookVersion: calculation.priceBookVersion,
        businessCalendarId: calculation.calendarId, businessCalendarVersion: calculation.calendarVersion,
        businessCalendarSourceVersion: calculation.calendarSourceVersion,
        matchedRuleIds: [...new Set(calculation.lines.flatMap((line) => line.matchedRule ? [line.matchedRule.id] : []))],
      },
      immutableSnapshot: true,
    })
  }

export function offeringDto(row: CatalogOfferingEntity, campgroundTerms?: CampgroundOfferingTermsEntity, addOnTerms?: AddonOfferingTermsEntity): CatalogOffering {
    const fulfillment: CatalogOffering["fulfillment"] = row.kind === "addon"
      ? { kind: "addon", serviceType: addOnTerms?.serviceType as AddOnServiceTerms["serviceType"], standalone: addOnTerms?.standalone ?? false, scope: row.scope as "reusable" | "offering_specific", ownerOfferingId: row.ownerOfferingId }
      : row.kind === "campground"
      ? {
        kind: "campground",
        salesUnit: campgroundTerms?.sellableUnit as "owned_tent" | "own_tent_pitch",
        allocationMode: campgroundTerms?.inventoryMode as "discrete_inventory" | "shared_capacity",
        capacityUnit: "tent",
        stayPricing: "sum_each_local_night",
      }
      : row.kind === "venue"
        ? { kind: "venue", allocationMode: "exclusive_resource", capacityUnit: "guests", pricingMode: "rate_plan" }
      : row.kind === "program"
        ? { kind: "program" }
        : row.kind === "event_service"
          ? { kind: "event_service" }
        : { kind: "house", stayPricing: "sum_each_local_night" }
    return {
      id: row.id, code: row.code, version: row.version, kind: row.kind as CatalogOffering["kind"],
      operationalName: row.operationalName, internalComment: row.internalComment,
      state: row.state as CatalogOffering["state"], salesMode: row.salesMode as CatalogOffering["salesMode"],
      priceDisplayMode: row.priceDisplayMode as CatalogOffering["priceDisplayMode"],
      currency: row.currency, timezone: row.timezone, taxMode: row.taxMode as CatalogOffering["taxMode"],
      businessCalendarId: row.businessCalendarId, fulfillment,
      activePriceBookId: row.activePriceBookId, archivedAt: row.archivedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
    }
  }

export function addOnTermsDto(terms: AddonOfferingTermsEntity): AddOnServiceTerms {
    const row = terms as unknown as AddOnTermsRow
    const quantity = terms.serviceType === "quantity_service"
      ? { metric: "units" as const, min: row.minimumQuantity, max: row.maximumQuantity, default: row.defaultQuantity, step: row.quantityStep }
      : terms.serviceType === "person_service"
        ? { metric: "participants" as const, min: row.minimumQuantity, max: row.maximumQuantity, default: row.defaultQuantity, step: row.quantityStep }
        : null
    return { serviceType: terms.serviceType as AddOnServiceTerms["serviceType"], categoryKey: terms.categoryKey, applicableOfferingKinds: row.applicableOfferingKinds, quantity } as AddOnServiceTerms
  }

export function addOnTermsEntity(offeringId: string, terms: AddOnServiceTerms, standalone: boolean, actorId: string): AddOnTermsRow {
    return {
      offeringId, offeringKind: "addon", serviceType: terms.serviceType, standalone, categoryKey: terms.categoryKey,
      applicableOfferingKinds: terms.applicableOfferingKinds, minimumQuantity: terms.quantity?.min ?? null, maximumQuantity: terms.quantity?.max ?? null,
      defaultQuantity: terms.quantity?.default ?? null, quantityStep: terms.quantity?.step ?? null, createdAt: new Date(), createdBy: actorId,
    }
  }

export function bindingDto(row: OfferingBindingEntity) {
    const target = row.resourceId ? { type: "resource" as const, id: row.resourceId }
      : row.resourceGroupId ? { type: "resource_group" as const, id: row.resourceGroupId }
        : row.programTemplateId ? { type: "program_template" as const, id: row.programTemplateId }
          : { type: "event_service_template" as const, id: row.eventServiceTemplateId! }
    return {
      id: row.id, offeringId: row.offeringId, version: row.version, target,
      role: row.role as "primary" | "required" | "optional" | "shared_area" | "inventory_unit",
      availabilityRequired: row.availabilityRequired, defaultQuantity: row.quantityDefault,
      defaultCapacityImpact: row.capacityImpactDefault,
      preparationBeforeMinutes: row.preparationBeforeMinutes, preparationAfterMinutes: row.preparationAfterMinutes,
    }
  }

export function resourceBindingTargetDto(resource: ResourceEntity) {
    return {
      type: "resource" as const,
      id: resource.id,
      version: resource.version,
      code: resource.code,
      name: resource.name,
      kind: resource.kind,
      capacity: { mode: resource.capacityMode, total: resource.capacityTotal },
      archived: resource.archivedAt !== null,
    }
  }

export function addOnCatalogItem(addOn: CatalogOfferingEntity, terms: AddonOfferingTermsEntity) {
    const archived = addOn.archivedAt !== null || addOn.state === "archived"
    const blocker = archived ? "archived" as const
      : addOn.state !== "active" ? "not_active" as const
        : addOn.salesMode !== "request_only" && addOn.activePriceBookId === null ? "active_price_book_missing" as const
          : null
    const item = {
      offering: {
        id: addOn.id,
        version: addOn.version,
        code: addOn.code,
        operationalName: addOn.operationalName,
        state: addOn.state,
        salesMode: addOn.salesMode,
        archived,
      },
      serviceType: terms.serviceType,
      scope: addOn.scope,
      ownerOfferingId: addOn.ownerOfferingId,
      categoryKey: terms.categoryKey,
      standalone: terms.standalone,
      availability: { status: blocker === null ? "available" as const : "blocked" as const, blocker },
    }
    const parsed = AddOnCatalogItemSchema.safeParse(item)
    if (!parsed.success) throw unprocessable("ADDON_CATALOG_TARGET_INVALID", "Назначенное дополнение имеет некорректные данные", { addOnOfferingId: addOn.id })
    return parsed.data
  }

export function assignmentDto(row: OfferingAddonAssignmentEntity) {
    return {
      id: row.id, offeringId: row.offeringId, version: row.version,
      addOnOfferingId: row.addonOfferingId, enabled: row.enabled, required: row.required,
      recommended: row.recommended, groupKey: row.groupKey,
      ratePlanKeyOverride: row.ratePlanKeyOverride, labelOverride: row.labelOverride,
      descriptionOverride: row.descriptionOverride, minQuantityOverride: row.minimumQuantity,
      maxQuantityOverride: row.maximumQuantity, defaultQuantityOverride: row.defaultQuantity,
      displayOrder: row.displayOrder,
    }
  }

export function resourcePrimaryOfferingSummary(offering: CatalogOfferingEntity, forcedKind?: "house" | "campground" | "venue") {
    return {
      offeringId: offering.id,
      kind: (forcedKind ?? offering.kind) as "house" | "campground" | "venue",
      code: offering.code,
      operationalName: offering.operationalName,
      state: offering.state as "draft" | "active" | "paused" | "archived",
    }
  }
