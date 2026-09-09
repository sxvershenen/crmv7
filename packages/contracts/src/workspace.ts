import { z } from "zod"

import { CapabilitiesSchema } from "./capabilities.js"
import { DateTimeSchema, IdSchema, VersionSchema } from "./primitives.js"
import { IdempotencyKeySchema, OperationIdSchema } from "./operations.js"

export const WorkspaceReadinessSchema = z.object({
  status: z.enum(["configured", "unconfigured"]),
  source: z.string().max(120).optional(),
}).strict()
export type WorkspaceReadiness = z.infer<typeof WorkspaceReadinessSchema>

export const WorkspaceProfileSchema = z.object({
  id: IdSchema, version: VersionSchema, name: z.string().min(1).max(200), email: z.string().email().max(320),
  phone: z.string().max(100), role: z.string().min(1).max(120), initials: z.string().max(10), language: z.literal("ru"),
  timezone: z.string().min(1).max(100), browserNotifications: z.boolean(), emailNotifications: z.boolean(),
  telegramNotifications: z.boolean(), notifyConflicts: z.boolean(), notifyNewLeads: z.boolean(), notifyOverdueTasks: z.boolean(),
  capabilities: CapabilitiesSchema,
}).strict()
export type WorkspaceProfile = z.infer<typeof WorkspaceProfileSchema>

export const WorkspaceProfileUpdateSchema = z.object({
  version: VersionSchema, name: z.string().min(1).max(200).optional(), email: z.string().email().max(320).optional(),
  phone: z.string().max(100).optional(), timezone: z.string().min(1).max(100).optional(),
  browserNotifications: z.boolean().optional(), emailNotifications: z.boolean().optional(), telegramNotifications: z.boolean().optional(),
  notifyConflicts: z.boolean().optional(), notifyNewLeads: z.boolean().optional(), notifyOverdueTasks: z.boolean().optional(),
  operationId: OperationIdSchema, idempotencyKey: IdempotencyKeySchema,
}).strict()
export type WorkspaceProfileUpdate = z.infer<typeof WorkspaceProfileUpdateSchema>

export const TeamMemberStatusSchema = z.enum(["active", "away", "invited", "archived"])
export type TeamMemberStatus = z.infer<typeof TeamMemberStatusSchema>
export const TeamMemberSchema = z.object({
  id: IdSchema, version: VersionSchema, name: z.string().min(1).max(200), email: z.string().email().max(320), phone: z.string().max(100),
  initials: z.string().max(10), role: z.string().min(1).max(120), status: TeamMemberStatusSchema, openItems: z.number().int().nonnegative(),
  lastActiveAt: DateTimeSchema.nullable(), schedule: WorkspaceReadinessSchema, leave: WorkspaceReadinessSchema,
}).strict()
export type TeamMember = z.infer<typeof TeamMemberSchema>

const IntegrationStatusSchema = z.enum(["connected", "attention", "planned"])
const IntegrationSchema = z.object({ id: z.string().min(1).max(64), name: z.string().min(1).max(200), description: z.string().max(1000), status: IntegrationStatusSchema, lastSyncAt: DateTimeSchema.nullable() }).strict()
const SettingsCapabilitiesSchema = CapabilitiesSchema.pick({ canView: true, canEdit: true }).extend({ canManageSettings: z.boolean() }).strict()
const OrganizationSettingsSchema = z.object({ currency: z.literal("RUB"), email: z.string().email().max(320), locale: z.literal("ru-RU"), name: z.string().min(1).max(300), phone: z.string().max(100), timezone: z.string().min(1).max(100) }).strict()
const OperationsSettingsSchema = z.object({ autoAssignNewLeads: z.boolean(), bookingPrefix: z.string().min(1).max(4), conflictWarnings: z.boolean(), defaultLeadSource: z.string().max(120), requireClientPhone: z.boolean() }).strict()
const SiteSettingsSchema = z.object({ connectionStatus: z.literal("planned"), defaultAssigneeId: IdSchema.nullable(), defaultSource: z.string().max(120), intakeEnabled: z.boolean(), publishAggregatedAvailability: z.boolean(), publishPrices: z.boolean(), publishResources: z.boolean(), siteUrl: z.string().url().max(500) }).strict()
export const CrmSettingsSchema = z.object({
  id: IdSchema, version: VersionSchema, organization: OrganizationSettingsSchema, operations: OperationsSettingsSchema, site: SiteSettingsSchema,
  integrations: z.array(IntegrationSchema).max(50), capabilities: SettingsCapabilitiesSchema,
}).strict()
export type CrmSettings = z.infer<typeof CrmSettingsSchema>
export const WorkspaceSettingsUpdateSchema = z.object({
  version: VersionSchema, organization: OrganizationSettingsSchema.partial().optional(), operations: OperationsSettingsSchema.partial().optional(),
  site: SiteSettingsSchema.partial().omit({ connectionStatus: true }).optional(), operationId: OperationIdSchema, idempotencyKey: IdempotencyKeySchema,
}).strict()
export type WorkspaceSettingsUpdate = z.infer<typeof WorkspaceSettingsUpdateSchema>

export const WorkspaceTeamListQuerySchema = z.object({ includeArchived: z.preprocess((value) => value === "true" ? true : value === "false" ? false : value, z.boolean()).default(false) }).strict()
export type WorkspaceTeamListQuery = z.infer<typeof WorkspaceTeamListQuerySchema>
