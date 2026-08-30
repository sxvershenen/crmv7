import { z } from "zod";
import { DateTimeSchema, IdSchema, VersionSchema } from "./primitives.js";
import { MutationMetaSchema } from "./operations.js";

export const AllocationSourceTypeSchema = z.enum(["booking_item", "event", "program_occurrence", "resource_block", "preparation"]);
export type AllocationSourceType = z.infer<typeof AllocationSourceTypeSchema>;
export const AllocationStatusSchema = z.enum(["tentative", "active", "cancelled"]);
export type AllocationStatus = z.infer<typeof AllocationStatusSchema>;

export const ResourceAllocationSchema = z.object({
  id: IdSchema, resourceId: IdSchema, sourceType: AllocationSourceTypeSchema, sourceId: IdSchema,
  startAt: DateTimeSchema, endAt: DateTimeSchema, quantity: z.number().int().positive(),
  capacityImpact: z.number().int().nonnegative(), status: AllocationStatusSchema, version: VersionSchema,
}).strict();
export type ResourceAllocation = z.infer<typeof ResourceAllocationSchema>;

export const AvailabilityQuerySchema = z.object({
  resourceId: IdSchema, startAt: DateTimeSchema, endAt: DateTimeSchema,
  quantity: z.number().int().positive().default(1), excludeSourceId: IdSchema.optional(),
}).strict();
export type AvailabilityQuery = z.input<typeof AvailabilityQuerySchema>;

export const AvailabilityConflictSchema = z.object({
  allocationId: IdSchema, resourceId: IdSchema, sourceType: AllocationSourceTypeSchema, sourceId: IdSchema,
  startAt: DateTimeSchema, endAt: DateTimeSchema, requestedQuantity: z.number().int().positive(),
  availableQuantity: z.number().int().nonnegative(), reason: z.enum(["overlap", "capacity", "blocked", "incompatible", "outside_hours", "min_duration"]),
}).strict();
export type AvailabilityConflict = z.infer<typeof AvailabilityConflictSchema>;
export const AvailabilityResultSchema = z.object({ available: z.boolean(), conflicts: z.array(AvailabilityConflictSchema) }).strict();
export type AvailabilityResult = z.infer<typeof AvailabilityResultSchema>;

export const AllocationMutationSchema = MutationMetaSchema.extend({
  resourceId: IdSchema, sourceType: AllocationSourceTypeSchema, sourceId: IdSchema,
  startAt: DateTimeSchema, endAt: DateTimeSchema, quantity: z.number().int().positive(),
  capacityImpact: z.number().int().nonnegative(), status: AllocationStatusSchema.default("tentative"),
}).strict();
