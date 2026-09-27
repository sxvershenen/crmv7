# Phase 4 — current status

Это единственная точка current status и следующего инкремента. Оставшийся scope и acceptance gates — в `IMPLEMENTATION-ROADMAP.md`. История проверок и инкрементов хранится в Git: `git ls-tree --name-only a1a649f:07-phase-4-cms/logs`, затем `git show a1a649f:<path>`. Историю читать только для конкретного спорного факта.

## Статус

| Контур | Реализовано | Осталось |
|---|---|---|
| CMS editor | Lossless hero/navigation/media adapters; сохранённый ID/version при частично успешных командах; SPA/unload/logout guard, conflict recovery и unsupported-schema readonly; простой обзор/дерево и mobile actionbar; FAQ/отзывы внутри страницы | C3–C12: остальные production UX gaps по roadmap |
| CRM ↔ CMS drafts | Каждый новый Resource получает видимый CMS-черновик; для домика, кемпинга, площадки и бани URL предлагается из названия и редактируется до публикации. House/campground/venue переиспользуют тот же node; public profile и relation создаются внутри guided flow. Первая активная цена включает предложение. Отключённый/архивный Resource сохраняет опубликованную страницу с соответствующей плашкой, без заявки; CRM-изменение инвалидирует public projection. `seed:demo` добавляет связанный локальный набор DEMO-WS1 без перезаписи существующих данных | Первый запуск страницы требует валидной commercial projection и опубликованных настроек сайта; старые неоднозначные mappings не исправляются автоматически |
| P4.1–P4.2 | Public UI kit/homepage, CMS frontend/core, Admin/Public API | Новые страницы используют существующие boundaries |
| P4.3 | Guarded render-ready preflight, effective diff/blast radius/dependencies, atomic direct publication, publication journal, delivery status/replay и immutable rollback | Закрыт; расширять только под новый publication consumer |
| P4.4 | Local/test и S3-compatible media storage, CDN URL delivery, fail-closed external scanner, staged processing retry/DLQ, orphan cleanup, safe health metrics, versioned blob replacement и page-filtered usage flows | Provider/data-location/retention approval и rights/source review перед migration |
| P4.5 operational | House/campground pricing и Resource dossier; add-on, venue, program и event-service dossiers; canonical venue draft; Booking, ProgramRegistration и Event quote acceptance | Campground acceptance context; venue quote/acceptance; неподдержанные order/add-on types остаются fail-closed |
| P4.5 public | Release-pinned commercial projections; CMS-driven canonical `/domiki`, `/kemping`, `/dopy`, `/poshadki`, `/programmy`, `/meropriyatiya`; one-hop legacy 301; typed editorial SSR; canonical/schema и sitemap/robots из active release | Закрыт для утверждённой URL-карты; новые curated nodes требуют реального редакционного evidence |
| CRM integration | Booking↔Lead commands/history; promotion registry и order-level discount; отчёты по броням и UTM сохранённых Lead. Resource, Event, ProgramTemplate и ProgramOccurrence уходят в доступный архив через подтверждение; история броней, регистраций и оплат сохраняется. Удаление регистраций из проведения убрано; снятие броней ресурсов, позиций брони и этапов программы/мероприятия требует подтверждения | Visitor analytics этими отчётами не закрыта |
| P4.6 | Public intake contract и `POST /api/public/v1/intake/leads`: sanitize/consent/UTM/referrer snapshot, honeypot, fail-closed HMAC(IP) rate limit, idempotent Customer + Lead transaction, audit/outbox и internal CRM deep link; homepage calculator отправляет typed request и не раскрывает CRM IDs | Закрыт; migration, disposable PostgreSQL integration и browser → API → CRM runtime-проверка пройдены |
| P4.7 analytics foundation | Public collector и site consent/client wiring с versioned consent evidence; consent-gated Metrika counter settings/tag runtime; append-only `lead.created`/`booking.created`/`payment.charge` conversion facts из authoritative outbox без PII и identity linking; protected on-demand aggregate read API, site-wide admin UI и daily series; period-unique visitors считается отдельно от дневных точек; recomputable Moscow-day page/section rollup, worker и read-path по полностью покрытым завершённым дням с exact raw fallback | Attribution linkage/models, Metrika reconciliation, retention/privacy workflows не завершены |
| P4.8–P4.9 | Отдельные foundations описаны в профильных specs | Controlled code и go-live не завершены |

Текущие ограничения:

- CMS product readiness не закрыта: пять основных разделов (`globals/sections`, `seo`, `marketing/campaigns`, `redirects`, `settings/site`) отображают demo specification; остаются visual preview, body authoring, полноценные settings/media/SEO flows, достоверность отдельных статусов и расширенная аналитика. Обязательный объём по всем разделам и acceptance — раздел «CMS — доведение продукта до production» в `IMPLEMENTATION-ROADMAP.md`. Завершённые backend foundations не означают готовность полного UX.
- Снятие страницы с сайта пока требует internal release `removeNodeIds`; кнопка «Архивировать» не меняет опубликованный release. Нужна отдельная понятная команда unpublish в CMS (C8), поэтому локально опубликованные demo-страницы нельзя скрыть обычным редактором.
- Booking/ProgramRegistration/Event принимают server-owned immutable quotes с exact context, versions и составом; preview не подтверждает заказ. Lifecycle/capacity/audit/outbox согласованы атомарно.
- Поддержаны назначенные quantity/person add-ons. Shared-capacity Event resources и scheduled-resource add-ons заблокированы; legacy manual/unpriced flows сохранены без автоматической миграции.
- CMS — editorial-only `/content/tree` и canonical drafts. Operational pricing/fulfillment остаются в CRM; CMS draft сам по себе не даёт public eligibility. Customer Event не создаёт CMS draft или payment.
- DB tests требуют отдельную disposable test database и restricted role. Старые результаты прогонов — исторические, не текущий gate.
- Media production config fail-closed: `APP_ENV=production` требует S3-compatible bucket, CDN base URL, external HTTP scanner и upload signing secret; local storage/scanner остаются только development/test adapters.
- Standalone site runtime проверяется HTTP contract stub без БД; production backend/CDN/deployment gates этим не закрыты. Full-homepage visual baselines сверены с текущими секциями why-us/partners; стандартный site E2E теперь проходит.
- Главная читает published public summaries домиков/программ/площадок/допов, афиша — ближайшие открытые проведения программ. Цена в карточке/окне/подборе обновляется при следующем запросе без новой CMS-публикации; no-store и один release проверяются. Media карточек ещё отсутствует в этих summaries; баня/чан и промокоды не показываются в API mode до соответствующих safe contracts. Map/directions и прежние hero media fallbacks требуют отдельного контентного подключения.

## Следующий инкремент

1. CMS: media picker/bindings и визуальный preview; затем оставшиеся C3–C10, CRM promotions/sauna contracts и API E2E по roadmap. Сохранность редактора и FAQ/отзывы уже реализованы; новые формы переиспользуют этот flow.
2. Параллельно закрыть go-live media decisions: provider/data-location/retention approval и rights/source review для approved media migration.
3. После надёжного редакционного ядра расширять P4.7 attribution linkage/models; минимальная аналитика должна честно отражать уже поддержанные измерения.

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
