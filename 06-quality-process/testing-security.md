# Testing, accessibility, security

## Frontend/design-system phase

- Vitest для component/presentation logic;
- visual/dev preview `/dev/ui`;
- Playwright для критических navigation/responsive flows по мере появления экранов;
- проверять empty/loading/error/disabled/long content/mobile states.

## Backend phase

Unit: interval overlap, capacity, prices, transitions, debt, permissions, idempotency, contract serialization, domain→API errors.

Integration против PostgreSQL: modules/controllers/Zod pipes/guards/interceptors/filters/repositories/API/CRUD/rollback/FK/version/idempotency/payments/availability/audit/outbox.

Concurrency: real PostgreSQL, row locks, overlapping booking races, optimistic concurrency, constraints/indexes, timezone, cursor pagination, outbox claiming.

E2E: реальные frontend + API + PostgreSQL.

## Accessibility

Keyboard, focus-visible, focus restoration, labels/errors, DnD alternatives, screen-reader announcements, WCAG AA, `44px` touch targets, safe area, no color-only semantics, icon-only = tooltip + accessible name.

## Security

Input validation, parameterized queries, CSRF, secure cookies, constrained CORS, public rate limit, no PII in logs, backend permission checks, sensitive data masking, brute-force protection, safe uploads, backup/restore.
