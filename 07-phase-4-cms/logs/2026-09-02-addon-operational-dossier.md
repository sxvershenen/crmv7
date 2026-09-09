# 2026-09-02 — P4.5C/D add-on operational dossier

## Scope

Закрыть bounded add-on vertical slice как самостоятельный `CatalogOffering(kind=addon)`: operational registry/dossier в CRM и CMS, typed service terms, quantity/person pricing lifecycle, usage diagnostics и exact canonical editorial locator. Quote resolution, availability promises и public operational projection в scope не входят.

## Authority

- CRM/backend владеет identity, subtype/scope, standalone semantics, service terms, bindings, PriceBook lifecycle и usage assignments.
- CMS владеет `addon_detail` copy/composition/SEO/review draft через один `CmsSourceLink(sourceKind=catalog_offering)`; locator не даёт public eligibility.
- `OfferingAddOnAssignment` остаётся связью контекста, а не вторым option-каталогом и не копией цены.
- Public namespace не получает operational add-on fields до P4.5E release-pinned allowlisted projection.

## Delivered

- Typed list/create/terms/editor/usage contracts, internal/admin OpenAPI routes и outbox events для add-on lifecycle.
- PostgreSQL terms columns, subtype/scope/step guards, `addon_detail` source-link compatibility и idempotent development seed.
- Server-side search/filtering по add-on registry без утечки house/campground rows; explicit boolean parsing для `standalone=false`.
- Shared CRM/CMS registry и route-driven dossier с обзором, условиями, сегментированным price lifecycle, usage diagnostics и canonical editorial handoff.
- Quantity/person activation validation; quote intentionally remains unavailable until a dedicated typed resolver exists.
- Capability-gated Files/Code tab remains visible in the editorial dossier and reports an honest unbound P4.8 state instead of simulating source access.
- Admin auth tests no longer depend on import timing: the API client resolves the default global fetch at request time, and the suite uses an explicit mocked API data mode.

## Acceptance

- contracts `60/60`, domain `36/36`, API `64/64`, PostgreSQL integration `34/34`;
- offering editor `16/16`, CRM `197/197`, CMS/Admin `60/60`;
- typecheck, lint and production builds pass for all touched packages;
- migration and seed applied to local development PostgreSQL;
- live smoke covered API, CRM, CMS and public site. A local demo add-on `Трансфер от станции` was created through the authoritative internal API and opened through both dossiers.

## Next

P4.5E safe add-on projection is the next gate: release-pinned listing/detail/price-readiness DTO and resolver with strict allowlist and no draft/internal fields. After it, continue operational slices with venue, program and event service. Add-on quote stays fail closed until its own pricing/acceptance contract is approved.
