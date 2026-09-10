import { z } from "zod"
import { CmsPathSchema } from "./content.js"
import { PublicResolvedSectionSchema } from "./public-site.js"

export const CMS_HOME_SECTION_KEYS = [
  "events", "houses", "sauna-chan", "programs", "venues", "blog", "reviews", "map", "faq", "directions", "calculator",
] as const
export type CmsHomeSectionKey = (typeof CMS_HOME_SECTION_KEYS)[number]

const CmsHomeSectionActionSchema = z.object({
  label: z.string().max(120),
  href: CmsPathSchema,
}).strict()

/** Editorial fields shared by the approved homepage section renderers. */
export const CmsHomeSectionDraftSchema = z.object({
  eyebrow: z.string().max(160).nullable(),
  title: z.string().max(240),
  description: z.string().max(1000),
  action: CmsHomeSectionActionSchema.nullable(),
}).strict()
export type CmsHomeSectionDraft = z.infer<typeof CmsHomeSectionDraftSchema>

export const CmsHomeSectionConfigSchema = CmsHomeSectionDraftSchema.superRefine((value, context) => {
  if (!value.title.trim()) context.addIssue({ code: "custom", path: ["title"], message: "Укажите заголовок секции" })
  if (value.action && !value.action.label.trim()) context.addIssue({ code: "custom", path: ["action", "label"], message: "Укажите подпись действия" })
})
export type CmsHomeSectionConfig = z.infer<typeof CmsHomeSectionConfigSchema>

export const CmsHomeSectionSchema = PublicResolvedSectionSchema.extend({
  key: z.enum(CMS_HOME_SECTION_KEYS),
  renderer: z.literal("homepage-section"),
  rendererVersion: z.literal("1"),
  schemaVersion: z.literal(1),
  config: CmsHomeSectionConfigSchema,
})

export function isCmsHomeSectionKey(value: string): value is CmsHomeSectionKey {
  return CMS_HOME_SECTION_KEYS.includes(value as CmsHomeSectionKey)
}
