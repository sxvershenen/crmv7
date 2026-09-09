import { z } from "zod";
import { BoundedJsonValueSchema, IdSchema } from "./primitives.js";

export const SearchIndexPolicySchema = z.enum(["index_follow", "noindex_follow", "noindex_nofollow"]);
export type SearchIndexPolicy = z.infer<typeof SearchIndexPolicySchema>;

export const CanonicalPolicySchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("self") }).strict(),
  z.object({ mode: z.literal("custom"), url: z.string().url().max(2048) }).strict(),
]);

export const SocialMetadataSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  description: z.string().min(1).max(300).optional(),
  imageAssetId: IdSchema.optional(),
  imageAlt: z.string().min(1).max(300).optional(),
}).strict();

export const StructuredDataBindingSchema = z.object({
  id: IdSchema,
  schemaType: z.string().min(1).max(120),
  enabled: z.boolean().default(true),
  payload: z.record(z.string().min(1).max(120), BoundedJsonValueSchema),
}).strict();

export const SeoMetadataSchema = z.object({
  title: z.string().min(1).max(70),
  description: z.string().min(1).max(320),
  indexPolicy: SearchIndexPolicySchema.default("index_follow"),
  canonical: CanonicalPolicySchema.default({ mode: "self" }),
  social: SocialMetadataSchema.optional(),
  structuredData: z.array(StructuredDataBindingSchema).max(20).default([]),
}).strict();
export type SeoMetadata = z.infer<typeof SeoMetadataSchema>;

export const SeoValidationIssueSchema = z.object({
  severity: z.enum(["error", "warning"]),
  code: z.enum([
    "TITLE_MISSING", "TITLE_LENGTH", "DESCRIPTION_MISSING", "DESCRIPTION_LENGTH",
    "CANONICAL_INVALID", "SOCIAL_IMAGE_MISSING", "STRUCTURED_DATA_INVALID", "ROUTE_NOT_INDEXABLE",
  ]),
  message: z.string().min(1).max(500),
  pointer: z.string().min(1).max(500).optional(),
}).strict();
export type SeoValidationIssue = z.infer<typeof SeoValidationIssueSchema>;
