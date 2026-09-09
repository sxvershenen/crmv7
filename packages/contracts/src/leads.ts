import { z } from "zod";

import { CapabilitiesSchema } from "./capabilities.js";
import { DateTimeSchema, IdSchema, VersionSchema } from "./primitives.js";

export const LeadStatusSchema = z.enum(["new", "in_progress", "waiting", "success", "rejected", "spam", "archived"]);
export type LeadStatus = z.infer<typeof LeadStatusSchema>;
export const LeadUtmSchema = z.record(z.string().max(64), z.string().max(500));
export const LeadAssigneeSchema = z.object({ id: IdSchema, initials: z.string().max(10), name: z.string().min(1).max(200) }).strict();
export const LeadCapabilitiesSchema = CapabilitiesSchema.pick({ canView: true, canCreate: true, canEdit: true, canArchive: true, canChangeStatus: true }).strict();
export type LeadCapabilities = z.infer<typeof LeadCapabilitiesSchema>;

export const LeadSchema = z.object({
  id: IdSchema,
  version: VersionSchema,
  customerId: IdSchema.nullable(),
  name: z.string().min(1).max(500),
  phone: z.string().max(100).nullable(),
  channel: z.string().max(64).nullable(),
  direction: z.string().max(200).nullable(),
  requestedItem: z.string().max(500).nullable(),
  desiredStartAt: DateTimeSchema.nullable(),
  desiredEndAt: DateTimeSchema.nullable(),
  guestCount: z.number().int().nonnegative(),
  comment: z.string().max(20_000),
  source: z.string().max(200).nullable(),
  utm: LeadUtmSchema,
  assignees: z.array(LeadAssigneeSchema).max(20),
  nextContactAt: DateTimeSchema.nullable(),
  status: LeadStatusSchema,
  archived: z.boolean(),
  createdAt: DateTimeSchema,
  updatedAt: DateTimeSchema,
  capabilities: LeadCapabilitiesSchema,
}).strict();
export type Lead = z.infer<typeof LeadSchema>;
export const LeadDtoSchema = LeadSchema;
export type LeadDto = Lead;

export const LeadCreateInputSchema = z.object({
  customerId: IdSchema.nullable().default(null),
  name: z.string().trim().min(1).max(500),
  phone: z.string().trim().max(100).nullable().default(null),
  channel: z.string().trim().max(64).nullable().default(null),
  direction: z.string().trim().max(200).nullable().default(null),
  requestedItem: z.string().trim().max(500).nullable().default(null),
  desiredStartAt: DateTimeSchema.nullable().default(null),
  desiredEndAt: DateTimeSchema.nullable().default(null),
  guestCount: z.number().int().nonnegative().max(1_000_000).default(0),
  comment: z.string().max(20_000).default(""),
  source: z.string().trim().max(200).nullable().default(null),
  utm: LeadUtmSchema.default({}),
  assignees: z.array(LeadAssigneeSchema).max(20).default([]),
  nextContactAt: DateTimeSchema.nullable().default(null),
  status: LeadStatusSchema.default("new"),
}).strict();
export const LeadCreateSchema = LeadCreateInputSchema;
export type LeadCreate = z.infer<typeof LeadCreateSchema>;

export const LeadUpdateInputSchema = z.object({
  version: VersionSchema,
  customerId: IdSchema.nullable().optional(),
  name: z.string().trim().min(1).max(500).optional(),
  phone: z.string().trim().max(100).nullable().optional(),
  channel: z.string().trim().max(64).nullable().optional(),
  direction: z.string().trim().max(200).nullable().optional(),
  requestedItem: z.string().trim().max(500).nullable().optional(),
  desiredStartAt: DateTimeSchema.nullable().optional(),
  desiredEndAt: DateTimeSchema.nullable().optional(),
  guestCount: z.number().int().nonnegative().max(1_000_000).optional(),
  comment: z.string().max(20_000).optional(),
  source: z.string().trim().max(200).nullable().optional(),
  utm: LeadUtmSchema.optional(),
  assignees: z.array(LeadAssigneeSchema).max(20).optional(),
  nextContactAt: DateTimeSchema.nullable().optional(),
}).strict();
export const LeadUpdateSchema = LeadUpdateInputSchema;
export type LeadUpdate = z.infer<typeof LeadUpdateSchema>;

export const LeadTransitionSchema = z.object({ version: VersionSchema, status: LeadStatusSchema }).strict();
export type LeadTransition = z.infer<typeof LeadTransitionSchema>;
export const LeadArchiveSchema = z.object({ version: VersionSchema }).strict();
export type LeadArchive = z.infer<typeof LeadArchiveSchema>;
export const LeadAssignSelfSchema = z.object({ version: VersionSchema }).strict();
export type LeadAssignSelf = z.infer<typeof LeadAssignSelfSchema>;
export const LeadListQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  customerId: IdSchema.optional(),
  status: LeadStatusSchema.optional(),
  direction: z.string().trim().max(200).optional(),
  source: z.string().trim().max(200).optional(),
  assigneeId: IdSchema.optional(),
  archived: z.preprocess((value) => value === "true" ? true : value === "false" ? false : value, z.boolean()).optional(),
  cursor: z.string().min(1).max(2048).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  order: z.enum(["createdDesc", "nextContactAsc", "desiredStartAsc"]).default("createdDesc"),
}).strict();
export type LeadListQuery = z.infer<typeof LeadListQuerySchema>;
export const LeadListResponseSchema = z.object({ items: z.array(LeadDtoSchema), nextCursor: z.string().nullable() }).strict();
export type LeadListResponse = z.infer<typeof LeadListResponseSchema>;
