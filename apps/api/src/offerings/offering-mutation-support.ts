import { createHash } from "node:crypto"

import type { OfferingEditorCapabilities, SessionUser } from "@crm/contracts"

/**
 * Stable JSON is deliberately independent from transport entry point and object
 * insertion order. It is used only for operation fingerprints, never as a DTO.
 */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`
  const record = value as Record<string, unknown>
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`
}

export function canonicalSha256(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex")
}

/**
 * P4.5B exposes granular editor capabilities while the current role model is
 * still coarse. Derivation stays server-side and is shared by both entry points.
 */
export function deriveOfferingEditorCapabilities(actor: SessionUser): OfferingEditorCapabilities {
  const capability = actor.capabilities
  return {
    catalog: {
      canEdit: capability.canEdit,
      canChangeState: capability.canChangeStatus,
      canArchive: capability.canArchive,
    },
    subject: {
      canEdit: capability.canEdit,
      canManageBindings: capability.canEdit && capability.canAssign,
    },
    pricing: {
      canView: capability.canView,
      canEditDraft: capability.canEdit,
      canActivate: capability.canChangeStatus,
    },
    addOns: {
      canSearch: capability.canView,
      canCreate: capability.canCreate,
      canAssign: capability.canEdit && capability.canAssign,
    },
    editorial: {
      canEdit: capability.canEditContent === true,
      canReview: capability.canReviewContent === true,
      canPublish: capability.canPublishContent === true,
    },
    canPreviewQuote: capability.canView,
  }
}
