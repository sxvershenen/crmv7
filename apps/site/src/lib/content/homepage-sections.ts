import {
  CmsHomeSectionSchema,
  CmsPartnersSectionSchema,
  CmsWhyUsSectionSchema,
  isCmsHomeSectionKey,
  type CmsHomeSectionConfig,
  type CmsHomeSectionKey,
  type CmsPartnersSectionConfig,
  type CmsWhyUsSectionConfig,
  type PublicPage,
} from "@crm/contracts"
import {
  DEFAULT_HOMEPAGE_SECTION_CONFIGS,
  DEFAULT_HOMEPAGE_SECTION_ORDER,
  DEFAULT_PARTNERS_CONFIG,
  DEFAULT_WHY_US_CONFIG,
  type HomepageSectionKey,
} from "../../data/publicContentDefaults"

export type HomepageSectionBinding =
  | { key: CmsHomeSectionKey; config: CmsHomeSectionConfig }
  | { key: "why-us"; config: CmsWhyUsSectionConfig }
  | { key: "partners"; config: CmsPartnersSectionConfig }

export function getHomepageSections(page: PublicPage | null, fixture: boolean): HomepageSectionBinding[] {
  if (fixture) return DEFAULT_HOMEPAGE_SECTION_ORDER.flatMap((key) => defaultBinding(key))
  const result: HomepageSectionBinding[] = []
  let locationRendered = false
  for (const section of (page?.sections ?? []).filter((candidate) => candidate.key !== "hero").sort((left, right) => left.order - right.order || left.key.localeCompare(right.key))) {
    if (section.key === "partners") result.push({ key: "partners", config: CmsPartnersSectionSchema.parse(section).config })
    else if (section.key === "why-us") result.push({ key: "why-us", config: CmsWhyUsSectionSchema.parse(section).config })
    else if (isCmsHomeSectionKey(section.key) && (section.key !== "faq" && section.key !== "directions" || !locationRendered)) {
      if (section.key === "faq" || section.key === "directions") locationRendered = true
      result.push({ key: section.key, config: CmsHomeSectionSchema.parse(section).config })
    }
  }
  return result
}

function defaultBinding(key: HomepageSectionKey): HomepageSectionBinding[] {
  if (key === "partners") return [{ key, config: DEFAULT_PARTNERS_CONFIG }]
  if (key === "why-us") return [{ key, config: DEFAULT_WHY_US_CONFIG }]
  return [{ key, config: DEFAULT_HOMEPAGE_SECTION_CONFIGS[key] }]
}
