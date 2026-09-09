# CMS editorial boundary and add-on CRM UX

Date: 2026-09-03

## Outcome

- CMS primary navigation is reduced to site pages, editorial presentation, promotion and site settings.
- `/content/tree` is the single primary page registry; legacy page/category/profile and offering list routes redirect into typed/filtered tree views.
- Offering deep links in CMS resolve the exact `catalog_offering` locator and mount only the canonical content editor.
- Ordinary CMS offer pages expose content, composition, media, SEO and publication. Pricing, bindings, fulfillment, PriceBook lifecycle, raw versions and access diagnostics were removed.
- Public price remains CRM/backend-owned and is joined through the safe active offering projection; CMS revisions never copy it.
- CRM add-on registry and dossier were compacted into business-facing cards and three tabs: main settings, one immediately effective price and usage.
- Stay Resource `?tab=offering` now manages its available additional services in place: add from the reusable library, enable/disable and remove, then persist the full versioned assignment set through the existing authoritative API. Operationally incomplete services stay visible with a concrete blocker instead of disappearing from the list.
- CMS publication and CRM usability are independent. A priced add-on moves from operational `draft` to `active` with its first active price book while its CMS page may remain an unpublished draft; `request_only` services become operationally active without requiring a price book.
- The local demo `Трансфер от станции` was repaired through an audited state transition, invalidated in the public projection outbox and successfully attached to `Дом «Сосна»`; its CMS revision intentionally remains `draft`.
- The global create control is visible on desktop and mobile and adds context-specific resource, add-on, run and registration actions.
- Booking composition now renders enabled services inside each stay position. CRM sends assignment IDs and quantities; backend resolves the parent stay plus add-on price books into one immutable composite quote and persists the quote ID with an authoritative add-on line snapshot on the booking item.
- Saving the editor as confirmed now executes the operational lifecycle transitions and accepts that persisted composite quote. Both the application service and the PostgreSQL trigger compare stay dates, guest count, resource, total and the exact assignment/quantity set before creating the immutable acceptance link.
- Once accepted, a booking composition cannot be silently replaced or moved while retaining the historical acceptance link; the API fails closed with `BOOKING_ACCEPTED_QUOTE_IMMUTABLE`.
- The bounded Booking slice supports priced `quantity_service` and `person_service` add-ons. `request_only` and scheduled-resource services remain visible but disabled instead of being coerced into a fake price/interval.
- Local demo data includes an active priced `Трансфер от станции`, assigned to `Дом «Сосна»`; the live new-booking flow resolves 12,000 ₽ stay + 1,500 ₽ transfer into 13,500 ₽.

## Authority and safety

- CRM/backend remains the only operational authority.
- CMS remains the only editorial/publication authority.
- CMS revision/profile/release state is never consulted when assigning an add-on inside CRM.
- Creating a business entity still creates its canonical CMS draft through the same application flow; this is not client-side synchronization.
- Booking add-ons are not client-priced: save rejects missing, expired, wrong-resource, wrong-period, wrong-quantity, changed-assignment and amount-mismatched quotes. Event/ProgramRegistration add-on composition remains fail-closed.

## Acceptance

- `@crm/offering-editor`: 19 tests.
- CRM: 222 tests; booking editor add-on regression: 7 tests; resource editor slice: 12 tests.
- API unit: 71 tests; PostgreSQL integration: 36 tests. The integration runner disables the background outbox timer and drives delivery batches explicitly, removing assertion/TRUNCATE races without changing non-test delivery.
- Admin: 53 tests.
- CRM, Admin and offering-editor typecheck/lint passed.
- Live browser verification passed for the CMS page tree, CMS add-on editorial editor, CRM add-on registry and CRM add-on pricing editor.
- API health reports PostgreSQL `ok`; CRM, CMS and public site return HTTP 200 on their local endpoints.
- Composite quote + Booking persistence and confirmation acceptance are covered by PostgreSQL integration; full API integration remains 36/36.

## Next bounded increment

Adapt the same assignment/quantity/snapshot contract to Event and ProgramRegistration. Do not accept request-only or scheduled-resource add-ons until their request/slot semantics are explicit.
