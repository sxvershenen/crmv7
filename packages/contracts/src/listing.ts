import { z } from "zod"

import { BoundedJsonValueSchema, IdSchema } from "./primitives.js"

export const ListingValueTypeSchema = z.enum(["string", "number", "boolean", "date", "enum"])
export const ListingFilterOperatorSchema = z.enum(["eq", "in", "range", "gte", "lte", "contains"])
export const ListingControlSchema = z.enum(["select", "multiselect", "checkbox", "range", "date_range", "search"])

export const ListingFilterDefinitionSchema = z.object({
  id: z.string().min(1).max(120).regex(/^[a-z][a-z0-9_]*$/),
  label: z.string().min(1).max(120),
  field: z.string().min(1).max(120),
  source: z.enum(["cms", "crm_public_projection", "derived"]),
  valueType: ListingValueTypeSchema,
  operators: z.array(ListingFilterOperatorSchema).min(1).max(6),
  control: ListingControlSchema,
  urlKey: z.string().min(1).max(80).regex(/^[a-z][a-z0-9_-]*$/),
  defaultValue: BoundedJsonValueSchema.optional(),
  options: z.array(z.object({ value: z.union([z.string(), z.number(), z.boolean()]), label: z.string().min(1).max(120) }).strict()).max(500).optional(),
  normalization: z.enum(["none", "lowercase", "integer", "iso_date"]).default("none"),
  indexPolicy: z.enum(["index", "canonical_to_base", "noindex"]).default("canonical_to_base"),
}).strict()
export type ListingFilterDefinition = z.infer<typeof ListingFilterDefinitionSchema>

export const ListingSortDefinitionSchema = z.object({
  id: z.string().min(1).max(120),
  label: z.string().min(1).max(120),
  field: z.string().min(1).max(120),
  direction: z.enum(["asc", "desc"]),
  source: z.enum(["cms", "crm_public_projection", "derived"]),
}).strict()

export const ListingDefinitionSchema = z.object({
  id: IdSchema,
  entityKind: z.enum(["resource", "program", "program_occurrence", "public_event_offering", "article"]),
  filters: z.array(ListingFilterDefinitionSchema).max(30),
  sorts: z.array(ListingSortDefinitionSchema).max(20),
  defaultSortId: z.string().min(1).max(120).nullable(),
  pageSize: z.number().int().min(1).max(100),
}).strict()
export type ListingDefinition = z.infer<typeof ListingDefinitionSchema>
