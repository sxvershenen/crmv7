import { createHash } from "node:crypto"

import {
  PublicAddOnProjectionPinSchema,
  ReleaseDependencyRefSchema,
  type PublicAddOnProjectionPin,
  type ReleaseDependencyRef,
} from "@crm/contracts"

export const PUBLIC_ADDON_PROJECTION_CONTRACT = "public.addon-summary.v1" as const

export function createPublicAddOnProjectionDependency(input: Omit<PublicAddOnProjectionPin, "contract" | "kind">): ReleaseDependencyRef {
  const pin = PublicAddOnProjectionPinSchema.parse({
    contract: PUBLIC_ADDON_PROJECTION_CONTRACT,
    kind: "addon",
    ...input,
  })
  return ReleaseDependencyRefSchema.parse({
    type: "crm_projection",
    id: pin.offeringId,
    version: pin.contract,
    contentHash: publicAddOnProjectionPinHash(pin),
  })
}

export function publicAddOnProjectionPinHash(pin: PublicAddOnProjectionPin): string {
  return createHash("sha256").update(stableStringify(PublicAddOnProjectionPinSchema.parse(pin))).digest("hex")
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(",")}}`
  }
  return JSON.stringify(value)
}
