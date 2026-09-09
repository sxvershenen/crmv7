import { z } from "zod";
import { SeoMetadataSchema } from "./seo.js";
import { IdempotencyKeySchema, OperationIdSchema } from "./operations.js";
import { BoundedJsonValueSchema, DateTimeSchema, IdSchema, VersionSchema } from "./primitives.js";
import { ListingDefinitionSchema } from "./listing.js";

export const CmsPageKindSchema = z.enum([
  "home", "landing", "category", "resource_listing", "resource_detail", "addon_detail", "program_listing",
  "program_detail", "program_occurrence", "event_listing", "event_detail", "article_listing",
  "article", "information", "custom_code_page",
  "legal",
]);
export type CmsPageKind = z.infer<typeof CmsPageKindSchema>;

export const CmsRevisionStateSchema = z.enum([
  "draft", "review", "approved", "scheduled", "published", "superseded", "archived",
]);

export const CmsNodeStatusSchema = z.enum(["active", "archived"]);
export const CmsPathSchema = z.string().min(1).max(2048).regex(/^(?:\/$|\/(?:[a-z0-9]+(?:-[a-z0-9]+)*)(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*)$/, "Expected a canonical lowercase path without query, hash, duplicate slashes or trailing slash");

export const CmsNodeIdentitySchema = z.object({
  id: IdSchema,
  kind: CmsPageKindSchema,
  status: CmsNodeStatusSchema,
  createdAt: DateTimeSchema,
  updatedAt: DateTimeSchema,
  version: VersionSchema,
}).strict();
export type CmsNodeIdentity = z.infer<typeof CmsNodeIdentitySchema>;

export const CmsRoutePlacementSchema = z.object({
  path: CmsPathSchema,
  slug: z.string().min(1).max(180).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  parentNodeId: IdSchema.nullable(),
  sortOrder: z.number().int().min(-100000).max(100000),
}).strict();

export const CmsScalarPatchSchema = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("replace"), value: z.union([BoundedJsonValueSchema, ListingDefinitionSchema]) }).strict(),
  z.object({ operation: z.literal("reset") }).strict(),
]);

export const CmsObjectPatchSchema = z.object({
  operation: z.literal("merge"),
  values: z.record(z.string().min(1).max(120), CmsScalarPatchSchema),
}).strict();

const CmsKeyedArrayValueSchema = z.record(z.string().min(1).max(120), BoundedJsonValueSchema);
export const CmsKeyedArrayOperationSchema = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("insert"), key: z.string().min(1).max(120), afterKey: z.string().min(1).max(120).nullable(), value: CmsKeyedArrayValueSchema }).strict(),
  z.object({ operation: z.literal("update"), key: z.string().min(1).max(120), patch: CmsObjectPatchSchema }).strict(),
  z.object({ operation: z.literal("remove"), key: z.string().min(1).max(120) }).strict(),
  z.object({ operation: z.literal("move"), key: z.string().min(1).max(120), afterKey: z.string().min(1).max(120).nullable() }).strict(),
]);

export const CmsConfigPatchSchema = z.object({
  scalars: z.record(z.string().min(1).max(120), CmsScalarPatchSchema).default({}),
  objects: z.record(z.string().min(1).max(120), CmsObjectPatchSchema).default({}),
  keyedArrays: z.record(z.string().min(1).max(120), z.array(CmsKeyedArrayOperationSchema).max(200)).default({}),
}).strict();
export type CmsConfigPatch = z.infer<typeof CmsConfigPatchSchema>;

export const CmsSectionPolicySchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("inherit") }).strict(),
  z.object({ mode: z.literal("disabled") }).strict(),
  z.object({ mode: z.literal("override"), patch: CmsConfigPatchSchema }).strict(),
]);
export type CmsSectionPolicy = z.infer<typeof CmsSectionPolicySchema>;

export const CmsSectionSchema = z.object({
  id: IdSchema,
  key: z.string().min(1).max(120).regex(/^[a-z][a-z0-9-]*$/),
  renderer: z.string().min(1).max(120),
  rendererVersion: z.string().min(1).max(40),
  schemaVersion: z.number().int().positive(),
  policy: CmsSectionPolicySchema,
  order: z.number().int().min(-100000).max(100000),
  analyticsActionId: z.string().min(1).max(120).optional(),
}).strict();
export type CmsSection = z.infer<typeof CmsSectionSchema>;

export const CmsHeroActionSchema = z.object({
  id: IdSchema,
  label: z.string().min(1).max(120),
  href: z.string().min(1).max(2048),
  target: z.enum(["_self", "_blank"]).default("_self"),
  style: z.enum(["primary", "secondary", "link"]).default("primary"),
}).strict();

export const CmsHeroMediaSchema = z.object({
  assetId: IdSchema,
  alt: z.string().max(500).nullable().default(null),
  variants: z.array(z.object({
    url: z.string().min(1).max(2048).refine((value) => value.startsWith("/") || z.string().url().safeParse(value).success, "Expected a public URL or absolute public path"),
    format: z.enum(["webp", "avif", "original"]),
    width: z.number().int().positive().max(20000).nullable(),
    height: z.number().int().positive().max(20000).nullable(),
  }).strict()).min(1).max(20),
}).strict();

/** A complete page-level hero template. Operational values never live here. */
export const CmsHeroConfigSchema = z.object({
  variant: z.enum(["default", "compact", "media-left", "media-right", "fullscreen"]).default("default"),
  eyebrow: z.string().max(160).nullable().default(null),
  title: z.string().min(1).max(240),
  subtitle: z.string().max(1000).nullable().default(null),
  backgroundAssetId: IdSchema.nullable().default(null),
  foregroundAssetId: IdSchema.nullable().default(null),
  background: CmsHeroMediaSchema.nullable().default(null),
  foreground: CmsHeroMediaSchema.nullable().default(null),
  overlay: z.enum(["none", "soft", "medium", "strong"]).default("medium"),
  align: z.enum(["left", "center"]).default("left"),
  actions: z.array(CmsHeroActionSchema).max(4).default([]),
  slides: z.array(z.object({
    id: IdSchema,
    imageAssetId: IdSchema,
    image: CmsHeroMediaSchema.nullable().default(null),
    title: z.string().min(1).max(240),
    tagline: z.string().max(500).nullable().default(null),
    focalPoint: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }).strict().default({ x: 0.5, y: 0.5 }),
  }).strict()).max(5).default([]),
  badge: z.object({ label: z.string().min(1).max(160), icon: z.string().min(1).max(80).nullable().default(null) }).strict().nullable().default(null),
  featureCards: z.array(z.object({
    id: IdSchema,
    imageAssetId: IdSchema,
    image: CmsHeroMediaSchema.nullable().default(null),
    title: z.string().min(1).max(160),
    description: z.string().max(500).nullable().default(null),
    href: z.string().min(1).max(2048),
    target: z.enum(["_self", "_blank"]).default("_self"),
  }).strict()).max(4).default([]),
  autoplayMs: z.number().int().min(3000).max(30000).nullable().default(null),
}).strict();
export type CmsHeroConfig = z.infer<typeof CmsHeroConfigSchema>;

export const CmsHeroPolicySchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("inherit") }).strict(),
  z.object({ mode: z.literal("disabled") }).strict(),
  z.object({ mode: z.literal("override"), config: CmsHeroConfigSchema }).strict(),
]);
export type CmsHeroPolicy = z.infer<typeof CmsHeroPolicySchema>;

export const CmsSourceKindSchema = z.enum([
  "resource", "program_template", "program_occurrence", "event", "program_category", "event_category", "catalog_offering",
]);
export type CmsSourceKind = z.infer<typeof CmsSourceKindSchema>;
export const CmsSourceLinkSchema = z.object({
  sourceKind: CmsSourceKindSchema,
  sourceId: IdSchema,
  sourceVersion: VersionSchema,
  syncState: z.literal("draft"),
  createdAt: DateTimeSchema,
}).strict();
export type CmsSourceLink = z.infer<typeof CmsSourceLinkSchema>;

export const CmsPublicProfileKindSchema = z.enum([
  "resource", "program_template", "program_occurrence", "public_event_offering", "catalog_offering",
]);

export const CmsEntityRelationSchema = z.object({
  kind: CmsPublicProfileKindSchema,
  entityId: IdSchema,
}).strict();

export const CmsNodeRevisionSchema = z.object({
  id: IdSchema,
  nodeId: IdSchema,
  revision: VersionSchema,
  state: CmsRevisionStateSchema,
  route: CmsRoutePlacementSchema,
  title: z.string().min(1).max(240),
  summary: z.string().max(1000).nullable(),
  hero: CmsHeroPolicySchema.default({ mode: "inherit" }),
  sections: z.array(CmsSectionSchema).max(200),
  seo: SeoMetadataSchema,
  relations: z.array(CmsEntityRelationSchema).max(100).default([]),
  schemaVersion: VersionSchema,
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  createdBy: IdSchema,
  createdAt: DateTimeSchema,
}).strict();
export type CmsNodeRevision = z.infer<typeof CmsNodeRevisionSchema>;

export const CmsNodeMutationSchema = z.object({
  operationId: OperationIdSchema,
  idempotencyKey: IdempotencyKeySchema,
  expectedVersion: VersionSchema,
  route: CmsRoutePlacementSchema.optional(),
  title: z.string().min(1).max(240).optional(),
  summary: z.string().max(1000).nullable().optional(),
  hero: CmsHeroPolicySchema.optional(),
  sections: z.array(CmsSectionSchema).max(200).optional(),
  seo: SeoMetadataSchema.optional(),
  relations: z.array(CmsEntityRelationSchema).max(100).optional(),
}).strict().refine((value) => Object.keys(value).some((key) => !["operationId", "idempotencyKey", "expectedVersion"].includes(key)), {
  message: "At least one mutable field is required",
});
export type CmsNodeMutation = z.infer<typeof CmsNodeMutationSchema>;

export const CmsNodeCreateSchema = z.object({
  operationId: OperationIdSchema,
  idempotencyKey: IdempotencyKeySchema,
  kind: CmsPageKindSchema,
  route: CmsRoutePlacementSchema,
  title: z.string().min(1).max(240),
  summary: z.string().max(1000).nullable().default(null),
  hero: CmsHeroPolicySchema.default({ mode: "inherit" }),
  sections: z.array(CmsSectionSchema).max(200).default([]),
  seo: SeoMetadataSchema,
  relations: z.array(CmsEntityRelationSchema).max(100).default([]),
  schemaVersion: VersionSchema.default(1),
}).strict();
export type CmsNodeCreate = z.infer<typeof CmsNodeCreateSchema>;

export const CmsNodeListQuerySchema = z.object({
  q: z.string().trim().min(1).max(200).optional(),
  kind: CmsPageKindSchema.optional(),
  status: CmsNodeStatusSchema.optional(),
  cursor: z.string().min(1).max(2048).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
}).strict();
export type CmsNodeListQuery = z.infer<typeof CmsNodeListQuerySchema>;

export const CmsNodeIdParamsSchema = z.object({ id: IdSchema }).strict();
export type CmsNodeIdParams = z.infer<typeof CmsNodeIdParamsSchema>;

export const CmsNodeRevisionMetadataSchema = CmsNodeRevisionSchema.pick({
  id: true,
  nodeId: true,
  revision: true,
  state: true,
  route: true,
  title: true,
  contentHash: true,
  createdBy: true,
  createdAt: true,
}).strict();
export type CmsNodeRevisionMetadata = z.infer<typeof CmsNodeRevisionMetadataSchema>;

export const CmsNodeDetailSchema = z.object({
  node: CmsNodeIdentitySchema,
  currentRevision: CmsNodeRevisionSchema.nullable(),
  latestPublished: CmsNodeRevisionMetadataSchema.nullable(),
  source: CmsSourceLinkSchema.nullable(),
}).strict();
export type CmsNodeDetail = z.infer<typeof CmsNodeDetailSchema>;

export const CmsNodeListItemSchema = z.object({
  node: CmsNodeIdentitySchema,
  currentRevision: CmsNodeRevisionMetadataSchema.nullable(),
  latestPublished: CmsNodeRevisionMetadataSchema.nullable(),
  source: CmsSourceLinkSchema.nullable(),
}).strict();

export const CmsNodeListResponseSchema = z.object({
  items: z.array(CmsNodeListItemSchema),
  nextCursor: z.string().min(1).max(2048).nullable(),
}).strict();
export type CmsNodeListResponse = z.infer<typeof CmsNodeListResponseSchema>;

export const CmsNodeTransitionSchema = z.object({
  operationId: OperationIdSchema,
  idempotencyKey: IdempotencyKeySchema,
  expectedVersion: VersionSchema,
}).strict();
export type CmsNodeTransition = z.infer<typeof CmsNodeTransitionSchema>;

export const CmsNodeArchiveSchema = CmsNodeTransitionSchema.extend({}).strict();
export type CmsNodeArchive = z.infer<typeof CmsNodeArchiveSchema>;

/** One-click publication command; immutable releases remain an internal journal. */
export const CmsNodePublishSchema = CmsNodeTransitionSchema.extend({}).strict();
export type CmsNodePublish = z.infer<typeof CmsNodePublishSchema>;

export const CmsNodePublishResultSchema = z.object({
  node: CmsNodeIdentitySchema,
  publishedRevision: CmsNodeRevisionMetadataSchema,
  publishedAt: DateTimeSchema,
  publicationId: IdSchema,
  publicationVersion: VersionSchema,
}).strict();
export type CmsNodePublishResult = z.infer<typeof CmsNodePublishResultSchema>;

export const CmsContentEventTypeSchema = z.enum([
  "cms.content.node.created",
  "cms.content.revision.created",
  "cms.content.revision.submitted",
  "cms.content.revision.approved",
  "cms.content.revision.returned",
  "cms.content.node.archived",
]);
export const CmsContentOutboxEventSchema = z.object({
  eventId: IdSchema,
  eventType: CmsContentEventTypeSchema,
  occurredAt: DateTimeSchema,
  actorId: IdSchema,
  requestId: z.string().min(1).max(128),
  nodeId: IdSchema,
  nodeVersion: VersionSchema,
  revisionId: IdSchema.nullable(),
  revision: VersionSchema.nullable(),
  state: CmsRevisionStateSchema.nullable(),
}).strict();
export type CmsContentOutboxEvent = z.infer<typeof CmsContentOutboxEventSchema>;
