import { z } from "zod";
import { DateTimeSchema, IdSchema, JsonValueSchema, VersionSchema } from "./primitives.js";

export const SavedViewEntitySchema = z.enum(["leads", "customers", "bookings", "tasks", "events", "resources", "payments"]);
export type SavedViewEntity = z.infer<typeof SavedViewEntitySchema>;
export const SortDirectionSchema = z.enum(["asc", "desc"]);
export const SavedViewSchema = z.object({
  id: IdSchema, version: VersionSchema, name: z.string().min(1).max(120), entity: SavedViewEntitySchema,
  filters: z.record(z.string().min(1).max(100), JsonValueSchema),
  columns: z.array(z.string().min(1).max(100)).max(100),
  sort: z.array(z.object({ field: z.string().min(1).max(100), direction: SortDirectionSchema }).strict()).max(10),
  isShared: z.boolean(), ownerId: IdSchema, createdAt: DateTimeSchema, updatedAt: DateTimeSchema,
}).strict();
export type SavedView = z.infer<typeof SavedViewSchema>;
export const CreateSavedViewInputSchema = SavedViewSchema.pick({ name: true, entity: true, filters: true, columns: true, sort: true, isShared: true });
export const UpdateSavedViewInputSchema = CreateSavedViewInputSchema.partial().extend({ expectedVersion: VersionSchema }).strict();

/** Compatibility command shape for the current internal API; definition is the persisted view DSL. */
export const SavedViewCreateSchema = z.object({
  entityType: z.string().trim().min(1).max(64), name: z.string().trim().min(1).max(120),
  definition: z.record(z.string(), z.unknown()), isDefault: z.boolean().default(false),
}).strict();
export type SavedViewCreate = z.infer<typeof SavedViewCreateSchema>;
export const SavedViewUpdateSchema = z.object({
  version: VersionSchema,
  entityType: z.string().trim().min(1).max(64).optional(),
  name: z.string().trim().min(1).max(120).optional(),
  definition: z.record(z.string(), z.unknown()).optional(),
  isDefault: z.boolean().optional(),
}).strict();
export type SavedViewUpdate = z.infer<typeof SavedViewUpdateSchema>;
export const SavedViewArchiveSchema = z.object({ version: z.coerce.number().int().positive() }).strict();
export type SavedViewArchive = z.infer<typeof SavedViewArchiveSchema>;
export const SavedViewDtoSchema = z.object({
  id: IdSchema, version: VersionSchema, entityType: z.string().min(1), name: z.string().min(1),
  definition: z.record(z.string(), z.unknown()), isDefault: z.boolean(), updatedAt: DateTimeSchema,
}).strict();
export type SavedViewDto = z.infer<typeof SavedViewDtoSchema>;
