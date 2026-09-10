# CRM composition and marketing delivery

## Поддерживаемый scope

CRM composition, backend-owned promotion registry/application и operational reporting реализованы. Этот документ хранит контракт, а не очередь повторной реализации; историческое evidence — `logs/2026-09-05-crm-marketing.md`.

- Booking composition: отдельные секции позиций, услуги перед финансовой сводкой, понятные quote/retry states; незавершённый расчёт блокирует сохранение.
- Promotion: normalized unique code, versioned writes, permissions/audit/outbox и server-owned immutable application. Gross offering quote не меняется; скидка применяется к заказу. Unchanged composition/code сохраняет исторический application, confirmed commercial terms нельзя менять молча.
- Reports: Booking/promotion facts, saved Lead UTM, период и сортировка; paid money только из payment ledger, отдельно от order value. Нет выдуманной visitor identity или conversion rate.
- Следующий analytics scope находится только в P4.6/P4.7 roadmap: public intake, consented visitor/session, collector, dedupe, attribution, conversion facts и retention. До него visitor charts не включать.

## Promotion semantics

- Fixed amounts/minimums use integer kopecks; percentage is 1–100. Fixed promotion is capped at eligible amount.
- Selected Resource or primary Offering matches only the base service portion. Selected add-on Offering matches that add-on snapshot line. Union of scopes, never count a line twice. All scope includes all lines.
- Minimum applies to eligible subtotal. Dates govern moment of application (not service date); endsAt exclusive.
- A promo does not stack with manual discounts. No payment is created by calculation. Activation changes only future/recalculated orders; existing saved application is a historical snapshot.
- No usage limits, customer segmentation, or public promo validation endpoint in this bounded increment.

## Gates

Contracts + domain tests for percent/fixed/caps/scopes/dates/non-stacking; PostgreSQL migration and uniqueness/CAS/audit; booking create/update and immutable quote acceptance regressions; CRM route/repository/component tests; desktop/mobile/keyboard/error/loading/conflict checks. Record actual verification in the dated track log, not here.
