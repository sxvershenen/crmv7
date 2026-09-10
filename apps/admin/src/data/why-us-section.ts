import { CmsWhyUsSectionDraftSchema, type CmsSection, type CmsWhyUsSectionDraft } from "@crm/contracts"
import type { SectionConfig } from "@admin/entities/cms"

const blankConfig = (): CmsWhyUsSectionDraft => ({
  eyebrow: "Почему мы",
  title: "Почему выбирают нас",
  description: "",
  facts: [],
  team: { label: "Команда «Зажигай»", title: "", description: "" },
})

export function isWhyUsRenderer(section: CmsSection): boolean {
  return section.key === "why-us" && section.renderer === "why-us" && section.rendererVersion === "1" && section.schemaVersion === 1
}

/** Complex inherited patches remain opaque: a form must not silently flatten them. */
export function whyUsDraft(section: CmsSection): CmsWhyUsSectionDraft | undefined {
  if (!isWhyUsRenderer(section)) return undefined
  if (section.policy.mode !== "override") return blankConfig()
  const { scalars, objects, keyedArrays } = section.policy.patch
  if (Object.keys(objects).length || Object.keys(keyedArrays).length) return undefined
  if (Object.entries(scalars).some(([key, patch]) => !["eyebrow", "title", "description", "facts", "team"].includes(key) || patch.operation !== "replace")) return undefined
  const values = Object.fromEntries(Object.entries(scalars).map(([key, patch]) => [key, patch.operation === "replace" ? patch.value : undefined]))
  const parsed = CmsWhyUsSectionDraftSchema.safeParse({ ...blankConfig(), ...values })
  return parsed.success ? parsed.data : undefined
}

export function whyUsPolicy(config: CmsWhyUsSectionDraft): CmsSection["policy"] {
  return { mode: "override", patch: { scalars: {
    eyebrow: { operation: "replace", value: config.eyebrow },
    title: { operation: "replace", value: config.title },
    description: { operation: "replace", value: config.description },
    facts: { operation: "replace", value: config.facts },
    team: { operation: "replace", value: config.team },
  }, objects: {}, keyedArrays: {} } }
}

export function createWhyUsEditorSection(): SectionConfig {
  return {
    id: crypto.randomUUID(), key: "why-us", label: "Why us", description: "Заголовок, факты и командный блок",
    mode: "override", source: "Эта страница", sourceHref: "?tab=composition", effectiveTitle: "Почему выбирают нас", whyUsConfig: blankConfig(),
  }
}
