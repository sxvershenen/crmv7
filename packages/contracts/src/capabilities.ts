import { z } from "zod";
import { adminCapabilityNames } from "./admin-capabilities.js";

export const CapabilityNameSchema = z.enum([
  "canView", "canCreate", "canEdit", "canDelete", "canArchive", "canAssign",
  "canChangeStatus", "canAddPayment", "canRefund", "canOverrideConflict",
  "canViewFinance", "canViewAudit", "canManageUsers", "canManageSettings",
  ...adminCapabilityNames,
]);
export type CapabilityName = z.infer<typeof CapabilityNameSchema>;

export const CapabilitiesSchema = z.object({
  canView: z.boolean(), canCreate: z.boolean(), canEdit: z.boolean(), canDelete: z.boolean(),
  canArchive: z.boolean(), canAssign: z.boolean(), canChangeStatus: z.boolean(),
  canAddPayment: z.boolean(), canRefund: z.boolean(), canOverrideConflict: z.boolean(),
  canViewFinance: z.boolean(), canViewAudit: z.boolean(), canManageUsers: z.boolean(),
  canManageSettings: z.boolean(),
  canViewContent: z.boolean().optional(), canEditContent: z.boolean().optional(),
  canReviewContent: z.boolean().optional(), canPublishContent: z.boolean().optional(),
  canManageSeo: z.boolean().optional(), canManageMedia: z.boolean().optional(),
  canViewAnalytics: z.boolean().optional(), canViewRawAnalytics: z.boolean().optional(),
  canManageSiteCode: z.boolean().optional(), canManageIntegrations: z.boolean().optional(),
  canManageRedirects: z.boolean().optional(), canManageSiteSettings: z.boolean().optional(),
}).strict();
export type Capabilities = z.infer<typeof CapabilitiesSchema>;

export const CapabilityEnvelopeSchema = z.object({
  subjectId: z.string().uuid(),
  resourceType: z.string().min(1).max(64),
  capabilities: CapabilitiesSchema,
}).strict();
export type CapabilityEnvelope = z.infer<typeof CapabilityEnvelopeSchema>;
