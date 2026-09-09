# 2026-09-09 — Booking↔Lead API closure

## Scope

Завершена Phase 3 API-интеграция ручной связи брони с заявкой. CMS, public intake, workspace/team и scheduler semantics не менялись.

## Изменения

- Backend: canonical Booking UUID, shared link/unlink idempotency scope, optimistic lock, atomic active link/history/version/audit/outbox, typed replay и domain conflicts.
- CRM: explicit link/unlink/history commands, сохранение dirty editor state и preparation minutes, server version recovery, общий fixture/API data-mode, desktop/mobile reload E2E.
- DB/test infra: один migration registry для CLI/API/seed; fail-closed guard требует явную `_test_<run>` database, совпадающие URLs и ограниченную PostgreSQL role до seed/TRUNCATE.

## Acceptance evidence

- `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`: exit 0.
- Fresh disposable PostgreSQL: 27 migrations, active-link partial unique index; повторный `pnpm db:migrate`: no pending work; counts до/после — users 3, bookings 2, link-history rows 9.
- Targeted Booking↔Lead integration: 1 passed; API Playwright: 2 passed, включая desktop/mobile relation reload.
- Полный API integration: exit 1, 35 passed / 2 failed вне relation slice — auth namespace HTTP parse и price-calendar `409` вместо ожидаемого `422`.
- Fixture Playwright: exit 1, 53 passed / 22 skipped / 3 failed вне relation slice — существующие labels в leads/resource block сценариях.

Одноразовая test database и роль удалены после проверок. Непройденные общие suites не считаются green gate.
