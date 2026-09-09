import { z } from "zod";

import { CapabilitiesSchema } from "./capabilities.js";
import { DateTimeSchema, IdSchema, VersionSchema } from "./primitives.js";

export const CustomerTypeSchema = z.enum(["person", "company", "organizer"]);
export type CustomerType = z.infer<typeof CustomerTypeSchema>;
export const CustomerDuplicateRiskSchema = z.enum(["none", "possible", "high"]);
export type CustomerDuplicateRisk = z.infer<typeof CustomerDuplicateRiskSchema>;
export const CustomerAssigneeSchema = z.object({ id: IdSchema, initials: z.string().max(10), name: z.string().min(1).max(200) }).strict();
export const CustomerConsentSchema = z.object({
  processing: z.boolean().default(false),
  marketing: z.boolean().default(false),
  updatedAt: DateTimeSchema.nullable().default(null),
}).strict();

export const CustomerCapabilitiesSchema = CapabilitiesSchema.pick({ canView: true, canCreate: true, canEdit: true, canArchive: true }).strict();
export type CustomerCapabilities = z.infer<typeof CustomerCapabilitiesSchema>;

export const CustomerSchema = z.object({
  id: IdSchema,
  version: VersionSchema,
  type: CustomerTypeSchema,
  name: z.string().min(1).max(500),
  phones: z.array(z.string().trim().min(1).max(100)).max(20),
  /** Primary phone projection; `phones` remains the canonical multi-value field. */
  phone: z.string().trim().min(1).max(100).nullable(),
  channels: z.array(z.string().trim().min(1).max(64)).max(20),
  email: z.string().email().max(320).nullable(),
  notes: z.string().max(20_000),
  consent: CustomerConsentSchema,
  duplicateRisk: CustomerDuplicateRiskSchema,
  assignees: z.array(CustomerAssigneeSchema).max(20),
  leadCount: z.number().int().nonnegative(),
  activeLeadCount: z.number().int().nonnegative(),
  bookingCount: z.number().int().nonnegative(),
  futureBookingCount: z.number().int().nonnegative(),
  taskCount: z.number().int().nonnegative(),
  turnover: z.number().int().nonnegative(),
  debt: z.number().int(),
  nextContactAt: DateTimeSchema.nullable(),
  lastVisitAt: DateTimeSchema.nullable(),
  archived: z.boolean(),
  createdAt: DateTimeSchema,
  updatedAt: DateTimeSchema,
  capabilities: CustomerCapabilitiesSchema,
}).strict();
export type Customer = z.infer<typeof CustomerSchema>;
export const CustomerDtoSchema = CustomerSchema;
export type CustomerDto = Customer;

export const CustomerCreateInputSchema = z.object({
  name: z.string().trim().min(1).max(500),
  type: CustomerTypeSchema.default("person"),
  phones: z.array(z.string().trim().min(1).max(100)).max(20).default([]),
  /** Convenience input for forms with one primary phone. */
  phone: z.string().trim().min(1).max(100).optional(),
  channels: z.array(z.string().trim().min(1).max(64)).max(20).default([]),
  email: z.string().email().max(320).nullable().default(null),
  notes: z.string().max(20_000).default(""),
  consent: CustomerConsentSchema.default({ processing: false, marketing: false, updatedAt: null }),
  duplicateRisk: CustomerDuplicateRiskSchema.default("none"),
  assignees: z.array(CustomerAssigneeSchema).max(20).default([]),
}).strict();
export const CustomerCreateSchema = CustomerCreateInputSchema;
export type CustomerCreate = z.infer<typeof CustomerCreateSchema>;

export const CustomerUpdateInputSchema = z.object({
  version: VersionSchema,
  name: z.string().trim().min(1).max(500).optional(),
  type: CustomerTypeSchema.optional(),
  phones: z.array(z.string().trim().min(1).max(100)).max(20).optional(),
  phone: z.string().trim().min(1).max(100).nullable().optional(),
  channels: z.array(z.string().trim().min(1).max(64)).max(20).optional(),
  email: z.string().email().max(320).nullable().optional(),
  notes: z.string().max(20_000).optional(),
  consent: CustomerConsentSchema.optional(),
  duplicateRisk: CustomerDuplicateRiskSchema.optional(),
  assignees: z.array(CustomerAssigneeSchema).max(20).optional(),
}).strict();
export const CustomerUpdateSchema = CustomerUpdateInputSchema;
export type CustomerUpdate = z.infer<typeof CustomerUpdateSchema>;

export const CustomerListQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  type: CustomerTypeSchema.optional(),
  archived: z.preprocess((value) => value === "true" ? true : value === "false" ? false : value, z.boolean()).optional(),
  duplicateRisk: CustomerDuplicateRiskSchema.optional(),
  hasDebt: z.preprocess((value) => value === "true" ? true : value === "false" ? false : value, z.boolean()).optional(),
  cursor: z.string().min(1).max(2048).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  order: z.enum(["createdDesc", "nameAsc", "nextContactAsc"]).default("createdDesc"),
}).strict();
export type CustomerListQuery = z.infer<typeof CustomerListQuerySchema>;
export const CustomerArchiveSchema = z.object({ version: VersionSchema }).strict();
export type CustomerArchive = z.infer<typeof CustomerArchiveSchema>;
export const CustomerAssignSelfSchema = z.object({ version: VersionSchema }).strict();
export type CustomerAssignSelf = z.infer<typeof CustomerAssignSelfSchema>;
export const CustomerListResponseSchema = z.object({ items: z.array(CustomerDtoSchema), nextCursor: z.string().nullable() }).strict();
export type CustomerListResponse = z.infer<typeof CustomerListResponseSchema>;
