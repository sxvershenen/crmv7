import { createHash } from "node:crypto"

import { PublicVenueProjectionPinSchema, ReleaseDependencyRefSchema, type PublicVenueProjectionPin, type ReleaseDependencyRef } from "@crm/contracts"

export const PUBLIC_VENUE_PROJECTION_CONTRACT = "public.venue-summary.v1" as const

export function createPublicVenueProjectionDependency(input: Omit<PublicVenueProjectionPin, "contract" | "kind">): ReleaseDependencyRef {
  const pin = PublicVenueProjectionPinSchema.parse({ contract: PUBLIC_VENUE_PROJECTION_CONTRACT, kind: "venue", ...input })
  return ReleaseDependencyRefSchema.parse({ type: "crm_projection", id: pin.offeringId, version: pin.contract, contentHash: publicVenueProjectionPinHash(pin) })
}

export function publicVenueProjectionPinHash(pin: PublicVenueProjectionPin): string {
  return createHash("sha256").update(stableStringify(PublicVenueProjectionPinSchema.parse(pin))).digest("hex")
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`
  if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(",")}}`
  return JSON.stringify(value)
}
