# Phase 4 — current status

Это единственная точка current status и следующего инкремента. Историческое evidence находится в `logs/` (старые Next/Remaining не являются текущими задачами); долговременный порядок и acceptance gates — в `IMPLEMENTATION-ROADMAP.md`. Не читать их целиком для обычной implementation-задачи.

## Статус

| Контур | Реализовано | Осталось |
|---|---|---|
| P4.1–P4.2 | Public UI kit/homepage, CMS frontend/core, Admin/Public API | Новые страницы используют существующие boundaries |
| P4.3 | Atomic/direct publication, provider-neutral delivery, Admin delivery health/detail/replay API | Render-ready preview/diff, сквозная UI/cache observability |
| P4.4 | Local media storage, processing и immutable public variants | Production storage/CDN, scanner, cleanup/DLQ/metrics |
| P4.5 operational | House/campground pricing и Resource dossier; add-on, program и event-service dossiers; Booking, ProgramRegistration и Event quote acceptance | Venue slice; campground acceptance context; неподдержанные order/add-on types остаются fail-closed |
| P4.5 public | Release-pinned add-on listing/detail projection | Typed resolvers остальных offering kinds и route-by-route CMS migration |
| CRM integration | Booking↔Lead commands/history; promotion registry и order-level discount; отчёты по броням и UTM сохранённых Lead | Visitor analytics этими отчётами не закрыта |
| P4.6–P4.9 | Отдельные foundations описаны в профильных specs | Public intake, visitor analytics, controlled code и go-live не завершены |

Ограничения принятого commercial flow:

- Booking/ProgramRegistration/Event принимают server-owned immutable quotes с exact context, versions и составом; preview не подтверждает заказ. Lifecycle/capacity/audit/outbox согласованы атомарно.
- Поддержаны назначенные quantity/person add-ons. Shared-capacity Event resources и scheduled-resource add-ons заблокированы; legacy manual/unpriced flows сохранены без автоматической миграции.
- CMS — editorial-only `/content/tree` и canonical drafts. Operational pricing/fulfillment остаются в CRM; CMS draft сам по себе не даёт public eligibility. Customer Event не создаёт CMS draft или payment.
- DB tests требуют отдельную disposable test database и restricted role. Старые результаты прогонов — исторические, не текущий gate.

## Следующий инкремент

1. Узкий venue operational slice: typed fulfillment/capacity в CRM, canonical CMS draft и отдельный fail-closed public resolver. Не расширять его до общего перепроектирования offering engine.
2. P4.5F route-by-route migration, preview/diff и сквозная delivery visibility; затем P4.6 public intake. Уже реализованный delivery API использовать повторно.

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
| Stable technical defaults | `P4-0-DECISIONS.md` |
| Order/acceptance gate | нужный раздел `IMPLEMENTATION-ROADMAP.md` |
| CRM composition/promotion/reporting stages | `CRM-MARKETING-IMPLEMENTATION.md` |
| Evidence of completed increment | один соответствующий файл в `logs/` |

`COMPETITOR-ANALYSIS.md` и `CONTENT-CALENDAR.md` — planning inputs, а не implementation pre-read. Реальные search/competitor выводы требуют live data/source evidence.
