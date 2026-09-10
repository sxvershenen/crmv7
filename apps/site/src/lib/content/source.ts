import {
  PublicListingResultSchema,
  PublicHouseSummarySchema,
  PublicCampgroundSummarySchema,
  PublicAddOnSummarySchema,
  PublicVenueSummarySchema,
  CmsHomeSectionSchema,
  CmsPartnersSectionSchema,
  CmsWhyUsSectionSchema,
  isCmsHomeSectionKey,
  PublicPageSchema,
  PublicSiteSettingsSchema,
  type PublicListingResult,
  type PublicHouseSummary,
  type PublicCampgroundSummary,
  type PublicAddOnSummary,
  type PublicVenueSummary,
  type PublicPage,
  type PublicSiteSettings,
} from "@crm/contracts"

export type ContentResult<T> =
  | { status: "published"; value: T }
  | { status: "not_found" }
  | { status: "unavailable" }

export interface ContentSource {
  page(path: string): Promise<ContentResult<PublicPage>>
  settings(): Promise<ContentResult<PublicSiteSettings>>
  listing(path: string, searchParams: URLSearchParams): Promise<ContentResult<PublicListingResult>>
  house(path: string): Promise<ContentResult<PublicHouseSummary>>
  campground(path: string): Promise<ContentResult<PublicCampgroundSummary>>
  addon(offeringId: string): Promise<ContentResult<PublicAddOnSummary>>
  venue(offeringId: string): Promise<ContentResult<PublicVenueSummary>>
}

export function createPublicContentSource(baseUrl: string, request: typeof fetch = fetch): ContentSource {
  async function document<T>(path: string, parse: (value: unknown) => T): Promise<ContentResult<T>> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 2_500)
    try {
      const response = await request(`${baseUrl.replace(/\/$/, "")}${path}`, {
        headers: { accept: "application/json" },
        signal: controller.signal,
        redirect: "error",
      })
      if (response.status === 404) {
        const body: unknown = await response.json()
        return body !== null && typeof body === "object" && "code" in body && body.code === "NOT_FOUND"
          ? { status: "not_found" }
          : { status: "unavailable" }
      }
      if (!response.ok) return { status: "unavailable" }
      return { status: "published", value: parse(await response.json()) }
    } catch {
      return { status: "unavailable" }
    } finally {
      clearTimeout(timeout)
    }
  }

  return {
    page(path) {
      const query = new URLSearchParams({ path, locale: "ru-RU" })
      return document(`/pages/resolve?${query}`, (value) => PublicPageSchema.parse(value))
    },
    settings() {
      return document("/site-settings", (value) => PublicSiteSettingsSchema.parse(value))
    },
    listing(path, searchParams) {
      const query = new URLSearchParams(searchParams)
      query.set("path", path)
      return document(`/listings/resolve?${query}`, (value) => PublicListingResultSchema.parse(value))
    },
    house(path) {
      const query = new URLSearchParams({ path })
      return document(`/offerings/houses/detail?${query}`, (value) => PublicHouseSummarySchema.parse(value))
    },
    campground(path) {
      const query = new URLSearchParams({ path })
      return document(`/offerings/campgrounds/detail?${query}`, (value) => PublicCampgroundSummarySchema.parse(value))
    },
    addon(offeringId) {
      return document(`/offerings/addons/${encodeURIComponent(offeringId)}`, (value) => PublicAddOnSummarySchema.parse(value))
    },
    venue(offeringId) {
      return document(`/offerings/venues/${encodeURIComponent(offeringId)}`, (value) => PublicVenueSummarySchema.parse(value))
    },
  }
}

export type PublishedRoute = ContentResult<{
  page: PublicPage
  settings: PublicSiteSettings
  listing: PublicListingResult | null
  house: PublicHouseSummary | null
  campground: PublicCampgroundSummary | null
  addon: PublicAddOnSummary | null
  venue: PublicVenueSummary | null
}>

/** Each response reads the active pointer independently. Never render a mixed release. */
export async function resolvePublishedRoute(source: ContentSource, path: string, searchParams: URLSearchParams): Promise<PublishedRoute> {
  const [page, settings] = await Promise.all([source.page(path), source.settings()])
  if (settings.status !== "published") return { status: "unavailable" }
  if (page.status !== "published") return page
  if (page.value.path !== path || !page.value.freshness.ready || page.value.releaseId !== settings.value.releaseId) {
    return { status: "unavailable" }
  }
  const partners = page.value.sections.filter((section) => section.key === "partners" || section.renderer === "partners")
  const whyUs = page.value.sections.filter((section) => section.key === "why-us" || section.renderer === "why-us")
  const homepage = page.value.sections.filter((section) => isCmsHomeSectionKey(section.key))
  const uniqueHomepageKeys = new Set(homepage.map((section) => section.key))
  if (partners.length > 1 || partners.some((section) => !CmsPartnersSectionSchema.safeParse(section).success) || whyUs.length > 1 || whyUs.some((section) => !CmsWhyUsSectionSchema.safeParse(section).success) || homepage.length !== uniqueHomepageKeys.size || homepage.some((section) => !CmsHomeSectionSchema.safeParse(section).success)) {
    return { status: "unavailable" }
  }
  let listing: PublicListingResult | null = null
  if (page.value.sections.some((section) => section.renderer === "listing")) {
    const result = await source.listing(path, searchParams)
    if (result.status !== "published" || result.value.releaseId !== page.value.releaseId || result.value.canonicalPath !== path) {
      return { status: "unavailable" }
    }
    listing = result.value
  }
  let house: PublicHouseSummary | null = null
  if (page.value.kind === "resource_detail" && path.startsWith("/houses/")) {
    const result = await source.house(path)
    if (result.status !== "published" || result.value.releaseId !== page.value.releaseId || result.value.path !== path || result.value.title !== page.value.title) {
      return { status: "unavailable" }
    }
    house = result.value
  }
  let campground: PublicCampgroundSummary | null = null
  if (page.value.kind === "resource_detail" && path.startsWith("/campgrounds/")) {
    const result = await source.campground(path)
    if (result.status !== "published" || result.value.releaseId !== page.value.releaseId || result.value.path !== path || result.value.title !== page.value.title) {
      return { status: "unavailable" }
    }
    campground = result.value
  }
  let addon: PublicAddOnSummary | null = null
  if (page.value.kind === "addon_detail" && path.startsWith("/addons/")) {
    const dependency = page.value.dependencies.find((candidate) => candidate.type === "crm_projection" && candidate.version === "public.addon-summary.v1")
    if (!dependency) return { status: "unavailable" }
    const result = await source.addon(dependency.id)
    if (result.status !== "published" || result.value.offeringId !== dependency.id || result.value.sourceVersions.contentReleaseId !== page.value.releaseId || result.value.title !== page.value.title) {
      return { status: "unavailable" }
    }
    addon = result.value
  }
  let venue: PublicVenueSummary | null = null
  if (page.value.kind === "resource_detail" && path.startsWith("/venues/")) {
    const dependencies = page.value.dependencies.filter((candidate) => candidate.type === "crm_projection" && candidate.version === "public.venue-summary.v1")
    if (dependencies.length !== 1) return { status: "unavailable" }
    const dependency = dependencies[0]!
    const result = await source.venue(dependency.id)
    if (result.status !== "published" || result.value.offeringId !== dependency.id || result.value.sourceVersions.contentReleaseId !== page.value.releaseId || result.value.title !== page.value.title) {
      return { status: "unavailable" }
    }
    venue = result.value
  }
  return { status: "published", value: { page: page.value, settings: settings.value, listing, house, campground, addon, venue } }
}

export function usesFixtureContent(environment: { DEV?: boolean; SITE_CONTENT_SOURCE?: string }): boolean {
  return environment.DEV === true && environment.SITE_CONTENT_SOURCE === "fixture"
}
