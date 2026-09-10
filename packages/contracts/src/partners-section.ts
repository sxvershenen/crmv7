import { z } from "zod"
import { IdSchema } from "./primitives.js"
import { PublicResolvedSectionSchema } from "./public-site.js"

/** Drafts may be incomplete; publication requires meaningful text and items. */
export const CmsPartnersSectionDraftSchema = z.object({
  title: z.string().max(160),
  description: z.string().max(320),
  items: z.array(z.object({ id: IdSchema, label: z.string().max(160) }).strict()).max(40),
}).strict()
export type CmsPartnersSectionDraft = z.infer<typeof CmsPartnersSectionDraftSchema>

export const CmsPartnersSectionConfigSchema = CmsPartnersSectionDraftSchema.superRefine((value, context) => {
  if (!value.title.trim()) context.addIssue({ code: "custom", path: ["title"], message: "Укажите заголовок секции" })
  if (!value.items.length) context.addIssue({ code: "custom", path: ["items"], message: "Добавьте хотя бы одного партнёра или скройте секцию" })
  const ids = new Set<string>()
  value.items.forEach((item, index) => {
    if (!item.label.trim()) context.addIssue({ code: "custom", path: ["items", index, "label"], message: "Укажите название партнёра" })
    if (ids.has(item.id)) context.addIssue({ code: "custom", path: ["items", index, "id"], message: "Партнёр повторяется" })
    ids.add(item.id)
  })
})
export type CmsPartnersSectionConfig = z.infer<typeof CmsPartnersSectionConfigSchema>

export const CmsPartnersSectionSchema = PublicResolvedSectionSchema.extend({
  key: z.literal("partners"),
  renderer: z.literal("partners"),
  rendererVersion: z.literal("1"),
  schemaVersion: z.literal(1),
  config: CmsPartnersSectionConfigSchema,
})
