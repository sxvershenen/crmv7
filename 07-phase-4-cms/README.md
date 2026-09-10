# Phase 4 — current status

Это единственная точка current status и следующего инкремента. Детальная история находится в `logs/`; долговременный порядок и acceptance gates — в `IMPLEMENTATION-ROADMAP.md`. Не читать их целиком для обычной implementation-задачи.

## Статус

- P4.1A public UI kit/homepage и P4.1B CMS frontend foundation реализованы.
- P4.2 CMS core/content/public read boundary реализованы.
- P4.3 atomic/direct publication реализована; render-ready preview/diff и delivery/cache observability не закрыты.
- P4.4 media foundation реализован; production storage/CDN, scanner, cleanup/DLQ/metrics не закрыты.
- P4.5 активна: catalog/pricing foundation, house и campground pricing/configuration/quote runtime, CRM operational editors для house, campground, addon и program, а также bounded P4.5E add-on safe public projection закрыты.
- CRM IA для проживания упрощена: домик/шатёр/палаточная зона открываются одним Resource dossier. Вкладка «Цена и сайт» не показывает operator-facing `Offering`/binding/PriceBook/RatePlan: она даёт одну базовую цену, включённых гостей, доплату, явные дни недели, праздники, особые периоды и сводку связанной страницы. При первом сохранении stay Resource цена, primary binding и CMS-черновик подготавливаются одним user action; legacy detail URL в CRM безопасно возвращает в Resource dossier. Новая бронь по Resource автоматически получает server-authoritative quote.
- Состав Booking поддерживает назначенные resource add-ons: CRM показывает их внутри позиции проживания, передаёт только assignment/quantity, а backend считает composite quote и сохраняет его ID со снимком строк допов рядом с booking item. При выборе «Подтверждено» CRM проводит lifecycle transition и принимает этот же immutable quote; service и PostgreSQL guard сверяют ресурс, даты, гостей, сумму и точный состав допов. CMS publication в operational доступности не участвует; первый bounded slice поддерживает `quantity_service` и `person_service`, а request-only/scheduled-resource остаются явно заблокированы.
- P4.5D CMS IA упрощена до editorial-only: `/content/tree` — единый реестр страниц, а отдельные списки главной/посадочных/категорий/предложений убраны из primary navigation и ведут в типизированные tree views. Offering deep links открывают только canonical content/composition/media/SEO/publication editor; operational pricing, bindings, fulfillment, versions и access diagnostics остаются в CRM. Структура сайта строится из authoritative `parentNodeId`/`sortOrder`, сохраняет exact page/source kinds и URL-state.
- P4.6 public intake, P4.7 analytics, P4.8 controlled code и P4.9 go-live не завершены.
- CRM «Маркетинг» имеет operational registry промокодов и отчёты по броням/UTM заявок. Промокод рассчитывается backend как отдельная скидка заказа; quote услуг сохраняет исходную стоимость. Состав Booking использует отдельные секции позиций и блокирует сохранение незавершённого расчёта. Сбор посетителей остаётся P4.6/P4.7; этапы и условия — `CRM-MARKETING-IMPLEMENTATION.md`.
- Phase 3 API-интеграция ручной связи Booking↔Lead закрыта: link/relink/unlink/history атомарно согласованы с booking version, idempotency, audit и outbox; CRM использует явные команды, сохраняет dirty draft и корректно работает в API/fixture modes. CLI, API и seed используют единый реестр миграций, а destructive test setup fail-closed проверяет отдельные test database и ограниченную роль. Отложенные regression assertions разобраны по причинам и закрыты без ослабления gate.
- Program offering Gate A закрыт: `/programs/:id` подготавливает одну commercial identity, exact primary ProgramTemplate binding и canonical `program_detail` CMS draft; CRM редактирует participant/package тариф и показывает server-authoritative `template_preview`. Preview фиксирует версии и остаётся непригодным для acceptance, public resolver отсутствует и fail-closed. Legacy `basePrice/published` после подготовки остаются только совместимостью и не редактируются.
- ProgramRegistration Gate B закрыт: подтверждение принимает только occurrence-bound `program_registration` quote с exact versions, participants, dates и supported add-ons. Capacity, lifecycle, accepted link, audit/outbox и idempotency фиксируются атомарно; PostgreSQL guards запрещают oversubscription и изменение принятых commercial facts. CRM хранит dirty draft отдельно от quote/requote, не отправляет client totals для priced registrations и показывает immutable accepted snapshot после reload. Legacy unpriced registrations сохранены без автоматической миграции.
- Event-service preview gate закрыт: существующий CRM workspace `/events/categories` открывает registry/create/dossier на `EventServiceTemplate`, а не второй пункт «Форматы». Сохранены прежние рабочие атрибуты категории — название, внутренняя заметка, allowlisted icon и цвет; они редактируются вместе с typed terms с owner-aware CAS. Атомарная команда создаёт template, exact primary `CatalogOffering(kind=event_service)` binding и canonical `event_detail` CMS-черновик. Named `flat_package` тарифы и server-owned same-local-date interval preview фиксируют guest/package, binding, template, pricing, rule/calendar и preparation pins в immutable `event_service_preview`; preview не проверяет availability, не резервирует ресурсы и имеет `acceptanceReady=false`. Customer `Event` и legacy `EventCategory` не связываются с template автоматически; public resolver остаётся fail-closed.

- Event order acceptance реализован отдельно от preview: `/events/:id` использует явную commercial identity, named package, назначенные quantity/person add-ons и immutable `event_order` quote. Confirmation атомарно принимает расчёт и резервирует явно выбранные fixed Resources с preparation interval; cancellation освобождает их и сохраняет историю. Database guards проверяют версии и TTL после locks. Customer Event не создаёт CMS draft и payment; legacy manual flow сохранён, замена его allocations стала атомарной. Shared-capacity Resources и scheduled-resource add-ons остаются fail-closed. Category workspace сохраняет dirty сегменты при tabs и soft reload.

House, campground и add-on gates закрыты: CMS использует exact `catalog_offering` locator только для canonical editorial workflow без operational копий и ручного relink. Campground различает отдельные owned tents и shared-capacity зону гостевых палаток. Add-on имеет компактный CRM dossier с typed quantity/person terms, reusable/offering-specific scope, одной operator-facing ценой с немедленным вводом после сохранения и usage diagnostics; внутренние PriceBook/RatePlan lifecycle не показываются. Add-on publication fail-closed требует exact public profile/revision relation и закрепляет `public.addon-summary.v1` dependency в immutable release. Public listing/detail получают цену из safe active backend projection, а не из CMS. Draft content, internal fields, raw pricing rules и availability promises наружу не выходят.

## Следующий инкремент

1. Закрыть узкий venue operational vertical slice: typed fulfillment/capacity semantics в CRM, canonical editorial draft в CMS и отдельный fail-closed public resolver.
2. Продолжать P4.5F route-by-route CMS migration и preview/diff/delivery observability; add-on acceptance для ещё не перенесённых order types остаётся fail-closed, после этого перейти к P4.6 public intake.

Production CDN/media providers (уточнить у юзера че это за хуйня и объяснить ему), legal/privacy/retention и deployment gates обязательны до go-live, но не блокируют provider-neutral implementation.

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
