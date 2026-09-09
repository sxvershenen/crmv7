# 2026-09-01 — CMS runtime recovery and compact house editor

## Scope

- replace the CMS dashboard fixture-only failure with an authoritative read model;
- provide safe local CMS demo content and navigation without taking ownership of existing routes;
- remove the field-column layout from the shared CRM/CMS house editor;
- leave public site, CRM, CMS and API running for browser review.

## CMS dashboard runtime

- Added strict `CmsDashboard` contracts and `GET /api/admin/v1/dashboard`.
- Aggregates are read from PostgreSQL: current CMS node states, active release items, media processing, delivery health, Leads, Bookings, paid Bookings and recent ChangeLog activity.
- Historical node revisions are not counted as current drafts/review items. Production page count comes only from the active release manifest.
- Web visitors intentionally remain `0` with an explicit “analytics not configured” attention item. No analytics fixture is presented as authoritative data.
- Admin repository parses the response strictly and adapts only display dates/labels.

## CMS session runtime

- Restored the auth routes expected by the CMS client under `/api/admin/v1/auth/*`: login, session, logout and password change now mount the existing shared `AuthModule` in the Admin namespace.
- The Admin and Internal surfaces still use one `AuthService`, session table and cookie contract; no second credential or session authority was introduced.
- CMS login/session/logout and access checks now use the Admin namespace consistently instead of reaching across into `/api/internal/v1`; CRM remains on the Internal namespace.
- PostgreSQL integration coverage verifies Admin login/session/logout/change-password and the intended cross-surface session behaviour. A live Admin login followed by dashboard and house-editor reads returns HTTP `200`.

## Development demo data

- Added five strict CMS revisions: `/`, `/houses`, `/houses/sosna`, `/family` and `/programs/family`, with published/review/draft states for realistic lists and filters.
- `/houses/sosna` is linked to the existing local `HOUSE-PINE` resource through `CmsSourceLink`.
- Added one valid draft site-settings revision with header, mobile and footer navigation.
- The seed validates payloads before persistence, skips existing canonical routes/source ownership/settings drafts and is idempotent.
- Both caller and helper fail closed in `APP_ENV=production`; no production demo write is possible through this path.

## Shared house editor density correction

- Overview now starts with localized summary metrics for state, sales mode, pricing readiness and fulfillment, followed by compact identity, definition, binding and PriceBook rows.
- PriceBook metadata uses semantic 12-column widths: long title/reason fields no longer compete with short dates.
- Every tariff is one bounded card with default/rule badges, a readable commercial formula and compact fields; the system key is short and DOM labels use stable `id/index`, not the mutable key.
- Quote preview is a form/result workspace: compact request controls on the left, total/validity/line items on the right, with immutable provenance kept tertiary.
- Readonly uses one banner and hides mutation actions. Conflict uses one comparison surface and the fixed footer exposes the actual version-refresh recovery action.
- The implementation stays in `@crm/offering-editor`; CRM and CMS do not fork presentation or pricing authority.

## PriceBook lifecycle workspace

- The shared pricing tab now exposes the existing backend lifecycle instead of leaving saved drafts inert: immediate activation is available for draft/scheduled books and deferred activation for drafts.
- Both actions require an explicit reason, use the current pricing CAS and retain the same operation/idempotency tuple for an exact retry of an unchanged command.
- Deferred local date/time is converted in the offering timezone; nonexistent daylight-saving local instants are rejected before transport.
- Lifecycle command state is independent from the editable PriceBook draft. Activation is blocked while the draft has unsaved changes and a successful transition reloads the authoritative editor so retirement/activation and owner versions are never patched optimistically.
- CRM and CMS adapters call the same Internal/Admin application endpoints and validate activate/schedule bodies strictly.

## Configuration transport boundary

- The shared gateway and both host adapters now expose the existing authoritative add-on library, house binding replacement, add-on assignment replacement and atomic offering-specific add-on creation commands.
- Subject and add-on commands keep their own CAS versions and endpoints; no CMS copy or global save was introduced.
- Configuration controls remain intentionally hidden until an authoritative searchable Resource target lookup and resolved add-on labels are available. Raw UUID entry and fixture-backed selectors are not accepted as an intermediate UI.

## Authoritative binding target lookup

- Added the same authenticated `GET /offerings/binding-targets` read model under Internal and Admin namespaces; no public route was added.
- The first strict target type is `resource`. Search is case-insensitive over operational name/code, supports kind filtering and deterministic cursor pagination, and never returns archived resources.
- Lookup items expose only allowlisted selector identity and capacity (`id/version/code/name/kind/capacity/archived`); Resource settings, audit fields and internal content are absent.
- The composite editor also resolves summaries for its already bound Resources in the same repeatable-read transaction. This lets the UI display a current or subsequently archived binding by name without leaking or asking for a raw UUID; missing/corrupt bound identity fails closed.
- Internal requires operational read capability; Admin additionally requires content view, matching the existing offering editor boundary.

## Compact Resource binding editor

- CRM and CMS now share a route-synchronized `Состав` tab backed by the same Resource lookup and subject mutation command.
- The primary Resource is presented as one compact identity/capacity card, followed by a searchable bounded result list and one horizontal parameter grid; raw Resource UUIDs are never rendered or entered.
- House v1 fixes the role to `primary` and edits quantity, capacity impact, preparation before/after and availability requirement. Archived current resources remain visible as blockers but cannot be selected from lookup.
- Read-only users can search and inspect safe Resource summaries while selection and binding fields remain disabled.
- Subject dirty/saving/conflict state is separate from pricing. A conflict preserves the local draft and exact retry body/idempotency tuple; successful save reloads the authoritative editor.
- Focused review caught and fixed an unstable inline save-action callback that caused a React render loop when opening the new tab; stable callbacks are now covered by the CRM route test.

## Resolved add-ons and local demo library

- The composite editor now returns `addOnCatalog`: safe display summaries for already assigned add-ons, resolved in the same repeatable-read snapshot as assignments. It includes typed terms, state and explicit blockers but excludes internal comments, tax/currency/timezone details and audit data.
- Missing, wrong-kind or terms-less assigned add-ons fail closed with `ADDON_CATALOG_TARGET_INVALID`; archived, inactive or unpriced selling add-ons remain visible with a typed blocker.
- The development seed now adds two reusable active RUB add-ons with valid PriceBooks/RatePlans: `ADDON-FIREWOOD` (450 ₽ per unit) and `ADDON-BREAKFAST` (900 ₽ per guest). Both are enabled/recommended for `HOUSE-PINE` with realistic quantities.
- The add-on seed is outside production, keys by stable codes, does not overwrite existing records or create CMS/public copies, and remained at exactly two terms/books/plans/assignments after two local runs.

## Reusable add-on assignment editor

- The shared `Состав` tab now includes a separate add-on owner segment below Resource binding. Assigned services render as compact identity/status cards with a collapsed overrides grid instead of a vertical field dump.
- The library performs authoritative server-side search with active/reusable filters and cursor pagination. Duplicate, self, inactive and unpriced choices are disabled; a newly selected library item immediately receives a safe local display summary and never falls back to a UUID.
- Cards support add/remove, enabled/required/recommended invariants, quantity overrides and optional group/rate/label overrides.
- Add-on dirty/saving/conflict/retry state and fixed-footer action are independent from Resource subject and pricing. Exact retry reuses the unchanged body/idempotency tuple; local drafts survive conflict reloads and successful reload clears temporary display summaries in favour of authoritative blockers.
- Search-only users may inspect the library, while assignment controls and the save action remain disabled.

## Offering-specific add-on creation

- The shared `Состав` tab now has a compact inline `Создать свой доп` flow rather than another long editor column. It collects only the operational name, category key and service format required for the first draft.
- Creation is atomic through the existing authoritative command: the add-on is `offering_specific`, `request_only`, `priceDisplayMode=request` and assigned disabled by default. The UI explicitly marks the separate pricing setup as the next blocker instead of pretending that the draft is sellable.
- Create state is independent from assignment dirty/save state. Creation is blocked while the assignment set is dirty or conflicted, preserves the exact body/idempotency tuple on `409`, and reloads the authoritative editor after success.
- Read-only and search-only roles never receive the create control; raw IDs are not rendered.

## Runtime cleanup

After the PostgreSQL integration gate, only disposable `crm_v7_test` artifacts created by the last media test were logically archived: `/media-test` and failed `spoof.png`. This did not delete user or production data; the integration test recreates them when run again.

## Canonical CatalogOffering editorial locator

- Extended the existing one-to-one `CmsSourceLink` with `sourceKind=catalog_offering`; the v1 database guard accepts only a real `house` offering linked to a `resource_detail` CMS node. The link retains the offering version observed at creation/promotion and blocks physical deletion of the referenced offering.
- The shared Internal/Admin composite editor now returns a strict safe `editorial` locator summary: source/node identity, current/latest-published revision metadata, editorial owner version and explicit publication blockers. It contains no internal comment, pricing, Resource settings, audit identity or public operational payload.
- Locator creation seeds only a noindex editorial placeholder and does not create a `CmsPublicProfile`, release relation/item or public-projection invalidation. Publication of a `catalog_offering` node remains fail-closed with `CMS_CATALOG_OFFERING_SAFE_PROJECTION_REQUIRED` until P4.5E provides an exact profile+relation and release-pinnable safe projection.
- Legacy `resource` links can be promoted in place only by the transaction-aware helper when the Resource is the non-archived primary binding of exactly one non-archived house offering. Zero/ambiguous matches remain unchanged as a deterministic report; the development seed promotes `HOUSE-PINE` through this same helper.
- Read-only inventory is available through `pnpm --filter @crm/api offering:editorial-locator:dry-run`; it starts a PostgreSQL read-only transaction and reports eligible/ambiguous/unmatched legacy links. The remaining production mutation command is deliberately not implemented yet: reserve `offering:editorial-locator:promote` for a separately reviewed, capability-gated audited batch that consumes an approved dry-run artifact rather than promoting all eligible rows blindly.

## Editorial locator presentation

- The shared overview now shows one compact read-only `Страница на сайте` summary: CMS title/path, revision state, node version, latest published revision and typed blockers. Technical node/source IDs, content fields, SEO, media and operational values are not duplicated.
- CRM builds the deep link from the server-returned node ID and `VITE_ADMIN_APP_URL`; CMS uses its same-origin canonical content-editor route. Missing locators remain an honest empty state, and ordinary editors expose no unlink/relink command.
- Both hosts are covered with focused tests for the canonical URL, blocker presentation and no-ID display. The existing CMS content editor remains the only owner of content/media/SEO panels.

## Primary CMS house editorial workspace

- `/offers/houses/:offeringId` now switches from the operational workspace to the canonical CMS editor on the same primary dossier route. The host resolves only `editor.editorial.node.id`; `offeringId` is never passed to the content repository as a CMS identity.
- Editorial route tabs are compact and separate from operational ownership: `content`, `page-composition`, `media-seo` and `publication`. At most one `EditorFrame`, one CMS repository state and one fixed action bar are mounted at a time; no nested editor or copied CMS form was introduced.
- The content, composition, SEO, hero preview and revision history use the existing `ContentEditorPage`/`cmsRepository`. Media remains an explicit hand-off to the canonical media manager until a page-filtered usage query is added; the UI does not fake page-scoped assets.
- Operational dirty state guards the transition into CMS. The optional shared `onOpenEditorial(nodeId)` callback lets the CMS host confirm before unmounting, while CRM keeps the existing cross-app href fallback.
- Publication remains visibly fail-closed: the action is disabled from the typed locator gate and the exact user-facing blockers are shown. The editorial draft can still be edited, reviewed and approved without changing production.
- The CMS repository now preserves exact revision state and exposes the already implemented review endpoints: `draft → review`, `review → draft | approved`. The former review read-only dead end is removed without creating a second workflow.

## Verification

- contracts: `56/56`;
- API unit: `58/58`;
- PostgreSQL integration: `33/33`;
- Admin: focused dashboard/repository and shared-house presentation tests green;
- Admin auth/repository namespace tests: `41/41`, typecheck and lint;
- `@crm/offering-editor`: `10/10`, typecheck and lint;
- CRM/Admin offering gateway tests cover pricing lifecycle and configuration paths; the Admin shared workspace test covers timezone-aware deferred activation and authoritative reload;
- CRM house routes: `11/11` including locator/deep-link, Resource and add-on no-UUID display, full replacement bodies, independent CAS, exact conflict retries, custom creation and search-only states;
- full CRM suite: `190/190`; full Admin suite: `44/44`;
- focused Admin house/repository/editorial gates: `25/25`, including `9/9` primary house workspace routes, exact locator node ID, one-EditorFrame, dirty-cancel and review return coverage;
- binding/add-on resolved contracts/API: Internal/Admin parity, archived-bound and add-on blocker coverage are included in the totals above;
- one first PostgreSQL integration run hit the existing quote-race timing assertion (`409` instead of `201`); an immediate complete rerun passed `31/31`, so the race test remains a known flake to monitor rather than being hidden;
- live Admin API: login, session, dashboard, house list and composite house editor return HTTP `200` after two idempotent seed runs;
- live public site meaningful DOM verified at `http://localhost:4321/`;
- authenticated CRM/CMS browser review remains available through their login screens; credentials are not injected into browser automation.

## Next bounded increment

Start the campground operational slice in the recorded order: owned tents first, then the shared-capacity own-tent area, reusing the completed segmented offering editor and pricing boundaries. Page-filtered media usages remain a bounded media enhancement; publication stays blocked until the separate P4.5E safe projection gate.
