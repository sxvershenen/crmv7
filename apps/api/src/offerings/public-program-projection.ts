import { createHash } from "node:crypto"

import { PublicProgramProjectionPinSchema, ReleaseDependencyRefSchema, type PublicProgramProjectionPin, type ReleaseDependencyRef } from "@crm/contracts"

export const PUBLIC_PROGRAM_PROJECTION_CONTRACT = "public.program-summary.v1" as const

export function createPublicProgramProjectionDependency(input: Omit<PublicProgramProjectionPin, "contract" | "kind">): ReleaseDependencyRef {
  const pin = PublicProgramProjectionPinSchema.parse({ contract: PUBLIC_PROGRAM_PROJECTION_CONTRACT, kind: "program", ...input })
  return ReleaseDependencyRefSchema.parse({ type: "crm_projection", id: pin.offeringId, version: pin.contract, contentHash: publicProgramProjectionPinHash(pin) })
}

export function publicProgramProjectionPinHash(pin: PublicProgramProjectionPin): string {
  return createHash("sha256").update(stableStringify(PublicProgramProjectionPinSchema.parse(pin))).digest("hex")
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`
  if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(",")}}`
  return JSON.stringify(value)
}
