import { z } from "zod";

import { CmsHeroConfigSchema, CmsPathSchema } from "./content.js";
import { IdempotencyKeySchema, OperationIdSchema } from "./operations.js";
import { DateTimeSchema, IdSchema, VersionSchema } from "./primitives.js";
import { PublicResolvedSectionSchema } from "./public-site.js";

export const CmsNavigationLinkSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("internal"), path: CmsPathSchema, anchor: z.string().regex(/^[a-z][a-z0-9-]*$/).max(120).optional() }).strict(),
  z.object({ kind: z.literal("external"), url: z.string().url().max(2048) }).strict(),
]);

const NavBase = z.object({
  id: IdSchema,
  label: z.string().min(1).max(120),
  link: CmsNavigationLinkSchema,
  target: z.enum(["_self", "_blank"]).default("_self"),
  icon: z.string().min(1).max(80).regex(/^[a-z][a-z0-9-]*$/).nullable().default(null),
  color: z.string().min(1).max(80).regex(/^(?:#[0-9a-fA-F]{6}|[a-z][a-z0-9-]*)$/).nullable().default(null),
  visibleOn: z.enum(["all", "desktop", "mobile"]).default("all"),
  enabled: z.boolean().default(true),
});

export const CmsNavigationLeafSchema = NavBase.extend({ children: z.tuple([]).default([]) }).strict();
export const CmsNavigationChildSchema = NavBase.extend({ children: z.array(CmsNavigationLeafSchema).max(30).default([]) }).strict();
export const CmsNavigationItemSchema = NavBase.extend({ children: z.array(CmsNavigationChildSchema).max(30).default([]) }).strict();

export const CmsSiteSettingsValueSchema = z.object({
  siteName: z.string().min(1).max(160),
  headerNavigation: z.array(CmsNavigationItemSchema).max(30).default([]),
  mobileNavigation: z.array(CmsNavigationItemSchema).max(30).default([]),
  footerNavigation: z.array(CmsNavigationItemSchema).max(60).default([]),
  headerCta: z.object({ label: z.string().min(1).max(120), link: CmsNavigationLinkSchema, enabled: z.boolean() }).strict().nullable().default(null),
  heroDefault: CmsHeroConfigSchema.nullable().default(null),
  sectionDefaults: z.array(PublicResolvedSectionSchema).max(30).default([]),
}).strict();
export type CmsSiteSettingsValue = z.infer<typeof CmsSiteSettingsValueSchema>;

export const CmsMetrikaSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  counterId: z.string().trim().regex(/^[1-9][0-9]{0,19}$/).nullable().default(null),
}).strict().superRefine((value, context) => {
  if (value.enabled && value.counterId === null) {
    context.addIssue({ code: "custom", path: ["counterId"], message: "Counter ID is required when Yandex Metrika is enabled" });
  }
});
export type CmsMetrikaSettings = z.infer<typeof CmsMetrikaSettingsSchema>;

export const CmsSiteSettingsStoredValueSchema = CmsSiteSettingsValueSchema.extend({
  analytics: z.object({
    metrika: CmsMetrikaSettingsSchema.default({ enabled: false, counterId: null }),
  }).strict().default({ metrika: { enabled: false, counterId: null } }),
}).strict();
export type CmsSiteSettingsStoredValue = z.infer<typeof CmsSiteSettingsStoredValueSchema>;

export const CmsSiteSettingsRevisionSchema = z.object({
  id: IdSchema,
  revision: VersionSchema,
  state: z.enum(["draft", "published", "superseded"]),
  value: CmsSiteSettingsValueSchema,
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  createdBy: IdSchema,
  createdAt: DateTimeSchema,
}).strict();

export const CmsSiteSettingsDetailSchema = z.object({
  id: IdSchema,
  version: VersionSchema,
  draft: CmsSiteSettingsRevisionSchema.nullable(),
  published: CmsSiteSettingsRevisionSchema.nullable(),
}).strict();
export type CmsSiteSettingsDetail = z.infer<typeof CmsSiteSettingsDetailSchema>;

export const CmsSiteSettingsMutationSchema = z.object({
  operationId: OperationIdSchema,
  idempotencyKey: IdempotencyKeySchema,
  expectedVersion: VersionSchema,
  value: CmsSiteSettingsValueSchema,
}).strict();
export type CmsSiteSettingsMutation = z.infer<typeof CmsSiteSettingsMutationSchema>;

export const CmsSiteSettingsPublishSchema = z.object({
  operationId: OperationIdSchema,
  idempotencyKey: IdempotencyKeySchema,
  expectedVersion: VersionSchema,
}).strict();
export type CmsSiteSettingsPublish = z.infer<typeof CmsSiteSettingsPublishSchema>;

export const CmsMetrikaSettingsRevisionSchema = z.object({
  id: IdSchema,
  revision: VersionSchema,
  state: z.enum(["draft", "published", "superseded"]),
  value: CmsMetrikaSettingsSchema,
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  createdBy: IdSchema,
  createdAt: DateTimeSchema,
}).strict();

export const CmsMetrikaSettingsDetailSchema = z.object({
  id: IdSchema,
  version: VersionSchema,
  draft: CmsMetrikaSettingsRevisionSchema.nullable(),
  published: CmsMetrikaSettingsRevisionSchema.nullable(),
}).strict();
export type CmsMetrikaSettingsDetail = z.infer<typeof CmsMetrikaSettingsDetailSchema>;

export const CmsMetrikaSettingsMutationSchema = z.object({
  operationId: OperationIdSchema,
  idempotencyKey: IdempotencyKeySchema,
  expectedVersion: VersionSchema,
  value: CmsMetrikaSettingsSchema,
}).strict();
export type CmsMetrikaSettingsMutation = z.infer<typeof CmsMetrikaSettingsMutationSchema>;

export const CmsMetrikaSettingsPublishSchema = z.object({
  operationId: OperationIdSchema,
  idempotencyKey: IdempotencyKeySchema,
  expectedVersion: VersionSchema,
}).strict();
export type CmsMetrikaSettingsPublish = z.infer<typeof CmsMetrikaSettingsPublishSchema>;

export const PublicSiteSettingsSchema = z.object({
  releaseId: IdSchema,
  revisionId: IdSchema,
  contentVersion: z.string().regex(/^[a-f0-9]{64}$/),
  publishedAt: DateTimeSchema,
  value: CmsSiteSettingsStoredValueSchema,
}).strict();
export type PublicSiteSettings = z.infer<typeof PublicSiteSettingsSchema>;
