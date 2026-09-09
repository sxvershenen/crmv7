export const SITE_UI_RENDERER_VERSION = "site-ui@1" as const

export const SITE_SECTION_KEYS = [
  "hero",
  "events",
  "houses",
  "sauna-chan",
  "programs",
  "venues",
  "blog",
  "why-us",
  "reviews",
  "map",
  "faq",
  "directions",
  "calculator",
  "partners",
  "footer",
] as const

export type SiteSectionKey = (typeof SITE_SECTION_KEYS)[number]
export type InheritanceMode = "inherit" | "override" | "disabled"

export interface SectionArtifactDeclaration {
  rendererVersion: typeof SITE_UI_RENDERER_VERSION
  schemaVersion: 1
  sectionKeys: SiteSectionKey[]
  cmsFields: string[]
  assets: Array<{ id: string; usage: string; alt: string }>
  analyticsIds: string[]
  publicApi: string[]
}

export interface SectionRegistryEntry {
  key: SiteSectionKey
  schemaVersion: 1
  interactive: boolean
  defaultHydration: "none" | "visible" | "idle" | "load"
  inheritance: boolean
}

const interactive = new Set<SiteSectionKey>(["hero", "events", "houses", "sauna-chan", "programs", "venues", "reviews", "map", "faq", "calculator"])
const inherited = new Set<SiteSectionKey>(["hero", "map", "faq", "directions", "calculator", "footer"])

export const SITE_SECTION_REGISTRY: Readonly<Record<SiteSectionKey, SectionRegistryEntry>> = Object.fromEntries(
  SITE_SECTION_KEYS.map((key) => [key, { key, schemaVersion: 1, interactive: interactive.has(key), defaultHydration: interactive.has(key) ? "visible" : "none", inheritance: inherited.has(key) }]),
) as Record<SiteSectionKey, SectionRegistryEntry>

export function isSiteSectionKey(value: string): value is SiteSectionKey {
  return SITE_SECTION_KEYS.includes(value as SiteSectionKey)
}
