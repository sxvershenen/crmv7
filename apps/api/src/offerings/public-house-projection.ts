import { createHash } from "node:crypto"

import { PublicHouseProjectionPinSchema, ReleaseDependencyRefSchema, type PublicHouseProjectionPin, type ReleaseDependencyRef } from "@crm/contracts"

export const PUBLIC_HOUSE_PROJECTION_CONTRACT = "public.house-summary.v1" as const

export function createPublicHouseProjectionDependency(input: Omit<PublicHouseProjectionPin, "contract" | "kind">): ReleaseDependencyRef {
  const pin = PublicHouseProjectionPinSchema.parse({ contract: PUBLIC_HOUSE_PROJECTION_CONTRACT, kind: "house", ...input })
  return ReleaseDependencyRefSchema.parse({ type: "crm_projection", id: pin.offeringId, version: pin.contract, contentHash: publicHouseProjectionPinHash(pin) })
}

export function publicHouseProjectionPinHash(pin: PublicHouseProjectionPin): string {
  return createHash("sha256").update(stableStringify(PublicHouseProjectionPinSchema.parse(pin))).digest("hex")
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`
  if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(",")}}`
  return JSON.stringify(value)
}
