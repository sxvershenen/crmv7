# CRM composition, promotion registry and operational attribution

## Delivered

- Booking composition: sibling position sections, inline dividers, assigned services before inclusive cost, compact responsive fields, append/duplicate after source. Detailed quote errors, retry, cancelled-request recovery, copied quote identity reset. Calculated input identity blocks saving stale/failed prices and avoids recalculating a persisted quote on tab open. Money rounds in kopecks.
- API startup migration registry now includes recurring weekday pricing, Booking add-ons, composite acceptance and promotions; CLI and API registries agree.
- `/marketing`: compact promotion registry and saved-Lead UTM report, inclusive Moscow creation-date periods, URL-backed search/source/channel/status filters, sortable columns, shared metric strip/table cells and dedicated mobile cards. Promotion creation is a contextual action in the common `Создать` menu.
- Development seed provides three promotions, six UTM leads and a linked paid booking. It is idempotent and refuses production.
- Promotion: normalized unique code, fixed RUB/percentage, minimum eligible subtotal, dates, all/selected Resource/Offering scopes; permissions, CAS, idempotency, audit and outbox. No second price catalog.
- Booking promo preview/save stores server calculation in `snapshot.promotion`; quote item gross amounts stay immutable, order total subtracts promotion. Manual item discount does not stack. Unchanged order preserves applied historical terms; confirmed promotion cannot be removed/replaced. Scope union counts each base/add-on line once. Payment ledger is untouched and overpayment displayed explicitly.
- Reports use real booking/Lead facts and ledger net including adjustments/refunds. Date window selects created bookings/leads; paid column is lifetime net for those bookings, not revenue in the date window. Visitors explicitly unavailable. UI QA used intercepted test responses, never fallback production metrics.

## Evidence

- Fresh isolated PostgreSQL 16 cluster, all 27 migrations: 2 targeted API integration scenarios passed (`persists server promotions`, `shares one house price editor`). Coverage includes Breakfast `person_service`, by-resource composite quote, selected add-on promotion, save/read/replay/stale version/permissions and confirming gross quote with discounted order total.
- Full CRM suite passed: 50 files / 238 tests. API marketing service (4) and targeted marketing/navigation/topbar checks pass; API/CRM/contracts/domain/DB typechecks passed. Report access also requires finance-view permission; report failure no longer blocks the promotion registry and unavailable metrics render as `—`.
- Live browser inspection at desktop and 390px: seeded promotion cards, UTM report table/cards, common create menu and source filters; no page error or horizontal document overflow.
- Working local `crm_v7` database migrated through all 27 registered migrations and development seed applied.
- Broader prior runs found unrelated failures: CRM Resource creation route assertion (223/224 passed) and two existing API add-on library query cases (34/36 passed before new promotion scenario). These gates are not claimed green.

## Remaining

- The exact original running-environment Breakfast failure was not reproduced: the correctly configured Breakfast scenario passes. The migration divergence and UI race are confirmed defects; neither alone proves the original preview failure. UI now exposes server error for follow-up with the affected resource/dates/configuration.
- Public visitor/session collector, consent, intake linkage and visitor→lead conversion remain P4.6/P4.7, sequenced in `CRM-MARKETING-IMPLEMENTATION.md`. No visitor tracking was enabled.
- Any non-local deployment must still run the migration set before using promotion APIs; development seed must not be enabled there.
