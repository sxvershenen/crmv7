# Add-on safe public projection — 2026-09-02

## Acceptance change

The bounded P4.5E add-on gate is complete. An approved `addon_detail` revision can enter an immutable public release only when its active `CatalogOffering(kind=addon)`, exact `CmsPublicProfile`, exact revision relation and typed quantity/person terms agree. Release construction pins a deterministic `public.addon-summary.v1` dependency; activation recomputes and verifies it fail-closed.

Public `GET /api/public/v1/offerings/addons` and `GET /api/public/v1/offerings/addons/{offeringId}` read only the active published release. They expose allowlisted editorial title/summary, typed public terms, source versions, `asOf`, ETag/cache tags and conservative live price readiness. Internal comments, applicability rules, bindings, raw price rules, draft content, availability claims and quote promises are excluded. A single unambiguous active amount may be `exact`, the lowest active allowlisted amount may be `from`; otherwise the response degrades to `request`/`request_only`.

Archive/hide invalidation now retains the offering-kind cache tag, so kind collections cannot remain stale. Legacy custom add-on creation was aligned with the new required applicability/quantity dossier fields. Raw PostgreSQL `date` values are normalized to ISO before effective-period comparison.

## Evidence

- contracts typecheck/lint and 61 tests passed;
- API typecheck/lint and 68 unit tests passed;
- PostgreSQL integration passed 35/35, including profile-required build, release pin, activation, strict list/detail, ETag 304, unknown-query rejection and non-leak assertions;
- the forward migration `AddonOperationalDossier1788120800000` was applied to the integration database before the gate.

## Running-stack smoke

The development database was migrated and API, public site, CMS and CRM were left running on ports `3000`, `4321`, `5174` and `5173`. Browser smoke confirmed the CRM/CMS add-on registries, the combined dossier, public homepage, and the authoritative site tree. Collapsing the house branch hides its child and persists the collapsed node in URL state.

The smoke also exposed a route ownership defect: selecting `?tab=code` from a house or campground canonical editor returned to the operational dossier because their wrapper allowlists omitted the code tab. Both wrappers now retain the canonical editor and display the explicit P4.8 page-artifact unavailable state; Admin tests and the live browser path cover the correction. Add-on editor copy now distinguishes the available public safe price summary from the still-unavailable quote resolver.

## Deliberate boundaries

- no add-on quote or availability resolver;
- no house/campground public projection implied;
- no copied operational price in CMS or public-site fixtures;
- route-by-route public rendering remains P4.5F.
