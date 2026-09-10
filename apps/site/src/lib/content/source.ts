import {
  PublicListingResultSchema,
  PublicPageSchema,
  PublicSiteSettingsSchema,
  type PublicListingResult,
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
  }
}

export type PublishedRoute = ContentResult<{
  page: PublicPage
  settings: PublicSiteSettings
  listing: PublicListingResult | null
}>

/** Each response reads the active pointer independently. Never render a mixed release. */
export async function resolvePublishedRoute(source: ContentSource, path: string, searchParams: URLSearchParams): Promise<PublishedRoute> {
  const [page, settings] = await Promise.all([source.page(path), source.settings()])
  if (settings.status !== "published") return { status: "unavailable" }
  if (page.status !== "published") return page
  if (page.value.path !== path || !page.value.freshness.ready || page.value.releaseId !== settings.value.releaseId) {
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
  return { status: "published", value: { page: page.value, settings: settings.value, listing } }
}

export function usesFixtureContent(environment: { DEV?: boolean; SITE_CONTENT_SOURCE?: string }): boolean {
  return environment.DEV === true && environment.SITE_CONTENT_SOURCE === "fixture"
}
