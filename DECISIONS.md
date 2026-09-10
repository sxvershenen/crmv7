# Действующие решения

Только выборы, которые нельзя безопасно восстановить из кода: authority, продуктовые ограничения и причины нетривиальных границ. Детали API/полей — в профильной spec и коде; состояние работ — в `07-phase-4-cms/README.md`.

Реестр редактируется по текущему решению, а не дополняется противоречащими записями. Сохранены ID действующих решений; пропуски — завершённые этапы, дубли и заменённые решения. Полная история D-001–D-086: `git show a1a649f:DECISIONS.md`.

## D-033 — Booking↔Lead: ручная связь без автоконверсии

Одна активная связь на Booking, несколько Booking на Lead; разные клиенты не запрещают ручную связь. Связь не меняет клиента, статус или оплату. Missing/archived target отклоняется, но существующую связь с archived Lead можно снять. История append-only; capability/version/idempotency/audit/outbox проверяются сервером. Exact replay предшествует проверке текущей версии; no-op допускается только после CAS и не создаёт side effects. CRM сохраняет dirty draft, выполняя отдельную relation command.

## D-039 — Public frontend: Astro-first

Astro владеет meaningful HTML и metadata, React используется отдельными SSR/hydrated islands. Public frontend не импортирует CRM UI, DB или internal API. Fixture content допустим только в явном dev/test mode. Режим доставки уточнён D-048; контракты presentation — `packages/site-ui/AGENTS.md`.

## D-046 — Публикация целым immutable release

Routes, redirects, navigation/defaults, editorial revisions и зависимости принадлежат одному complete release. Materialization фиксирует exact revisions, activation меняет один CAS pointer, rollback создаёт новый release на проверенные artifacts. Mutable draft/archive не меняет опубликованный snapshot. Inheritance разрешается явно; отсутствующая база блокирует публикацию. Оператор публикует страницу одной командой, а не управляет build/activation вручную.

## D-047 — Controlled code не исполняется из БД

Обычные страницы — Astro templates + typed CMS fields. Уникальные source artifacts ограничены `apps/site/src/managed/**`, проходят isolated secretless build, review и atomic release. CMS не редактирует production checkout, dependencies или config. Полный будущий gate — `07-phase-4-cms/PUBLIC-PAGE-AUTHORING.md`; это не требование строить универсальный page builder.

## D-048 — Три API и независимая доставка

Internal/Admin/Public API и OpenAPI изолированы. Public site читает published projections через server/same-origin boundary, не входит в credentialed CRM/CMS CORS trust. Цель доставки — Astro server/hybrid + invalidation; static rebuild допустим как явно выбранный fallback с SLO. Конкретные production hosting/CDN — go-live выбор, не причина создавать второй delivery runtime.

## D-049 — Аналитика без восстановления личности

First-party visitor/session IDs непрозрачны и выдаются сервером. Analytics не хранит raw IP, контакты, form values, cookies или полный referrer/query. Raw IP допустим только в отдельно утверждённом security contour. Конверсии — server facts Lead → Booking → Payment; Метрика consent-gated и сравнительная, её ID не означает аккаунт человека. Identity links требуют отдельной цели, retention, capability и audit. Подробности — `07-phase-4-cms/ANALYTICS.md`.

## D-050 — Модель агентной работы Phase 4

Модель и effort main выбирает пользователь. Делегируемая роль — worker (Luna xhigh): discovery, обычная реализация и targeted checks; main принимает решения, выполняет сложные части и интеграцию. Актуальные правила ownership и маршрутизации — в `AGENTS.md` и инструкциях пользователя; roadmap не назначает модели. Заменяет первоначальное распределение Sol/Terra.

## D-059 — Рефакторинг public UI не разрешает редизайн

Сохранять одобренный вид и поведение; историческая pre-migration точка — `9cd146a`, последующие принятые изменения сохраняются. Baseline меняется после визуального сравнения и объяснения намеренного отличия. Новые patterns требуют реального consumer, package export, gallery и соразмерной regression coverage. Детали размеров/вариантов читаются из текущих consumers, а не из старого журнала.

## D-060 — Повторная авторизация сохраняет CMS draft

CMS использует canonical CRM cookie session. Initial 401 открывает login; expiry после загрузки — re-auth поверх смонтированного editor с сохранением URL/dirty state. Вход другим пользователем требует reload. Capabilities применяются одинаково к навигации и прямым routes; invalid credentials не маскируются как истёкшая сессия.

## D-063 — Private originals, immutable public media

Versioned asset отделён от immutable blob/variants. Signed scoped upload ограничен MIME/size/hash/TTL; MIME/magic/scan/decode/pixel limits проверяются до public readiness. Originals private, публичны только ready variants без EXIF/GPS. Usage graph защищает published references от удаления. Production provider/scanner и cleanup — отдельные незакрытые gates, не готовность локального адаптера.

## D-064 — Публичная проекция не равна operational записи

Listing definition и editorial dependencies закреплены release. Public resolver допускает только утверждённые fields/filter/sort и exact profile relation; operational Event/Occurrence, draft и PII не публикуются. Query filter pages имеют noindex/canonical на базовый route; индексируемая curated landing — отдельный CMS node. Отсутствие безопасной цены/availability не заменяется выдуманными значениями.

## D-071 — Одна коммерческая authority

CatalogOffering, typed bindings, PriceBook/RatePlan/rules/calendar и assigned add-ons принадлежат backend. CRM/CMS transport adapters переиспользуют один application service, named owner versions и audit/idempotency; UI boundary — D-082. Editorial release и active operational price меняются независимо. Принятый заказ хранит immutable server calculation. Demand-based algorithmic pricing и автоматическая миграция неоднозначных legacy price/type данных не входят в согласованный scope.

## D-074 — Один consumer-scoped delivery runtime

Fenced leases/epochs, immutable attempts/receipts, bounded retry/DLQ и audited replay принадлежат одному state machine. Успех SSE не закрывает public projection: событие завершено после всех consumers. Monotonic generation и durable database epoch реализуют cache-effect port; CDN adapter подключается к нему. Сам delivery success не создаёт safe public DTO или eligibility.

## D-076 — Canonical CMS locator не даёт public eligibility

CmsSourceLink связывает source и node one-to-one; slug, route и fulfillment binding не заменяют identity. Public publication требует exact profile/revision relation и safe typed resolver отдельно. Legacy promotion сохраняет ту же строку, node/revisions/history; ambiguity блокирует операцию. Ordinary UI не получает unlink/relink — это отдельный audited repair. Migration editorial locator forward-only: принятая идентичность не откатывается в старый неоднозначный locator.

## D-078 — Campground продаёт Resource, не ResourceGroup

ResourceGroup — навигация. Owned tent — отдельный fixed Resource, capacity означает гостей; own-tent area — shared Resource, capacity означает палаточные места, одна палатка расходует unit. Owned tent оплачивается за ночь; цена каждой локальной ночи own-tent area умножается на запрошенные units. Subtype неизменяем, membership/capacity/binding совместимы. Quote preview не резервирует availability; operational acceptance требует отдельного typed context.

## D-080 — Простой тариф проживания

Resource dossier показывает одну default-цену, included/extra guests, weekdays, holidays и special periods; technical PriceBook/RatePlan скрыты. Порядок: custom period → calendar holiday → recurring weekday → base; равнозначные правила и legacy ambiguity блокируют расчёт. UI показывает RUB, transport/storage — integer minor units. Price preview не заменяет acceptance quote.

## D-082 — CRM operations, CMS editorial-only

CRM business dossier: Resource для проживания/площадки, ProgramTemplate для программы, EventServiceTemplate для формата. Guided creation подготавливает hidden commercial identity/binding/canonical draft одним действием без второго справочника. Цена, availability, capacity и fulfillment остаются в CRM.

CMS primary registry — `/content/tree`; editor владеет content/media/composition/SEO/publication. Старые offer routes — locator/deep links, public profiles — diagnostics. CMS не монтирует второй operational editor. Публичная цена берётся из allowlisted active backend projection, не CMS revision; недоступная цена отображается «по запросу».

## D-083 — ProgramTemplate, occurrence и registration разделены

Template владеет сценарием/duration/participant bounds; offering — pricing; occurrence — датами/capacity; registration — заказом. Pricing basis задаётся явно: per_person или flat_package; participants не равны числу registrations. Template preview имеет acceptanceReady=false. Legacy basePrice/published не доказывают basis или public release; migration не угадывает их.

## D-084 — ProgramRegistration принимает occurrence-bound quote

Confirmation атомарно проверяет exact versions/dates/participants/currency/tariff/assignments, capacity и expiry, записывает status/accepted link/server total/audit/outbox. Quote не резервирует capacity. Accepted commercial facts защищены service и DB; stale quote требует requote. Поддержаны quantity/person add-ons, прочие types fail closed. Legacy unpriced flow сохраняется без автоконверсии; dirty draft отделён от quote intent.

## D-086 — Customer Event не является публичным форматом

`/events/:id` — заказ без CMS draft/payment side effects; `/events/categories` — EventServiceTemplate + offering + canonical editorial draft. Legacy category ID/name не трактуется как template; старые event source links не чистятся автоматически. Новый Event имеет явный offering и event_order quote; legacy_manual не мигрирует догадками. Event-service preview не принимается.

Planning→booked принимает immutable quote и fixed-resource allocations одной CAS/idempotent транзакцией; TTL проверяется после locks. Payment отдельный, cancellation освобождает allocation, сохраняя snapshot без автоматического refund. Resource расходует одну unit независимо от гостей; preparation входит в интервал, цена ресурса отдельно не добавляется. Shared capacity/scheduled-resource add-ons требуют нового fulfillment gate; изменение accepted terms — будущей amendment-команды.
