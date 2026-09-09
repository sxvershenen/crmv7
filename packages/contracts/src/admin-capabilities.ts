import { z } from "zod";

export const adminCapabilityNames = [
  "canViewContent", "canEditContent", "canReviewContent", "canPublishContent", "canManageSeo",
  "canManageMedia", "canViewAnalytics", "canViewRawAnalytics", "canManageSiteCode",
  "canManageIntegrations", "canManageRedirects", "canManageSiteSettings",
] as const;

export const AdminCapabilitySchema = z.enum(adminCapabilityNames);
export type AdminCapability = z.infer<typeof AdminCapabilitySchema>;

export const AdminCapabilitySetSchema = z.object({
  capabilities: z.array(AdminCapabilitySchema).max(12),
}).strict();
