import type {
  CrmSettings,
  TeamMember,
  WorkspaceProfile,
} from "@app/entities/workspace";

export const workspaceProfileFixture: WorkspaceProfile = {
  browserNotifications: true,
  email: "marina@svistoplyasovo.ru",
  emailNotifications: false,
  id: "marina",
  initials: "МК",
  language: "ru",
  name: "Марина Кириллова",
  notifyConflicts: true,
  notifyNewLeads: true,
  notifyOverdueTasks: true,
  phone: "+7 921 555-08-41",
  role: "Руководитель CRM",
  telegramNotifications: true,
  timezone: "Europe/Moscow",
};

export const teamMembersFixture: TeamMember[] = [
  { id: "marina", name: "Марина Кириллова", initials: "МК", email: "marina@svistoplyasovo.ru", phone: "+7 921 555-08-41", role: "Руководитель CRM", status: "active", openItems: 18, lastActiveLabel: "Сейчас", colorClass: "bg-sky-100 text-sky-700" },
  { id: "alexey", name: "Алексей Воронов", initials: "АВ", email: "alexey@svistoplyasovo.ru", phone: "+7 911 440-20-18", role: "Администратор", status: "active", openItems: 12, lastActiveLabel: "5 мин назад", colorClass: "bg-violet-100 text-violet-700" },
  { id: "olga", name: "Ольга Семёнова", initials: "ОС", email: "olga@svistoplyasovo.ru", phone: "+7 900 614-82-02", role: "Менеджер по броням", status: "away", openItems: 9, lastActiveLabel: "Сегодня, 10:24", colorClass: "bg-emerald-100 text-emerald-700" },
  { id: "irina", name: "Ирина Соколова", initials: "ИС", email: "irina@svistoplyasovo.ru", phone: "+7 921 333-17-60", role: "Координатор программ", status: "active", openItems: 7, lastActiveLabel: "Сегодня, 09:48", colorClass: "bg-amber-100 text-amber-700" },
  { id: "denis", name: "Денис Морозов", initials: "ДМ", email: "denis@svistoplyasovo.ru", phone: "+7 905 220-01-44", role: "Технический специалист", status: "invited", openItems: 0, lastActiveLabel: "Приглашение отправлено", colorClass: "bg-slate-100 text-slate-700" },
];

export const crmSettingsFixture: CrmSettings = {
  organization: {
    currency: "RUB",
    email: "info@svistoplyasovo.ru",
    locale: "ru-RU",
    name: "Свистоплясово",
    phone: "+7 812 000-00-00",
    timezone: "Europe/Moscow",
  },
  operations: {
    autoAssignNewLeads: false,
    bookingPrefix: "B",
    conflictWarnings: true,
    defaultLeadSource: "Сайт",
    requireClientPhone: true,
  },
  site: {
    connectionStatus: "planned",
    defaultAssigneeId: "marina",
    defaultSource: "Сайт",
    intakeEnabled: true,
    publishAggregatedAvailability: false,
    publishPrices: true,
    publishResources: true,
    siteUrl: "https://svistoplyasovo.ru",
  },
  integrations: [
    { id: "site", name: "Публичный сайт", description: "Формы, публичные цены и агрегированная доступность", status: "planned", lastSyncLabel: "После запуска public API" },
    { id: "cms", name: "CMS и публикации", description: "Контент, SEO, медиа и публичные профили ресурсов", status: "planned", lastSyncLabel: "Отдельная admin-фаза" },
    { id: "telephony", name: "Телефония", description: "Звонки, записи разговоров и сопоставление номеров", status: "attention", lastSyncLabel: "Нужна настройка" },
    { id: "analytics", name: "Веб-аналитика", description: "UTM, Client ID и атрибуция заявок", status: "connected", lastSyncLabel: "Сегодня, 12:41" },
  ],
};
