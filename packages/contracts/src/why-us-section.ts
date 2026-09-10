import { z } from "zod"
import { PublicResolvedSectionSchema } from "./public-site.js"

const WhyUsFactSchema = z.object({
  id: z.string().min(1).max(80).regex(/^[a-z][a-z0-9-]*$/),
  number: z.string().max(40),
  title: z.string().max(160),
  description: z.string().max(600),
}).strict()

const WhyUsTeamSchema = z.object({
  label: z.string().max(160),
  title: z.string().max(240),
  description: z.string().max(500),
}).strict()

/** Drafts may be incomplete; publication requires meaningful trust copy. */
export const CmsWhyUsSectionDraftSchema = z.object({
  eyebrow: z.string().max(160),
  title: z.string().max(160),
  description: z.string().max(500),
  facts: z.array(WhyUsFactSchema).max(8),
  team: WhyUsTeamSchema,
}).strict()
export type CmsWhyUsSectionDraft = z.infer<typeof CmsWhyUsSectionDraftSchema>

export const CmsWhyUsSectionConfigSchema = CmsWhyUsSectionDraftSchema.superRefine((value, context) => {
  if (!value.eyebrow.trim()) context.addIssue({ code: "custom", path: ["eyebrow"], message: "Укажите надзаголовок секции" })
  if (!value.title.trim()) context.addIssue({ code: "custom", path: ["title"], message: "Укажите заголовок секции" })
  if (!value.facts.length) context.addIssue({ code: "custom", path: ["facts"], message: "Добавьте хотя бы один факт или скройте секцию" })
  const ids = new Set<string>()
  value.facts.forEach((fact, index) => {
    if (!fact.number.trim()) context.addIssue({ code: "custom", path: ["facts", index, "number"], message: "Укажите числовой акцент факта" })
    if (!fact.title.trim()) context.addIssue({ code: "custom", path: ["facts", index, "title"], message: "Укажите название факта" })
    if (!fact.description.trim()) context.addIssue({ code: "custom", path: ["facts", index, "description"], message: "Укажите описание факта" })
    if (ids.has(fact.id)) context.addIssue({ code: "custom", path: ["facts", index, "id"], message: "Факт повторяется" })
    ids.add(fact.id)
  })
  if (!value.team.label.trim()) context.addIssue({ code: "custom", path: ["team", "label"], message: "Укажите подпись командного блока" })
  if (!value.team.title.trim()) context.addIssue({ code: "custom", path: ["team", "title"], message: "Укажите заголовок командного блока" })
  if (!value.team.description.trim()) context.addIssue({ code: "custom", path: ["team", "description"], message: "Укажите описание командного блока" })
})
export type CmsWhyUsSectionConfig = z.infer<typeof CmsWhyUsSectionConfigSchema>

export const CmsWhyUsSectionSchema = PublicResolvedSectionSchema.extend({
  key: z.literal("why-us"),
  renderer: z.literal("why-us"),
  rendererVersion: z.literal("1"),
  schemaVersion: z.literal(1),
  config: CmsWhyUsSectionConfigSchema,
})
