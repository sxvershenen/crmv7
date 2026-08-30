import type { Assignee } from "@crm/ui"

import type { ProgramCategory, ProgramRegistration, ProgramRun, ProgramTemplate } from "@app/entities/programs"

const marina: Assignee = { id: "marina", initials: "МК", name: "Марина Кириллова", colorClass: "bg-sky-100 text-sky-700" }
const alexey: Assignee = { id: "alexey", initials: "АВ", name: "Алексей Воронов", colorClass: "bg-violet-100 text-violet-700" }
const olga: Assignee = { id: "olga", initials: "ОС", name: "Ольга Семёнова", colorClass: "bg-emerald-100 text-emerald-700" }

export const programAssigneesFixture: Assignee[] = [marina, alexey, olga]

export const programCategoriesFixture: ProgramCategory[] = [
  { id: "family", name: "Семейные", description: "Совместные программы для семейных групп", icon: "campfire", tone: "amber", templateCount: 3 },
  { id: "children", name: "Детские", description: "Интерактивные программы для детей", icon: "palette", tone: "violet", templateCount: 2 },
  { id: "nature", name: "Природа", description: "Маршруты и занятия на открытом воздухе", icon: "leaf", tone: "emerald", templateCount: 2 },
  { id: "season", name: "Сезонные", description: "Программы, привязанные к сезону", icon: "snowflake", tone: "sky", templateCount: 1 },
  { id: "special", name: "Специальные", description: "Тематические события и особые даты", icon: "sparkles", tone: "rose", templateCount: 1 },
]

export const programTemplatesFixture: ProgramTemplate[] = [
  { id: "forest-family", name: "Семейный день в лесу", version: 4, updatedAt: "2026-08-21T13:40:00+03:00", categoryId: "family", categoryName: "Семейные", categoryIcon: "campfire", categoryTone: "amber", durationMinutes: 240, participantLimit: 24, basePrice: 4200, assignees: [marina], published: true, nextRun: { id: "run-2408-1", startsAt: "2026-08-24T11:00:00+03:00" } },
  { id: "clay-lab", name: "Глиняная лаборатория для маленьких исследователей", version: 7, updatedAt: "2026-08-20T17:10:00+03:00", categoryId: "children", categoryName: "Детские", categoryIcon: "palette", categoryTone: "violet", durationMinutes: 105, participantLimit: 14, basePrice: 2800, assignees: [olga], published: true, nextRun: { id: "run-2508-1", startsAt: "2026-08-25T10:30:00+03:00" } },
  { id: "herbs", name: "Лесные травы: прогулка и чай", version: 2, updatedAt: "2026-08-17T09:00:00+03:00", categoryId: "nature", categoryName: "Природа", categoryIcon: "leaf", categoryTone: "emerald", durationMinutes: 150, participantLimit: 18, basePrice: 2400, assignees: [alexey], published: true, nextRun: { id: "run-2608-1", startsAt: "2026-08-26T15:00:00+03:00" } },
  { id: "winter-tale", name: "Зимняя сказка в Свистоплясово", version: 3, updatedAt: "2026-08-15T12:20:00+03:00", categoryId: "season", categoryName: "Сезонные", categoryIcon: "snowflake", categoryTone: "sky", durationMinutes: 180, participantLimit: 30, basePrice: 3900, assignees: [], published: false, nextRun: null },
  { id: "night-stars", name: "Ночь звёзд и старинных историй", version: 1, updatedAt: "2026-08-12T18:45:00+03:00", categoryId: "special", categoryName: "Специальные", categoryIcon: "sparkles", categoryTone: "rose", durationMinutes: 210, participantLimit: 20, basePrice: 5100, assignees: [marina, olga], published: false, nextRun: { id: "run-2808-1", startsAt: "2026-08-28T20:00:00+03:00" } },
]

export const programRunsFixture: ProgramRun[] = [
  { id: "24081", templateId: "forest-family", name: "Семейный день в лесу", categoryId: "family", categoryIcon: "campfire", categoryTone: "amber", startsAt: "2026-08-24T11:00:00+03:00", endsAt: "2026-08-24T15:00:00+03:00", participantCount: 17, participantLimit: 24, registrationCount: 7, registrationLimit: 10, status: "registration", revenue: 71400, paid: 58800, assignees: [marina, alexey] },
  { id: "24082", templateId: "clay-lab", name: "Глиняная лаборатория", categoryId: "children", categoryIcon: "palette", categoryTone: "violet", startsAt: "2026-08-24T16:30:00+03:00", endsAt: "2026-08-24T18:15:00+03:00", participantCount: 14, participantLimit: 14, registrationCount: 8, registrationLimit: 8, status: "full", revenue: 39200, paid: 39200, assignees: [olga] },
  { id: "25081", templateId: "clay-lab", name: "Глиняная лаборатория для маленьких исследователей", categoryId: "children", categoryIcon: "palette", categoryTone: "violet", startsAt: "2026-08-25T10:30:00+03:00", endsAt: "2026-08-25T12:15:00+03:00", participantCount: 6, participantLimit: 14, registrationCount: 4, registrationLimit: 8, status: "registration", revenue: 16800, paid: 8400, assignees: [olga] },
  { id: "25082", templateId: "forest-family", name: "Семейный день в лесу — вечерняя группа", categoryId: "family", categoryIcon: "campfire", categoryTone: "amber", startsAt: "2026-08-25T17:00:00+03:00", endsAt: "2026-08-25T21:00:00+03:00", participantCount: 8, participantLimit: 24, registrationCount: 3, registrationLimit: 10, status: "planned", revenue: 33600, paid: 12600, assignees: [] },
  { id: "26081", templateId: "herbs", name: "Лесные травы: прогулка и чай", categoryId: "nature", categoryIcon: "leaf", categoryTone: "emerald", startsAt: "2026-08-26T15:00:00+03:00", endsAt: "2026-08-26T17:30:00+03:00", participantCount: 5, participantLimit: 18, registrationCount: 3, registrationLimit: 10, status: "registration", revenue: 12000, paid: 7200, assignees: [alexey] },
  { id: "27081", templateId: "forest-family", name: "Семейный день в лесу", categoryId: "family", categoryIcon: "campfire", categoryTone: "amber", startsAt: "2026-08-27T11:00:00+03:00", endsAt: "2026-08-27T15:00:00+03:00", participantCount: 0, participantLimit: 24, registrationCount: 0, registrationLimit: 10, status: "draft", revenue: 0, paid: 0, assignees: [marina] },
  { id: "28081", templateId: "night-stars", name: "Ночь звёзд и старинных историй", categoryId: "special", categoryIcon: "sparkles", categoryTone: "rose", startsAt: "2026-08-28T20:00:00+03:00", endsAt: "2026-08-28T23:30:00+03:00", participantCount: 11, participantLimit: 20, registrationCount: 6, registrationLimit: 10, status: "registration", revenue: 56100, paid: 40800, assignees: [marina, olga] },
  { id: "30081", templateId: "herbs", name: "Лесные травы: длинное название проведения для проверки переполнения в узкой колонке", categoryId: "nature", categoryIcon: "leaf", categoryTone: "emerald", startsAt: "2026-08-30T12:00:00+03:00", endsAt: "2026-08-30T14:30:00+03:00", participantCount: 9, participantLimit: 18, registrationCount: 5, registrationLimit: 10, status: "planned", revenue: 21600, paid: 9600, assignees: [alexey] },
]

export const programRegistrationsFixture: ProgramRegistration[] = [
  { id: "5012", runId: "24081", programName: "Семейный день в лесу", programStartsAt: "2026-08-24T11:00:00+03:00", categoryIcon: "campfire", categoryTone: "amber", clientName: "Анна Ковалёва", phone: "+7 921 450-12-40", total: 12600, debt: 0, status: "paid", comment: "Двое взрослых и ребёнок", assignees: [marina] },
  { id: "5011", runId: "24082", programName: "Глиняная лаборатория", programStartsAt: "2026-08-24T16:30:00+03:00", categoryIcon: "palette", categoryTone: "violet", clientName: "Михаил Белов", phone: "+7 911 803-44-15", total: 5600, debt: 2800, status: "confirmed", comment: "Позвонить за день", assignees: [olga] },
  { id: "5009", runId: "25081", programName: "Глиняная лаборатория для маленьких исследователей", programStartsAt: "2026-08-25T10:30:00+03:00", categoryIcon: "palette", categoryTone: "violet", clientName: "Екатерина Орлова", phone: "+7 900 555-19-20", total: 8400, debt: 4200, status: "new", comment: "Длинный комментарий для проверки аккуратного переполнения: уточнить возраст участников и питание", assignees: [] },
  { id: "5007", runId: "25082", programName: "Семейный день в лесу — вечерняя группа", programStartsAt: "2026-08-25T17:00:00+03:00", categoryIcon: "campfire", categoryTone: "amber", clientName: "ООО «Северные истории»", phone: "+7 812 440-18-20", total: 33600, debt: 21000, status: "confirmed", comment: "Корпоративная группа", assignees: [alexey] },
  { id: "5004", runId: "26081", programName: "Лесные травы: прогулка и чай", programStartsAt: "2026-08-26T15:00:00+03:00", categoryIcon: "leaf", categoryTone: "emerald", clientName: "Дарья Петрова", phone: "+7 921 209-15-44", total: 4800, debt: 4800, status: "cancelled", comment: "Отмена по просьбе клиента", assignees: [alexey] },
  { id: "4998", runId: "28081", programName: "Ночь звёзд и старинных историй", programStartsAt: "2026-08-28T20:00:00+03:00", categoryIcon: "sparkles", categoryTone: "rose", clientName: "Сергей Лебедев", phone: "+7 921 107-77-63", total: 10200, debt: 0, status: "paid", comment: "Без комментария", assignees: [marina, olga] },
]
