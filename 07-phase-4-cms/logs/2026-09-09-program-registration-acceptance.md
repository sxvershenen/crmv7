# 2026-09-09 — ProgramRegistration Gate B

## Scope

Закрыт occurrence quote и acceptance для ProgramRegistration. EventServiceTemplate, venue, public program resolver, public intake и общий CMS rewrite не включались.

## Изменения

- Contracts/API: отдельный acceptance-ready quote для exact occurrence; typed inputs, breakdown, provenance, expiry и accepted DTO после reload.
- Backend/DB: stable lock order, authoritative capacity на create/update/confirm/limit reduction, atomic lifecycle + accepted link + audit/outbox + idempotency, immutable accepted commercial fields.
- CRM: explicit save draft / quote / requote / confirm, observed versions и stable retry keys; priced flow не отправляет client total/discount, показывает only supported add-ons без raw IDs и сохраняет dirty draft.
- Compatibility: legacy registrations остались operator-priced; Booking quote acceptance и Booking↔Lead flow прошли regression. Program public output остался fail-closed.
- Stabilization: fixture customer test теперь ждёт hydrated assignment control; Gate A API E2E детерминированно завершает draft activation; transient CMS serialization race повторяет целую транзакцию.

## Acceptance evidence

- `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`: exit 0.
- API unit: 94 passed; contracts: 73 passed; PostgreSQL integration: 38 passed.
- Fixture Playwright: 60 passed / 22 skipped, включая priced registration desktop/mobile, keyboard, stale quote и overflow.
- API Playwright: 4 passed, включая quote→confirm→reload с accepted add-on snapshot, Gate A и Phase 3 regressions.
- Fresh disposable PostgreSQL с restricted role: 29 migrations, pricing mode и 4 Gate B triggers; repeat migrate — no pending work. Revert→run на runtime data сохранил 9 registrations и 5 program quote snapshots.
- Обе одноразовые БД и restricted role удаляются после финальной проверки.

## Следующий gate

EventServiceTemplate получает отдельный dossier «Формат мероприятия» и typed interval/package quote; только после его acceptance подключается lifecycle acceptance фактического Event.
