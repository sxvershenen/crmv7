import { z } from "zod";
import { CmsHeroConfigSchema, CmsHeroMediaSchema, CmsHeroPolicySchema, CmsPageKindSchema, CmsPathSchema, CmsSectionSchema } from "./content.js";
import { ReleaseDependencyRefSchema } from "./publication.js";
import { SeoMetadataSchema } from "./seo.js";
import { BoundedJsonValueSchema, DateTimeSchema, IdSchema, MoneySchema } from "./primitives.js";
import { ListingDefinitionSchema } from "./listing.js";
export {
  ListingControlSchema,
  ListingDefinitionSchema,
  ListingFilterDefinitionSchema,
  ListingFilterOperatorSchema,
  ListingSortDefinitionSchema,
  ListingValueTypeSchema,
  type ListingDefinition,
  type ListingFilterDefinition,
} from "./listing.js";

export const PublicCardProjectionSchema = z.object({
  id: IdSchema,
  kind: z.enum(["resource", "program", "program_occurrence", "public_event_offering", "article"]),
  title: z.string().min(1).max(240),
  summary: z.string().max(1000).nullable(),
  hero: CmsHeroConfigSchema.nullable().default(null),
  href: CmsPathSchema,
  image: CmsHeroMediaSchema.nullable(),
  priceFrom: MoneySchema.nullable(),
  attributes: z.record(z.string().min(1).max(120), z.union([z.string(), z.number(), z.boolean(), z.null()])),
}).strict();
export type PublicCardProjection = z.infer<typeof PublicCardProjectionSchema>;

export const PublicListingQuerySchema = z.object({
  path: CmsPathSchema,
  page: z.number().int().min(1).max(10_000).default(1),
  sort: z.string().min(1).max(120).nullable().default(null),
  filters: z.record(z.string().min(1).max(80), z.string().min(1).max(500)).refine((value) => Object.keys(value).length <= 30, "Too many listing filters"),
}).strict();
export type PublicListingQuery = z.infer<typeof PublicListingQuerySchema>;

/** Wire-level GET query: every additional string key is interpreted as a ListingDefinition urlKey. */
export const PublicListingHttpQuerySchema = z.object({
  path: CmsPathSchema,
  page: z.coerce.number().int().min(1).max(10_000).optional(),
  sort: z.string().min(1).max(120).optional(),
}).catchall(z.string().min(1).max(500));

export const PublicListingResultSchema = z.object({
  definition: ListingDefinitionSchema,
  items: z.array(PublicCardProjectionSchema).max(100),
  page: z.number().int().positive(),
  totalPages: z.number().int().nonnegative(),
  totalItems: z.number().int().nonnegative(),
  appliedFilters: z.record(z.string(), z.string()),
  sortId: z.string().nullable(),
  canonicalPath: CmsPathSchema,
  robots: z.enum(["index_follow", "noindex_follow"]),
  releaseId: IdSchema,
  asOf: DateTimeSchema,
}).strict();
export type PublicListingResult = z.infer<typeof PublicListingResultSchema>;

export const PublicResolvedSectionSchema = z.object({
  id: IdSchema,
  key: z.string().min(1).max(120).regex(/^[a-z][a-z0-9-]*$/),
  renderer: z.string().min(1).max(120),
  rendererVersion: z.string().min(1).max(40),
  schemaVersion: z.number().int().positive(),
  order: z.number().int().min(-100000).max(100000),
  config: z.record(z.string().min(1).max(120), z.union([BoundedJsonValueSchema, ListingDefinitionSchema])),
  analyticsActionId: z.string().min(1).max(120).optional(),
}).strict();

export const PublicEditorialContentConfigSchema = z.object({
  heading: z.string().min(1).max(240).nullable().default(null),
  lead: z.string().min(1).max(1000).nullable().default(null),
  blocks: z.array(z.discriminatedUnion("type", [
    z.object({ type: z.literal("paragraph"), text: z.string().min(1).max(5000) }).strict(),
    z.object({ type: z.literal("heading"), level: z.enum(["h2", "h3"]), text: z.string().min(1).max(240) }).strict(),
    z.object({ type: z.literal("list"), items: z.array(z.string().min(1).max(1000)).min(1).max(50) }).strict(),
  ])).min(1).max(200),
  links: z.array(z.object({ label: z.string().min(1).max(160), href: CmsPathSchema }).strict()).max(30).default([]),
}).strict();
export type PublicEditorialContentConfig = z.infer<typeof PublicEditorialContentConfigSchema>;

export const PublicReleasePageContentSchema = z.object({
  kind: CmsPageKindSchema,
  path: CmsPathSchema,
  title: z.string().min(1).max(240),
  summary: z.string().max(1000).nullable(),
  hero: CmsHeroConfigSchema.nullable().default(null),
  sections: z.array(PublicResolvedSectionSchema).max(200),
  seo: SeoMetadataSchema,
}).strict();
export type PublicReleasePageContent = z.infer<typeof PublicReleasePageContentSchema>;

export const PublicPageSchema = z.object({
  nodeId: IdSchema,
  revisionId: IdSchema,
  releaseId: IdSchema,
  kind: CmsPageKindSchema,
  path: CmsPathSchema,
  title: z.string().min(1).max(240),
  summary: z.string().max(1000).nullable(),
  hero: CmsHeroConfigSchema.nullable().default(null),
  sections: z.array(PublicResolvedSectionSchema).max(200),
  seo: SeoMetadataSchema,
  dependencies: z.array(ReleaseDependencyRefSchema).max(1000),
  generatedAt: DateTimeSchema,
  cache: z.object({
    etag: z.string().min(1).max(200),
    maxAgeSeconds: z.number().int().nonnegative().max(86400),
    staleWhileRevalidateSeconds: z.number().int().nonnegative().max(604800),
    tags: z.array(z.string().min(1).max(200)).max(500),
  }).strict(),
  freshness: z.object({
    contentVersion: z.string().min(1).max(120),
    crmProjectionAsOf: DateTimeSchema.nullable(),
    ready: z.boolean(),
  }).strict(),
}).strict();
export type PublicPage = z.infer<typeof PublicPageSchema>;

/** Signed authoring snapshot. It is intentionally not a render-ready public page until inheritance is materialised. */
export const CmsPreviewDocumentSchema = z.object({
  nodeId: IdSchema,
  revisionId: IdSchema,
  kind: CmsPageKindSchema,
  path: CmsPathSchema,
  title: z.string().min(1).max(240),
  summary: z.string().max(1000).nullable(),
  hero: CmsHeroPolicySchema.default({ mode: "inherit" }),
  sections: z.array(CmsSectionSchema).max(200),
  seo: SeoMetadataSchema,
  renderable: z.literal(false),
  blockingIssues: z.array(z.literal("CMS_INHERITANCE_NOT_MATERIALIZED")).min(1).max(10),
  generatedAt: DateTimeSchema,
}).strict();
export type CmsPreviewDocument = z.infer<typeof CmsPreviewDocumentSchema>;

export const PublicPageResolveQuerySchema = z.object({
  path: CmsPathSchema,
  locale: z.literal("ru-RU").default("ru-RU"),
}).strict();
export type PublicPageResolveQuery = z.infer<typeof PublicPageResolveQuerySchema>;

export const CmsRevisionIdParamsSchema = z.object({ revisionId: IdSchema }).strict();
export type CmsRevisionIdParams = z.infer<typeof CmsRevisionIdParamsSchema>;

export const CmsPreviewTokenIssueSchema = z.object({
  /** A deliberately short browser-preview lifetime; the server additionally clamps it. */
  ttlSeconds: z.number().int().min(60).max(3600).default(900),
}).strict();
export type CmsPreviewTokenIssue = z.infer<typeof CmsPreviewTokenIssueSchema>;

export const CmsPreviewTokenResponseSchema = z.object({
  token: z.string().min(32).max(4096),
  expiresAt: DateTimeSchema,
  previewPath: CmsPathSchema,
}).strict();
export type CmsPreviewTokenResponse = z.infer<typeof CmsPreviewTokenResponseSchema>;

export const PublicPagePreviewQuerySchema = z.object({
  token: z.string().min(32).max(4096),
}).strict();
export type PublicPagePreviewQuery = z.infer<typeof PublicPagePreviewQuerySchema>;
