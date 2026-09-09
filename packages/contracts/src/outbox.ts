import { z } from "zod";

import { IdempotencyKeySchema, OperationIdSchema } from "./operations.js";
import { DateTimeSchema, IdSchema, PaginationInputSchema } from "./primitives.js";

/** Delivery names are intentionally bounded but not hard-coded to today’s workers. */
export const OutboxConsumerSchema = z.string().min(1).max(120).regex(/^[a-z][a-z0-9_]*$/);
export type OutboxConsumer = z.infer<typeof OutboxConsumerSchema>;

export const OutboxDeliveryStatusSchema = z.enum(["pending", "processing", "succeeded", "failed", "dead_letter"]);
export type OutboxDeliveryStatus = z.infer<typeof OutboxDeliveryStatusSchema>;

export const OutboxDeliveryAttemptOutcomeSchema = z.enum([
  "succeeded",
  "retryable_failure",
  "permanent_failure",
  "lease_expired",
]);
export type OutboxDeliveryAttemptOutcome = z.infer<typeof OutboxDeliveryAttemptOutcomeSchema>;

export const OutboxDeliveryErrorCodeSchema = z.string().min(1).max(120).regex(/^[A-Z][A-Z0-9_]*$/);
export type OutboxDeliveryErrorCode = z.infer<typeof OutboxDeliveryErrorCodeSchema>;

export const PublicCacheTagSchema = z.string().regex(/^(?:public-offering:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|public-offering-kind:[a-z_]+|public-offering-collection)$/);
export type PublicCacheTag = z.infer<typeof PublicCacheTagSchema>;

/**
 * Safe operator projection. Generic outbox payload and error text are excluded:
 * either can contain operational data and never belong in an observability API.
 */
export const OutboxDeliverySchema = z.object({
  eventId: IdSchema,
  consumer: OutboxConsumerSchema,
  topic: z.string().min(1).max(240),
  aggregateType: z.string().min(1).max(120),
  aggregateId: IdSchema,
  status: OutboxDeliveryStatusSchema,
  attempts: z.number().int().nonnegative().max(100_000),
  maxAttempts: z.number().int().positive().max(100),
  deliveryEpoch: z.number().int().positive().max(100_000),
  replayCount: z.number().int().nonnegative().max(100_000),
  availableAt: DateTimeSchema,
  processedAt: DateTimeSchema.nullable(),
  leaseAcquiredAt: DateTimeSchema.nullable(),
  leaseExpiresAt: DateTimeSchema.nullable(),
  lastAttemptAt: DateTimeSchema.nullable(),
  lastFailureAt: DateTimeSchema.nullable(),
  lastErrorCode: OutboxDeliveryErrorCodeSchema.nullable(),
  deadLetteredAt: DateTimeSchema.nullable(),
  createdAt: DateTimeSchema,
  updatedAt: DateTimeSchema,
}).strict();
export type OutboxDelivery = z.infer<typeof OutboxDeliverySchema>;

export const OutboxDeliveryAttemptSchema = z.object({
  eventId: IdSchema,
  consumer: OutboxConsumerSchema,
  deliveryEpoch: z.number().int().positive().max(100_000),
  attempt: z.number().int().positive().max(100_000),
  outcome: OutboxDeliveryAttemptOutcomeSchema,
  errorCode: OutboxDeliveryErrorCodeSchema.nullable(),
  attemptedAt: DateTimeSchema,
  completedAt: DateTimeSchema,
  nextAvailableAt: DateTimeSchema.nullable(),
}).strict();
export type OutboxDeliveryAttempt = z.infer<typeof OutboxDeliveryAttemptSchema>;

export const OutboxDeliveryReplaySchema = z.object({
  id: IdSchema,
  eventId: IdSchema,
  consumer: OutboxConsumerSchema,
  previousDeliveryEpoch: z.number().int().positive().max(100_000),
  previousAttempts: z.number().int().nonnegative().max(100_000),
  operationId: OperationIdSchema,
  requestId: z.string().min(1).max(500),
  reason: z.string().min(1).max(500),
  replayedBy: IdSchema.nullable(),
  replayedAt: DateTimeSchema,
}).strict();
export type OutboxDeliveryReplay = z.infer<typeof OutboxDeliveryReplaySchema>;

export const OutboxDeliveryReplayInputSchema = z.object({
  operationId: OperationIdSchema,
  idempotencyKey: IdempotencyKeySchema,
  /** Replay is intentionally a CAS: an operator may only revive the state observed. */
  expectedStatus: z.enum(["failed", "dead_letter"]),
  expectedDeliveryEpoch: z.number().int().positive().max(100_000),
  expectedAttempts: z.number().int().nonnegative().max(100_000),
  reason: z.string().trim().min(1).max(500),
}).strict();
export type OutboxDeliveryReplayInput = z.infer<typeof OutboxDeliveryReplayInputSchema>;

export const OutboxDeliveryQuerySchema = PaginationInputSchema.extend({
  consumer: OutboxConsumerSchema.optional(),
  status: OutboxDeliveryStatusSchema.optional(),
  topic: z.string().min(1).max(240).optional(),
  aggregateType: z.string().min(1).max(120).optional(),
  aggregateId: IdSchema.optional(),
}).strict();
export type OutboxDeliveryQuery = z.infer<typeof OutboxDeliveryQuerySchema>;

export const OutboxDeliveryDetailParamsSchema = z.object({
  eventId: IdSchema,
  consumer: OutboxConsumerSchema,
}).strict();
export type OutboxDeliveryDetailParams = z.infer<typeof OutboxDeliveryDetailParamsSchema>;

/** Safe cursor page for the operator surface; payload/error text remain server-only. */
export const OutboxDeliveryListResponseSchema = z.object({
  items: z.array(OutboxDeliverySchema).max(100),
  nextCursor: z.string().min(1).max(2048).nullable(),
}).strict();
export type OutboxDeliveryListResponse = z.infer<typeof OutboxDeliveryListResponseSchema>;

export const OutboxDeliveryHealthConsumerSchema = z.object({
  consumer: OutboxConsumerSchema,
  pending: z.number().int().nonnegative(),
  processing: z.number().int().nonnegative(),
  succeeded: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  deadLetter: z.number().int().nonnegative(),
  oldestReadyAt: DateTimeSchema.nullable(),
  oldestLeaseExpiresAt: DateTimeSchema.nullable(),
}).strict();
export type OutboxDeliveryHealthConsumer = z.infer<typeof OutboxDeliveryHealthConsumerSchema>;

export const OutboxDeliveryHealthSchema = z.object({
  generatedAt: DateTimeSchema,
  consumers: z.array(OutboxDeliveryHealthConsumerSchema).max(200),
}).strict();
export type OutboxDeliveryHealth = z.infer<typeof OutboxDeliveryHealthSchema>;

export const OutboxDeliveryReplayResultSchema = z.object({
  delivery: OutboxDeliverySchema,
  replay: OutboxDeliveryReplaySchema,
}).strict();
export type OutboxDeliveryReplayResult = z.infer<typeof OutboxDeliveryReplayResultSchema>;

export const PublicOfferingProjectionStateSchema = z.object({
  offeringId: IdSchema,
  generation: z.number().int().positive().max(2_147_483_647),
  lastInvalidationEventId: IdSchema,
  invalidatedAt: DateTimeSchema,
  updatedAt: DateTimeSchema,
}).strict();
export type PublicOfferingProjectionState = z.infer<typeof PublicOfferingProjectionStateSchema>;

/**
 * Core identity/generation/tags are immutable. Effect metadata is a safe,
 * monotonic operator projection of retryable external cache work.
 */
export const PublicOfferingProjectionInvalidationReceiptSchema = z.object({
  eventId: IdSchema,
  offeringId: IdSchema,
  deliveryEpoch: z.number().int().positive().max(100_000),
  deliveryAttempt: z.number().int().positive().max(100_000),
  generation: z.number().int().positive().max(2_147_483_647),
  cacheTags: z.array(PublicCacheTagSchema).min(1).max(3),
  tagsHash: z.string().regex(/^[a-f0-9]{64}$/),
  appliedAt: DateTimeSchema,
  effect: z.enum(["pending", "applied", "failed"]),
  lastEffectAt: DateTimeSchema.nullable(),
  effectAttempts: z.number().int().nonnegative().max(100_000),
  providerCode: z.string().min(1).max(120).regex(/^[A-Z0-9][A-Z0-9_.:-]*$/).nullable(),
  providerRequestId: z.string().min(1).max(200).regex(/^[A-Za-z0-9._:-]+$/).nullable(),
}).strict();
export type PublicOfferingProjectionInvalidationReceipt = z.infer<typeof PublicOfferingProjectionInvalidationReceiptSchema>;
