import { CMS_HOME_SECTION_KEYS, CmsHomeSectionDraftSchema, type CmsHomeSectionDraft, type CmsHomeSectionKey, type CmsSection } from "@crm/contracts"
import type { SectionConfig } from "@admin/entities/cms"

const labels: Record<CmsHomeSectionKey, string> = {
  events: "События", houses: "Домики", "sauna-chan": "Баня и чан", programs: "Программы", venues: "Площадки", blog: "Блог", reviews: "Отзывы", map: "Карта базы", faq: "FAQ", directions: "Как добраться", calculator: "Калькулятор",
}

const blankConfig = (key: CmsHomeSectionKey): CmsHomeSectionDraft => ({ eyebrow: null, title: labels[key], description: "", action: null })

export function isHomepageSectionRenderer(section: CmsSection): section is CmsSection {
  return CMS_HOME_SECTION_KEYS.includes(section.key as CmsHomeSectionKey) && section.renderer === "homepage-section" && section.rendererVersion === "1" && section.schemaVersion === 1
}

/** Complex inherited patches remain opaque: a form must not silently flatten them. */
export function homepageSectionDraft(section: CmsSection): CmsHomeSectionDraft | undefined {
  if (!isHomepageSectionRenderer(section)) return undefined
  const key = section.key as CmsHomeSectionKey
  if (section.policy.mode !== "override") return blankConfig(key)
  const { scalars, objects, keyedArrays } = section.policy.patch
  if (Object.keys(objects).length || Object.keys(keyedArrays).length) return undefined
  if (Object.entries(scalars).some(([field, patch]) => !["eyebrow", "title", "description", "action"].includes(field) || patch.operation !== "replace")) return undefined
  const values = Object.fromEntries(Object.entries(scalars).map(([field, patch]) => [field, patch.operation === "replace" ? patch.value : undefined]))
  const parsed = CmsHomeSectionDraftSchema.safeParse({ ...blankConfig(key), ...values })
  return parsed.success ? parsed.data : undefined
}

export function homepageSectionPolicy(config: CmsHomeSectionDraft): CmsSection["policy"] {
  return { mode: "override", patch: { scalars: {
    eyebrow: { operation: "replace", value: config.eyebrow },
    title: { operation: "replace", value: config.title },
    description: { operation: "replace", value: config.description },
    action: { operation: "replace", value: config.action },
  }, objects: {}, keyedArrays: {} } }
}

export function createHomepageSectionEditorSection(key: CmsHomeSectionKey): SectionConfig {
  return {
    id: crypto.randomUUID(), key, label: labels[key], description: "Заголовок, описание и действие секции",
    mode: "override", source: "Эта страница", sourceHref: "?tab=composition", effectiveTitle: labels[key], homepageConfig: blankConfig(key),
  }
}
