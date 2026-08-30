import type { Assignee } from "@crm/ui"

import type { FinanceBreakdown, FinanceBreakdownDetail, FinanceExpectedPayment, FinanceOperation, FinancePoint } from "@app/entities/finance"

const marina: Assignee = { id: "marina", initials: "МК", name: "Марина Кириллова", colorClass: "bg-sky-100 text-sky-700" }
const alexey: Assignee = { id: "alexey", initials: "АВ", name: "Алексей Воронов", colorClass: "bg-violet-100 text-violet-700" }
const olga: Assignee = { id: "olga", initials: "ОС", name: "Ольга Семёнова", colorClass: "bg-emerald-100 text-emerald-700" }

export const financeOperationsFixture: FinanceOperation[] = [
  { id: "F-9041", date: "2026-08-24T11:20:00+03:00", dateLabel: "Сегодня, 11:20", type: "payment", amount: 58000, clientName: "Анна Ковалёва", relationLabel: "Свадьба · #E-3108", relationHref: "/events/E-3108", category: "events", method: "transfer", source: "Сайт", assignees: [marina] },
  { id: "F-9040", date: "2026-08-24T10:45:00+03:00", dateLabel: "Сегодня, 10:45", type: "accrual", amount: 71400, clientName: "Регистрации программы", relationLabel: "Семейный день · #24081", relationHref: "/programs/runs/24081", category: "programs", method: "card", source: "Telegram", assignees: [olga] },
  { id: "F-9039", date: "2026-08-24T09:10:00+03:00", dateLabel: "Сегодня, 09:10", type: "payment", amount: 21000, clientName: "Елена Тихонова", relationLabel: "Дом «Берёза» · #2034", relationHref: "/bookings/2034", category: "houses", method: "card", source: "Сайт", assignees: [alexey] },
  { id: "F-9038", date: "2026-08-23T18:30:00+03:00", dateLabel: "23 авг, 18:30", type: "refund", amount: -7500, clientName: "Мария Иванова", relationLabel: "Репетиция · #E-2880", relationHref: "/events/E-2880", category: "events", method: "transfer", source: "Телефон", assignees: [marina] },
  { id: "F-9037", date: "2026-08-23T16:15:00+03:00", dateLabel: "23 авг, 16:15", type: "accrual", amount: 42000, clientName: "Илья Воронцов", relationLabel: "Дом «Озеро» · #2051", relationHref: "/bookings/2051", category: "houses", method: "cash", source: "Телефон", assignees: [alexey] },
  { id: "F-9036", date: "2026-08-22T14:00:00+03:00", dateLabel: "22 авг, 14:00", type: "payment", amount: 18000, clientName: "Сергей Лебедев", relationLabel: "Баня · #2028", relationHref: "/bookings/2028", category: "bath", method: "cash", source: "VK", assignees: [olga] },
  { id: "F-9035", date: "2026-08-21T12:40:00+03:00", dateLabel: "21 авг, 12:40", type: "adjustment", amount: 3500, clientName: "ООО «Северный берег»", relationLabel: "Площадка · #2019", relationHref: "/bookings/2019", category: "venues", method: "transfer", source: "Email", assignees: [marina, alexey] },
  { id: "F-9034", date: "2026-08-20T10:10:00+03:00", dateLabel: "20 авг, 10:10", type: "payment", amount: 12000, clientName: "Дарья Петрова", relationLabel: "Кемпинг · #1998", relationHref: "/bookings/1998", category: "camping", method: "card", source: "Сайт", assignees: [] },
]

export const financeExpectedFixture: FinanceExpectedPayment[] = [
  { id: "P-3110", dueLabel: "Сегодня, 16:00", clientName: "ООО «Северный берег»", relationLabel: "Корпоратив · #E-3110", total: 142000, paid: 48000, overdue: false },
  { id: "P-2054", dueLabel: "Завтра, 12:00", clientName: "Михаил Белов", relationLabel: "Дом «Берёза» · #2054", total: 28000, paid: 14000, overdue: false },
  { id: "P-2046", dueLabel: "Вчера, 18:00", clientName: "Екатерина Орлова", relationLabel: "Площадка · #2046", total: 88000, paid: 22000, overdue: true },
]

export const financeBreakdownFixture: FinanceBreakdown[] = [
  { id: "houses", label: "Домики", accrued: 184000, paid: 142000 }, { id: "bath", label: "Баня и чан", accrued: 76000, paid: 61500 }, { id: "venues", label: "Площадки", accrued: 156000, paid: 112000 }, { id: "camping", label: "Кемпинг", accrued: 54000, paid: 48000 }, { id: "programs", label: "Программы", accrued: 71400, paid: 58800 }, { id: "events", label: "Мероприятия", accrued: 422000, paid: 286000 },
]

export const financeBreakdownDetailsFixture: FinanceBreakdownDetail[] = [
  { id: "house-pine", label: "Дом «Сосна»", section: "houses", accrued: 68000, paid: 54000, href: "/resources/houses/house-pine" },
  { id: "house-lake", label: "Дом у озера с очень длинным названием", section: "houses", accrued: 74000, paid: 52000, href: "/resources/houses/house-lake" },
  { id: "house-birch", label: "Дом «Берёза»", section: "houses", accrued: 42000, paid: 36000, href: "/resources/houses/house-birch" },
  { id: "bath-lake", label: "Баня у озера", section: "bath", accrued: 52000, paid: 44000, href: "/resources/bath/bath-lake" },
  { id: "bath-small", label: "Малая баня", section: "bath", accrued: 24000, paid: 17500, href: "/resources/bath/bath-small" },
  { id: "venue-main", label: "Большая площадка", section: "venues", accrued: 108000, paid: 82000, href: "/resources/venues/venue-main" },
  { id: "venue-forest", label: "Лесная площадка", section: "venues", accrued: 48000, paid: 30000, href: "/resources/venues/venue-forest" },
  { id: "camp-common", label: "Общее место под палатку", section: "camping", accrued: 39000, paid: 36000, href: "/resources/camping/camp-common" },
  { id: "camp-river", label: "Место у реки", section: "camping", accrued: 15000, paid: 12000, href: "/resources/camping/camp-river" },
  { id: "family", label: "Семейные", section: "programs", accrued: 42000, paid: 36000, href: "/programs/categories/family" },
  { id: "children", label: "Детские", section: "programs", accrued: 18000, paid: 14800, href: "/programs/categories/children" },
  { id: "nature", label: "Природа", section: "programs", accrued: 11400, paid: 8000, href: "/programs/categories/nature" },
  { id: "wedding", label: "Свадьба", section: "events", accrued: 180000, paid: 122000, href: "/events/categories/wedding" },
  { id: "corporate", label: "Корпоратив", section: "events", accrued: 142000, paid: 84000, href: "/events/categories/corporate" },
  { id: "birthday", label: "День рождения", section: "events", accrued: 58000, paid: 50000, href: "/events/categories/birthday" },
  { id: "offsite", label: "Выездное мероприятие", section: "events", accrued: 42000, paid: 30000, href: "/events/categories/offsite" },
]

export const financePointsFixture: FinancePoint[] = [
  { label: "18 авг", accrued: 82000, paid: 64000, refunds: 0, debt: 18000, paymentCount: 2 },
  { label: "19 авг", accrued: 118000, paid: 92000, refunds: 0, debt: 26000, paymentCount: 3 },
  { label: "20 авг", accrued: 96000, paid: 78000, refunds: 0, debt: 18000, paymentCount: 2 },
  { label: "21 авг", accrued: 146000, paid: 105000, refunds: 0, debt: 41000, paymentCount: 3 },
  { label: "22 авг", accrued: 132000, paid: 121000, refunds: 0, debt: 11000, paymentCount: 4 },
  { label: "23 авг", accrued: 178000, paid: 139000, refunds: 7500, debt: 46500, paymentCount: 3 },
  { label: "24 авг", accrued: 211000, paid: 168000, refunds: 0, debt: 43000, paymentCount: 5 },
]
