import { z } from "zod";
import { IdSchema, VersionSchema } from "./primitives.js";

export const OperationIdSchema = IdSchema;
export type OperationId = z.infer<typeof OperationIdSchema>;

export const MutationMetaSchema = z.object({
  operationId: OperationIdSchema,
  expectedVersion: VersionSchema,
}).strict();
export type MutationMeta = z.infer<typeof MutationMetaSchema>;

export const IdempotencyKeySchema = z.string().min(16).max(255).regex(/^[A-Za-z0-9._~-]+$/);
export const IdempotentOperationSchema = MutationMetaSchema.extend({ idempotencyKey: IdempotencyKeySchema }).strict();
export type IdempotentOperation = z.infer<typeof IdempotentOperationSchema>;
