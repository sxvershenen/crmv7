import {
  canonicalPublicPath,
  type CmsHeroConfig,
  type CmsSiteSettingsValue,
  type PublicPage,
  type PublicSiteSettings,
} from "@crm/contracts"
import type {
  SiteNavigationChild,
  SiteNavigationConfig,
  SiteNavigationIcon,
  SiteNavigationItem,
  SiteHeroConfig,
  SiteHeroCta,
} from "@crm/site-ui"
import { DEFAULT_HERO_CONFIG, DEFAULT_PUBLIC_NAVIGATION } from "../../data/publicContentDefaults"
import { createPublicContentSource, resolvePublishedRoute, usesFixtureContent } from "./source"

const iconNames = new Set<SiteNavigationIcon>([
  "home", "flame", "sparkles", "layers", "calendar", "compass", "map-pin", "calculator", "arrow-right",
])

function publicApiBaseUrl() {
  return (import.meta.env.CMS_PUBLIC_API_BASE_URL || "http://127.0.0.1:3000/api/public/v1").replace(/\/$/, "")
}

export const fixtureContentEnabled = usesFixtureContent(import.meta.env)

export function getPublishedRoute(pathname: string, searchParams = new URLSearchParams()) {
  return resolvePublishedRoute(createPublicContentSource(publicApiBaseUrl()), pathname, searchParams)
}

export function getPublishedRouteManifest() {
  if (fixtureContentEnabled) return Promise.resolve({
    status: "published" as const,
    value: {
      releaseId: "00000000-0000-4000-8000-000000000001",
      generatedAt: "2026-01-01T00:00:00.000Z",
      routes: [{ path: "/" as const, lastModified: "2026-01-01T00:00:00.000Z", schemaTypes: ["WebSite"] }],
      redirects: [],
      cache: { etag: '"fixture-routes"', maxAgeSeconds: 0, staleWhileRevalidateSeconds: 0, tags: ["fixture"] },
    },
  })
  return createPublicContentSource(publicApiBaseUrl()).manifest()
}

export async function getPublishedRedirect(pathname: string) {
  const destinationPath = canonicalPublicPath(pathname)
  if (destinationPath === pathname) return { status: "not_redirect" as const }
  const manifest = await getPublishedRouteManifest()
  if (manifest.status !== "published") return manifest
  const redirect = manifest.value.redirects.find((candidate) => candidate.sourcePath === pathname && candidate.destinationPath === destinationPath)
  return redirect ? { status: "published" as const, value: redirect } : { status: "not_found" as const }
}

/** Legacy static blog/resource routes migrate separately from the CMS route adapter. */
export async function getPublishedSiteSettings(): Promise<PublicSiteSettings | null> {
  if (fixtureContentEnabled) return null
  const result = await createPublicContentSource(publicApiBaseUrl()).settings()
  return result.status === "published" ? result.value : null
}

export function toSiteStructuredData(bindings: PublicPage["seo"]["structuredData"]): Array<Record<string, unknown>> {
  return bindings
    .filter((binding) => binding.enabled)
    .map((binding) => ({
      ...binding.payload,
      "@context": "https://schema.org",
      "@type": binding.schemaType,
    }))
}

type CmsNavigationItem = CmsSiteSettingsValue["headerNavigation"][number]
type CmsNavigationChild = CmsNavigationItem["children"][number]
type NavigationNode = CmsNavigationItem | CmsNavigationChild | CmsNavigationChild["children"][number]

function linkHref(item: NavigationNode): string {
  if (item.link.kind === "external") return item.link.url
  const anchor = (item.link as typeof item.link & { anchor?: string | null }).anchor
  return anchor ? `${item.link.path}#${anchor}` : item.link.path
}

function iconName(value: string | null): SiteNavigationIcon {
  return value && iconNames.has(value as SiteNavigationIcon) ? value as SiteNavigationIcon : "arrow-right"
}

function childView(item: NavigationNode): SiteNavigationChild {
  return {
    id: item.id,
    label: item.label,
    href: linkHref(item),
    icon: iconName(item.icon),
    ...(item.color ? { color: item.color } : {}),
    ...((item.target === "_blank" || item.link.kind === "external") ? { external: true } : {}),
    children: item.children.map(childView),
  }
}

function itemView(item: CmsNavigationItem): SiteNavigationItem {
  return {
    id: item.id,
    label: item.label,
    href: linkHref(item),
    icon: iconName(item.icon),
    color: item.color ?? "#2B9E47",
    children: item.children.filter((child) => child.enabled).map(childView),
    ...((item.target === "_blank" || item.link.kind === "external") ? { external: true } : {}),
  }
}

export function toSiteNavigation(settings: PublicSiteSettings): SiteNavigationConfig {
  const header = settings.value.headerNavigation
    .filter((item) => item.enabled && item.visibleOn !== "mobile")
    .map(itemView)
  const mobileSource = settings.value.mobileNavigation.length
    ? settings.value.mobileNavigation
    : settings.value.headerNavigation
  return {
    brand: {
      ...DEFAULT_PUBLIC_NAVIGATION.brand,
      title: settings.value.siteName.toLocaleUpperCase("ru-RU"),
    },
    items: header,
    mobileItems: mobileSource
      .filter((item) => item.enabled && item.visibleOn !== "desktop")
      .map(itemView),
  }
}

export function toFooterNavigation(settings: PublicSiteSettings): SiteNavigationItem[] {
  return settings.value.footerNavigation.filter((item) => item.enabled).map(itemView)
}

function mediaUrl(media: CmsHeroConfig["background"]): string | null {
  if (!media) return null
  return [...media.variants]
    .sort((left, right) => {
      const formatRank = (value: string) => value === "avif" ? 3 : value === "webp" ? 2 : 1
      return formatRank(right.format) - formatRank(left.format) || (right.width ?? 0) - (left.width ?? 0)
    })[0]?.url ?? null
}

function heroAction(action: CmsHeroConfig["actions"][number] | undefined, fallback: SiteHeroCta): SiteHeroCta {
  if (!action) return fallback
  if (/^(?:booking:|#booking$)/.test(action.href)) return { label: action.label, action: "booking" }
  if (/^(?:tel:|call:|#call$)/.test(action.href)) return { label: action.label, action: "call" }
  if (action.href.startsWith("#") || action.href.startsWith("/#")) return { label: action.label, action: "navigate", target: action.href.replace(/^\/?#/, "") }
  return { label: action.label, action: "link", target: action.href }
}

export function toSiteHero(hero: CmsHeroConfig): SiteHeroConfig {
  const overlay = {
    none: { from: 0, via: 0, to: 0 },
    soft: { from: 55, via: 25, to: 15 },
    medium: DEFAULT_HERO_CONFIG.overlay,
    strong: { from: 92, via: 65, to: 45 },
  }[hero.overlay]
  const background = mediaUrl(hero.background)
  const slides = hero.slides.length
    ? hero.slides.map((slide, index) => ({
        id: slide.id,
        image: mediaUrl(slide.image) ?? DEFAULT_HERO_CONFIG.slides[index % DEFAULT_HERO_CONFIG.slides.length]!.image,
        imageAlt: slide.image?.alt ?? slide.title,
        title: slide.title,
        tagline: slide.tagline ?? hero.subtitle ?? "",
        focalPoint: { x: slide.focalPoint.x * 100, y: slide.focalPoint.y * 100 },
      }))
    : [{
        ...DEFAULT_HERO_CONFIG.slides[0]!,
        image: background ?? DEFAULT_HERO_CONFIG.slides[0]!.image,
        imageAlt: hero.background?.alt ?? hero.title,
        title: hero.title,
        tagline: hero.subtitle ?? "",
      }]
  return {
    enabled: true,
    badge: hero.badge?.label ?? "",
    title: hero.title,
    slides,
    primaryCta: heroAction(hero.actions[0], DEFAULT_HERO_CONFIG.primaryCta),
    secondaryCta: heroAction(hero.actions[1], DEFAULT_HERO_CONFIG.secondaryCta),
    featureCards: hero.featureCards.map((card, index) => ({
      id: card.id,
      title: card.title,
      description: card.description ?? "",
      image: mediaUrl(card.image) ?? DEFAULT_HERO_CONFIG.featureCards[index % DEFAULT_HERO_CONFIG.featureCards.length]!.image,
      imageAlt: card.image?.alt ?? card.title,
      href: card.href,
      accent: index === 0 ? "brand" : "neutral",
    })),
    overlay,
    autoplayMs: hero.autoplayMs ?? 0,
  }
}
