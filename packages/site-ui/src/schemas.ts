import { z } from "zod"
import { SITE_ACTIONS } from "./lib/analytics"
import { SITE_SECTION_KEYS, SITE_UI_RENDERER_VERSION } from "./section-registry"

export const analyticsIdSchema = z.string().regex(
  /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/,
  "Use a stable semantic ID such as home.hero.booking",
)

export const siteActionSchema = z.enum(SITE_ACTIONS)

export const focalPointSchema = z.object({
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
})

export const responsiveMediaSchema = z.object({
  src: z.string().min(1),
  alt: z.string(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  focalPoint: focalPointSchema.default({ x: 50, y: 50 }),
  sources: z.array(z.object({
    srcSet: z.string().min(1),
    media: z.string().optional(),
    type: z.enum(["image/webp", "image/avif"]).optional(),
  })).default([]),
})

export const ctaSchema = z.object({
  label: z.string().min(1),
  action: siteActionSchema,
  target: z.string().min(1),
  analyticsId: analyticsIdSchema,
})

export const inheritanceModeSchema = z.enum(["inherit", "override", "disabled"])

export const sectionConfigSchema = z.object({
  key: z.enum(SITE_SECTION_KEYS),
  schemaVersion: z.literal(1),
  mode: inheritanceModeSchema.default("inherit"),
  analyticsId: analyticsIdSchema.optional(),
})

export const sectionArtifactDeclarationSchema = z.object({
  rendererVersion: z.literal(SITE_UI_RENDERER_VERSION),
  schemaVersion: z.literal(1),
  sectionKeys: z.array(z.enum(SITE_SECTION_KEYS)),
  cmsFields: z.array(z.string().min(1)),
  assets: z.array(z.object({ id: z.string().min(1), usage: z.string().min(1), alt: z.string() })),
  analyticsIds: z.array(analyticsIdSchema),
  publicApi: z.array(z.string().min(1)),
})

export type SectionArtifactInput = z.input<typeof sectionArtifactDeclarationSchema>
export type SectionArtifact = z.output<typeof sectionArtifactDeclarationSchema>
