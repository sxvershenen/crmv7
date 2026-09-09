# CRM composition and marketing delivery

## Scope and sequence

Requested 2026-09-04. Deliver small independently verified increments; do not equate CRM operational reporting with completed P4.7 visitor analytics.

1. Repair resource + assigned add-on quote failure, stale requests and understandable error/retry states. Verify amount in minor units and persistence.
2. Compact booking composition: sibling position sections, dividers, services before financial summary, responsive fields, existing shared UI.
3. Backend-owned promotion registry: normalized unique code, fixed RUB amount or integer percentage, activity window, minimum eligible amount, all/selected resources and offerings, versioned writes, permissions, audit/outbox. CRM route-driven editor and sortable registry.
4. Apply promotion to Booking with server-owned immutable calculation snapshot. Preserve gross immutable offering quote; order-level promotion reduces booking total, not quote lines. Manual item discount and promotion are mutually exclusive. Save revalidates conditions; unchanged composition/code retains historical application. Confirmed/accepted commercial terms cannot be edited silently.
5. Operational marketing reporting: booking/promotion facts and saved Lead UTM dimensions, period selection, all data columns sortable, no client-side revenue authority. Money from payment ledger only. Distinguish order value from paid money. No inferred visitor identity or synthetic conversion rates.
6. Separate P4.6/P4.7 increment: successful public intake, consented signed visitor/session, collector, dedupe, attribution, outbox conversion facts, retention and privacy gates. Only then enable visitors and visitor→lead conversion charts. No tracking is enabled by the CRM slice.

## Promotion semantics

- Fixed amounts/minimums use integer kopecks; percentage is 1–100. Fixed promotion is capped at eligible amount.
- Selected Resource or primary Offering matches only the base service portion. Selected add-on Offering matches that add-on snapshot line. Union of scopes, never count a line twice. All scope includes all lines.
- Minimum applies to eligible subtotal. Dates govern moment of application (not service date); endsAt exclusive.
- A promo does not stack with manual discounts. No payment is created by calculation. Activation changes only future/recalculated orders; existing saved application is a historical snapshot.
- No usage limits, customer segmentation, or public promo validation endpoint in this bounded increment.

## Gates

Contracts + domain tests for percent/fixed/caps/scopes/dates/non-stacking; PostgreSQL migration and uniqueness/CAS/audit; booking create/update and immutable quote acceptance regressions; CRM route/repository/component tests; desktop/mobile/keyboard/error/loading/conflict checks. Record actual verification in the dated track log, not here.
