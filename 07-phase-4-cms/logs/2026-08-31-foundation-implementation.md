# 2026-08-31 — Phase 4 foundation implementation

## Scope

Начата реализация foundation-инкремента Phase 4 параллельными Sol High frontend-треками и общим contract track.

## Public UI kit track

- ownership: `packages/site-ui/**`, `apps/site/**`;
- цель: semantic tokens, typography, primitives, compositions, section registry, booking/date-range UX, `/dev/site-ui` и перевод существующего публичного сайта на kit;
- operational availability/price logic остаётся за CRM/public API.

## CMS admin track

- ownership: `apps/admin/**`;
- цель: отдельный CMS shell и route-driven экраны на существующей CRM design system;
- backend mutations пока не симулируются как authoritative.

## Shared contracts completed

В `packages/contracts` добавлены независимые модули:

- `content.ts` — node/revision/route, public-profile relations и inheritance patch grammar;
- `seo.ts` — index/canonical/social/structured-data metadata;
- `media.ts` — upload grant, asset/variant/usage and processing states;
- `publication.ts` — immutable release manifest, exact dependencies, validation and delivery;
- `public-site.ts` — page resolver, typed listing filters/sorts, cache/freshness metadata;
- `public-intake.ts` — consented Lead-only intake with attribution;
- `analytics.ts` — separated client events, stored events, domain conversion facts and aggregates;
- `admin-capabilities.ts` — granular CMS/media/SEO/code/analytics permissions;
- `phase4-openapi.ts` — isolated admin/public OpenAPI 3.1 documents.

Рекурсивный arbitrary JSON не используется в Phase 4 external contracts. Вместо него добавлена finite bounded JSON grammar, совместимая с OpenAPI generation и strict validation.

## Verification

- `@crm/contracts` typecheck — passed;
- `@crm/contracts` lint — passed;
- contract tests — 26/26 passed, включая namespace и materialized-public non-leak checks;
- environment warning unchanged: current Node 24, project expects Node `>=22.16 <23`.

## CMS persistence and API namespace foundation

- добавлена migration `1788116800000-cms-content-releases`;
- добавлены TypeORM entities для CMS nodes, immutable revisions, releases, release items, active release CAS pointer и public profiles;
- route/path/hash/state/profile-kind constraints закреплены на уровне PostgreSQL;
- operational `Event` намеренно отсутствует среди допустимых public profile kinds;
- Nest global prefix изменён с монолитного `/api/internal/v1` на `/api`, а существующие CRM modules смонтированы через `InternalApiModule` обратно под `/internal/v1`;
- добавлены раздельные endpoints `/api/admin/v1/openapi.json` и `/api/public/v1/openapi.json`;
- прежние internal OpenAPI server URL и CRM endpoint topology сохранены.

Additional verification:

- `@crm/db` typecheck/lint — passed;
- `@crm/api` typecheck/lint/build — passed;
- API unit — 26/26 passed после content/public/preview среза;
- Colima и PostgreSQL 16.10 запущены; все 13 migrations применены к чистой Docker DB;
- PostgreSQL integration — 17/17 passed, включая namespace compatibility, CMS draft/release/public resolver и archive-without-live-release-change;
- прежний environment blocker снят; осталось только engine warning Node 24 вместо целевого Node 22.x.

## Authenticated CMS content API

- `/api/admin/v1/content/nodes`: list/search/filter, create/detail, immutable draft update, submit review, return to draft and archive;
- granular CMS capabilities, optimistic version, operation/idempotency replay, SERIALIZABLE transaction, ChangeLog and typed Outbox;
- canonical path derives from parent + slug; root `/` belongs only to `home`; draft path duplicates remain legal until release validation;
- malformed cursors are rejected before PostgreSQL and parent cycles are blocked.

## Published-only public boundary

- `/api/public/v1/pages/resolve` reads active release + published manifest item + published revision in one SQL snapshot;
- release item pins strict `resolved_content`, its canonical hash and exact dependency refs; public DTO contains resolved renderer `config`, never authoring `policy`;
- editorial node archive cannot bypass publication or remove a route from the active immutable release;
- ETag, public cache headers and surrogate tags are release/revision scoped;
- signed preview tokens are short-lived, HMAC-protected and audited without persisting the bearer token; response is private/noindex;
- until P4.3 inheritance materializer exists, preview is explicitly an authoring document with `renderable=false`, not a fake public page.

## P4.3 atomic publication core

- added review approval plus release build/get/activate/rollback admin endpoints and OpenAPI coverage;
- materialized release items contain public renderer configs, content hashes and deterministic dependency refs for every inherited parent revision;
- path conflicts, absent inheritance bases, archived/missing nodes, unknown removals and unresolved CRM projections block release construction;
- activation uses active pointer `version + baseReleaseId` CAS inside a `SERIALIZABLE` transaction; idempotency, ChangeLog and typed Outbox commit atomically;
- rollback clones a historical published snapshot into a new immutable release and atomically activates it;
- PostgreSQL integration now exercises real approve → build → activate → public resolve and verifies that later editorial archive does not mutate the active release;
- explicit boundary: persisted site-default/page-type-default layers and render-ready preview remain P4.3b; no default configuration is fabricated.

Gate after publication core: contracts `26/26`, API unit `30/30`, PostgreSQL integration `17/17`, admin `15/15`, CRM `176/176`; typecheck/lint/build gates pass for the touched workspaces. Current Node remains 24 while the repository requires Node 22.x.

## Security and routing corrections from live audit

- canonical error enum now covers runtime API/CMS codes used by OpenAPI;
- CMS release item has a composite revision/node foreign key;
- credentialed CORS allowlist includes CRM/CMS only; public site must use its same-origin server/proxy;
- Nest wrapper routing was corrected to register every internal child module under `/internal/v1`; a live 17-test PostgreSQL gate protects the former URLs.
