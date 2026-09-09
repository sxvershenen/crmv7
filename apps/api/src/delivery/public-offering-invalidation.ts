import {
  OfferingConfigurationOutboxEventSchema,
  OfferingPricingOutboxEventSchema,
} from "@crm/contracts"

export type PublicOfferingInvalidation = Readonly<{
  eventId: string
  offeringId: string
  occurredAt: string
  pricingVersion: number | null
  subjectVersion: number | null
  addOnsVersion: number | null
  calendarVersion: number | null
  configurationHash: string | null
}>

/**
 * Outbox payload is a signal only. This boundary accepts the two existing
 * producer shapes but never turns commercial payload fields into projection
 * data. Callers must also verify the envelope id/topic/aggregate separately.
 */
export function normalizePublicOfferingInvalidation(payload: unknown): PublicOfferingInvalidation | null {
  const pricing = OfferingPricingOutboxEventSchema.safeParse(payload)
  if (pricing.success && pricing.data.eventType === "public.offering_projection.invalidated") {
    return {
      eventId: pricing.data.eventId,
      offeringId: pricing.data.offeringId,
      occurredAt: pricing.data.occurredAt,
      pricingVersion: pricing.data.pricingVersion,
      subjectVersion: null,
      addOnsVersion: null,
      calendarVersion: null,
      configurationHash: null,
    }
  }
  const configuration = OfferingConfigurationOutboxEventSchema.safeParse(payload)
  if (!configuration.success || configuration.data.eventType !== "public.offering_projection.invalidated" || configuration.data.aggregate.type !== "catalog_offering") return null
  return {
    eventId: configuration.data.eventId,
    offeringId: configuration.data.aggregate.id,
    occurredAt: configuration.data.occurredAt,
    pricingVersion: null,
    subjectVersion: configuration.data.versions.subject,
    addOnsVersion: configuration.data.versions.addOns,
    calendarVersion: configuration.data.versions.calendar,
    configurationHash: configuration.data.configurationHash,
  }
}
