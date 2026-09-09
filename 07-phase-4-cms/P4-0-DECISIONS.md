# P4.0 implementation defaults

Статус: technical defaults approved by project owner instruction to proceed autonomously. Legal/privacy texts and production provider contracts still require the responsible owner before go-live.

## Runtime and delivery

- Keep current Astro static behavior while UI-kit migration is in progress.
- CMS-backed target: Astro server/hybrid with a generic Node adapter, server-rendered meaningful HTML and CDN/cache invalidation.
- Draft preview target: visible update within 5 seconds after successful local/isolated build.
- Content-only production publish target: p95 within 60 seconds; code release may take longer and shows build progress.
- Active production is one immutable release manifest behind a CAS `active_release_id`.
- Environments: local, isolated preview, staging, production.

## Storage and media

- S3-compatible storage abstraction; local development may use a compatible local service, production provider is replaceable.
- Original image stays private for active asset lifetime to allow reprocessing; public delivery uses immutable WebP variants.
- Archive starts an explicit retention/purge workflow; no silent physical deletion while revision/release references exist.
- EXIF/GPS is stripped from public variants; SVG active content is rejected/sanitized.

## Domain ownership

- CRM owns price, discounts validity/calculation, availability, capacity, booking and payments.
- CRM Pricing owns `CatalogOffering`, versioned price books/rate plans/rules, business calendar, sellable options and quote snapshots. CMS may edit them only through the same capability-gated operational application service used by CRM; no fields are copied into CMS revisions.
- CMS owns promotion copy, campaign placement and display schedule only.
- Public program offering binds to `ProgramTemplate`; occurrence requires a safe projection.
- Operational CRM `Event` is always private. A public wedding/corporate/other format uses an allowlisted `EventServiceTemplate` offering; any public occurrence is another explicit projection.
- «Доп» maps to `CatalogOffering(kind=addon)` with optional Resource binding; otherwise it is CMS-only non-bookable content without price/availability.
- Manual weekday/weekend/holiday schedules and exact date overrides are in scope; automatic demand-based price optimization is not.
- Campground v1 sells owned tents individually and capacity units in an `own_tent_area` for guest tents; no whole-camp rental. Each occupied local night resolves separately.
- `calendar_holiday` and `custom_date_override` are distinct selectors. Reusable searchable add-ons may have offering-specific assignments/rate overrides. Optional lead-days rules are fixed at backend quote time.

## Public code

- CMS-editable paths: `apps/site/src/managed/**` and page/section manifests generated for that area.
- `packages/site-ui`, API clients, build config, dependencies, lockfile, environment, migrations and infrastructure are read-only from CMS code editor.
- Dependencies are frozen; no package install or lifecycle scripts inside build.
- Build runs ephemeral, non-root, secretless, default-deny network, with signed artifact and separate preview origin.
- Content release needs reviewer; code release requires an approver other than author. Emergency capability is separate and audited.

## Analytics/privacy engineering defaults

- Server-issued opaque visitor/session IDs; no fingerprinting.
- Raw IP is absent from analytics/CRM/events/exports and may exist only in security/rate-limit logs for up to 7 days.
- Pseudonymous raw analytics events: 90 days; sessions/attribution: 180 days; irreversible aggregates: up to 25 months.
- Metrika loads only for its approved consent purpose and remains an aggregate comparison source.
- Business facts Lead/Booking/Payment remain regardless of analytics consent; visitor linkage is purpose-bound.
- Production PII infrastructure/data flows must pass Russian localization and provider review before go-live.

## Recovery targets

- Publication rollback: one prior immutable release activation, target under 10 minutes.
- Database/media backups: target RPO 5 minutes for metadata and versioned object storage for assets; target RTO 30 minutes, subject to provider verification.
- Cache purge failure cannot mix release versions because public responses and asset keys are release/version scoped.

## UI delivery order

1. Public `packages/site-ui` + homepage migration.
2. CMS/admin frontend prototype on CRM design system.
3. Shared Phase 4 contracts.
4. API namespaces and CMS core.
5. Publication/media/public projections/intake/analytics.
