import {
  IconArticle, IconDashboard, IconFileAnalytics, IconFiles, IconLink,
  IconMap, IconPhoto, IconReportSearch, IconRoute, IconSettings, IconSitemap, IconSparkles,
  IconTemplate,
} from "@tabler/icons-react"
import type { Capabilities } from "@crm/contracts/capabilities"

export type AdminNavItem = { label: string; href: string; icon: React.ElementType; match?: string; capability?: keyof Capabilities }
export const navGroups: { label: string; items: AdminNavItem[] }[] = [
  { label: "Сайт", items: [
    { label: "Обзор", href: "/", icon: IconDashboard },
    { label: "Страницы сайта", href: "/content/tree", icon: IconSitemap, match: "/content" },
    { label: "Блог и материалы", href: "/content/articles", icon: IconArticle, match: "/content/articles" },
  ] },
  { label: "Оформление", items: [
    { label: "Глобальные секции", href: "/globals/sections", icon: IconTemplate },
    { label: "Меню и подвал", href: "/globals/navigation", icon: IconRoute },
    { label: "Медиа", href: "/media", icon: IconPhoto, match: "/media" },
  ] },
  { label: "Продвижение", items: [
    { label: "SEO", href: "/seo", icon: IconReportSearch, match: "/seo" },
    { label: "Маркетинг", href: "/marketing/campaigns", icon: IconSparkles },
    { label: "Редиректы", href: "/redirects", icon: IconLink, capability: "canManageRedirects" },
    { label: "Аналитика", href: "/analytics", icon: IconFileAnalytics, match: "/analytics", capability: "canViewAnalytics" },
  ] },
  { label: "Настройки", items: [
    { label: "Настройки сайта", href: "/settings/site", icon: IconSettings, capability: "canManageSiteSettings" },
  ] },
]

export const quickCreateItems: AdminNavItem[] = [
  { label: "Посадочную", href: "/content/pages/new", icon: IconFiles, capability: "canEditContent" },
  { label: "Статью", href: "/content/articles/new", icon: IconArticle, capability: "canEditContent" },
  { label: "Загрузить медиа", href: "/media?upload=1", icon: IconPhoto, capability: "canManageMedia" },
]

export const mobileNav: AdminNavItem[] = [
  { label: "Обзор", href: "/", icon: IconDashboard },
  { label: "Страницы", href: "/content/tree", icon: IconSitemap, match: "/content" },
  { label: "Создать", href: "/content/pages/new", icon: IconSparkles, capability: "canEditContent" },
  { label: "Медиа", href: "/media", icon: IconPhoto, match: "/media" },
  { label: "Меню", href: "/menu", icon: IconMap },
]

export function hasAdminCapability(capabilities: Capabilities, capability?: keyof Capabilities) {
  return capability === undefined || capabilities[capability] === true
}

export function routeTitle(pathname: string) {
  for (const group of navGroups) for (const item of group.items) if (pathname === item.href || (item.match && pathname.startsWith(item.match))) return item.label
  return pathname.includes("/new") ? "Новая запись" : "CMS"
}
