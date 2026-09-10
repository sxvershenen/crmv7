# Platform architecture

Этот документ описывает target contracts и будущие gates; текущая реализация определяется Phase 4 status, source и фактическими проверками.

## 1. Authority и bounded contexts

| Контекст | Authoritative owner | Что хранит |
|---|---|---|
| CRM Operations | текущий API/domain | Resource/ResourceGroup, availability/capacity, Program, Event, Lead, Customer, Booking, Payment |
| CRM Catalog & Pricing | shared operational application services | CatalogOffering, EventServiceTemplate, PriceBook/RatePlan/PriceRule, BusinessCalendar, options, quotes/snapshots |
| CMS Content | новый CMS module | route tree, drafts/revisions, layout, text, reusable blocks, SEO, redirects, releases |
| Public profiles | CMS relation layer | маркетинговое представление CRM entity без копии operational state |
| Public projection | public API | только published CMS + разрешённые CRM projections |
| Media | media module/worker | asset metadata, original, WebP variants, usage graph |
| Code delivery | Git/build worker | allowlisted code artifacts, preview/build/release/rollback |
| Analytics | analytics module/worker | consent-aware events, attribution, conversion facts, aggregates |
| Delivery | Outbox + jobs | fan-out, publication schedule, cache purge/rebuild, retry/DLQ |

CMS не получает право менять operational поля через content DTO. `apps/admin` может дать deep link в CRM dossier, а CRM Catalog/Pricing application service остаётся одной backend boundary; operational editor не монтируется в CMS и не создаёт второй UI owner. Аналогично CRM может открыть shared CMS content panel/deep link к той же revision. `PublicResourceProfile` и `PublicProgramProfile` содержат только public copy/media/SEO/display settings и typed relation к существующей entity. Произвольный operational `Event` не получает public profile: публичным является отдельный allowlisted `EventServiceTemplate`/offering, а не клиентский заказ.

Полная коммерческая модель шести направлений и её UI/data-flow: `OFFERING-CATALOG-ARCHITECTURE.md`.

## 2. Контентная модель

### Основные таблицы

- `cms_nodes`: только stable identity, workspace/site and archive marker; mutable published route topology здесь не хранится.
- `cms_node_revisions`: immutable content/layout/SEO **and route placement**: parent, slug, derived path, order, template, index policy, schemaVersion/hash.
- `cms_route_alias_revisions`: versioned old path → canonical path, redirect type/status.
- `cms_node_relation_revisions`: versioned typed relation to CRM entity/category/other node.
- `cms_blocks`, `cms_block_revisions`: reusable strict blocks.
- `cms_public_profiles`, `cms_public_profile_revisions`: stable relation identity + versioned marketing/config snapshot.
- `cms_site_defaults`, `cms_site_default_revisions`: stable site identity + versioned global slots/settings.
- `cms_navigations`, `cms_navigation_revisions`: versioned header/footer/menu topology.
- `cms_releases`, `cms_release_items`: atomic publication manifest.
- `cms_publication_jobs`: schedule/unpublish/retry/idempotency.
- `cms_code_artifacts`, `cms_code_artifact_revisions`, `cms_builds`: Git/build metadata, not executable source in DB.

`kind`: `home`, `landing`, `category`, `resource_listing`, `resource_detail`, `program_listing`, `program_detail`, `event_listing`, `event_detail`, `article_listing`, `article`, `information`, `legal`, `custom_code_page`.

### Layout policy

```ts
type SectionPolicy<T> =
  | { mode: "inherit" }
  | { mode: "disabled" }
  | { mode: "override"; patch: Partial<T> }
```

Resolution: `site default → page type → parent/category → current revision`. Effective configuration вычисляется детерминированно и сохраняется в release manifest. Global edit сначала считает affected routes; production меняется только release.

Patch grammar:

- scalar — replace or explicit `reset-to-parent`;
- object — typed deep patch only by declared schema fields;
- array — full replace by default; patchable arrays use stable item IDs and allowlisted `insert/update/remove/move` operations;
- `null` is a business value only when schema allows it and never silently means inherit;
- one inheritance parent per layer, with cycle detection;
- config/renderer schema migrations are explicit and versioned;
- effective result is materialized, validated and content-hashed for preview/release.

## 3. Режимы страниц

1. **Schema-driven:** registered renderer + strict Zod payload. Основной путь для редактора.
2. **Reusable block/template:** versioned instance with usage graph and blast-radius preview.
3. **Custom code:** metadata points to Git ref/build artifact; никогда не `eval()`/TSX из PostgreSQL.

AI-generated custom page создаётся против versioned site UI-kit contract и обязана декларировать imports, assets, API bindings, analytics IDs, hydration reasons и tests.

CMS не обязан быть visual page builder. Для standard page Astro template владеет semantic structure, а CMS — typed fields/SEO/media и разрешёнными visibility/variant settings. Для уникальной AI-authored page source artifact в `apps/site/src/managed/**` владеет presentation/composition, CMS route/release — URL, metadata, editable manifest fields и publication lifecycle. Детальный контракт: `PUBLIC-PAGE-AUTHORING.md`.

## 4. Draft, preview, release

Revision lifecycle:

`draft → review → approved → scheduled | published → superseded | archived`.

- draft update использует `expectedVersion`;
- published revision immutable;
- preview token short-lived, scoped, private/noindex, не входит в public cache;
- release manifest pins exact revisions/hashes for nodes, route topology, relations, navigation/defaults, profiles, blocks, media variants and code build;
- activation atomically compare-and-swaps one `active_release_id` against `baseReleaseId`;
- rollback создаёт новую release на ранее валидированные immutable artifacts;
- unpublish требует явного 301/302/404/410 поведения;
- schedule хранит UTC instant + display timezone и idempotency key.

Publish blockers: duplicate path, invalid canonical/schema, missing required data/alt, broken node/CRM/media dependency, unready media, failed code build, unauthorized renderer, unsafe HTML, redirect loop.

Pipeline: `validate → build immutable artifacts → approve → write manifest transaction → CAS active pointer → invalidate/warm caches`. Manual and scheduled activations serialize on the site pointer. Versioned cache keys prevent mixed releases if purge fails after activation; the failure remains visible and retryable. Preview records `baseReleaseId` and becomes stale when the base changes. Emergency rollback activates a complete prior manifest. Content release requires a reviewer; code release requires an approver other than the author; emergency capability is separate and audited.

## 5. Astro delivery

Текущий `apps/site` — Astro server output с published API и provider-neutral publication. Отдельные route slices ещё мигрируют с fixtures; Astro-first/islands/public-API boundaries сохраняются.

Главная и catch-all CMS route используют `ContentSource`: `published | not_found | unavailable`. Только JSON `404` с API code `NOT_FOUND` при доступных published settings становится страницей 404. Network/timeout/redirect/schema errors, missing settings, `freshness.ready=false`, несовпадающие path/releaseId и недоступный обязательный listing дают `503`, `no-store`, noindex и `Retry-After`; error HTML не содержит booking islands или schema успешной страницы. Page/settings/listing должны относиться к одному release; новый запрос повторно читает active pointer. Materialized `hero=null` окончателен: frontend не повторяет inheritance. Отсутствующий blog slot не включается автоматически.

`partners` — typed editorial binding: renderer `partners`, rendererVersion `1`, schemaVersion `1`; config содержит только `title` (до 160 символов), `description` (до 320) и ordered `items` (1–40 `{id: UUID, label: string <= 160}`). Черновик может быть неполным; materialization валидирует итоговую конфигурацию после parent/global inheritance и disabled policies. Неверная конфигурация или версия блокирует публикацию (`CMS_PARTNERS_SECTION_INVALID`), недействительный public response даёт `503`. Главная и catch-all выводят этот snapshot в Astro без отдельной hydration; именами партнёров код не владеет.

`SITE_CONTENT_SOURCE=fixture` разрешает статическую главную только в Astro dev (noindex); production игнорирует флаг. Помимо `partners`, опубликованные legacy section consumers, `/blog` и `/resources/[slug]` ещё требуют отдельных typed migrations; их статическое содержимое и legacy settings adapter не являются production-ready CMS delivery.

- draft preview должен обновляться за секунды через isolated workspace/HMR;
- целевой production runtime — Astro server/hybrid, public API, server-rendered SEO HTML, CDN cache + tag/path invalidation;
- Provider-neutral atomic publication уже реализована. Hosting adapter, CDN и revalidation mechanism выбираются на go-live; static output остаётся возможным deployment-вариантом с честным SLO и не заменяет published API или server-rendered SEO HTML.
- Engineering targets are preview update within 5 seconds and content-only production publish p95 within 60 seconds; these are targets, not achieved SLOs or provider commitments.
- Environments are local, isolated preview, staging and production; preview is private/noindex and production never reads drafts.

Provider/CDN/data-location/revalidation choice remains a go-live decision and does not block the current provider-neutral publication path.

## 6. API namespaces

- `/api/internal/v1/*` — существующая CRM, backward compatible.
- `/api/admin/v1/*` — content/media/SEO/release/code/admin analytics.
- `/api/public/v1/*` — published page resolver, catalogs, public profiles, safe operational projections, intake, analytics collector.

Нужны раздельные OpenAPI documents и registries. Public document не импортирует internal DTO.

Новые contract modules: `content.ts`, `media.ts`, `seo.ts`, `publication.ts`, `public-site.ts`, `public-intake.ts`, `analytics.ts`, `admin-capabilities.ts`.

Общий mutation contract: `expectedVersion`, `operationId/idempotencyKey`, request ID и существующий error shape. Public DTO никогда не содержит drafts, audit, internal comments, staff PII или payment ledger.

Public page resolver returns `releaseId`, `contentVersion`, exact dependency versions, ETag/cache policy and cache tags. One response cannot mix an active release with latest drafts/defaults. Safe CRM projections include `asOf`, readiness/freshness and a typed unavailable/stale fallback without leaking internal status or reason.

Listing contracts share `ListingDefinition`/`FilterDefinition`: field, operator, source, value type, allowed values/cardinality, control, default, URL key, normalization and index policy. Public resolver validates unknown/invalid params, deterministic ordering/limits and stable pagination. Sort/filter query URLs are canonical/noindex; curated indexable combinations are separate node routes, not query aliases.

Текущий global prefix `/api/internal/v1` должен быть аккуратно заменён module routing под `/api`, с compatibility tests всех существующих internal URLs.

## 7. Public projections и CRM↔CMS↔site flow

```text
CRM mutation ─┐
              ├─ transaction + ChangeLog + Outbox
CMS release ──┘                    │
                                  ▼
                         consumer deliveries
                    ┌─────────────┼─────────────┐
                    ▼             ▼             ▼
             public projector  cache purge  analytics fact
                    │
                    ▼
               public API
                    │
                    ▼
               Astro site
```

Availability, price and payment are never copied into CMS revisions. Public API resolves safe live/read-model values. Cards/pages must define missing/stale fallback; CMS preview can use a permitted snapshot but labels it. Operational save in CRM changes one aggregate/version; CMS saves only one editorial revision and deep-links to CRM for operational changes. Active operational change and CMS publication have different lifecycle and actions in UI.

Public eligibility mapping before migrations:

- program detail maps to `ProgramTemplate` through `CatalogOffering(kind=program)`; an occurrence is exposed only through a dedicated allowlisted safe projection;
- operational CRM `Event` is never public. Public event service maps to an explicit `EventServiceTemplate`/`CatalogOffering(kind=event_service)`; a public occurrence, if ever needed, requires another safe projection;
- «Доп» maps to `CatalogOffering(kind=addon)` with optional Resource binding, or remains CMS-only non-bookable content without price/availability claims;
- CRM archive/hide/ineligibility follows typed stale → hide/unpublish/fallback rules, never silent orphan content.

Hard non-leak gate: `event` and `program_occurrence` source links/technical drafts cannot become release items and cannot copy customer/internal comments into editorial summary. Publication requires an explicit allowlisted public offering/profile relation.

### Commercial offering and pricing boundary

`CatalogOffering` is the stable sellable identity; `OfferingBinding` points to Resource/ResourceGroup/ProgramTemplate/EventServiceTemplate. Versioned `PriceBook → RatePlan → PriceRule`, `BusinessCalendar` and add-on offerings connected through `OfferingAddOnAssignment` keep weekday/weekend/holiday/date/guest/lead-time rules out of CMS JSON and Resource settings. Backend quote resolution is deterministic and returns rule/version provenance; accepted Booking/Event/Registration stores an immutable snapshot.

Current `Resource.settings.showOnSite`, free-form `Resource.kind`, `ProgramTemplate.basePrice` and caller-supplied `BookingItem.price` are migration sources, not the target commercial model. Manual schedules/date overrides are in scope; demand-driven algorithmic pricing is not.

Public form uses a dedicated `PublicIntakeService`, not an exposed internal LeadsController. It validates/sanitizes, rate-limits, applies anti-spam and consent/UTM mapping, creates Lead/contact and never confirmed Booking.

## 8. Outbox fan-out and jobs

Current one-consumer `processedAt` model cannot acknowledge SSE, publication and analytics independently. Add `outbox_deliveries(outboxEventId, consumer, status, attempts, processedAt)` or equivalent consumer checkpoints.

Typed topics:

- `cms.revision.created`;
- `cms.release.published|rolled_back|unpublished`;
- `media.asset.ready|failed`;
- `crm.offering|price_book|business_calendar.public_changed`;
- `analytics.aggregate.ready`.

Workers: media processor, publication scheduler, cache/revalidation dispatcher, analytics rollup/retention. Multi-instance jobs use DB claim/lock, idempotent job key, retry/backoff, DLQ and health metrics.

## 9. Media pipeline

Tables:

- `media_assets`: logical identity, metadata, owner/archive.
- `media_blobs`: immutable original, checksum, MIME, size, storage key.
- `media_variants`: format/dimensions/quality/storage/processing state.
- `media_uploads`, `media_processing_jobs`.
- `media_usages`: node/revision/block/code artifact + pointer/source location/release.

Flow:

`presigned staging upload → MIME/magic/size validation → malware scan → decode/orientation → metadata/EXIF policy → WebP responsive variants → ready/CDN`.

Also enforce decoded-pixel/decompression-bomb limits, normalized filenames, per-user/site quotas, SVG active-content policy, EXIF/GPS stripping, orientation/color-profile rules and cleanup of failed staging objects. UI may show a local preview immediately, but a CMS reference becomes publishable only at server `ready`.

Engineering default is an S3-compatible storage abstraction (a compatible local service is allowed in development); provider, data location and retention still require go-live approval. Original хранится private while an asset may be reprocessed; публичная доставка изображений идёт через immutable WebP variants. SVG sanitizes separately; video/documents keep their formats. Dedup uses content hash. Published usage blocks physical delete; replace creates a new blob/version, and purge is an explicit retention workflow.

Schema references populate usage graph directly. Custom code build must emit asset manifest; dynamic untracked media URLs block publish.

## 10. Controlled code pipeline

- allowlisted workspace paths only;
- no `.env`, secrets, migrations, DB/API config, package manager or arbitrary shell;
- ephemeral non-root secretless sandbox, read-only base image/lockfile, no host or Docker socket and default-deny network;
- CPU/RAM/disk/process/time quotas, isolated writable workdir and cleanup;
- realpath/symlink checks for every file/import, plugin/import allowlist, no lifecycle scripts or dependency changes;
- separate `canManageSiteCode` and review/approval;
- format/typecheck/lint/Astro build/static scan/a11y/performance/SSR-content gates in isolated worker;
- signed preview from built draft;
- immutable Git hash + build artifact in release;
- signed build manifest/artifact verified by deploy before activation;
- preview on a separate origin with strict CSP, Referrer-Policy and no production/admin cookies;
- three-way diff/merge and atomic rollback;
- HTML sanitization and CSP-compatible policy;
- full audit of file access, build and publication.

Code service exposes a virtual file/dependency/usage tree, not unrestricted server filesystem operations.

## 11. RBAC

Minimum capabilities:

- `canViewContent`, `canEditContent`, `canReviewContent`, `canPublishContent`;
- `canManageSeo`, `canManageMedia`, `canManageSiteCode`;
- `canViewAnalytics`, `canManageAnalytics`, `canViewAttributionDetail`, `canExportAnalytics`, `canAccessIdentityLinks`;
- `canManageIntegrations`.

Every admin mutation: secure session, CSRF, explicit capability, version, idempotency, ChangeLog. Upload grants and preview tokens are short-lived and scope-bound.

## 12. Migration sequence

1. API routing/namespaces and contracts without CRM regression.
2. CMS nodes/revisions/blocks/routes/releases.
3. CRM typed relations/public profiles and fail-closed Event/Occurrence publication gate.
4. Media asset/blob/variant/usage and worker.
5. Publication jobs/outbox deliveries/cache invalidation.
6. CatalogOffering/pricing/calendar/options/quote snapshots, then explicit public offering projections/intake.
7. Analytics raw/rollups/retention.
8. Controlled code metadata/build pipeline.

No `synchronize`; every step is forward migration + tested rollback/operational recovery.

## 13. Remaining architecture and go-live blockers

- v1 content is Russian-only; internationalization requires a later explicit design for locale-scoped revisions/routes, translation relations, fallback, canonical and hreflang;
- Astro server/hybrid hosting adapter versus static build SLO;
- object storage/CDN provider and data location;
- product semantics for campground sellable unit, holiday calendar and multi-night price application;
- exact public quote/request behavior for EventServiceTemplate, ProgramTemplate and venue tariffs;
- custom-code allowlist and approval policy;
- privacy purposes, consent texts, identity-link rules and retention;
- whether original image is retained and for how long;
- production publish/review roles and emergency rollback procedure.
