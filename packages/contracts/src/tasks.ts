import { z } from "zod";
import { DateTimeSchema, IdSchema, VersionSchema } from "./primitives.js";
import { MutationMetaSchema } from "./operations.js";

// `todo`/`in_progress` are retained for compatibility with the first API migration;
// new domain flows should use open/completed/cancelled.
export const TaskStatusSchema = z.enum(["open", "completed", "cancelled", "todo", "in_progress", "review", "done"]);
export type TaskStatus = z.infer<typeof TaskStatusSchema>;
export const TaskPrioritySchema = z.enum(["low", "normal", "high", "urgent"]);
export type TaskPriority = z.infer<typeof TaskPrioritySchema>;

export const TaskSchema = z.object({
  id: IdSchema, version: VersionSchema, title: z.string().min(1).max(500),
  description: z.string().max(20_000).nullable(), status: TaskStatusSchema,
  priority: TaskPrioritySchema, dueAt: DateTimeSchema.nullable(), assigneeId: IdSchema.nullable(),
  relatedEntity: z.object({ type: z.string().min(1).max(64), id: IdSchema }).strict().nullable(),
  createdAt: DateTimeSchema, updatedAt: DateTimeSchema,
}).strict();
export type Task = z.infer<typeof TaskSchema>;

export const CreateTaskInputSchema = z.object({
  title: z.string().trim().min(1).max(500),
  description: z.string().max(20_000).nullable().optional(),
  details: z.string().max(20_000).default(""),
  status: TaskStatusSchema.default("open"),
  priority: TaskPrioritySchema.default("normal"), dueAt: DateTimeSchema.nullable().default(null),
  reminderMinutes: z.number().int().nonnegative().max(10080).nullable().default(null),
  relation: z.record(z.string(), z.unknown()).default({}),
  assignees: z.array(z.object({ id: z.string().min(1), initials: z.string().max(10), name: z.string().min(1).max(200) }).strict()).default([]),
  blocked: z.boolean().optional(),
  assigneeId: IdSchema.nullable().optional(), relatedEntity: z.object({ type: z.string().min(1).max(64), id: IdSchema }).strict().nullable().optional(),
}).strict();
export const TaskCreateSchema = CreateTaskInputSchema;
export type TaskCreate = z.infer<typeof TaskCreateSchema>;
// Keep PATCH genuinely sparse. `CreateTaskInputSchema.partial()` preserves defaults
// from the create contract and would materialize omitted fields during parsing.
export const UpdateTaskInputSchema = z.object({
  version: VersionSchema,
  title: z.string().trim().min(1).max(500).optional(),
  description: z.string().max(20_000).nullable().optional(),
  details: z.string().max(20_000).optional(),
  status: TaskStatusSchema.optional(),
  priority: TaskPrioritySchema.optional(),
  dueAt: DateTimeSchema.nullable().optional(),
  reminderMinutes: z.number().int().nonnegative().max(10080).nullable().optional(),
  relation: z.record(z.string(), z.unknown()).optional(),
  assignees: z.array(z.object({
    id: z.string().min(1),
    initials: z.string().max(10),
    name: z.string().min(1).max(200),
  }).strict()).optional(),
  blocked: z.boolean().optional(),
  assigneeId: IdSchema.nullable().optional(),
  relatedEntity: z.object({ type: z.string().min(1).max(64), id: IdSchema }).strict().nullable().optional(),
}).strict();
export const TaskUpdateSchema = UpdateTaskInputSchema;
export type TaskUpdate = z.infer<typeof TaskUpdateSchema>;
export const TransitionTaskInputSchema = MutationMetaSchema.extend({ status: TaskStatusSchema }).strict();
export const TaskListQuerySchema = z.object({
  status: TaskStatusSchema.optional(), priority: TaskPrioritySchema.optional(), assigneeId: z.string().min(1).optional(), dueBefore: DateTimeSchema.optional(),
  dueAfter: DateTimeSchema.optional(), search: z.string().trim().max(200).optional(),
  cursor: z.string().min(1).max(2048).optional(), limit: z.coerce.number().int().min(1).max(100).default(50),
  archived: z.preprocess((value) => value === "true" ? true : value === "false" ? false : value, z.boolean()).optional(),
  order: z.enum(["createdDesc", "dueAsc"]).default("dueAsc"),
}).strict();
export type TaskListQuery = z.infer<typeof TaskListQuerySchema>;

export const TaskArchiveSchema = z.object({ version: VersionSchema }).strict();
export type TaskArchive = z.infer<typeof TaskArchiveSchema>;
export const TaskAssignSelfSchema = z.object({ version: VersionSchema }).strict();
export type TaskAssignSelf = z.infer<typeof TaskAssignSelfSchema>;

export const TaskDtoSchema = z.object({
  id: z.string().min(1), entityId: IdSchema, version: VersionSchema, title: z.string().min(1), details: z.string(),
  status: TaskStatusSchema, priority: TaskPrioritySchema, dueAt: DateTimeSchema.nullable(), reminderMinutes: z.number().int().nonnegative().nullable(),
  relation: z.record(z.string(), z.unknown()), assignees: z.array(z.object({ id: z.string(), initials: z.string(), name: z.string() }).strict()),
  commentCount: z.number().int().nonnegative(), latestComment: z.string().nullable(), blocked: z.boolean(), archived: z.boolean(),
  createdAt: DateTimeSchema, updatedAt: DateTimeSchema,
  capabilities: z.object({ canEdit: z.boolean(), canChangeStatus: z.boolean(), canArchive: z.boolean() }).strict(),
}).strict();
export type TaskDto = z.infer<typeof TaskDtoSchema>;
