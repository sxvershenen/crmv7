import type { Assignee } from "@crm/ui"

import type { Lead } from "@app/entities/leads"

const marina: Assignee = { id: "marina", initials: "МК", name: "Марина Кириллова", colorClass: "bg-sky-100 text-sky-700" }
const alexey: Assignee = { id: "alexey", initials: "АВ", name: "Алексей Воронов", colorClass: "bg-violet-100 text-violet-700" }
const olga: Assignee = { id: "olga", initials: "ОС", name: "Ольга Семёнова", colorClass: "bg-emerald-100 text-emerald-700" }

export const leadsFixture: Lead[] = [
  {
    id: "1284", clientName: "Анна Ковалёва", phone: "+7 921 450-12-40", requestedItem: "Домик «Сосна» и баня", guestCount: 6,
    direction: "Проживание", source: "Сайт", promo: "Без промокода", utm: "organic", plannedAt: "2026-08-24T11:00:00+03:00", plannedLabel: "Завтра, 11:00", nextContactAt: "2026-08-23T19:00:00+03:00", nextContactLabel: "Сегодня, 19:00", assignees: [marina], assignedToMe: true, overdue: true, stage: "new",
  },
  {
    id: "1283", clientName: "Михаил Белов", phone: "+7 911 803-44-15", requestedItem: "Семейная программа", guestCount: 4,
    direction: "Программы", source: "Telegram", promo: "Лето", utm: "telegram", plannedAt: "2026-08-29T14:00:00+03:00", plannedLabel: "29 авг, 14:00", nextContactAt: "2026-08-24T10:00:00+03:00", nextContactLabel: "Завтра, 10:00", assignees: [], assignedToMe: false, overdue: false, stage: "new",
  },
  {
    id: "1282", clientName: "Екатерина Орлова с очень длинным именем для проверки", phone: "+7 900 555-19-20", requestedItem: "Большая беседка для юбилея и дополнительная выездная программа", guestCount: 24,
    direction: "Мероприятия", source: "Телефон", promo: "Без промокода", utm: "direct", plannedAt: "2026-09-06T16:30:00+03:00", plannedLabel: "06 сен, 16:30", nextContactAt: "2026-08-25T12:30:00+03:00", nextContactLabel: "25 авг, 12:30", assignees: [alexey], assignedToMe: false, overdue: false, stage: "new", demoRejectMove: true,
  },
  {
    id: "1279", clientName: "Сергей Лебедев", phone: "+7 921 107-77-63", requestedItem: "Баня и чан", guestCount: 8,
    direction: "Баня", source: "VK", promo: "Лето", utm: "vk_cpc", plannedAt: "2026-08-26T18:00:00+03:00", plannedLabel: "26 авг, 18:00", nextContactAt: "2026-08-23T15:00:00+03:00", nextContactLabel: "Сегодня, 15:00", assignees: [marina, alexey], assignedToMe: true, overdue: true, stage: "work",
  },
  {
    id: "1276", clientName: "Игорь Козлов", phone: "+7 953 644-90-12", requestedItem: "Домик «Берёза»", guestCount: 3,
    direction: "Проживание", source: "Сайт", promo: "Семья", utm: "yandex_cpc", plannedAt: "2026-08-30T13:00:00+03:00", plannedLabel: "30 авг, 13:00", nextContactAt: "2026-08-24T09:30:00+03:00", nextContactLabel: "Завтра, 09:30", assignees: [olga], assignedToMe: false, overdue: false, stage: "work",
  },
  {
    id: "1274", clientName: "Наталья Волкова", phone: "+7 921 312-28-70", requestedItem: "Детский квест", guestCount: 12,
    direction: "Программы", source: "Сайт", promo: "Семья", utm: "organic", plannedAt: "2026-08-31T12:00:00+03:00", plannedLabel: "31 авг, 12:00", nextContactAt: "2026-08-27T11:00:00+03:00", nextContactLabel: "27 авг, 11:00", assignees: [marina], assignedToMe: true, overdue: false, stage: "waiting",
  },
  {
    id: "1271", clientName: "Артём Соколов", phone: "+7 911 440-26-19", requestedItem: "Свадебная площадка", guestCount: 35,
    direction: "Мероприятия", source: "Telegram", promo: "Без промокода", utm: "telegram", plannedAt: "2026-09-12T15:00:00+03:00", plannedLabel: "12 сен, 15:00", nextContactAt: "2026-08-23T12:00:00+03:00", nextContactLabel: "Сегодня, 12:00", assignees: [alexey], assignedToMe: false, overdue: true, stage: "waiting",
  },
  {
    id: "1268", clientName: "Елена Морозова", phone: "+7 921 808-11-04", requestedItem: "Домик «Сосна»", guestCount: 5,
    direction: "Проживание", source: "VK", promo: "Лето", utm: "vk_cpc", plannedAt: "2026-08-25T15:00:00+03:00", plannedLabel: "25 авг, 15:00", nextContactAt: "2026-08-24T13:00:00+03:00", nextContactLabel: "Завтра, 13:00", assignees: [olga], assignedToMe: false, overdue: false, stage: "success",
  },
  {
    id: "1262", clientName: "Павел Никитин", phone: "+7 900 904-03-91", requestedItem: "Баня", guestCount: 4,
    direction: "Баня", source: "Телефон", promo: "Без промокода", utm: "direct", plannedAt: "2026-08-22T19:00:00+03:00", plannedLabel: "22 авг, 19:00", nextContactAt: "2026-08-22T09:00:00+03:00", nextContactLabel: "22 авг, 09:00", assignees: [marina], assignedToMe: true, overdue: true, stage: "rejected",
  },
  {
    id: "1248", clientName: "Дарья Петрова", phone: "+7 921 209-15-44", requestedItem: "Летняя площадка", guestCount: 18,
    direction: "Мероприятия", source: "Сайт", promo: "Без промокода", utm: "organic", plannedAt: "2026-08-20T17:00:00+03:00", plannedLabel: "20 авг, 17:00", nextContactAt: "2026-08-20T10:00:00+03:00", nextContactLabel: "20 авг, 10:00", assignees: [alexey], assignedToMe: false, overdue: false, stage: "archive",
  },
]
