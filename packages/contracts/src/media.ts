import { z } from "zod";
import { DateTimeSchema, IdSchema, VersionSchema } from "./primitives.js";

export const MediaKindSchema = z.enum(["image", "svg", "video", "document"]);
export const MediaAssetStateSchema = z.enum(["uploading", "processing", "ready", "failed", "archived"]);

export const MediaVariantSchema = z.object({
  id: IdSchema,
  format: z.enum(["webp", "avif", "original"]),
  width: z.number().int().positive().max(20000).nullable(),
  height: z.number().int().positive().max(20000).nullable(),
  byteSize: z.number().int().nonnegative().safe(),
  url: z.string().min(1).max(2048).refine((value) => value.startsWith("/") || z.string().url().safeParse(value).success, "Expected a public URL or absolute public path"),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();

export const MediaAssetSchema = z.object({
  id: IdSchema,
  version: VersionSchema,
  kind: MediaKindSchema,
  state: MediaAssetStateSchema,
  title: z.string().min(1).max(240),
  alt: z.string().max(500).nullable(),
  caption: z.string().max(1000).nullable(),
  credit: z.string().max(500).nullable(),
  license: z.string().max(500).nullable(),
  tags: z.array(z.string().min(1).max(80)).max(50),
  focalPoint: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }).strict(),
  originalFilename: z.string().min(1).max(500),
  mimeType: z.string().min(1).max(255),
  byteSize: z.number().int().nonnegative().safe(),
  width: z.number().int().positive().max(20000).nullable(),
  height: z.number().int().positive().max(20000).nullable(),
  variants: z.array(MediaVariantSchema).max(50),
  usageCount: z.number().int().nonnegative(),
  publishedUsage: z.boolean(),
  archivedAt: DateTimeSchema.nullable(),
  createdAt: DateTimeSchema,
  updatedAt: DateTimeSchema,
}).strict();
export type MediaAsset = z.infer<typeof MediaAssetSchema>;

export const MediaUploadInitSchema = z.object({
  filename: z.string().min(1).max(500),
  mimeType: z.string().min(1).max(255),
  byteSize: z.number().int().positive().max(100_000_000),
  checksumSha256: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();

export const MediaUploadGrantSchema = z.object({
  uploadId: IdSchema,
  uploadUrl: z.string().url().max(4096),
  method: z.literal("PUT"),
  expiresAt: DateTimeSchema,
  requiredHeaders: z.record(z.string().min(1).max(120), z.string().max(2048)),
  maxByteSize: z.number().int().positive().safe(),
}).strict();

export const MediaAssetIdParamsSchema = z.object({ assetId: IdSchema }).strict();
export const MediaUploadIdParamsSchema = z.object({ uploadId: IdSchema }).strict();
export const MediaUploadTokenQuerySchema = z.object({ token: z.string().min(32).max(512) }).strict();

export const MediaAssetListQuerySchema = z.object({
  q: z.string().trim().min(1).max(200).optional(),
  state: MediaAssetStateSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
}).strict();

export const MediaAssetListResponseSchema = z.object({ items: z.array(MediaAssetSchema).max(100) }).strict();

export const MediaAssetMetadataMutationSchema = z.object({
  expectedVersion: VersionSchema,
  title: z.string().min(1).max(240),
  alt: z.string().max(500).nullable(),
  caption: z.string().max(1000).nullable().default(null),
  credit: z.string().max(500).nullable().default(null),
  license: z.string().max(500).nullable().default(null),
  tags: z.array(z.string().trim().min(1).max(80)).max(50).default([]),
  focalPoint: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }).strict().default({ x: 0.5, y: 0.5 }),
}).strict();

export const MediaAssetArchiveSchema = z.object({ expectedVersion: VersionSchema }).strict();

export const MediaUsageSchema = z.object({
  assetId: IdSchema,
  ownerType: z.enum(["cms_revision", "cms_site_settings_revision", "cms_block_revision", "code_artifact", "release"]),
  ownerId: IdSchema,
  pointer: z.string().min(1).max(1000),
  published: z.boolean(),
}).strict();

export const MediaAssetDetailSchema = z.object({
  asset: MediaAssetSchema,
  usages: z.array(MediaUsageSchema).max(10_000),
}).strict();

export type MediaAssetDetail = z.infer<typeof MediaAssetDetailSchema>;
export type MediaAssetListQuery = z.infer<typeof MediaAssetListQuerySchema>;
export type MediaAssetMetadataMutation = z.infer<typeof MediaAssetMetadataMutationSchema>;
export type MediaAssetArchive = z.infer<typeof MediaAssetArchiveSchema>;
export type MediaUploadInit = z.infer<typeof MediaUploadInitSchema>;
export type MediaUploadGrant = z.infer<typeof MediaUploadGrantSchema>;
export type MediaUsage = z.infer<typeof MediaUsageSchema>;
