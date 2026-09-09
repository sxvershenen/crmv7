export const SITE_NAVIGATION_ICONS = [
  "home",
  "flame",
  "sparkles",
  "layers",
  "calendar",
  "compass",
  "map-pin",
  "calculator",
  "arrow-right",
] as const

export type SiteNavigationIcon = (typeof SITE_NAVIGATION_ICONS)[number]

export interface SiteNavigationChild {
  id: string
  label: string
  description?: string
  href: string
  icon?: SiteNavigationIcon
  color?: string
  external?: boolean
  children?: SiteNavigationChild[]
}

export interface SiteNavigationItem {
  id: string
  label: string
  href: string
  icon: SiteNavigationIcon
  color: string
  description?: string
  children: SiteNavigationChild[]
  external?: boolean
}

export interface SiteBrandConfig {
  title: string
  subtitle: string
  mark: string
  href: string
  color: string
}

export interface SiteNavigationConfig {
  brand: SiteBrandConfig
  items: SiteNavigationItem[]
  mobileItems?: SiteNavigationItem[]
}

export interface SiteHeroSlide {
  id: string
  image: string
  imageAlt: string
  title: string
  tagline: string
  focalPoint?: { x: number; y: number }
}

export interface SiteHeroCta {
  label: string
  action: "booking" | "call" | "navigate" | "link"
  target?: string
}

export interface SiteHeroFeatureCard {
  id: string
  title: string
  description: string
  image: string
  imageAlt: string
  href: string
  accent: "brand" | "neutral"
}

export interface SiteHeroConfig {
  enabled: boolean
  badge: string
  title: string
  slides: SiteHeroSlide[]
  primaryCta: SiteHeroCta
  secondaryCta: SiteHeroCta
  featureCards: SiteHeroFeatureCard[]
  overlay: { from: number; via: number; to: number }
  autoplayMs: number
}

export interface SiteBottomSectionsConfig {
  map: "inherit" | "enabled" | "disabled"
  faqAndDirections: "inherit" | "enabled" | "disabled"
  calculator: "inherit" | "enabled" | "disabled"
  footer: "inherit" | "enabled" | "disabled"
}
