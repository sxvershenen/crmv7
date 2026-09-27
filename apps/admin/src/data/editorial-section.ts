import type { CmsSection, PublicEditorialContentConfig } from "@crm/contracts"
import type { SectionConfig } from "@admin/entities/cms"

const emptyContent = (): PublicEditorialContentConfig => ({ heading: null, lead: null, blocks: [], links: [] })

export function isEditorialSection(section: CmsSection) {
  return section.renderer === "editorial-content" && section.rendererVersion === "1" && section.schemaVersion === 1
}

/** Leave unknown or complex patches untouched instead of flattening them into this form. */
export function editorialDraft(section: CmsSection): PublicEditorialContentConfig | undefined {
  if (!isEditorialSection(section)) return undefined
  if (section.policy.mode !== "override") return emptyContent()
  const { scalars, objects, keyedArrays } = section.policy.patch
  if (Object.keys(objects).length || Object.keys(keyedArrays).length) return undefined
  if (Object.entries(scalars).some(([field, patch]) => !["heading", "lead", "blocks", "links"].includes(field) || patch.operation !== "replace")) return undefined
  const values = Object.fromEntries(Object.entries(scalars).map(([field, patch]) => [field, patch.operation === "replace" ? patch.value : undefined]))
  const candidate: unknown = { ...emptyContent(), ...values }
  return isEditableDraft(candidate) ? candidate : undefined
}

export function editorialPolicy(config: PublicEditorialContentConfig): CmsSection["policy"] {
  return { mode: "override", patch: { scalars: {
    heading: { operation: "replace", value: config.heading },
    lead: { operation: "replace", value: config.lead },
    blocks: { operation: "replace", value: config.blocks },
    links: { operation: "replace", value: config.links },
  }, objects: {}, keyedArrays: {} } }
}

export function createEditorialSection(): SectionConfig {
  return {
    id: crypto.randomUUID(), key: "body", label: "Текст страницы", description: "Абзацы, подзаголовки, списки и ссылки",
    mode: "override", source: "Эта страница", sourceHref: "?tab=composition", effectiveTitle: "Текст страницы", editorialConfig: emptyContent(),
  }
}

function isEditableDraft(value: unknown): value is PublicEditorialContentConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const config = value as Record<string, unknown>
  if (Object.keys(config).some((key) => !["heading", "lead", "blocks", "links"].includes(key))) return false
  if (!(config.heading === null || typeof config.heading === "string") || !(config.lead === null || typeof config.lead === "string")) return false
  if (!Array.isArray(config.blocks) || !Array.isArray(config.links)) return false
  const blocksValid = config.blocks.every((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false
    const block = value as Record<string, unknown>
    if (block.type === "paragraph") return Object.keys(block).every((key) => ["type", "text"].includes(key)) && typeof block.text === "string"
    if (block.type === "heading") return Object.keys(block).every((key) => ["type", "level", "text"].includes(key)) && (block.level === "h2" || block.level === "h3") && typeof block.text === "string"
    if (block.type === "list") return Object.keys(block).every((key) => ["type", "items"].includes(key)) && Array.isArray(block.items) && block.items.every((item) => typeof item === "string")
    return false
  })
  return blocksValid && config.links.every((value) => value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).every((key) => ["label", "href"].includes(key)) && typeof value.label === "string" && typeof value.href === "string")
}
