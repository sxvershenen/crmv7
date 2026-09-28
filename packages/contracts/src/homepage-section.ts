import { z } from "zod"
import { CmsHomeCardSchema, CmsHomeReviewDraftSchema, CmsPathSchema } from "./content.js"
import { PublicResolvedSectionSchema } from "./public-site.js"
import { IdSchema } from "./primitives.js"

export const CMS_HOME_SECTION_KEYS = [
  "events", "houses", "sauna-chan", "programs", "venues", "blog", "reviews", "map", "faq", "directions", "calculator",
] as const
export type CmsHomeSectionKey = (typeof CMS_HOME_SECTION_KEYS)[number]

const itemId = z.string().min(1).max(160)
const CmsHomeFaqDraftSchema = z.object({
  id: itemId, question: z.string().max(320), answer: z.string().max(4000),
}).strict()

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
  reviews: z.array(CmsHomeReviewDraftSchema).max(40).optional(),
  faq: z.array(CmsHomeFaqDraftSchema).max(40).optional(),
  /** Undefined preserves old automatic collections; a saved array is a manual selection. */
  selectedOfferingIds: z.array(IdSchema).max(12).refine((ids) => new Set(ids).size === ids.length, "Карточки не должны повторяться").optional(),
  /** Editorial visual cards for programs, sauna/chan and reviews. Prices remain CRM-owned. */
  cards: z.array(CmsHomeCardSchema).max(12).optional(),
}).strict()
export type CmsHomeSectionDraft = z.infer<typeof CmsHomeSectionDraftSchema>

export const CmsHomeSectionConfigSchema = CmsHomeSectionDraftSchema.superRefine((value, context) => {
  if (!value.title.trim()) context.addIssue({ code: "custom", path: ["title"], message: "Укажите заголовок секции" })
  if (value.action && !value.action.label.trim()) context.addIssue({ code: "custom", path: ["action", "label"], message: "Укажите подпись действия" })
  for (const [key, fields] of [["reviews", ["name", "text"]], ["faq", ["question", "answer"]]] as const) {
    const ids = new Set<string>()
    for (const [index, item] of (value[key] ?? []).entries()) {
      if (ids.has(item.id)) context.addIssue({ code: "custom", path: [key, index, "id"], message: "Элемент списка повторяется" })
      ids.add(item.id)
      for (const field of fields) {
        if (!String((item as Record<string, unknown>)[field]).trim()) context.addIssue({ code: "custom", path: [key, index, field], message: key === "reviews" ? "Заполните имя и текст отзыва" : "Заполните вопрос и ответ" })
      }
    }
  }
  const cardIds = new Set<string>()
  for (const [index, card] of (value.cards ?? []).entries()) {
    if (cardIds.has(card.id)) context.addIssue({ code: "custom", path: ["cards", index, "id"], message: "Карточка повторяется" })
    cardIds.add(card.id)
    if (!card.title.trim()) context.addIssue({ code: "custom", path: ["cards", index, "title"], message: "Укажите название карточки" })
    if (card.imageAssetId && !card.imageUrl) context.addIssue({ code: "custom", path: ["cards", index, "imageUrl"], message: "Выберите готовый публичный вариант изображения" })
    if (card.selectedOfferingIds && new Set(card.selectedOfferingIds).size !== card.selectedOfferingIds.length) context.addIssue({ code: "custom", path: ["cards", index, "selectedOfferingIds"], message: "Программа в направлении повторяется" })
  }
})
export type CmsHomeSectionConfig = z.infer<typeof CmsHomeSectionConfigSchema>

export const CmsHomeSectionSchema = PublicResolvedSectionSchema.extend({
  key: z.enum(CMS_HOME_SECTION_KEYS),
  renderer: z.literal("homepage-section"),
  rendererVersion: z.literal("1"),
  schemaVersion: z.literal(1),
  config: CmsHomeSectionConfigSchema,
}).superRefine((value, context) => {
  if (value.config.reviews !== undefined && value.key !== "reviews") context.addIssue({ code: "custom", path: ["config", "reviews"], message: "Отзывы доступны только в секции отзывов" })
  if (value.config.faq !== undefined && value.key !== "faq" && value.key !== "directions") context.addIssue({ code: "custom", path: ["config", "faq"], message: "Вопросы доступны только в секции FAQ" })
  if (value.config.selectedOfferingIds !== undefined && !["houses", "programs", "venues"].includes(value.key)) context.addIssue({ code: "custom", path: ["config", "selectedOfferingIds"], message: "Ручной выбор доступен только для домиков, программ и площадок" })
  if (value.config.cards !== undefined && !["programs", "sauna-chan", "reviews"].includes(value.key)) context.addIssue({ code: "custom", path: ["config", "cards"], message: "Карточки доступны только для программ, бани и отзывов" })
  if (value.key !== "programs" && value.config.cards?.some((card) => card.selectedOfferingIds !== undefined)) context.addIssue({ code: "custom", path: ["config", "cards"], message: "Выбор программ доступен только в направлениях" })
  if (value.key !== "reviews" && value.config.cards?.some((card) => card.videoUrl !== undefined)) context.addIssue({ code: "custom", path: ["config", "cards"], message: "Видео доступно только в отзывах" })
  if (value.key === "reviews") for (const [index, card] of (value.config.cards ?? []).entries()) {
    if (card.videoUrl && !card.imageUrl) context.addIssue({ code: "custom", path: ["config", "cards", index, "imageUrl"], message: "Для видео нужна обложка" })
  }
})

export const CmsHomeOfferingKindSchema = z.enum(["house", "program", "venue"])
export type CmsHomeOfferingKind = z.infer<typeof CmsHomeOfferingKindSchema>
export const CmsHomeOfferingChoiceQuerySchema = z.object({ kind: CmsHomeOfferingKindSchema, cursor: IdSchema.optional() }).strict()
export type CmsHomeOfferingChoiceQuery = z.infer<typeof CmsHomeOfferingChoiceQuerySchema>
export const CmsHomeOfferingChoiceListSchema = z.object({
  items: z.array(z.object({ offeringId: IdSchema, title: z.string().min(1).max(500), state: z.enum(["draft", "active", "paused"]) }).strict()).max(100),
  nextCursor: IdSchema.nullable(),
}).strict()
export type CmsHomeOfferingChoice = z.infer<typeof CmsHomeOfferingChoiceListSchema>["items"][number]

export function isCmsHomeSectionKey(value: string): value is CmsHomeSectionKey {
  return CMS_HOME_SECTION_KEYS.includes(value as CmsHomeSectionKey)
}
