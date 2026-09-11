import type { AnalyticsSummary, CmsDashboard, CodeArtifact, ContentNode, EditorRecord, MediaAsset, PublicNavigation, ReleaseRecord } from "@admin/entities/cms"

export const dashboardFixture: CmsDashboard = {
  productionRelease: "Опубликованная версия",
  publishedAt: "Сегодня, 10:42",
  drafts: 14,
  queueHealthy: true,
  metrics: [
    { id: "pages", label: "Страницы", value: "48", detail: "42 в production", trend: "+3 за месяц" },
    { id: "seo", label: "SEO-качество", value: "39 / 42", detail: "3 страницы с рисками" },
    { id: "media", label: "Медиа", value: "286", detail: "2 файла в обработке" },
    { id: "release", label: "Черновики", value: "8", detail: "1 блокирует публикацию · 2 предупреждения" },
  ],
  attention: [
    { id: "a1", title: "Страница пока не готова к публикации", detail: "Не готова WebP-версия hero-mobile.jpg", href: "/content/pages/landing-family", tone: "danger" },
    { id: "a2", title: "3 страницы без входящих ссылок", detail: "Проверьте внутреннюю перелинковку", href: "/seo?tab=links", tone: "warning" },
    { id: "a3", title: "Публикация работает", detail: "Изменения проходят автоматическую проверку перед появлением на сайте", href: "/content/tree", tone: "info" },
  ],
  funnel: { visitors: 12840, leads: 436, bookings: 118, paid: 86 },
  activity: [
    { id: "ch1", actor: "Марина К.", action: "обновила hero", target: "Главная", when: "12 мин назад", status: "draft" },
    { id: "ch2", actor: "Олег М.", action: "отправил на проверку", target: "Отдых с детьми", when: "34 мин назад", status: "review" },
    { id: "ch3", actor: "Система", action: "опубликовала", target: "Карта и навигация", when: "Сегодня, 10:42", status: "published" },
  ],
}

export const nodeFixtures: ContentNode[] = [
  { id: "home", title: "Главная", path: "/", pageKind: "home", sortOrder: 0, type: "home", status: "published", quality: "ok", parentId: null, children: ["houses", "programs", "landing-family"], owner: "Марина К.", updatedLabel: "12 мин назад", inboundLinks: 32, mediaCount: 24 },
  { id: "houses", title: "Домики", path: "/domiki", pageKind: "category", sortOrder: 10, type: "category", status: "published", quality: "ok", parentId: "home", children: ["house-lesnoy"], owner: "Олег М.", updatedLabel: "Вчера, 18:20", inboundLinks: 18, mediaCount: 16 },
  { id: "house-lesnoy", title: "Домик «Лесной»", path: "/domiki/lesnoy", pageKind: "resource_detail", sortOrder: 10, type: "profile", status: "published", quality: "warning", parentId: "houses", children: [], owner: "Марина К.", updatedLabel: "06 июл, 11:00", inboundLinks: 7, mediaCount: 8 },
  { id: "programs", title: "Программы", path: "/programmy", pageKind: "category", sortOrder: 20, type: "category", status: "review", quality: "warning", parentId: "home", children: [], owner: "Анна Р.", updatedLabel: "Сегодня, 09:14", inboundLinks: 12, mediaCount: 11 },
  { id: "landing-family", title: "Отдых с детьми", path: "/family", pageKind: "landing", sortOrder: 30, type: "landing", status: "draft", quality: "blocker", parentId: "home", children: [], owner: "Олег М.", updatedLabel: "34 мин назад", inboundLinks: 0, mediaCount: 5 },
  { id: "crm-house-new", title: "Новый домик", path: "/domiki/new-house", pageKind: "resource_detail", sortOrder: 20, type: "profile", status: "draft", quality: "warning", parentId: "houses", children: [], owner: "Синхронизация CRM", updatedLabel: "только что", inboundLinks: 0, mediaCount: 0, source: "CRM", sourceKind: "resource", importedDraft: true },
  { id: "crm-program-new", title: "Новая программа", path: "/programmy/new-program", pageKind: "program_detail", sortOrder: 10, type: "profile", status: "draft", quality: "warning", parentId: "programs", children: [], owner: "Синхронизация CRM", updatedLabel: "2 мин назад", inboundLinks: 0, mediaCount: 0, source: "CRM", sourceKind: "program_template", importedDraft: true },
  { id: "crm-event-new", title: "Новое мероприятие", path: "/meropriyatiya/new-event", pageKind: "event_detail", sortOrder: 40, type: "profile", status: "draft", quality: "warning", parentId: "home", children: [], owner: "Синхронизация CRM", updatedLabel: "5 мин назад", inboundLinks: 0, mediaCount: 0, source: "CRM", sourceKind: "event", importedDraft: true },
  { id: "crm-category-new", title: "Новая категория", path: "/new-category", pageKind: "category", sortOrder: 50, type: "category", status: "draft", quality: "warning", parentId: "home", children: [], owner: "Синхронизация CRM", updatedLabel: "8 мин назад", inboundLinks: 0, mediaCount: 0, source: "CRM", sourceKind: "program_category", importedDraft: true },
]

const inheritedSections = [
  { id: "hero", label: "Hero", description: "H1, фон, CTA и trust-факты", mode: "override", source: "Главная · локальная настройка", sourceHref: "/content/home?tab=sections", effectiveTitle: "Отдых на природе в Свистоплясово", quality: "ok" },
  { id: "map", label: "Карта базы", description: "Точки, подписи и CTA", mode: "inherit", source: "Настройки сайта → Карта", sourceHref: "/globals/sections?section=map", effectiveTitle: "Карта территории", quality: "ok" },
  { id: "faq", label: "FAQ и как добраться", description: "Ответы, schema.org и маршруты", mode: "inherit", source: "Тип страницы → Посадочная", sourceHref: "/globals/sections?section=faq", effectiveTitle: "Частые вопросы", quality: "ok" },
  { id: "calculator", label: "Калькулятор", description: "Пресет подбора и funnel IDs", mode: "disabled", source: "Скрыто на странице", sourceHref: "/globals/sections?section=calculator", effectiveTitle: "Подобрать отдых", quality: "warning" },
  { id: "footer", label: "Footer", description: "Навигация, контакты, legal", mode: "inherit", source: "Глобальный footer", sourceHref: "/globals/footer", effectiveTitle: "Основной footer", quality: "ok" },
] satisfies EditorRecord["sections"]

const defaultHero: EditorRecord["hero"] = {
  mode: "override", eyebrow: "Свистоплясово", title: "База отдыха «Свистоплясово»",
  description: "Загородный отдых, домики и программы в Нижегородской области.",
  primaryCtaLabel: "Подобрать отдых", primaryCtaTarget: "#booking",
  secondaryCtaLabel: "Посмотреть домики", secondaryCtaTarget: "/domiki",
  desktopImage: "/images/hero.webp", mobileImage: "/images/hero-mobile.webp",
  overlay: 46, focalPosition: "center", alignment: "left",
}

export const editorFixtures: Record<string, EditorRecord> = {
  home: { id: "home", kind: "home", internalName: "Главная", publicTitle: "База отдыха «Свистоплясово»", slug: "", parent: "Корень сайта", url: "/", status: "published", version: 18, owner: "Марина К.", source: "CMS", updatedLabel: "12 мин назад", reviewLabel: "Проверено 28 авг", seoChecks: { passed: 18, warnings: 1, blockers: 0 }, sections: inheritedSections, hero: defaultHero, description: "Специальный редактор главной страницы.", seoTitle: "База отдыха «Свистоплясово»", seoDescription: "Загородный отдых, домики и программы в Нижегородской области.", indexPolicy: "index_follow" },
  "landing-family": { id: "landing-family", kind: "landing", internalName: "Отдых с детьми", publicTitle: "Семейный отдых на природе", slug: "family", parent: "Главная", url: "/family", status: "draft", version: 4, owner: "Олег М.", source: "CMS", updatedLabel: "34 мин назад", reviewLabel: "Проверить до 15 сен", seoChecks: { passed: 11, warnings: 2, blockers: 1 }, sections: inheritedSections.map((item) => ({ ...item, mode: item.id === "hero" ? "override" : item.mode, source: item.id === "hero" ? "Эта страница · собственные настройки" : item.source })), hero: { ...defaultHero, title: "Семейный отдых на природе", description: "Домики и программы для семейного отдыха с детьми." }, description: "Посадочная для семейного поискового интента.", seoTitle: "Семейный отдых на природе", seoDescription: "Домики и программы для семейного отдыха с детьми.", indexPolicy: "index_follow" },
  houses: { id: "houses", kind: "category", internalName: "Каталог домиков", publicTitle: "Домики для отдыха", slug: "houses", parent: "Главная", url: "/domiki", status: "published", version: 9, owner: "Олег М.", source: "CMS", updatedLabel: "Вчера, 18:20", reviewLabel: "Проверено 29 авг", seoChecks: { passed: 16, warnings: 1, blockers: 0 }, sections: inheritedSections, hero: { ...defaultHero, mode: "inherit", title: "Домики для отдыха" }, description: "Каталог с configurable filters и stable sorting.", seoTitle: "Домики для отдыха", seoDescription: "Каталог домиков базы отдыха с фильтрами по вместимости.", indexPolicy: "index_follow" },
  "house-lesnoy": { id: "house-lesnoy", kind: "profile", internalName: "Профиль · Лесной", publicTitle: "Домик «Лесной»", slug: "lesnoy", parent: "Домики", url: "/domiki/lesnoy", status: "published", version: 12, owner: "Марина К.", source: "CMS", updatedLabel: "06 июл, 11:00", reviewLabel: "Проверить до 01 окт", seoChecks: { passed: 14, warnings: 1, blockers: 0 }, sections: inheritedSections, hero: { ...defaultHero, mode: "inherit", title: "Домик «Лесной»" }, description: "Маркетинговый профиль, операционные данные из CRM только для чтения.", seoTitle: "Домик «Лесной»", seoDescription: "Домик для отдыха до шести гостей.", indexPolicy: "index_follow", readonlyCrm: { entity: "Домик «Лесной»", code: "HOUSE-04", status: "Активен", capacity: "6 гостей", price: "От 12 500 ₽", availability: "Public projection ready" } },
}

export const navigationFixture: PublicNavigation = {
  version: 3, status: "published", updatedLabel: "Сегодня, 10:42",
  header: [
    { id: "stay", label: "Проживание", href: "/domiki", icon: "home", color: "#2f6b4f", visible: true, children: [{ id: "houses", label: "Домики", href: "/domiki", icon: "building-cottage", color: "#2f6b4f", visible: true, children: [] }] },
    { id: "programs", label: "Программы", href: "/programmy", icon: "sparkles", color: "#8a5b2d", visible: true, children: [] },
    { id: "contacts", label: "Контакты", href: "/contacts", icon: "map-pin", color: "#43658b", visible: true, children: [] },
  ],
  mobile: [
    { id: "mobile-stay", label: "Проживание", href: "/domiki", icon: "home", color: "#2f6b4f", visible: true, children: [] },
    { id: "mobile-programs", label: "Программы", href: "/programmy", icon: "sparkles", color: "#8a5b2d", visible: true, children: [] },
  ],
  footer: [{ id: "privacy", label: "Политика конфиденциальности", href: "/privacy", icon: "shield", color: "#5f6368", visible: true, children: [] }],
}

export const mediaFixtures: MediaAsset[] = [
  { id: "asset-hero", title: "Hero · зимний лес", filename: "hero-winter.jpg", status: "ready", progress: 100, dimensions: "2400×1600", size: "384 KB WebP", usageCount: 4, publishedUsage: true, alt: "Домики в зимнем лесу", license: "Собственное фото", dominant: "#66705a" },
  { id: "asset-mobile", title: "Hero mobile", filename: "hero-mobile.jpg", status: "converting", progress: 72, dimensions: "1280×1600", size: "3.8 MB original", usageCount: 1, publishedUsage: false, alt: "", license: "Собственное фото", dominant: "#8c7a62" },
  { id: "asset-map", title: "Схема территории", filename: "base-map.png", status: "ready", progress: 100, dimensions: "1800×1200", size: "218 KB WebP", usageCount: 18, publishedUsage: true, alt: "Карта базы отдыха", license: "Автор: Алексей П.", dominant: "#d5d0b8" },
  { id: "asset-broken", title: "Галерея бани", filename: "bath-gallery.tiff", status: "error", progress: 43, dimensions: "—", size: "18.6 MB", usageCount: 0, publishedUsage: false, alt: "Баня с террасой", license: "Не указана", dominant: "#955f42" },
]

export const releaseFixtures: ReleaseRecord[] = [
  { id: "REL-2026-085", title: "Семейная посадочная и hero", state: "review", baseReleaseId: "REL-2026-084", author: "Олег М.", reviewer: "Марина К.", changedRoutes: 4, assets: 2, codeArtifacts: 0, createdLabel: "Сегодня, 11:08", gates: [
    { id: "content", label: "Контент и ссылки", detail: "48 checks passed", state: "passed" },
    { id: "seo", label: "SEO и schema", detail: "2 warnings: длинный title, orphan page", state: "warning" },
    { id: "media", label: "Медиа", detail: "hero-mobile.jpg: WebP ещё обрабатывается", state: "blocked" },
    { id: "build", label: "Preview build", detail: "Последняя сборка 38 с", state: "passed" },
  ], changes: [
    { route: "/", before: "Hero v17", after: "Hero v18", kind: "Глобальная секция" },
    { route: "/family", before: "Нет в production", after: "Revision 4", kind: "Новая страница" },
    { route: "/domiki", before: "Наследует Hero v17", after: "Наследует Hero v18", kind: "Effective diff" },
    { route: "/programmy", before: "Наследует Hero v17", after: "Наследует Hero v18", kind: "Effective diff" },
  ] },
  { id: "REL-2026-084", title: "Карта и навигация", state: "published", baseReleaseId: "REL-2026-083", author: "Марина К.", reviewer: "Анна Р.", changedRoutes: 18, assets: 1, codeArtifacts: 0, createdLabel: "Сегодня, 10:42", gates: [{ id: "all", label: "Все gates", detail: "Production delivery completed", state: "passed" }], changes: [{ route: "18 routes", before: "Map v2", after: "Map v3", kind: "Reusable block" }] },
]

export const analyticsFixture: AnalyticsSummary = {
  period: "01–31 авг 2026",
  visitors: 12840,
  views: 34820,
  leads: 436,
  bookings: 118,
  paid: 86,
  channels: [
    { name: "Organic", value: 5320, percent: 41 }, { name: "Direct", value: 3310, percent: 26 }, { name: "Referral", value: 2060, percent: 16 }, { name: "Campaign", value: 1400, percent: 11 }, { name: "Other", value: 750, percent: 6 },
  ],
  pages: [
    { path: "/", views: 12640, cta: 1820, leads: 214 }, { path: "/domiki", views: 6340, cta: 910, leads: 88 }, { path: "/programmy", views: 4120, cta: 482, leads: 54 }, { path: "/family", views: 2840, cta: 430, leads: 49 },
  ],
}

export const codeArtifactFixture: CodeArtifact = {
  id: "homepage-featured", name: "HomepageFeatured", status: "valid", file: "src/sections/HomepageFeatured.tsx", editable: true,
  files: [
    { path: "src/", kind: "folder" }, { path: "src/sections/", kind: "folder" }, { path: "src/sections/HomepageFeatured.tsx", kind: "tsx", changed: true }, { path: "src/sections/homepage-featured.css", kind: "css", changed: true }, { path: "src/sections/manifest.json", kind: "json" }, { path: "src/pages/family.astro", kind: "tsx" },
  ],
  source: `import { PublicCardRail } from "@site/ui"\n\nexport function HomepageFeatured({ items, analyticsId }) {\n  return (\n    <section aria-labelledby="featured-title">\n      <h2 id="featured-title">\u0412ыбор гостей</h2>\n      <PublicCardRail items={items} analyticsId={analyticsId} />\n    </section>\n  )\n}`,
  diff: [
    { before: "<PublicCardRail items={items} />", after: "<PublicCardRail items={items} analyticsId={analyticsId} />" },
    { before: "", after: "aria-labelledby=\"featured-title\"" },
  ],
  gates: [
    { id: "typecheck", label: "Typecheck", detail: "0 errors", state: "passed" }, { id: "lint", label: "Lint", detail: "0 warnings", state: "passed" }, { id: "a11y", label: "Accessibility", detail: "1 landmark warning", state: "warning" }, { id: "build", label: "Preview build", detail: "Artifact signed · 38 s", state: "passed" },
  ],
  dependencies: ["@site/ui/PublicCardRail", "public-api:listing-profile", "media:asset-hero"],
}
