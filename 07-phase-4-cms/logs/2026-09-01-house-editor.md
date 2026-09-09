# 2026-09-01 — P4.5C/D shared house editor

## Design gate

- Canonical editor identity is `CatalogOffering`; its primary `Resource` is fulfillment, while CMS node/revision remains the separate editorial owner.
- CRM and CMS use the same feature package and route shape: `/offers/houses` and `/offers/houses/:offeringId?tab=overview|pricing`. Only transport/chrome adapters differ: Internal API for CRM and Admin API for CMS.
- The first slice exposes only real `Overview` and `Pricing` capabilities. Composition, content, media/SEO and publication tabs are not rendered until `catalog_offering` CMS source links and a direct editorial locator exist.
- Pricing has its own dirty/saving/error/conflict state and named `expectedPricingVersion` CAS. There is no global save across catalog, Resource, pricing, add-ons and CMS revisions.
- Catalog identity/state remain read-only because their shared command endpoint is not implemented. Legacy `Resource.settings.showOnSite`, `cmsId` and description are not offering/publication authority.

## First implementation slice

1. Add transport-neutral `@crm/offering-editor` with shared list, editor shell, owner/readiness summary and pricing workspace.
2. Add CRM Internal and CMS Admin gateways against the existing strict offering schemas.
3. Support full draft PriceBook create/replace while preserving typed date rules; exact retries keep one operation/idempotency pair and stale pricing versions surface as conflicts.
4. Add a house quote simulator through the existing server-authoritative preview endpoint.
5. Provide an idempotent development seed for browser QA, without frontend fixture authority or production writes.
6. Verify package/app unit tests, both namespace repositories, cross-surface CAS/idempotency, desktop/mobile layout and the complete local stack.

## Deferred boundaries

- CMS content/publication integration requires a direct `catalog_offering` source link and editorial descriptor.
- Binding editing requires an authoritative Resource/ResourceGroup lookup rather than guessed IDs.
- Add-on assignment UI and calendar rule authoring remain separate bounded slices.
- Safe public offering DTO/resolver remains P4.5E.

## Delivered

- Added `@crm/offering-editor` as the shared transport-neutral feature boundary. It contains the house registry, route-neutral editor, owner/capability overview, PriceBook draft form and quote simulator.
- Added Internal and Admin gateways with strict contract parsing and namespace-specific error normalization; CRM and CMS mount the same shared feature on `/offers/houses` and `/offers/houses/:offeringId`.
- Draft create strips inherited RatePlan/PriceRule IDs; draft replace retains the complete identity/rule graph. Existing drafts round-trip without rewriting `name` or `changeReason`.
- Pricing inputs use major RUB units while API contracts keep minor units. `validToExclusive` is shown explicitly as an exclusive boundary.
- Save and quote exact retries retain their operation/idempotency pair for an unchanged normalized request. Pricing conflicts freeze editing, retain the local form, expose the current server draft for comparison/reload and protect Close/topbar back plus browser unload while dirty.
- Default quote dates are derived from `CatalogOffering.timezone`, not the browser or UTC date.
- Development-only seed creates one house offering, primary binding, covered business calendar and active per-night tariff for local browser QA. Production seed behavior is unchanged.

## Review and corrections

Targeted Sol High review reported no P0 and five P1 findings. All were resolved before closing the slice:

1. quote body now omits pricing CAS and passes the strict quote schema;
2. existing draft conversion is lossless;
3. quote retries reuse one immutable-snapshot request identity;
4. pricing conflict/dirty navigation has an explicit recovery/guard flow and fixed footer Save;
5. service dates use the offering timezone.

The review also confirmed the intended authority boundaries: Internal/Admin gateways call only offering endpoints, CMS revision/public transports are not used, create-vs-replace ID semantics are correct and server capabilities gate editing.

## Verification

- `@crm/offering-editor`: `9/9` focused tests, typecheck, lint and build;
- CRM: `180/180` full tests before the review patch, `4/4` focused house tests after it, typecheck, lint and production build;
- CMS/Admin: `35/35` full tests, `6/6` focused house tests after the review patch, typecheck, lint and production build;
- API: `52/52` unit tests and `28/28` PostgreSQL integration tests;
- public site: Astro check with zero diagnostics, architecture `14/14` and production build;
- repository: `git diff --check`;
- local runtime: API health, public site, CRM house route and CMS house route return HTTP 200.

One pre-existing PostgreSQL test race was made deterministic: the scenario testing concurrent acceptance of one immutable quote now explicitly permits the two intentionally overlapping draft bookings. The production fixed-resource conflict policy was not changed.

## Next bounded slice

Add PriceBook activation/scheduling UX, authoritative binding/add-on assignment and a direct `catalog_offering` editorial locator. Only after that locator exists should CMS mount content/media/SEO/publication panels. The house gate remains the template before starting campground UI.
