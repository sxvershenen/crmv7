# Phase 4 implementation roadmap

Это долговременный порядок и acceptance gates, а не current-status или implementation pre-read. Текущий статус и следующий инкремент находятся в `README.md`.

Агент сначала находит нужный heading через `rg -n '^## P4\.'`, затем читает только этот track/gate. Целиком файл открывают только для перепланирования Phase 4.

## Delivery principles

- ownership and delegation follow root `../AGENTS.md`; architecture, authority and public UI remain with the main Sol agent;
- each accepted increment ends with working routes, migrations/contracts where applicable, proportionate tests and one coherent track-log update by the main agent;
- no parallel implementation may create two authorities for one field;
- existing dirty worktree and unrelated user changes must be preserved.

## P4.0 — Architecture lock and baseline

### Decisions

- hosting and Astro `server/hybrid` adapter or accepted static rebuild SLO;
- object storage/CDN/data location and media original retention;
- commercial authority from D-071 plus product semantics for price bases/calendar/campground/quote behavior;
- public eligibility through CatalogOffering/EventServiceTemplate; operational Event/ProgramOccurrence remain fail closed;
- privacy purposes, consent, retention, identity-link and legal owner;
- explicit product approval that analytics uses opaque visitor/session IDs while raw IP stays only in a separate short-lived security contour and Metrika identifiers are not account identity;
- custom-code allowlist, CI sandbox and approval roles;
- production/staging/preview environments and rollback owner.

### Artifacts

- approved entity/contract schemas, revision-scoped route topology and route map;
- effective inheritance examples;
- current site fixture/media/route inventory and migration map;
- UI-kit gap inventory for admin and public site;
- ADRs appended to root `../DECISIONS.md`.

### Gate

The implemented P4.0 foundation stays locked. Provider/legal choices remain go-live gates. Commercial product semantics required by P4.5A were confirmed on 2026-08-31; later semantic expansion requires a new explicit product decision. Existing CRM tests remain green.

## P4.1A — Public site UI kit and homepage migration

Owner: Sol High only.

- create versioned `packages/site-ui` and semantic global tokens/typography;
- implement primitive/layout/form/overlay/navigation/content/catalog/feedback foundations;
- implement date-range, guest, calculator and booking dialog components without client business authority;
- create section registry/manifest and AI-agent contract;
- create `/dev/site-ui-v2` with complete states;
- refactor homepage and existing public routes to consume the kit while preserving Astro-first HTML and approved composition.

### Gate

- global token edit reaches all public consumers;
- no screen-local duplicate primitives or scattered brand magic values;
- homepage/detail/blog/privacy and modal/date flows use the kit;
- typecheck/lint/build plus keyboard/mobile/reduced-motion/long-content review;
- no availability/price authority moved to frontend.

## P4.1B — Admin design system and frontend prototype

Owner: Sol High only for design and page implementation.

Build `apps/admin` on `packages/ui` with typed fixture repository:

- shell/app switcher/responsive navigation;
- `/dev/ui/admin` additions;
- dashboard and content tree;
- home editor;
- representative landing/category/public-profile editor;
- inheritance control and effective-value preview;
- media manager upload/processing states;
- release diff/publish UI;
- analytics overview/funnel shell;
- code/file inspector read/diff prototype.

### Gate

- route-driven editor anatomy, URL tabs and mobile adaptation;
- default/loading/empty/error/readonly/dirty/conflict/processing/publish states;
- no direct fixtures in JSX and no no-op controls;
- Vitest + Playwright desktop/mobile + visual review;
- no local second design system.

## P4.2 — API namespace and CMS core

- preserve `/api/internal/v1` compatibility;
- add `/api/admin/v1` and `/api/public/v1` plus separate OpenAPI;
- Zod contracts for nodes/revisions/blocks/SEO/routes/releases/capabilities;
- migrations for CMS core and public profiles;
- optimistic versions, idempotency, ChangeLog, Outbox;
- draft/read/review endpoints and signed preview token.

### Gate

- internal Phase 3 contract/E2E regression green;
- namespace leak tests;
- release-scoped route uniqueness, canonical placement, revision immutability, conflict and permission integration tests;
- admin frontend uses real API for completed flows.

## P4.3 — Atomic publication and delivery

- release manifest/items and schedule jobs;
- single CAS `active_release_id`, `baseReleaseId` and exact dependency revisions;
- outbox per-consumer deliveries;
- effective inheritance resolution and blast-radius preview;
- validation gates, cache purge/rebuild trigger, delivery status;
- rollback/unpublish/redirect lifecycle;
- preview/production diff.

### Gate

Atomicity/failure-injection test: content + routes + redirects + navigation/defaults + profiles + assets/code either all become live or production remains on one complete release. Scheduled/manual races serialize, duplicate delivery is harmless, cache purge failure cannot mix releases, stale preview is detected and emergency rollback restores a complete manifest.

## P4.4 — Media platform

- storage integration and scoped uploads;
- MIME/magic/size/scan/decode pipeline;
- immediate WebP responsive variants;
- metadata/focal point/alt/rights;
- usage graph and safe archive/replace;
- import existing external/local fixture assets only after rights/source review.

### Gate

Spoof/oversize/XSS/SVG/EXIF failures tested; unprocessed asset cannot publish; production usage cannot be deleted silently; rendered pages include dimensions/srcset/alt behavior.

## P4.5 — Public site migration

Before further mass profile/page migration, complete the commercial catalog increments from `OFFERING-CATALOG-ARCHITECTURE.md`:

### P4.5A — Offering domain lock and non-leak gate

Status: completed on 2026-08-31; current consumers remain unchanged.

- product semantics confirmed: individual owned tents + shared own-tent-area capacity, explicit calendar-holiday/custom-date rules, per-night resolution, searchable reusable add-ons and optional quote-time early-booking rules;
- hard publication eligibility for Event/ProgramOccurrence and operational/customer comment stripping implemented and regression-tested;
- lock `CatalogOffering`, `EventServiceTemplate`, typed price-book/rate/rule/options and quote snapshot contracts;
- add forward-only foundation migrations/entities and constraints without changing current readers, writers or public behavior;
- specify data migration from free-form `Resource.kind/settings`, `showOnSite` and `ProgramTemplate.basePrice`.

### P4.5B — Pricing and quote core

Status: house and campground backend gates completed on 2026-09-01. They include `house + per_night`, both campground sales units, immutable quote storage, scheduling runtime, read-only legacy dry-run, shared business calendar/bindings/reusable add-ons, accepted house `BookingItem` quote links and the production-shaped `public_projection` delivery runtime. On 2026-09-03 Booking composition added assigned quantity/person services, one immutable composite quote and exact lifecycle acceptance guarded by both application and PostgreSQL checks. Campground quote snapshots intentionally have no operational acceptance context yet. ProgramRegistration acceptance is implemented with occurrence-bound quotes. Event acceptance uses a separate Event/version-bound `event_order` snapshot, assigned quantity/person add-ons, atomic fixed-resource allocation/cancellation and database guards; template/event-service previews remain ineligible. Shared-capacity Event resources and scheduled-resource add-ons remain fail closed.

- application services for offering bindings, business calendar, immutable active price revisions and options on top of the P4.5A schema;
- deterministic rule precedence, ambiguity/gap validation, activation/scheduling and immutable quote snapshots; accepted house quotes attach atomically to the exact `BookingItem` on `unconfirmed → confirmed`;
- one composite editor projection with owner-segmented versions/capabilities for CRM and CMS;
- ChangeLog, typed Outbox and independent consumer deliveries/cache invalidation;
- fenced delivery leases, monotonic offering projection generations, durable `database_epoch` cache effects, retry/DLQ/replay audit and Admin-only delivery observability. A production CDN/tag-purge adapter remains a deployment choice, not a second delivery state machine.

### P4.5C — CRM operational editors

Status: house and campground editor slices completed on 2026-09-01; the standalone add-on operational editor completed on 2026-09-02. On 2026-09-02 the CRM stay IA was consolidated around the Resource dossier: standalone stay registries and detail URLs return to the exact Resource, and an idempotent transaction creates offering + primary binding + canonical CMS draft from an unlinked Resource. The embedded `Цена и сайт` screen hides offering/binding/PriceBook/RatePlan mechanics and exposes one resource price, included/extra guests, explicit recurring weekdays, holidays, higher-priority special periods and the canonical website-page summary. First save prepares the hidden commercial/CMS infrastructure in the same user action. New stay bookings request an authoritative resource-scoped quote and render RUB major units while persistence remains integer minor units. Venue is the next operational offering kind after the safe add-on projection gate.

- Resource registry is the primary CRM entry for house/campground; shared offering panels remain the primary operational workspace for price calendar/tariffs/options and public-site status;
- implement one complete house slice first; then campground → addon → venue → program → event service;
- changes use the same backend commands later mounted in CMS.

### P4.5D — CMS offer workspaces

Status: bounded house and campground workspace gates completed on 2026-09-01; add-on registry/dossier completed on 2026-09-02. Current CMS IA is editorial-only: `/content/tree` owns the registry and exact canonical nodes (`resource_detail` for stays, `addon_detail` for add-ons). Offering deep links open content/media/SEO/publication; operational editors remain in CRM dossiers. Generic `Публичные профили` is a diagnostics route, not primary CMS navigation. Media explicitly hands off to the canonical manager until page-filtered usages exist. The operational dashboard and development demo nodes/settings are authoritative PostgreSQL data. Add-on publication is enabled only through the completed release-pinned P4.5E projection; house and campground remain fenced until their own typed public resolvers exist.

- primary CMS IA `/content/tree` with canonical editorial deep links;
- CRM dossiers own operational panels; CMS owns content/media/SEO/publication panels;
- field ownership markers, segmented conflict handling, date/guest quote simulator and first-launch readiness;
- generic categories/public-profiles remain diagnostics, not primary CRUD.

### Immediate execution order after campground

1. **CMS topology/read UX:** render the route forest from authoritative `parentNodeId`, support accessible collapse/search ancestry and expose orphan/cycle states without inferring ownership from URL text. Status: completed on 2026-09-02.
2. **CMS topology/write UX:** create child/reparent now writes a route-only revision with `expectedVersion` and server leaf/parent/cycle/path validation. Mutation is limited to never-published leaves; published leaves return `CMS_REDIRECT_REQUIRED` and non-leaf moves return `CMS_SUBTREE_MOVE_REQUIRED` until their authoritative contracts exist. Status: bounded leaf-safe increment completed on 2026-09-02.
3. **Controlled-code handoff:** keep the capability-gated Files/Code tab in canonical and offer editors, but show an explicit unavailable state until P4.8 supplies page → artifact binding, versioned file drafts and server gates. Never write the public checkout from CMS UI. Status: UI handoff restored on 2026-09-02; backend remains P4.8.
4. **Add-on operational core:** typed service terms, quantity/person pricing and standalone/reusable/offering-specific semantics on the existing catalog, calendar and segmented pricing authority. Status: completed on 2026-09-02; quote resolution remains deliberately out of scope.
5. **Add-on CRM/CMS dossier:** a small registry and route-driven editor reusing the shared operational panels plus the canonical `addon_detail` editorial locator/workflow; no second option or content catalog. Status: completed on 2026-09-02.
6. **Safe public projection:** release-pinned allowlisted add-on DTO/resolver before any operational field becomes public, then resume route-by-route delivery. Status: bounded add-on listing/detail/price-readiness projection completed on 2026-09-02; quote and availability remain fail-closed.
7. **Booking add-on composition:** assigned resource services inside the stay position, authoritative composite quote/persistence and immutable acceptance on confirmation. Status: completed on 2026-09-03; CMS publication never controls CRM eligibility.
8. **Next order types:** implement the parent `program` offering/participant quote before ProgramRegistration add-ons, and the parent `event_service` offering/interval quote before Event add-ons. Direct library-to-order pricing is prohibited because it would bypass assignment applicability and create a second price authority.

### P4.5E — Safe public offering projections

User-requested CRM composition/promotion increment runs alongside the remaining offering verticals; boundaries and sequential gates are in `CRM-MARKETING-IMPLEMENTATION.md`. Operational promotion and saved-Lead UTM reports do not close P4.7 visitor collection.

Status: the bounded add-on gate completed on 2026-09-02 with exact public-profile/revision checks, immutable release dependency pinning, strict listing/detail DTOs, conservative live price readiness, cache tags/ETag and PostgreSQL non-leak coverage. House, campground and later offering kinds still require their own typed resolvers; add-on quote/availability are not implied by this gate.

- explicit allowlisted types instead of generic free-form resource/program fields;
- listing/detail/price summary/quote/availability contracts with source versions, `asOf`, readiness and typed fallbacks;
- public profile relation is required; `cms_source_links` alone never grants eligibility;
- strict managed artifact data bindings; no DB/internal API access or copied prices.

### P4.5F — Route-by-route delivery

Order:

1. preserve the implemented `ContentSource`/resolver and global identity/navigation/default slots;
2. complete home page CMS bindings section-by-section;
3. vertical offer slices in order `house → campground → addon → venue → program → event service`;
4. migrate existing resource routes and redirect map;
5. complete hubs/categories/curated landings;
6. articles/information/legal pages;
7. sitemap/robots/canonical/schema generated from release.

Extend the already established `packages/site-ui` and section registry when new public page patterns are genuinely required; public visual work remains Sol High.

### Gate

- meaningful content present in server/prerendered HTML;
- no direct DB/internal API/CRM fixtures;
- fixture fallback is explicit development mode only;
- Playwright route/preview/publish/rollback/mobile/accessibility;
- route-by-route visual comparison and no regression of current approved layout without recorded decision.
- the same operational mutation through CRM or CMS produces one aggregate version/audit history and the same public projection;
- Event/ProgramOccurrence/customer comments cannot become release content without an explicit safe offering/profile contract;
- quote rule provenance and historical snapshots remain reproducible after price-book changes.

## P4.6 — Public intake and CRM conversion

- real public form endpoint with rate limit/anti-spam/sanitization;
- typed consent + UTM/referrer snapshot;
- Lead/contact creation only;
- public success/error/idempotency UX;
- notification/outbox and CRM deep link;
- calculator/availability uses public projection, not client authority.

### Gate

Form never creates confirmed Booking, exposes internal status or duplicates Lead on retry. Security/load/consent/CRM E2E are green.

## P4.7 — First-party analytics

1. taxonomy/config/consent and stable page/section/action IDs;
2. collector, visitor/session, dedupe, bot/internal class;
3. attribution snapshot and server Lead/Booking/Payment facts;
4. daily/monthly aggregates;
5. admin full dashboard and CRM compact view;
6. Metrika consent-gated aggregate reconciliation;
7. retention/privacy request jobs and export audit.

### Gate

No raw IP/contact/form values/cookies in analytics/logs. Refuse/revoke paths work. Server conversions reconcile. Elevated identity access is purpose-bound and audited.

## P4.8 — Controlled custom code

Starts only after schema-driven CMS covers normal pages.

- allowlisted Git workspace and virtual file tree;
- site UI-kit/manifest contract for AI-agent;
- ephemeral non-root secretless/network-denied typecheck/lint/Astro/security/a11y/performance build with resource limits and signed artifact;
- HMR preview, three-way diff, review;
- artifact/assets/dependency manifest;
- atomic release and rollback.

### Gate

Traversal/symlink escape, SSRF/exfiltration, secret/config/socket access, arbitrary dependency/lifecycle script/shell, resource exhaustion, unsafe HTML/import, unsigned artifact and untracked media tests reject publish. Production cannot execute source from DB.

## P4.9 — SEO expansion, migration and go-live

- current/legacy URL inventory and redirects;
- migrate all approved entities/content/media;
- real competitor/semantic research;
- create only evidence-backed categories/landings;
- Search Console/Metrika setup after consent/legal review;
- performance, security, backup/restore and incident runbooks;
- staging content freeze, production release and post-release reconciliation.

### Final acceptance gate

- monorepo typecheck/lint/unit/build;
- contract tests for three API namespaces;
- PostgreSQL migration/integration/concurrency/outbox/jobs;
- admin and site Playwright across desktop/mobile;
- accessibility/visual/performance/security/upload/privacy tests;
- publish/rollback/backup/restore drill;
- no unpublished/draft/internal/PII data in public responses or HTML;
- documentation, OpenAPI and logs updated.

## Working logs

Only the main agent updates one coherent `logs/YYYY-MM-DD-<track>.md` when an increment materially changes acceptance state. Record scope, result, important contracts/migrations, gates, failures and remaining risks; do not paste command transcripts or worker notes. Durable architectural decisions also append root `../DECISIONS.md`; logs do not replace it.
