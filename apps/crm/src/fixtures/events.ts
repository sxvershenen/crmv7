import type { Assignee } from "@crm/ui"

import type { CrmEvent, EventCategory } from "@app/entities/events"

export const eventAssigneesFixture: Assignee[] = [
  { id: "marina", initials: "МК", name: "Марина Кириллова", colorClass: "bg-sky-100 text-sky-700" },
  { id: "alexey", initials: "АВ", name: "Алексей Воронов", colorClass: "bg-violet-100 text-violet-700" },
  { id: "olga", initials: "ОС", name: "Ольга Семёнова", colorClass: "bg-emerald-100 text-emerald-700" },
]

const [marina, alexey, olga] = eventAssigneesFixture as [Assignee, Assignee, Assignee]

export const eventCategoriesFixture: EventCategory[] = [
  { id: "wedding", name: "Свадьба", description: "Свадебные мероприятия и банкеты", icon: "heart", tone: "rose", eventCount: 2 },
  { id: "corporate", name: "Корпоратив", description: "Командные и деловые мероприятия", icon: "building", tone: "violet", eventCount: 2 },
  { id: "birthday", name: "День рождения", description: "Личные и семейные праздники", icon: "cake", tone: "amber", eventCount: 2 },
  { id: "offsite", name: "Выездное мероприятие", description: "Самостоятельные мероприятия на выезде", icon: "bus", tone: "sky", eventCount: 2 },
]

export const eventsFixture: CrmEvent[] = [
  { id: "E-3108", name: "Свадьба Анны и Михаила", categoryId: "wedding", categoryName: "Свадьба", categoryIcon: "heart", categoryTone: "rose", clientName: "Анна Ковалёва", phone: "+7 921 450-12-40", startsAt: "2026-08-24T12:00:00+03:00", endsAt: "2026-08-24T22:00:00+03:00", guestCount: 72, status: "booked", total: 280000, paid: 180000, requiresAction: true, hasConflict: false, assignees: [marina, olga] },
  { id: "E-3110", name: "Летний корпоратив «Северного берега»", categoryId: "corporate", categoryName: "Корпоратив", categoryIcon: "building", categoryTone: "violet", clientName: "ООО «Северный берег»", phone: "+7 812 440-18-20", startsAt: "2026-08-24T16:00:00+03:00", endsAt: "2026-08-24T21:00:00+03:00", guestCount: 46, status: "in_work", total: 142000, paid: 48000, requiresAction: false, hasConflict: true, assignees: [alexey] },
  { id: "E-3112", name: "День рождения Варвары", categoryId: "birthday", categoryName: "День рождения", categoryIcon: "cake", categoryTone: "amber", clientName: "Елена Соколова", phone: "+7 911 203-44-70", startsAt: "2026-08-25T14:30:00+03:00", endsAt: "2026-08-25T19:00:00+03:00", guestCount: 18, status: "booked", total: 76000, paid: 76000, requiresAction: false, hasConflict: false, assignees: [olga] },
  { id: "E-3114", name: "Выездной тимбилдинг на берегу", categoryId: "offsite", categoryName: "Выездное мероприятие", categoryIcon: "bus", categoryTone: "sky", clientName: "АО «Маяк»", phone: "+7 812 505-22-11", startsAt: "2026-08-26T10:00:00+03:00", endsAt: "2026-08-26T17:30:00+03:00", guestCount: 34, status: "in_work", total: 118000, paid: 30000, requiresAction: true, hasConflict: false, assignees: [] },
  { id: "E-2908", name: "Юбилей семьи Волковых", categoryId: "birthday", categoryName: "День рождения", categoryIcon: "cake", categoryTone: "amber", clientName: "Игорь Волков", phone: "+7 921 770-82-10", startsAt: "2026-08-27T13:00:00+03:00", endsAt: "2026-08-27T19:00:00+03:00", guestCount: 25, status: "completed", total: 92000, paid: 92000, requiresAction: false, hasConflict: false, assignees: [marina] },
  { id: "E-2880", name: "Отменённая свадебная репетиция", categoryId: "wedding", categoryName: "Свадьба", categoryIcon: "heart", categoryTone: "rose", clientName: "Мария Иванова", phone: "+7 921 105-30-80", startsAt: "2026-08-28T11:00:00+03:00", endsAt: "2026-08-28T13:00:00+03:00", guestCount: 8, status: "cancelled", total: 18000, paid: 0, requiresAction: false, hasConflict: false, assignees: [] },
  { id: "E-2702", name: "Архивный корпоратив", categoryId: "corporate", categoryName: "Корпоратив", categoryIcon: "building", categoryTone: "violet", clientName: "ООО «Нева»", phone: "+7 812 330-12-55", startsAt: "2026-08-30T15:00:00+03:00", endsAt: "2026-08-30T20:00:00+03:00", guestCount: 39, status: "archived", total: 136000, paid: 136000, requiresAction: false, hasConflict: false, assignees: [alexey] },
  { id: "E-3120", name: "Выездное мероприятие с длинным названием для проверки переполнения", categoryId: "offsite", categoryName: "Выездное мероприятие", categoryIcon: "bus", categoryTone: "sky", clientName: "Дмитрий Орлов", phone: "+7 900 555-19-20", startsAt: "2026-08-30T09:30:00+03:00", endsAt: "2026-08-30T16:00:00+03:00", guestCount: 21, status: "in_work", total: 88000, paid: 22000, requiresAction: true, hasConflict: false, assignees: [] },
]
