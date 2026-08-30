import type { Assignee } from "@crm/ui"

import type { Customer } from "@app/entities/customers"

const marina: Assignee = { id: "marina", initials: "МК", name: "Марина Кириллова", colorClass: "bg-sky-100 text-sky-700" }
const alexey: Assignee = { id: "alexey", initials: "АВ", name: "Алексей Воронов", colorClass: "bg-violet-100 text-violet-700" }
const olga: Assignee = { id: "olga", initials: "ОС", name: "Ольга Семёнова", colorClass: "bg-emerald-100 text-emerald-700" }

export const customersFixture: Customer[] = [
  {
    id: "1042", name: "Анна Ковалёва", phone: "+7 921 450-12-40", type: "person", channels: ["Сайт", "Телефон"],
    leadCount: 4, activeLeadCount: 1, bookingCount: 7, futureBookingCount: 1, taskCount: 2, turnover: 184000, debt: 0,
    duplicateRisk: "none", nextContactAt: "2026-08-24T11:00:00+03:00", nextContactLabel: "Завтра, 11:00", lastVisitDaysAgo: 12,
    hasActive: true, archived: false, assignees: [marina],
  },
  {
    id: "1037", name: "ООО «Северные истории»", phone: "+7 812 440-18-20", type: "company", channels: ["Email", "Телефон"],
    leadCount: 9, activeLeadCount: 2, bookingCount: 12, futureBookingCount: 3, taskCount: 4, turnover: 980000, debt: 126000,
    duplicateRisk: "possible", nextContactAt: "2026-08-25T15:30:00+03:00", nextContactLabel: "25 авг, 15:30", lastVisitDaysAgo: 28,
    hasActive: true, archived: false, assignees: [alexey, marina],
  },
  {
    id: "1029", name: "Екатерина Орлова — семейные события и большие корпоративные выезды", phone: "+7 900 555-19-20", type: "organizer", channels: ["Telegram", "Сайт"],
    leadCount: 11, activeLeadCount: 3, bookingCount: 16, futureBookingCount: 4, taskCount: 6, turnover: 1425000, debt: 48500,
    duplicateRisk: "high", nextContactAt: "2026-08-23T18:00:00+03:00", nextContactLabel: "Сегодня, 18:00", lastVisitDaysAgo: 7,
    hasActive: true, archived: false, assignees: [olga],
  },
  {
    id: "1024", name: "Михаил Белов", phone: "+7 911 803-44-15", type: "person", channels: ["Telegram"],
    leadCount: 2, activeLeadCount: 0, bookingCount: 3, futureBookingCount: 0, taskCount: 0, turnover: 72000, debt: 12000,
    duplicateRisk: "none", nextContactAt: null, nextContactLabel: null, lastVisitDaysAgo: 44,
    hasActive: false, archived: false, assignees: [],
  },
  {
    id: "1018", name: "ИП Волкова Н. А.", phone: "+7 921 312-28-70", type: "organizer", channels: ["VK", "Телефон"],
    leadCount: 6, activeLeadCount: 1, bookingCount: 8, futureBookingCount: 2, taskCount: 1, turnover: 412000, debt: 0,
    duplicateRisk: "possible", nextContactAt: "2026-08-27T10:00:00+03:00", nextContactLabel: "27 авг, 10:00", lastVisitDaysAgo: 61,
    hasActive: true, archived: false, assignees: [marina],
  },
  {
    id: "1011", name: "АО «Ладога Проект»", phone: "+7 812 903-44-90", type: "company", channels: ["Email"],
    leadCount: 3, activeLeadCount: 0, bookingCount: 5, futureBookingCount: 0, taskCount: 1, turnover: 315000, debt: 0,
    duplicateRisk: "none", nextContactAt: "2026-09-02T12:00:00+03:00", nextContactLabel: "02 сен, 12:00", lastVisitDaysAgo: 83,
    hasActive: false, archived: false, assignees: [alexey],
  },
  {
    id: "1006", name: "Сергей Лебедев", phone: "+7 921 107-77-63", type: "person", channels: ["Телефон"],
    leadCount: 1, activeLeadCount: 0, bookingCount: 1, futureBookingCount: 0, taskCount: 0, turnover: 18500, debt: 2500,
    duplicateRisk: "high", nextContactAt: null, nextContactLabel: null, lastVisitDaysAgo: 116,
    hasActive: false, archived: false, assignees: [],
  },
  {
    id: "0988", name: "Дарья Петрова", phone: "+7 921 209-15-44", type: "person", channels: ["Сайт"],
    leadCount: 1, activeLeadCount: 0, bookingCount: 2, futureBookingCount: 0, taskCount: 0, turnover: 34000, debt: 0,
    duplicateRisk: "none", nextContactAt: null, nextContactLabel: null, lastVisitDaysAgo: 190,
    hasActive: false, archived: true, assignees: [],
  },
]
