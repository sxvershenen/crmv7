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

- После add-on и venue slices нужны resolver/contracts house, campground, program и event-service: listing/detail/price readiness и, где предусмотрено сценарием, quote/availability.
- Exact profile/revision relation, release-pinned dependencies, strict allowlist, source versions/hash/asOf и честный unavailable/request fallback обязательны.
- Operational change инвалидирует active projection независимо от CMS release; existing fenced delivery/cache-effect port используется повторно.
- Non-leak tests проверяют отсутствие draft/internal/customer fields. CMS source locator сам по себе не разрешает public output.

### P4.5F — Route-by-route delivery

1. Завершить CMS bindings главной по секциям, сохраняя ContentSource и global identity/navigation/default slots.
2. Мигрировать vertical routes в порядке house → campground → addon → venue → program → event service, учитывая готовность safe resolver каждого kind.
3. Завершить resource URLs/redirect map, hubs/categories/curated landings, статьи и information/legal pages.
4. Генерировать sitemap/robots/canonical/schema из active release.

Для каждой страницы: meaningful SSR HTML, один H1, crawlable links, metadata, image dimensions, минимальная hydration и desktop/mobile/keyboard/visual checks по затронутому сценарию. Production outage/invalid response не становится fixture fallback или ложным индексируемым 404. Renderer key/version/schema и порядок/config sections валидируются. Не менять одобренный дизайн без задачи.

Listing authoring/filter UX вводится для реального consumer; SQL projection/index/load gate нужен перед ростом каталога, не как предварительная универсальная подсистема.

## P4.3 — Preview и сквозная видимость доставки

- Render-ready preview, diff и blast-radius показывают effective content/dependencies и stale state до publish.
- UI использует реализованные Admin delivery health/detail/replay APIs; CDN cache integration не создаёт второй state machine.
- Published route moves требуют redirect contract, non-leaf moves — subtree contract; до них mutations остаются fail-closed.
- Gate: publish/schedule races, exact dependencies, failed delivery/cache purge, stale preview и rollback не смешивают releases. Полный page state переключается атомарно.

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
