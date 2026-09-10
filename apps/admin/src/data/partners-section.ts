import { CmsPartnersSectionDraftSchema, type CmsPartnersSectionDraft, type CmsSection } from "@crm/contracts"
import type { SectionConfig } from "@admin/entities/cms"

const blankConfig = (): CmsPartnersSectionDraft => ({ title: "Наши партнёры", description: "", items: [] })

export function isPartnersRenderer(section: CmsSection): boolean {
  return section.key === "partners" && section.renderer === "partners" && section.rendererVersion === "1" && section.schemaVersion === 1
}

/** Complex inherited patches remain opaque: a form must not silently flatten them. */
export function partnersDraft(section: CmsSection): CmsPartnersSectionDraft | undefined {
  if (!isPartnersRenderer(section)) return undefined
  if (section.policy.mode !== "override") return blankConfig()
  const { scalars, objects, keyedArrays } = section.policy.patch
  if (Object.keys(objects).length || Object.keys(keyedArrays).length) return undefined
  if (Object.entries(scalars).some(([key, patch]) => !["title", "description", "items"].includes(key) || patch.operation !== "replace")) return undefined
  const values = Object.fromEntries(Object.entries(scalars).map(([key, patch]) => [key, patch.operation === "replace" ? patch.value : undefined]))
  const parsed = CmsPartnersSectionDraftSchema.safeParse({ ...blankConfig(), ...values })
  return parsed.success ? parsed.data : undefined
}

export function partnersPolicy(config: CmsPartnersSectionDraft): CmsSection["policy"] {
  return { mode: "override", patch: { scalars: {
    title: { operation: "replace", value: config.title },
    description: { operation: "replace", value: config.description },
    items: { operation: "replace", value: config.items },
  }, objects: {}, keyedArrays: {} } }
}

export function createPartnersEditorSection(): SectionConfig {
  return {
    id: crypto.randomUUID(), key: "partners", label: "Партнёры", description: "Заголовок и упорядоченный список партнёров",
    mode: "override", source: "Эта страница", sourceHref: "?tab=composition", effectiveTitle: "Наши партнёры", partnersConfig: blankConfig(),
  }
}
