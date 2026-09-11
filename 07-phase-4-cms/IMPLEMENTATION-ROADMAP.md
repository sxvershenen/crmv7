# Оставшаяся работа Phase 4

Текущий статус и ближайший инкремент — `README.md`. Здесь только незакрытый scope, зависимости и acceptance; реализованные foundations не являются очередью повторной реализации. Детали контрактов открывать в профильной spec по задаче.

## P4.5 — Offering и публичная миграция

### Оставшиеся commercial boundaries

- Campground quote ещё требует typed operational acceptance context.
- Venue использует typed exclusive Resource, canonical CMS draft и safe public projection, но его server quote/acceptance остаются отдельным order contract.
- Request-only/scheduled-resource add-ons и shared-capacity Event resources остаются fail-closed до отдельной fulfillment semantics.
- Audited repair для ambiguous legacy mappings отделён от ordinary UI; не угадывать bindings/basis и не включать автоматический backfill.
- Acceptance любого нового order type: exact subject/version/composition, DB-clock expiry после locks, atomic capacity/lifecycle/accepted link/audit/outbox и DB guards. Quote preview не резервирует capacity; accepted history не пересчитывается.

### P4.5E — Typed public projections

- После add-on, venue и house slices нужны resolver/contracts campground, program и event-service: listing/detail/price readiness и, где предусмотрено сценарием, quote/availability.
- Exact profile/revision relation, release-pinned dependencies, strict allowlist, source versions/hash/asOf и честный unavailable/request fallback обязательны.
- Operational change инвалидирует active projection независимо от CMS release; existing fenced delivery/cache-effect port используется повторно.
- Non-leak tests проверяют отсутствие draft/internal/customer fields. CMS source locator сам по себе не разрешает public output.

### P4.5F — Route-by-route delivery

Gate закрыт для утверждённой URL-карты. Canonical paths: `/domiki`, `/kemping`, `/dopy`, `/poshadki`, `/programmy`, `/meropriyatiya`; прежние English prefixes и `/resources/sauna-chan` получают прямой 301 без цепочек. Active release владеет опубликованными indexable routes, schema bindings, sitemap и robots. Typed `editorial-content` доставляет статьи, information/legal и содержательные curated nodes; сами новые landings публикуются только с реальным editorial evidence.

Homepage editorial binding gate закрыт: стандартные секции главной используют typed `homepage-section`/`partners`/`why-us` contracts, release order и visibility, а footer — typed global navigation/settings slot; ContentSource, global identity/navigation/default slots и Astro/React consumers проверяются в desktop/mobile CMS delivery E2E. Operational card collections остаются отдельной public-projection boundary.

House vertical route gate закрыт: `public.house-summary.v1` проверяет exact `CatalogOffering(kind=house)` → active CMS profile/revision → одну primary fixed Resource → active calendar, а public API отдаёт bounded list и detail по canonical CMS path. `/domiki/*` требует совпадающие CMS page и house projection из одного release; missing/malformed/mixed operational response даёт `503` без partial HTML. Price отсутствует — честный `request_only`, availability не вычисляется в странице.

Campground vertical route gate закрыт: `public.campground-summary.v1` проверяет exact `CatalogOffering(kind=campground)` → active CMS profile/revision → одну primary Resource → совместимые `CampgroundOfferingTerms`/capacity mode → единственную active campground membership → active calendar. `owned_tent` и `own_tent_pitch` разделены в public contract; whole-camp rental не появляется. `/kemping/*` требует совпадающие CMS page и campground projection из одного release, shared capacity не суммируется в браузере, а отсутствие price остаётся `request_only`. Public quote/acceptance для campground — отдельный commercial boundary.

Addon vertical route gate закрыт: существующий `public.addon-summary.v1` подключён к CMS `addon_detail` через release dependency с exact offering ID; `/dopy/*` сверяет `offeringId`, `contentReleaseId`, title и не рендерит route без dependency, malformed data или outage. Strict add-on terms и conservative price/readiness projection остаются operational authority; route показывает request fallback, если price отсутствует.

Venue vertical route gate закрыт: `public.venue-summary.v1` подключён к CMS `resource_detail` через release dependency с exact offering ID; `/poshadki/*` сверяет `offeringId`, `contentReleaseId`, title и не рендерит route без dependency, malformed data или outage. Exclusive-resource capacity, space type и conservative price/readiness projection остаются operational authority; interval availability и quote не выдаются в браузер, а отсутствие price даёт request fallback.

Program vertical route gate закрыт: `public.program-summary.v1` подключён к CMS `program_detail` через release dependency с exact offering ID; `/programmy/*` сверяет `offeringId`, `path`, `contentReleaseId`, title и не рендерит route без dependency, malformed data, no-price/no-occurrence response или outage. Generic public listing продолжает отдавать безопасные program cards, а typed detail projection показывает только template limits, duration, next open occurrence и conservative price/readiness; registrations, customer fields и quote acceptance остаются за CRM.

Event-service vertical route gate закрыт: `public.event-service-summary.v1` подключён к CMS `event_detail` через release dependency с exact offering ID; `/meropriyatiya/*` сверяет `offeringId`, `path`, `contentReleaseId`, title и не рендерит route без dependency, malformed data или outage. Typed detail projection показывает только редакционный summary, allowlisted format, duration, guest bounds и request-only readiness; customer Event, PII, resource selections и private event-order quote flow остаются за CRM.

Для каждой страницы: meaningful SSR HTML, один H1, crawlable links, metadata, image dimensions, минимальная hydration и desktop/mobile/keyboard/visual checks по затронутому сценарию. Production outage/invalid response не становится fixture fallback или ложным индексируемым 404. Renderer key/version/schema и порядок/config sections валидируются. Не менять одобренный дизайн без задачи.

Listing authoring/filter UX вводится для реального consumer; SQL projection/index/load gate нужен перед ростом каталога, не как предварительная универсальная подсистема.

## P4.3 — Preview и сквозная видимость доставки

Gate закрыт. Page editor сначала получает server-materialized effective content, before/after, affected paths, exact dependencies, validation issues и cache tags. Publish принимает preview hash + active release/version guard; stale preview и concurrent release отклоняются до atomic pointer switch. `/releases` показывает безопасный delivery status, capability-gated CAS replay и immutable rollback. Approved canonical leaf move создаёт release-derived 301; произвольный published move и non-leaf subtree move остаются fail-closed.

## P4.4 — Media hardening

- Production storage/CDN и внешний fail-closed scanner; cleanup unreferenced objects, processing retry/DLQ/metrics.
- Versioned blob replacement и page-filtered usages — отдельные scoped flows, если они нужны текущему редактору; существующие upload/archive не имитируют их.
- Миграция assets только после rights/source review. Spoof/oversize/decode/pixel/EXIF/SVG failures не проходят publish; published references защищены usage graph.

## P4.6 — Public intake

После готовности необходимых public projections: form endpoint, rate limit/anti-spam/sanitization, typed consent и UTM/referrer snapshot, idempotent Lead/contact creation, audit/outbox/notifications и CRM deep link.

Gate: retry не дублирует Lead; public success не подтверждает Booking и не раскрывает internal status/PII. Проверить реальную форму → CRM и error/consent paths.

## P4.7 — First-party analytics

Порядок: taxonomy/consent/stable IDs → collector/visitor/session/dedupe/bot classification → attribution и server conversion facts → aggregates/dashboards → consent-gated Metrika reconciliation → retention/privacy/export audit.

Operational marketing reports не доказывают visitor collection. Gate: refuse/revoke, server reconciliation, отсутствие raw IP/contacts/form values/cookies, purpose-bound identity access. Спецификация — `ANALYTICS.md`.

## P4.8 — Controlled code

Начинать, только когда schema-driven CMS покрывает обычные страницы и появился конкретный source-authoring use case.

Allowlisted managed workspace, persisted artifact revisions/build/dependency hashes, linked virtual file tree, versioned drafts, isolated preview/diff/review и signed release artifacts. Gate отклоняет traversal/symlink, secrets/socket/config access, SSRF/exfiltration, unsafe imports/HTML/dependencies/scripts и resource exhaustion; production не исполняет DB source. Детали — `PUBLIC-PAGE-AUTHORING.md`.

## P4.9 — Go-live

- Выбрать hosting/render mode/SLO, storage/CDN/data location, recovery/rollback owner и staging/production/preview environments.
- Утвердить privacy purposes, consent/retention, legal owner и допустимость identity links; engineering defaults не заменяют утверждение.
- Инвентаризировать legacy URLs/redirects, завершить approved content/media migration. Research/новые SEO landings только по реальным источникам.
- Search Console/Метрика после consent/legal readiness; performance/security, backup/restore/incident runbooks, content freeze, production release и reconciliation.
- Final gate: workspace typecheck/lint/unit/build; три API namespaces; PostgreSQL migrations/concurrency/jobs; затронутые admin/site E2E; privacy/upload/a11y/performance; publish/rollback/restore drill; отсутствие draft/internal/PII в public API/HTML.

Не выполнять go-live gate после каждой локальной правки. Verification записывается в итог задачи/коммит; менять этот план только при изменении scope/order/gate, не дописывать сессионные отчёты.
