import { z } from "zod";
import { AllocationSourceTypeSchema, AllocationStatusSchema, AvailabilityResultSchema, ResourceAllocationSchema } from "./availability.js";
import { CapabilitiesSchema } from "./capabilities.js";
import { DateTimeSchema, IdSchema, VersionSchema } from "./primitives.js";
import { IdempotentOperationSchema, OperationIdSchema } from "./operations.js";

export const ResourceCapacityModeSchema = z.enum(["fixed", "shared"]);
export type ResourceCapacityMode = z.infer<typeof ResourceCapacityModeSchema>;
export const ResourceWeekDaySchema = z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);
export const ResourceColorKeySchema = z.enum(["blue", "orange", "violet", "green", "rose", "amber", "sky", "slate"]);
export const ResourceSpaceTypeSchema = z.enum(["outdoor", "indoor", "mixed"]);
export const ResourceEditorRulesSchema = z.object({
  availableDays: z.array(ResourceWeekDaySchema), bookingStepMinutes: z.string(), defaultCheckIn: z.string(),
  defaultCheckOut: z.string(), maxDurationMinutes: z.string(), minDurationMinutes: z.string(),
  preparationAfterMinutes: z.string(), preparationBeforeMinutes: z.string(),
}).strict();
export const ResourceBlockMetadataSchema = z.object({ reason: z.string().max(1000) }).strict();
/**
 * Resource settings are the persisted extension point for editor-only fields.
 * The known fields are validated while catchall keeps older integrations
 * forward-compatible with additional resource settings.
 */
export const ResourceSettingsSchema = z.object({
  active: z.boolean().optional(), secondaryType: z.string().max(500).optional(), iconKey: z.string().max(120).optional(),
  colorKey: ResourceColorKeySchema.optional(), customIconDataUrl: z.string().max(2_000_000).optional(),
  customIconName: z.string().max(500).optional(), description: z.string().max(20_000).optional(),
  cmsId: z.string().max(500).optional(), showOnSite: z.boolean().optional(),
  spaceType: ResourceSpaceTypeSchema.nullable().optional(), rules: ResourceEditorRulesSchema.optional(),
  monthlyLoadPercent: z.number().min(0).max(100).nullable().optional(),
  blockMetadata: z.record(z.string().uuid(), ResourceBlockMetadataSchema).optional(),
}).catchall(z.unknown());
export type ResourceSettings = z.infer<typeof ResourceSettingsSchema>;

export const ResourceCapabilitiesSchema = CapabilitiesSchema.pick({
  canView: true, canCreate: true, canEdit: true, canArchive: true, canOverrideConflict: true,
}).strict();
export type ResourceCapabilities = z.infer<typeof ResourceCapabilitiesSchema>;

export const ResourceSchema = z.object({
  id: IdSchema, code: z.string().min(1).max(120), version: VersionSchema,
  kind: z.string().min(1).max(64), name: z.string().min(1).max(500),
  capacityMode: ResourceCapacityModeSchema, capacityTotal: z.number().int().nonnegative().max(1_000_000),
  settings: ResourceSettingsSchema, archived: z.boolean(), createdAt: DateTimeSchema, updatedAt: DateTimeSchema,
  capabilities: ResourceCapabilitiesSchema,
}).strict();
export type Resource = z.infer<typeof ResourceSchema>;
export const ResourceCreateInputSchema = z.object({
  code: z.string().trim().min(1).max(120).optional(), kind: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1).max(500), capacityMode: ResourceCapacityModeSchema,
  capacityTotal: z.number().int().nonnegative().max(1_000_000), settings: ResourceSettingsSchema.default({}),
}).strict();
export const ResourceCreateSchema = ResourceCreateInputSchema;
export type ResourceCreate = z.infer<typeof ResourceCreateSchema>;
export const ResourceUpdateInputSchema = z.object({
  version: VersionSchema, kind: z.string().trim().min(1).max(64).optional(), name: z.string().trim().min(1).max(500).optional(),
  capacityMode: ResourceCapacityModeSchema.optional(), capacityTotal: z.number().int().nonnegative().max(1_000_000).optional(), settings: ResourceSettingsSchema.optional(),
}).strict();
export const ResourceUpdateSchema = ResourceUpdateInputSchema;
export type ResourceUpdate = z.infer<typeof ResourceUpdateSchema>;
export const ResourceListQuerySchema = z.object({
  kind: z.string().trim().min(1).max(64).optional(), archived: z.preprocess((value) => value === "true" ? true : value === "false" ? false : value, z.boolean()).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50), cursor: z.string().min(1).max(2048).optional(),
}).strict();
export type ResourceListQuery = z.infer<typeof ResourceListQuerySchema>;
export const ResourceArchiveSchema = z.object({ version: VersionSchema }).strict();
export type ResourceArchive = z.infer<typeof ResourceArchiveSchema>;

export const ResourceAllocationCreateSchema = z.object({
  resourceId: IdSchema, sourceType: AllocationSourceTypeSchema, sourceId: IdSchema,
  startAt: DateTimeSchema, endAt: DateTimeSchema, quantity: z.number().int().positive(), capacityImpact: z.number().int().nonnegative(),
  status: AllocationStatusSchema.default("tentative"), operationId: OperationIdSchema, expectedVersion: VersionSchema,
  reason: z.string().trim().min(1).max(1000).optional(),
  /** Explicit authorization is required to persist an allocation despite conflicts. */
  overrideConflict: z.boolean().default(false),
}).strict();
export type ResourceAllocationCreate = z.infer<typeof ResourceAllocationCreateSchema>;
export const ResourceAllocationDtoSchema = ResourceAllocationSchema;
export type ResourceAllocationDto = z.infer<typeof ResourceAllocationDtoSchema>;
export const EventAllocationReplaceSchema = IdempotentOperationSchema.omit({ expectedVersion: true }).extend({
  eventId: IdSchema,
  expectedEventVersion: VersionSchema,
  allocations: z.array(ResourceAllocationCreateSchema.pick({ resourceId: true, startAt: true, endAt: true, quantity: true, capacityImpact: true })).max(100),
}).strict().superRefine((value, context) => {
  value.allocations.forEach((allocation, index) => {
    if (new Date(allocation.startAt) >= new Date(allocation.endAt)) context.addIssue({ code: "custom", path: ["allocations", index, "endAt"], message: "Invalid allocation interval" });
  });
});
export type EventAllocationReplace = z.infer<typeof EventAllocationReplaceSchema>;
export const EventAllocationReplaceResultSchema = z.object({ eventVersion: VersionSchema, allocations: z.array(ResourceAllocationDtoSchema) }).strict();
export const ResourceBlockDtoSchema = ResourceAllocationSchema.extend({ sourceType: z.literal("resource_block"), reason: z.string() }).strict();
export type ResourceBlockDto = z.infer<typeof ResourceBlockDtoSchema>;
export const ResourceAvailabilityQuerySchema = z.object({
  resourceId: IdSchema, startAt: DateTimeSchema, endAt: DateTimeSchema, quantity: z.coerce.number().int().positive().default(1), excludeSourceId: IdSchema.optional(),
}).strict();
export type ResourceAvailabilityQuery = z.infer<typeof ResourceAvailabilityQuerySchema>;
export const ResourceAvailabilityByCodeQuerySchema = ResourceAvailabilityQuerySchema.omit({ resourceId: true }).strict();
export type ResourceAvailabilityByCodeQuery = z.infer<typeof ResourceAvailabilityByCodeQuerySchema>;
export const ResourceAvailabilityResponseSchema = AvailabilityResultSchema;
export type ResourceAvailabilityResponse = z.infer<typeof ResourceAvailabilityResponseSchema>;

export const ResourceCapacityReadModelSchema = z.object({
  mode: ResourceCapacityModeSchema, total: z.number().int().nonnegative(), occupied: z.number().int().nonnegative().optional(),
}).strict();
export const ResourceWarningSchema = z.object({ id: IdSchema, message: z.string() }).strict();
export const ResourcePermissionsSchema = z.object({ canEdit: z.boolean(), canManageBlocks: z.boolean() }).strict();
export const ResourceReadModelSchema = z.object({
  active: z.boolean(), secondaryType: z.string(), iconKey: z.string(), capacity: ResourceCapacityReadModelSchema,
  nextBookingAt: DateTimeSchema.nullable(), nextAvailableFrom: DateTimeSchema.nullable(), hasActiveBlock: z.boolean(),
  futureBookingCount: z.number().int().nonnegative(), warning: ResourceWarningSchema.nullable(), permissions: ResourcePermissionsSchema,
  monthlyLoadPercent: z.number().min(0).max(100).nullable(), cmsId: z.string(), colorKey: ResourceColorKeySchema,
  customIconDataUrl: z.string(), customIconName: z.string(), description: z.string(), rules: ResourceEditorRulesSchema,
  showOnSite: z.boolean(), spaceType: ResourceSpaceTypeSchema.nullable(), blocks: z.array(ResourceBlockDtoSchema),
}).strict();
export type ResourceReadModel = z.infer<typeof ResourceReadModelSchema>;
export const ResourceDtoSchema = ResourceSchema.merge(ResourceReadModelSchema);
export type ResourceDto = z.infer<typeof ResourceDtoSchema>;
export const ResourceListResponseSchema = z.object({ items: z.array(ResourceDtoSchema), nextCursor: z.string().nullable() }).strict();
export type ResourceListResponse = z.infer<typeof ResourceListResponseSchema>;

export const ResourceAllocationsQuerySchema = z.object({ includeCancelled: z.preprocess((value) => value === "true" ? true : value === "false" ? false : value, z.boolean()).default(false) }).strict();
export type ResourceAllocationsQuery = z.infer<typeof ResourceAllocationsQuerySchema>;
export const ResourceAllocationListQuerySchema = ResourceAllocationsQuerySchema.extend({
  sourceType: AllocationSourceTypeSchema.optional(), sourceId: IdSchema.optional(), resourceId: IdSchema.optional(),
}).strict();
export type ResourceAllocationListQuery = z.infer<typeof ResourceAllocationListQuerySchema>;
export const ResourceAllocationCancelSchema = IdempotentOperationSchema;
export type ResourceAllocationCancel = z.infer<typeof ResourceAllocationCancelSchema>;
export const ResourceBlockCreateSchema = z.object({
  startAt: DateTimeSchema, endAt: DateTimeSchema, reason: z.string().trim().min(1).max(1000),
  operationId: OperationIdSchema, expectedVersion: VersionSchema,
}).strict();
export type ResourceBlockCreate = z.infer<typeof ResourceBlockCreateSchema>;
export const ResourceBlockCancelSchema = z.object({ version: VersionSchema, operationId: OperationIdSchema.optional() }).strict();
export type ResourceBlockCancel = z.infer<typeof ResourceBlockCancelSchema>;
