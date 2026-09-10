import { createHash } from "node:crypto"

import { PublicCampgroundProjectionPinSchema, ReleaseDependencyRefSchema, type PublicCampgroundProjectionPin, type ReleaseDependencyRef } from "@crm/contracts"

export const PUBLIC_CAMPGROUND_PROJECTION_CONTRACT = "public.campground-summary.v1" as const

export function createPublicCampgroundProjectionDependency(input: Omit<PublicCampgroundProjectionPin, "contract" | "kind">): ReleaseDependencyRef {
  const pin = PublicCampgroundProjectionPinSchema.parse({ contract: PUBLIC_CAMPGROUND_PROJECTION_CONTRACT, kind: "campground", ...input })
  return ReleaseDependencyRefSchema.parse({ type: "crm_projection", id: pin.offeringId, version: pin.contract, contentHash: publicCampgroundProjectionPinHash(pin) })
}

export function publicCampgroundProjectionPinHash(pin: PublicCampgroundProjectionPin): string {
  return createHash("sha256").update(stableStringify(PublicCampgroundProjectionPinSchema.parse(pin))).digest("hex")
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`
  if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(",")}}`
  return JSON.stringify(value)
}
