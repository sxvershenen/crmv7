# Offering catalog architecture

Статус: durable product/domain architecture. Реализация отдельных slices меняется по мере Phase 4; фактический status и следующий increment находятся в `README.md` и релевантном roadmap heading.

## 1. Цель и граница

Платформа должна одинаково уверенно представлять и продавать шесть разных направлений:

1. домики;
2. кемпинги: несколько палаточных мест/палаток и общая зона;
3. допы и услуги: баня, чан, оборудование, кейтеринг и подобное;
4. площадки для аренды и мероприятий;
5. мероприятия под заказ: свадьбы, корпоративы и другие форматы;
6. готовые программы.

Для пользователя CMS эти offering kinds представлены typed nodes в одном canonical tree и locator/deep-link flow, а не шестью независимыми рабочими разделами и не одним generic `Public profiles`. Для backend это не шесть несвязанных систем: общие коммерческие правила живут в shared offering/pricing model, а особенности исполнения остаются в `Resource`, `ResourceGroup`, `ProgramTemplate`, `ProgramOccurrence`, `Event` и новых специализированных шаблонах.

Этот scope включает ручные календарные цены, тарифы и детерминированные правила. Автоматическое demand-based dynamic pricing, при котором алгоритм сам меняет цену из-за спроса/загрузки, по-прежнему не входит в первый релиз.

## 2. Один факт — один owner, разные интерфейсы

Operational facts редактируются в CRM, editorial facts — в CMS. Cross-app deep links и guided creation используют общие typed contracts, но не создают вторую authority или client-side synchronization.

| Группа данных | Authoritative owner | CRM | CMS | Public site |
|---|---|---|---|---|
| internal identity, operational kind, ресурсы, вместимость, ограничения, availability | CRM Operations | editable | readonly/deep link «Открыть в CRM» | safe projection only |
| price books, тарифы, календарные/праздничные правила, extra guest, коммерческие опции | CRM Pricing | editable | readonly/deep link «Открыть в CRM» | active safe quote/summary projection |
| фактические Lead/Booking/Event/Occurrence/Payment | CRM Operations | editable | readonly status/deep link | только allowlisted факты без internal status/PII |
| public title, marketing copy, media, benefits, FAQ, SEO, page composition | CMS Content | canonical draft/deep link where the workflow creates it | editable | active CMS release only |
| route, canonical, index policy, sitemap eligibility, redirects | CMS Publication | readonly/deep link | editable | active release only |
| effective card/detail/quote readiness | computed public projection | readonly | preview/readiness | public API only |

Инварианты:

- Admin API не пишет operational JSON в `cms_node_revisions`; CRM application service создаёт canonical draft при guided creation, а CMS редактирует editorial revision.
- Operational mutations проходят CRM command boundary; editorial mutations проходят CMS revision/CAS boundary. Они не копируют поля друг в друга.
- Каждая mutation передаёт только свой expected version и idempotency key; actor, request ID и entry point фиксируются в audit/outbox.
- SSE/outbox invalidates нужные query caches; UI никогда не «синхронизирует» данные клиентским copy/paste.
- Сохранённый CMS content draft виден в editorial preview, но production меняется только публикацией.
- Активированное operational изменение сразу видно в CRM и safe projection с новым `asOf`; price book можно подготовить как draft и активировать/запланировать отдельно.

## 3. Целевая предметная модель

### 3.1 `CatalogOffering`

Стабильная CRM-owned коммерческая identity, которая связывает продажу, исполнение и публичный профиль.

Общие поля:

- `id`, `code`, catalog `version`, persistent `subjectVersion`, `pricingVersion`, `addonAssignmentsVersion`, audit/archive fields;
- `kind`: `house | campground | addon | venue | event_service | program`;
- `operationalName` и необязательный внутренний комментарий;
- `state`: `draft | active | paused | archived`;
- `salesMode`: `request_only | quoted | selectable`; public v1 всё равно создаёт Lead, не confirmed Booking;
- `priceDisplayMode`: `from | exact | request`; absence from public is controlled by state/readiness/publication, not a second `hidden` flag;
- `currency`, `timezone`, `taxMode` как явные business settings;
- `primaryBinding` и дополнительные `OfferingBinding`;
- `capacityPolicyId`, `activePriceBookId`;
- `publicEligibility`: вычисляемая readiness, а не ручной `showOnSite` boolean;
- `leadDirection`, routing/assignee defaults и notification policy.

`Resource.kind` и `settings.showOnSite` недостаточно типизированы для этой роли и после миграции не должны оставаться единственным каталогом продаж.

### 3.2 `OfferingBinding`

Связывает предложение с тем, что реально исполняется:

- target: `Resource | ProgramTemplate | EventServiceTemplate`; campground shared capacity binds to a dedicated `Resource`. `ResourceGroup` остаётся navigation/operational grouping и не является sellable binding в v1; если имя сохранено в schema enum, оно reserved и не runtime-supported.
- role: `primary | required | optional | shared_area | inventory_unit`;
- quantity/capacity impact defaults;
- interval/preparation policy;
- whether availability is required for quote/intake.

Один `ProgramOccurrence` или фактический `Event` не является постоянным предложением. Это проведение/заказ, созданный по template/offering и сохраняющий snapshot использованных условий.

### 3.3 `PriceBook`, `RatePlan` и `PriceRule`

`PriceBook` — versioned набор правил одного offering:

- name, currency, `draft | active | scheduled | retired`;
- `validFrom`, `validTo`, timezone;
- immutable version after activation;
- activation/schedule actor, reason и version;
- один active book на offering/currency/time slice; пересечения запрещены.

Current active and future scheduled books use separate non-overlap constraints: a future revision may be scheduled while the current active revision is open-ended. Activation atomically retires the old active pointer and activates the scheduled book; the active pointer has a composite FK and cannot reference another offering's price book.

`RatePlan` — именованный продаваемый тариф или пакет:

- internal/public-neutral label;
- `pricingBasis`: `per_night | per_day | per_slot | per_hour | per_person | per_unit | flat_package`;
- base inclusions: included guests/units/duration;
- min/max quantity, min/max duration;
- cancellation/deposit reference, если эти правила позже войдут в scope;
- display order, default flag and applicability.

`PriceRule` хранит только детерминированные dimensions:

- selector `any_date | day_class | calendar_holiday | custom_date_override`;
- `day_class` contains only weekday/weekend, while calendar holidays and arbitrary date/range overrides are structurally different selectors;
- participant/guest quantity range;
- booking lead-time range in calendar days;
- duration/slot range where applicable;
- amount and optional `extraUnitAmount` after included quantity;
- priority, exclusive flag, reason/source.

Разрешение цены выполняет backend quote service. Рекомендуемый порядок специфичности:

1. `custom_date_override`;
2. `calendar_holiday`;
3. weekday/weekend `day_class`;
4. `any_date` rule;
5. base rate plan.

Within one date rank, more matched typed dimensions win, then explicit priority. An equal final rank is an ambiguity validation error.

При одинаковой специфичности два активных правила не могут пересекаться по тем же dimensions. Никакого «первое попавшееся правило».

### 3.4 `BusinessCalendar`

- site timezone and local service date;
- day class `weekday | weekend | calendar_holiday`;
- label, source and source version;
- official calendar may be imported, but every imported day is reviewable;
- manual override has explicit reason/audit and higher specificity;
- pricing preview always shows which calendar day and rule won.

Праздник не выводится из `Saturday/Sunday`: переносы рабочих дней и специальные даты хранятся явно.

Pricing selectors intentionally remain separate:

- `calendar_holiday` applies to dates classified as holidays by the versioned production/business calendar;
- `custom_date_override` applies only to explicitly selected arbitrary date/date range and has higher specificity;
- UI never merges them into one vague «Особые даты» control.

### 3.5 Допы и кейтеринг

Библиотечный или кастомный доп — это тот же `CatalogOffering(kind=addon)`, а не вторая параллельная сущность `OfferingOption`. Поэтому баня, чан, кейтеринг, оборудование, размещение или декор получают одну operational identity, собственные binding/PriceBook/RatePlan, CMS-профиль и аудит.

Addon-offering имеет scope:

- `reusable` — доступен в общем справочнике;
- `offering_specific` — создан из конкретной программы/свадьбы/площадки и принадлежит ей, но остаётся полноценной типизированной записью.

`OfferingAddOnAssignment` связывает родительское предложение с addon-offering и хранит только контекст подключения: required/recommended state, order/group, quantity overrides, public label/description overrides и необязательный stable `ratePlanKeyOverride`. Сумма в assignment не копируется: выбранный тариф разрешается из активного versioned price book допа.

Библиотека поддерживает server-side поиск по нормализованному названию/code/category, cursor pagination и active/archive/scope filters; selector остаётся пригодным для десятков и сотен записей. Inline «Создать свой доп» атомарно создаёт `offering_specific` addon-offering и assignment.

CMS может менять public title/marketing description/media через тот же CMS-профиль допа, но identity, binding и цена остаются CRM-owned. Это покрывает «заголовок + описание + разные тарифы кейтеринга» without embedding arbitrary price arrays in page content.

### 3.6 Quote and booking snapshot

`QuoteRequest` contains offering/rate/add-on assignment IDs, local service dates, guests/participants, quantities and currency. Quote instant is never client-controlled: backend clock fixes it as `calculatedAt` and derives optional lead-days rules in offering timezone. `QuoteResult` returns:

- total and line items;
- price book/rate/rule IDs and versions;
- inputs, timezone, `calculatedAt`, `validUntil`;
- warnings/readiness without internal reasons;
- `displayMode` and public-safe explanation.

Confirmed operational records snapshot the accepted quote/rules into `BookingItem`, `ProgramRegistration` or `Event`; later price-book edits never rewrite historical totals.

## 4. Направления и обязательные поля

### 4.1 Домики

Operational:

- primary accommodation `Resource`, capacity, sleeping places/rooms if needed for sale;
- check-in/out, minimum/maximum nights, preparation intervals, allowed arrival days;
- rate plans per night;
- weekday/weekend/holiday prices and exact-date overrides;
- closed-to-arrival/closed-to-departure/min-stay overrides when availability rules are implemented;
- included guests and optional extra guest price only if the business uses this rule;
- bookable options and resource dependencies.

CMS:

- public name, short/full description, benefits, amenities explanation, included/not included;
- hero/gallery/floor plan, badges, FAQ/restrictions, related offers;
- detail/listing variants, CTA, SEO/schema eligibility.

Public:

- published CMS profile + active offering;
- capacity and `priceFrom`/quote from safe operational projection;
- availability only from public availability/quote endpoint.

### 4.2 Кемпинги

Target composition:

- `ResourceGroup` for navigation/operational grouping of the campground, not as a whole-camp sellable unit;
- one fixed inventory `Resource` for each owned tent sold individually, with either its own offering/profile or an explicitly pooled offering when tents share every commercial rule;
- a separate `CatalogOffering(kind=campground)` bound to one shared-capacity `own_tent_area` resource for guests installing their own tents;
- configurable `capacityTotal` for that area, initially expected around 15 tent places; one selected place consumes one capacity unit;
- separate offerings/rate plans for an owned tent and an own-tent pitch, both priced per local night;
- no whole-camp/exclusive-group rental mode in current scope;
- weekday/weekend/calendar-holiday prices and explicit custom-date overrides;
- group, area and guest-capacity checks stay backend-owned; UI never subtracts capacity itself.

CMS additionally explains layout, shared facilities, access, quiet/safety rules and what the group booking includes. Public availability must never sum capacities client-side.

### 4.3 Допы и услуги

Subtype/capability, not a free-text bucket:

- `scheduled_resource`: баня/чан with slots, duration, preparation and conflict checks;
- `quantity_service`: equipment/firewood/transfer-like quantity;
- `person_service`: catering or per-person service;
- `package_service`: fixed bundle;
- `content_only`: non-bookable CMS material, which cannot show authoritative price/availability.

Operational fields: pricing basis, duration/slot step, quantity/capacity, resource binding, availability requirement, standalone vs only-with-offering, applicability, tax/currency and price rules. CMS fields: public title/description, usage instructions, inclusions, restrictions, media, related offers and CTA.

### 4.4 Площадки

Operational:

- venue `Resource`, indoor/outdoor/mixed, capacity and availability;
- rental interval, setup/cleanup, min/max duration;
- base price by weekday/weekend/holiday and exact date;
- `includedGuestCount`;
- `extraGuestAmount` for every guest above included count, optional ceiling/tiers;
- alternative hourly/day/package plans;
- required/optional equipment, catering and other options;
- season/closure constraints.

Quote formula is server-owned: selected base rule + validated extra guests + selected options. CMS shows only published explanation and returned figures.

Реализованный operational slice не дублирует terms в отдельной venue-таблице: `Resource` владеет `spaceType` и fixed capacity, primary `OfferingBinding` — exclusive availability и setup/cleanup, `RatePlan` — basis, duration bounds, included guests и extra guest amount. Guided CRM flow создаёт один `CatalogOffering(kind=venue)`, exact primary binding и canonical `catalog_offering → resource_detail` CMS-черновик. `public.venue-summary.v1` читает только active release и exact projection dependency; interval availability count наружу не выдаётся. Shared capacity, duration selectors в price rules и venue order acceptance остаются fail-closed до отдельного контракта.

### 4.5 Мероприятия под заказ

Постоянная категория мероприятия — `EventServiceTemplate` с exact primary `CatalogOffering(kind=event_service)` binding. Она не равна фактическому CRM `Event`, который содержит клиента, телефон, даты, планирование и оплаты. Несколько категорий могут иметь одинаковый `format`; это классификация, не identity.

`/event-services` создаёт template, offering, binding и один canonical `catalog_offering → event_detail` CMS-черновик атомарно и идемпотентно, без публикации. `/events` создаёт клиентские заказы: создание заказа не создаёт CMS node/revision/source link и не копирует клиентские поля в CMS. Одна категория обслуживает много заказов; legacy `EventCategory` не связывается с template по имени или ID. Исторические customer Event CMS links требуют отдельного read-only inventory и решения о cleanup.

Operational template:

- format/category: wedding, corporate, birthday, other allowlisted values;
- default duration and required resources;
- named `RatePlan` packages;
- package price and included guest limit;
- extra guest amount/tier above package limit;
- min/max guests, date/holiday overrides;
- reusable option groups: catering tariffs, decoration, equipment, accommodation, sauna etc.;
- lead routing, preparation and quote requirements.

Customer Event uses an explicit commercial offering relation, persisted package/add-on/resource selections and an Event/version-bound `event_order` quote. The immutable `event_service_preview` remains ineligible for acceptance. A planning→booked command atomically accepts server commercial facts and allocates selected supported resources; it never creates a payment or an additional Booking charge for an included resource. Cancellation releases allocations and retains quote/payment history. Legacy manual orders keep their existing identity and pricing mode. Public site exposes the offering, never arbitrary customer events.

Resource V1 accepts explicit fixed/exclusive Resource selections at quantity=1 and capacityImpact=1, with the server preparation interval. Guest count is a separate commercial limit. Shared capacity and scheduled-resource add-ons require a later fulfillment contract; CMS publication does not determine availability. Priced customer Events without selected resources do not imply resource availability.

### 4.6 Готовые программы

`ProgramTemplate` remains the operational template and is linked to `CatalogOffering(kind=program)`.

Required fields:

- duration, min participants, participant/registration limit;
- program stages and required resources;
- one or more named rate plans;
- participant-count tiers (`minParticipants`, `maxParticipants`, amount/basis);
- booking lead-time tiers (for example early booking) with explicit `minLeadDays/maxLeadDays`;
- service-date/holiday overrides;
- whether price is per participant, group or package;
- option groups, including catering tariffs with label, description, price/basis and applicability;
- occurrence override policy: which fields a run may override and whether public occurrence is exposed.

`ProgramOccurrence` owns date/time, current limits, registrations and operational status. It may pin/override an approved rate plan for that run, but a CMS editor cannot edit an occurrence through content JSON.

Lead-time rule is optional and mainly supports early-booking/promotional tariffs. It is evaluated from the server quote fixation instant to the local service start; quote stores that instant, selected rule and expiry. Without such a rule, booking time does not affect price.

## 5. CMS information architecture

### 5.1 Navigation

CMS primary navigation is editorial-only:

**Сайт**

- Обзор;
- Страницы сайта (`/content/tree`);
- Блог и материалы.

The tree is the only primary page registry. Homepage, landings, category/listing nodes and offering-linked pages are typed nodes in that tree, not competing sections. Taxonomies, listing definitions, public profiles and offering locators remain backend concepts or capability-gated repair diagnostics.

Compatibility routes resolve into the tree or the canonical editorial locator:

```text
/content/tree?type=landing
/content/tree?type=category
/content/tree?source=catalog_offering
/offers/:kind/:offeringId
```

Legacy `/content/pages`, `/content/categories`, `/content/public-profiles` and direction list routes redirect to a filtered tree. Offering detail routes are locator-only deep links: they resolve the exact canonical CMS node and mount the same editorial editor.

### 5.2 Direction workspace

There is no operational direction workspace in CMS. A filtered tree view may expose only editorial signals:

- page title and canonical route;
- content/review/publication state;
- content, media and SEO blockers;
- canonical route and last public update;
- page type/source kind and updated time.

Primary actions are create page, open, preview, request review and publish. Price/capacity/availability readiness is not edited or summarized here; the page offers an explicit «Открыть в CRM» link where an operational dossier exists.

### 5.3 Offer editor

Offering-linked pages use the canonical route-driven editorial editor with five tabs:

1. **Содержимое** — public copy and typed fields.
2. **Блоки страницы** — composition and related public sections.
3. **Медиа** — assets, alt/focal point and usage.
4. **SEO** — snippet, canonical/index/schema checks.
5. **Публикация и история** — draft/live diff, review, blockers and rollback links.

Bindings, fulfillment, tariffs, PriceBooks, operational activation, capacity, availability, raw versions and access matrices never appear in this ordinary CMS editor. Files/code and repair diagnostics are separate elevated tools, not offering tabs.

The fixed action bar contains only editorial commands:

- `Сохранить черновик`;
- `Отправить на проверку` where review is configured;
- `Опубликовать страницу` after all gates pass.

Active price is not a CMS field. Public SSR joins the published editorial release with the safe backend offering projection by stable `offeringId`; operational changes invalidate that projection independently of editorial publication.

## 6. Creation and cross-app workflows

### 6.1 Create from CRM

1. Create operational aggregate/offering through CRM service.
2. For an editorial source (including an event-service category), in the same transaction create `CmsSourceLink` and minimal CMS draft/workspace. Customer Event orders are not editorial sources and do not create CMS artifacts.
3. CMS displays it in the correct direction as `Нужно заполнить`, not as a generic profile.
4. CRM owns price/capacity; CMS completes content/route/media/SEO.
5. First launch atomically validates active offering, active price book where required, public profile relation and CMS release.

### 6.2 Create from CMS

For a bookable direction, «Создать» is a guided operational command, not a CMS-only page:

1. choose kind/subtype and minimal operational identity;
2. Admin API invokes the same CRM application service;
3. backend creates offering + source link + CMS draft;
4. user continues in the canonical editorial editor; operational fields are edited through the CRM dossier.

Only explicit `content_only` services/landings may exist without an operational offering, and they cannot claim price/availability or appear as bookable cards.

### 6.3 Edit and publish

- Operational save in CRM becomes visible in both apps immediately; draft/active price-book state is explicit.
- Editorial save becomes one immutable CMS draft revision visible in both apps.
- Production content changes only after publication.
- Public operational projection changes on activation/effective time and emits cache invalidation.
- First launch is blocked unless operational + editorial + route/media/SEO gates agree.
- Deactivation/archiving proposes public hide/unpublish/redirect behavior; no silent orphan page.

### 6.4 Canonical editorial locator

The operational and editorial aggregates are joined by one canonical locator, not by copied fields or a route:

- `CmsSourceLink(sourceKind=catalog_offering, sourceId=CatalogOffering.id)` points to exactly one CMS node;
- the existing uniqueness of source and node makes both directions one-to-one;
- `sourceVersion` records the offering version observed when the link was created or promoted, but is not a second operational CAS;
- approved editorial mappings are `CatalogOffering(kind=house|campground) → CmsNode(kind=resource_detail)` and `CatalogOffering(kind=addon) → CmsNode(kind=addon_detail)`; later kinds require their own approved CMS/public contract;
- locator creation may seed only safe editorial placeholders. It never copies internal comments, pricing, availability or Resource settings into a CMS revision;
- `CmsPublicProfile` remains a separate public-eligibility/launch gate. A source link alone never makes a node publishable.

Fresh offering creation and guided CMS creation must call one transaction-aware helper that creates the offering editorial draft and locator atomically. Existing legacy `resource` source links may be promoted in place only when that Resource is the exact non-archived primary binding of one house offering; ambiguous candidates stay unchanged and are reported by an audited dry-run/backfill.

Until the safe offering projection exists, publication of a `catalog_offering`-linked node fails closed. It requires an exact public profile, a matching revision relation, compatible active offering/node kinds, a resolvable allowlisted public projection and release-pinned projection version/hash. Locator APIs stay outside the public namespace and ordinary editor UI does not expose unlink/relink; repairs are separate audited operations.

## 7. APIs, events and projections

Application services are shared even if transport namespaces differ:

- internal CRM: `/api/internal/v1/offerings`, `/price-books`, `/quotes`;
- admin facade: `/api/admin/v1/offerings`, `/price-books`, `/options`, delegating to the same domain services and capabilities;
- public: `/api/public/v1/offerings/:id/summary`, `/quote`, `/availability`, plus release-pinned listing/profile payloads.

Recommended events:

- `crm.offering.created|changed|state_changed`;
- `crm.price_book.activated|scheduled|retired`;
- `crm.business_calendar.changed`;
- `crm.offering_option.changed`;
- `cms.offering_profile.draft_changed|published|unpublished`;
- `public.offering_projection.invalidated`.

Every public projection includes `offeringId`, kind, source versions, `asOf`, readiness/freshness and safe fallback. Public DTOs never contain internal comments, customer event data, cost/margin, unpublished rates or detailed conflict reasons.

Listings should move from the current broad `resource | program` distinction to explicit allowlisted offering kinds. Filters are defined per kind from a registry; arbitrary JSON paths cannot become public filter fields.

## 8. AI-authored public pages

Unique page layout remains source-authored in `apps/site/src/managed/**`. The artifact never queries PostgreSQL/internal API and never embeds copied prices.

Each artifact manifest declares typed bindings such as:

- `offeringProfile(offeringId)`;
- `offeringSummary(offeringId)`;
- `offeringQuote(offeringId, allowedInputs)`;
- `offeringAvailability(offeringId, allowedInputs)`;
- `relatedOfferingListing(definitionId)`.

The CMS release pins route/content/media/artifact versions and the offering relation. Live operational responses carry their own source versions/`asOf`; raw SSR HTML must render a safe published summary and must not turn a failed operational dependency into invented price/availability.

For AI generation the agent receives field schemas and fixtures, not database credentials. Generated code may choose composition only; pricing formulas, eligibility, sorting/filter allowlists and booking outcome remain backend-owned.

## 9. Validation and acceptance gates

- one active price-book version for a time slice; no ambiguous equal-priority rule overlap;
- all monetary values integer minor units + ISO currency;
- timezone/local-date behavior covered at midnight/DST-independent site-zone boundaries;
- holiday/manual override and rule explanation tests;
- min/max/included/extra guest invariants;
- campground shared/inventory allocation conflict tests;
- option applicability, mutual exclusion and quantity tests;
- quote idempotency and immutable Booking/Event/Registration snapshot;
- identical mutation through CRM and CMS produces one authoritative version/audit history;
- stale version in either app returns common conflict shape;
- published profile without eligible active offering and required price/capacity is blocked;
- archived/paused source gives typed hide/unpublish/fallback behavior;
- public contracts contain no drafts/internal status/PII;
- SSR/card/detail/quote mobile, keyboard, loading/error/stale states;
- route/canonical/sitemap and cache invalidation remain release-consistent.

## 10. Delivery increments

1. **P4.5A — Domain lock:** offering kinds, campground sales units, business calendar and price-basis semantics.
2. **P4.5B — Pricing core:** price books/rules, quote snapshots and operational acceptance with DB guards.
3. **P4.5C — CRM editors:** type-specific operational panels and shared command repositories.
4. **P4.5D — CMS editorial workspaces:** one page tree, canonical locators and content/publication panels.
5. **P4.5E — Public projections:** allowlisted offering-kind DTOs, release pinning and no-leak tests.
6. **P4.5F — Route migration:** one vertical slice at a time, with meaningful SSR content and proportionate visual/SEO regression.

These are architectural increments, not a second current-status list. Open only the relevant roadmap section and keep each implementation task bounded; record the command/result with the implementation change and update current status only when the gate changes. Ownership follows root/scoped `AGENTS.md`.

## 11. Confirmed P4.5A product semantics

Confirmed by product owner on 2026-08-31:

1. campground sells owned tents individually and shared-capacity places for guests’ own tents; there is no whole-camp rental in current scope;
2. holiday pricing is a named `calendar_holiday` rule sourced from the Russian production calendar with manual calendar corrections; arbitrary dates/ranges use a separate higher-priority `custom_date_override`;
3. accommodation/campground pricing resolves every occupied local night independently;
4. catering and other add-ons form a reusable searchable library; custom items can be created and each offering selects its own set with assignment-specific terms;
5. optional lead-days pricing is allowed for early-booking/promotional rules and is fixed by the backend quote instant;
6. every offering selects public display mode `exact | from | request`; public v1 still creates a Lead and never a confirmed Booking;
7. active operational price changes follow their own activation/effective schedule; editorial copy still requires CMS publication.

Adult/child differentiation is not required by the confirmation and remains out of the initial schema constraint: v1 uses one guest/participant quantity unless a later product decision adds typed guest categories.
