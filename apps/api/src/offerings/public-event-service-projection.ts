import { createHash } from "node:crypto"

import { PublicEventServiceProjectionPinSchema, ReleaseDependencyRefSchema, type PublicEventServiceProjectionPin, type ReleaseDependencyRef } from "@crm/contracts"

export const PUBLIC_EVENT_SERVICE_PROJECTION_CONTRACT = "public.event-service-summary.v1" as const

export function createPublicEventServiceProjectionDependency(input: Omit<PublicEventServiceProjectionPin, "contract" | "kind">): ReleaseDependencyRef {
  const pin = PublicEventServiceProjectionPinSchema.parse({ contract: PUBLIC_EVENT_SERVICE_PROJECTION_CONTRACT, kind: "event_service", ...input })
  return ReleaseDependencyRefSchema.parse({ type: "crm_projection", id: pin.offeringId, version: pin.contract, contentHash: publicEventServiceProjectionPinHash(pin) })
}

export function publicEventServiceProjectionPinHash(pin: PublicEventServiceProjectionPin): string {
  return createHash("sha256").update(stableStringify(PublicEventServiceProjectionPinSchema.parse(pin))).digest("hex")
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`
  if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(",")}}`
  return JSON.stringify(value)
}
