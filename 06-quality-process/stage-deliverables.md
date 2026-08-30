# Результат этапов и критерии приёмки

## Design system

- tokens/theme;
- generated shadcn primitives + domain components;
- desktop/mobile shell;
- `/dev/ui`;
- demo CRM screen;
- main states;
- lint/typecheck/build/tests;
- происхождение preset-компонентов подтверждено.

## Frontend

- реальные routes/screens/flows на общей DS;
- typed fixtures только через data boundary;
- responsive/mobile adaptations;
- no-op декоративных controls быть не должно: если backend ещё нет, действие должно иметь честное локальное demo-state или быть явно disabled/marked;
- critical Playwright flows.

## Backend + CRM integration

- NestJS/domain/contracts/db/api-client;
- migrations/seed;
- frontend на реальном API;
- permissions/concurrency/idempotency/audit;
- unit + PostgreSQL integration/concurrency + e2e;
- данные сохраняются после reload.

## Site/admin

- internal/public/admin API separation;
- site forms → CRM Lead;
- publication/content admin;
- security/performance/accessibility hardening;
- regression e2e.

## Общие запреты

Не дублировать availability, не редактировать проведённые payments, не silent-overwrite concurrency, не давать public site прямой DB access, не возвращать TypeORM entities из controllers, не включать `synchronize: true`, не плодить микросервисы без доказанной необходимости, не делать самописную имитацию shadcn/Vega.
