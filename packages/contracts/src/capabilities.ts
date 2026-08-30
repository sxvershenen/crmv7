import { z } from "zod";

export const CapabilityNameSchema = z.enum([
  "canView", "canCreate", "canEdit", "canDelete", "canArchive", "canAssign",
  "canChangeStatus", "canAddPayment", "canRefund", "canOverrideConflict",
  "canViewFinance", "canViewAudit", "canManageUsers", "canManageSettings",
]);
export type CapabilityName = z.infer<typeof CapabilityNameSchema>;

export const CapabilitiesSchema = z.object({
  canView: z.boolean(), canCreate: z.boolean(), canEdit: z.boolean(), canDelete: z.boolean(),
  canArchive: z.boolean(), canAssign: z.boolean(), canChangeStatus: z.boolean(),
  canAddPayment: z.boolean(), canRefund: z.boolean(), canOverrideConflict: z.boolean(),
  canViewFinance: z.boolean(), canViewAudit: z.boolean(), canManageUsers: z.boolean(),
  canManageSettings: z.boolean(),
}).strict();
export type Capabilities = z.infer<typeof CapabilitiesSchema>;

export const CapabilityEnvelopeSchema = z.object({
  subjectId: z.string().uuid(),
  resourceType: z.string().min(1).max(64),
  capabilities: CapabilitiesSchema,
}).strict();
export type CapabilityEnvelope = z.infer<typeof CapabilityEnvelopeSchema>;
