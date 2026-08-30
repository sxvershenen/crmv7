import {
  IconBath,
  IconBed,
  IconBuildingCottage,
  IconCalendarEvent,
  IconCalendarTime,
  IconCampfire,
  IconCash,
  IconDashboard,
  IconHome,
  IconMap,
  IconMessageQuestion,
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
      { label: "Баня и чан", href: "/resources/bath", icon: IconBath },
      { label: "Площадки", href: "/resources/venues", icon: IconMap },
      { label: "Палаточный кемпинг", href: "/resources/camping", icon: IconTent },
      { label: "Программы", href: "/programs", icon: IconSparkles },
      { label: "Мероприятия", href: "/events", icon: IconCampfire },
    ],
  },
  {
    label: "Управление",
    items: [
      { label: "Задачи", href: "/tasks", icon: IconTargetArrow },
      { label: "Финансы", href: "/finance", icon: IconCash },
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
