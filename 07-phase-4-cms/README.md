# Phase 4 — current status

Это единственная точка current status и следующего инкремента. Оставшийся scope и acceptance gates — в `IMPLEMENTATION-ROADMAP.md`. История проверок и инкрементов хранится в Git: `git ls-tree --name-only a1a649f:07-phase-4-cms/logs`, затем `git show a1a649f:<path>`. Историю читать только для конкретного спорного факта.

## Статус

| Контур | Реализовано | Осталось |
|---|---|---|
| P4.1–P4.2 | Public UI kit/homepage, CMS frontend/core, Admin/Public API | Новые страницы используют существующие boundaries |
| P4.3 | Atomic/direct publication, provider-neutral delivery, Admin delivery health/detail/replay API | Render-ready preview/diff, сквозная UI/cache observability |
| P4.4 | Local media storage, processing и immutable public variants | Production storage/CDN, scanner, cleanup/DLQ/metrics |
| P4.5 operational | House/campground pricing и Resource dossier; add-on, venue, program и event-service dossiers; canonical venue draft; Booking, ProgramRegistration и Event quote acceptance | Campground acceptance context; venue quote/acceptance; неподдержанные order/add-on types остаются fail-closed |
| P4.5 public | Release-pinned add-on, venue, house, campground, program и event-service listing/detail projections; ContentSource и 404/503/release consistency; standalone SSR/asset delivery gate; typed editorial CMS→publication→SSR bindings всех стандартных секций главной; CMS-driven `/houses/*`, `/campgrounds/*`, `/addons/*`, `/venues/*`, `/programs/*` и `/events/*` routes | Route-by-route migration |
| CRM integration | Booking↔Lead commands/history; promotion registry и order-level discount; отчёты по броням и UTM сохранённых Lead | Visitor analytics этими отчётами не закрыта |
| P4.6–P4.9 | Отдельные foundations описаны в профильных specs | Public intake, visitor analytics, controlled code и go-live не завершены |

Текущие ограничения:

- Booking/ProgramRegistration/Event принимают server-owned immutable quotes с exact context, versions и составом; preview не подтверждает заказ. Lifecycle/capacity/audit/outbox согласованы атомарно.
- Поддержаны назначенные quantity/person add-ons. Shared-capacity Event resources и scheduled-resource add-ons заблокированы; legacy manual/unpriced flows сохранены без автоматической миграции.
- CMS — editorial-only `/content/tree` и canonical drafts. Operational pricing/fulfillment остаются в CRM; CMS draft сам по себе не даёт public eligibility. Customer Event не создаёт CMS draft или payment.
- DB tests требуют отдельную disposable test database и restricted role. Старые результаты прогонов — исторические, не текущий gate.
- Standalone site runtime проверяется HTTP contract stub без БД; production backend/CDN/deployment gates этим не закрыты. Full-homepage visual baselines сверены с текущими секциями why-us/partners; стандартный site E2E теперь проходит.
- Homepage editorial snapshot теперь typed и release-pinned; operational карточки секций пока сохраняют отдельную safe-projection migration boundary и не должны восприниматься как CMS-owned facts.

## Следующий инкремент

1. P4.5F route-by-route migration: homepage, house, campground, addon, venue, program и event-service vertical route gates закрыты; следующим завершать resource URL/curated landing migration.
2. Render-ready preview/diff и сквозная delivery visibility; затем P4.6 public intake. Уже реализованный delivery API использовать повторно.

До go-live выбрать production media storage/CDN (хранение файлов и их публичная доставка), утвердить legal/privacy/retention и deployment gates. При выборе объяснить пользователю варианты и последствия; provider-neutral разработку это не блокирует.

## Границы

- `apps/admin` использует `packages/ui`, CRM session/capabilities и общие API contracts.
- CRM владеет resources, availability/capacity, prices, Lead/Booking/Payment; CMS — public profiles, copy, media, composition, SEO и publication.
- Standard pages — Astro templates + typed CMS fields; unique source pages — только `apps/site/src/managed/**`.
- CMS не исполняет TSX/HTML из БД. Custom code проходит allowlisted workspace, isolated build, review, atomic release и rollback.
- Public output привязан к immutable active release; draft/media originals/internal relations/PII наружу не выходят.
- First-party analytics использует opaque visitor/session IDs и server conversion facts; raw IP, contacts и form values не пишутся в analytics events.

## Индекс по задаче

Открывать один основной документ, а не всю папку:

| Задача | Документ |
|---|---|
| CMS routes/editors/states | `CMS-UX-SPEC.md` |
| Offering/pricing/CRM↔CMS/public model | `OFFERING-CATALOG-ARCHITECTURE.md` |
| Ownership/API/publication/media/code | `PLATFORM-ARCHITECTURE.md` |
| Public components/sections/booking | `PUBLIC-SITE-UI-KIT.md` |
| Managed page/artifact contract | `PUBLIC-PAGE-AUTHORING.md` |
| URL types/navigation/internal links | `SITE-STRUCTURE.md` |
| SEO/content quality | `SEO-STRATEGY.md` |
| Analytics/attribution/privacy/Метрика | `ANALYTICS.md` |
| Order/acceptance gate | нужный раздел `IMPLEMENTATION-ROADMAP.md` |
| CRM composition/promotion/reporting stages | `CRM-MARKETING-IMPLEMENTATION.md` |

SEO research и content workflow — в `SEO-STRATEGY.md`; будущие страницы требуют реального source evidence.
