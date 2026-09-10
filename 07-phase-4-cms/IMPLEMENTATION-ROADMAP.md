# Phase 4 implementation roadmap

Это долговременный порядок и acceptance gates, а не current-status или implementation pre-read. Текущий статус и следующий инкремент находятся в `README.md`.

Агент сначала находит нужный heading через `rg -n '^## P4\.'`, затем читает только этот track/gate. Целиком файл открывают только для перепланирования Phase 4.

## Delivery principles

- ownership and delegation follow root `../AGENTS.md`; this plan does not assign models;
- each increment ends at its acceptance criteria with proportionate checks; update one track log only when acceptance state materially changes;
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

The implemented P4.0 foundation stays locked; its artifact list is not new work. Provider/legal choices remain go-live gates. Commercial product semantics required by P4.5A were confirmed on 2026-08-31; later semantic expansion requires a new explicit product decision. Existing CRM tests remain green.

## P4.1A — Public site UI kit and homepage migration

Implemented foundation; use the following as regression criteria, not a rebuild backlog.

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

Implemented foundation; do not rebuild the fixture prototype or duplicate the existing admin application.

`apps/admin` uses `packages/ui`; fixtures are explicit dev/test mode only. Preserve the established surfaces:

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

Implemented foundation. The following are maintained invariants, not pending implementation.

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

Atomic/direct publication and provider-neutral delivery are implemented. Remaining: render-ready preview/diff and end-to-end delivery/cache visibility. Preserve these contracts:

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

Local/provider-neutral processing is implemented. Remaining: production storage/CDN, external scanner, cleanup/DLQ/metrics and rights-reviewed migration. Preserve:

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

Foundation implemented. Preserve typed CatalogOffering/EventServiceTemplate contracts, calendar/price-book semantics, forward migrations and fail-closed operational publication. Product semantics and authority: `OFFERING-CATALOG-ARCHITECTURE.md`; active decisions D-071 onward. Legacy data migration must be explicit, not inferred from free-form fields.

### P4.5B — Pricing and quote core

Implemented: shared calendar/bindings/add-ons, immutable pricing and quote snapshots, house/campground quotes, accepted BookingItem links, occurrence-bound ProgramRegistration acceptance and Event/version-bound `event_order` acceptance. Template previews remain non-accepting.

Remaining boundaries:

- campground operational acceptance context is not implemented;
- request-only/scheduled-resource add-on acceptance and shared-capacity Event resources remain fail closed;
- delivery already has fenced leases, monotonic generations, `database_epoch` effects, retry/DLQ/replay and Admin API observability; production CDN integration must reuse this runtime;
- new accepted order types require exact subject/version/composition, expiry after locks, atomic lifecycle/capacity/accepted link/audit/outbox and PostgreSQL guards. No direct library-to-order pricing.

### P4.5C — CRM operational editors

Established: Resource dossier for house/campground, add-on dossier, program commercial tab and event-service category workspace. Reuse the shared backend pricing authority and canonical CMS draft preparation; do not recreate standalone stay registries or expose PriceBook/RatePlan mechanics to operators.

Remaining operational vertical: venue, as scoped in the current-status README. Public resolvers are separate gates; an operational editor does not grant publication eligibility.

### P4.5D — CMS offer workspaces

Established: editorial-only `/content/tree`, canonical typed source locators and owner-aware conflicts. Pricing/bindings/fulfillment stay in CRM; generic public profiles are diagnostics. Media uses the canonical manager until page-filtered usages exist.

Remaining topology/code boundaries:

- never-published leaf create/reparent is implemented; published moves require redirect contracts, non-leaf moves require subtree contracts;
- Files/Code remains capability-gated and unavailable for mutation until P4.8 implements artifact binding, versioned drafts and server gates;
- house/campground/program/event-service publication stays fenced until each typed public resolver is accepted.

### P4.5E — Safe public offering projections

CRM composition/promotion and saved-Lead UTM reports are implemented; their maintained contract is `CRM-MARKETING-IMPLEMENTATION.md`. They do not close P4.6 intake or P4.7 visitor collection.

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

Extend the already established `packages/site-ui` and section registry when new public page patterns are genuinely required; ownership follows root `../AGENTS.md`.

### Gate

- meaningful content present in server/prerendered HTML;
- no direct DB/internal API/CRM fixtures;
- fixture fallback is explicit development mode only;
- Playwright route/preview/publish/rollback/mobile/accessibility;
- route-by-route visual comparison and no regression of current approved layout without recorded decision.
- existing Internal/Admin command adapters share one application authority, aggregate version/audit history and public projection; this does not require operational editors in CMS;
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
