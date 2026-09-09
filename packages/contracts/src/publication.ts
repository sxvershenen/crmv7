import { z } from "zod";
import { DateTimeSchema, IdSchema, VersionSchema } from "./primitives.js";

export const ReleaseStateSchema = z.enum(["draft", "validating", "ready", "publishing", "published", "failed", "superseded"]);

export const ReleaseDependencyRefSchema = z.object({
  type: z.enum(["node_revision", "block_revision", "media_asset", "code_artifact", "crm_projection"]),
  id: IdSchema,
  version: z.string().min(1).max(120),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
}).strict();
export type ReleaseDependencyRef = z.infer<typeof ReleaseDependencyRefSchema>;

export const ReleaseRouteSchema = z.object({
  path: z.string().min(1).max(2048).regex(/^\/(?:[^?#]*)$/),
  nodeId: IdSchema,
  revisionId: IdSchema,
  resolvedContentHash: z.string().regex(/^[a-f0-9]{64}$/),
  dependencyRefs: z.array(ReleaseDependencyRefSchema).max(1000),
}).strict();

export const ReleaseManifestSchema = z.object({
  id: IdSchema,
  sequence: VersionSchema,
  state: ReleaseStateSchema,
  baseReleaseId: IdSchema.nullable(),
  routes: z.array(ReleaseRouteSchema).min(1).max(20_000),
  manifestHash: z.string().regex(/^[a-f0-9]{64}$/),
  createdBy: IdSchema,
  createdAt: DateTimeSchema,
  publishedAt: DateTimeSchema.nullable(),
}).strict();
export type ReleaseManifest = z.infer<typeof ReleaseManifestSchema>;

export const ReleaseValidationIssueSchema = z.object({
  severity: z.enum(["error", "warning"]),
  code: z.string().min(1).max(120).regex(/^[A-Z0-9_]+$/),
  message: z.string().min(1).max(1000),
  route: z.string().max(2048).optional(),
  dependency: ReleaseDependencyRefSchema.optional(),
}).strict();
export type ReleaseValidationIssue = z.infer<typeof ReleaseValidationIssueSchema>;

export const ReleaseValidationResultSchema = z.object({
  releaseId: IdSchema,
  valid: z.boolean(),
  issues: z.array(ReleaseValidationIssueSchema).max(10_000),
  checkedAt: DateTimeSchema,
}).strict();
export type ReleaseValidationResult = z.infer<typeof ReleaseValidationResultSchema>;

export const CmsReleaseBuildInputSchema = z.object({
  operationId: IdSchema,
  idempotencyKey: z.string().min(16).max(255).regex(/^[A-Za-z0-9._~-]+$/),
  /** Revisions are pinned by UUID; only approved revisions may enter a new release. */
  revisionIds: z.array(IdSchema).min(1).max(20_000),
  /** Explicit omission only. Archiving a node never mutates the active release. */
  removeNodeIds: z.array(IdSchema).max(20_000).default([]),
}).strict().superRefine((value, context) => {
  if (new Set(value.revisionIds).size !== value.revisionIds.length) context.addIssue({ code: "custom", path: ["revisionIds"], message: "Each revision may be selected once" });
  if (new Set(value.removeNodeIds).size !== value.removeNodeIds.length) context.addIssue({ code: "custom", path: ["removeNodeIds"], message: "Each node may be removed once" });
});
export type CmsReleaseBuildInput = z.infer<typeof CmsReleaseBuildInputSchema>;

export const CmsReleaseActivateInputSchema = z.object({
  operationId: IdSchema,
  idempotencyKey: z.string().min(16).max(255).regex(/^[A-Za-z0-9._~-]+$/),
  baseReleaseId: IdSchema.nullable(),
  expectedActiveReleaseVersion: VersionSchema,
}).strict();
export type CmsReleaseActivateInput = z.infer<typeof CmsReleaseActivateInputSchema>;

export const CmsReleaseIdParamsSchema = z.object({ id: IdSchema }).strict();
export type CmsReleaseIdParams = z.infer<typeof CmsReleaseIdParamsSchema>;

export const CmsReleaseDetailSchema = z.object({
  manifest: ReleaseManifestSchema,
  validation: ReleaseValidationResultSchema,
  activeReleaseId: IdSchema.nullable(),
  activeReleaseVersion: VersionSchema,
}).strict();
export type CmsReleaseDetail = z.infer<typeof CmsReleaseDetailSchema>;

export const CmsReleaseOutboxEventSchema = z.object({
  eventId: IdSchema,
  eventType: z.enum(["cms.release.built", "cms.release.published", "cms.release.rolled_back"]),
  occurredAt: DateTimeSchema,
  actorId: IdSchema,
  requestId: z.string().min(1).max(128),
  releaseId: IdSchema,
  baseReleaseId: IdSchema.nullable(),
  sequence: VersionSchema,
  affectedPaths: z.array(z.string().min(1).max(2048)).max(20_000),
}).strict();
export type CmsReleaseOutboxEvent = z.infer<typeof CmsReleaseOutboxEventSchema>;

export const ReleaseDeliverySchema = z.object({
  releaseId: IdSchema,
  status: z.enum(["pending", "purging", "delivered", "failed"]),
  affectedPaths: z.array(z.string().min(1).max(2048)).max(20_000),
  attempts: z.number().int().nonnegative().max(100),
  lastError: z.string().max(2000).nullable(),
  deliveredAt: DateTimeSchema.nullable(),
}).strict();

export const PublishReleaseInputSchema = z.object({
  operationId: IdSchema,
  idempotencyKey: z.string().min(16).max(255).regex(/^[A-Za-z0-9._~-]+$/),
  releaseId: IdSchema,
  baseReleaseId: IdSchema.nullable(),
  expectedActiveReleaseVersion: VersionSchema,
  scheduledFor: DateTimeSchema.nullable().default(null),
}).strict();
