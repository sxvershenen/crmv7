import {
  IconBath,
  IconBed,
  IconBuildingCottage,
  IconCalendarEvent,
  IconCalendarTime,
  IconCampfire,
  IconCash,
  IconDashboard,
  IconDiscount2,
  IconHome,
  IconMap,
  IconMessageQuestion,
  IconPuzzle,
  IconSettings,
  IconSparkles,
  IconTargetArrow,
  IconTent,
  IconUsers,
  IconUsersGroup,
} from "@tabler/icons-react"

export const navGroups = [
  {
    label: "CRM",
    items: [
      { label: "Обзор", href: "/", icon: IconDashboard },
      { label: "Заявки", href: "/leads", icon: IconMessageQuestion },
      { label: "Бронирования", href: "/bookings", icon: IconCalendarEvent },
      { label: "Расписание ресурсов", href: "/schedule", icon: IconCalendarTime },
      { label: "Клиенты", href: "/customers", icon: IconUsers },
    ],
  },
  {
    label: "Ресурсы и расписание",
    items: [
      { label: "Домики", href: "/resources/houses", icon: IconBuildingCottage },
      { label: "Палаточный кемпинг", href: "/resources/camping", icon: IconTent },
      { label: "Баня и чан", href: "/resources/bath", icon: IconBath },
      { label: "Площадки", href: "/resources/venues", icon: IconMap },
      { label: "Допы и услуги", href: "/offers/addons", icon: IconPuzzle },
      { label: "Программы", href: "/programs", icon: IconSparkles },
      { label: "Мероприятия", href: "/events", icon: IconCampfire },
    ],
  },
  {
    label: "Управление",
    items: [
      { label: "Задачи", href: "/tasks", icon: IconTargetArrow },
      { label: "Финансы", href: "/finance", icon: IconCash },
      { label: "Маркетинг", href: "/marketing", icon: IconTargetArrow },
      { label: "Команда", href: "/team", icon: IconUsersGroup },
      { label: "Настройки CRM", href: "/settings", icon: IconSettings },
    ],
  },
] as const

export const quickCreateItems = [
  { label: "Бронирование", href: "/bookings/new", icon: IconBed },
  { label: "Заявку", href: "/leads/new", icon: IconMessageQuestion },
  { label: "Клиента", href: "/customers/new", icon: IconUsers },
  { label: "Задачу", href: "/tasks/new", icon: IconTargetArrow },
  { label: "Программу", href: "/programs/new", icon: IconSparkles },
  { label: "Мероприятие", href: "/events/new", icon: IconCampfire },
] as const

/**
 * Actions which are meaningful in the currently open operational section.
 * Keep these separate from the global list: the topbar and mobile sheet can
 * expose the same registry without duplicating route matching logic.
 */
export const contextualCreateItems = [
  { label: "Домик", href: "/resources/houses/new", icon: IconBuildingCottage, section: "/resources/houses" },
  { label: "Кемпинг", href: "/resources/camping/new", icon: IconTent, section: "/resources/camping" },
  { label: "SPA-ресурс", href: "/resources/bath/new", icon: IconBath, section: "/resources/bath" },
  { label: "Площадку", href: "/resources/venues/new", icon: IconMap, section: "/resources/venues" },
  { label: "Доп/услугу", href: "/offers/addons?create=1", icon: IconPuzzle, section: "/offers/addons" },
  { label: "Проведение", href: "/programs/runs/new", icon: IconCalendarEvent, section: "/programs" },
  { label: "Регистрацию", href: "/programs/registrations/new", icon: IconUsers, section: "/programs" },
  { label: "Промокод", href: "/marketing/promotions/new", icon: IconDiscount2, section: "/marketing" },
] as const

export function getQuickCreateItems(pathname: string) {
  const contextual = contextualCreateItems.filter((item) => pathname === item.section || pathname.startsWith(`${item.section}/`))
  return { contextual, global: quickCreateItems }
}

export const mobileNav = [
  { label: "Обзор", href: "/", icon: IconHome },
  { label: "Заявки", href: "/leads", icon: IconMessageQuestion },
  { label: "Брони", href: "/bookings", icon: IconCalendarEvent },
] as const

export function getSectionTitle(pathname: string) {
  if (pathname === "/") return "Обзор"
  if (pathname === "/dev/ui") return "UI и компоненты"
  if (pathname.startsWith("/profile")) return "Профиль"

  const allItems = navGroups.flatMap((group) => [...group.items])
  return allItems
    .filter((item) => item.href !== "/" && pathname.startsWith(item.href))
    .sort((left, right) => right.href.length - left.href.length)[0]?.label ?? "CRM"
}
