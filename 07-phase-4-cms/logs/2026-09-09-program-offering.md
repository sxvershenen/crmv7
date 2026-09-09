# 2026-09-09 — Program offering Gate A

## Scope

Закрыт program offering/dossier и template preview. ProgramRegistration acceptance, EventServiceTemplate, venue, public program resolver и общий CMS rewrite не включались.

## Изменения

- Backend/DB: exact primary ProgramTemplate binding, atomic offering + canonical `program_detail` draft, safe legacy promotion, typed participant/package pricing, duration-aware rule resolution и immutable versioned preview.
- Contracts: отдельные prepare/lookup/preview DTO и OpenAPI для Internal/Admin namespaces; preview явно не пригоден для acceptance.
- CRM: route-driven commercial tab, один понятный тариф, CMS/public readiness, server quote, stable retries и сохранение dirty template draft. Code route нормализуется в canonical UUID до dependent queries.
- Stabilization: динамические calendar fixtures, актуальные accessible labels и numeric serialization `registrationCloseHours`.

## Acceptance evidence

- `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`: exit 0.
- PostgreSQL integration: 38 passed. API Playwright: 3 passed последовательно, включая program prepare/activate/quote/reload и Booking↔Lead regression.
- Fixture Playwright: 58 passed / 22 skipped; program dossier проверен на desktop/mobile overflow и keyboard action.
- Fresh disposable PostgreSQL с ограниченной ролью: 28 migrations, program primary partial unique index, quote pin columns и program CMS guard; повторный migrate — no pending work.
- Upgrade/revert-run сохранял контрольные users; program migration затем прошла на fresh database. Обе одноразовые базы и роли удалены после проверки.

## Следующий gate

ProgramRegistration принимает только occurrence-bound immutable quote с authoritative capacity/concurrency и атомарными lifecycle/audit/outbox effects. `template_preview` не переиспользуется как accepted quote.
