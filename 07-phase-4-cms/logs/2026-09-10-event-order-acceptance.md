# Event order acceptance — 2026-09-10

## Evidence
- Baseline: `5581f087503f1f47f5a8d9bffbb264f5be48149e`, `main`; исходный dirty `AGENTS.md` исключён из изменения.
- До инкремента были реализованы category template/offering/CMS draft и неакцептуемый `event_service_preview`; customer Event acceptance отсутствовал.
- Read-only inventory локальной `crm_v7`: historical `cms_source_links.source_kind=event` — 0. Production не проверялся; cleanup не выполнялся.

## Contracts
- Customer Event не создаёт CMS artifacts; category создаёт собственные template/offering/editorial draft независимо от format.
- `event_order` фиксирует Event/version, состав, цены и dependency pins; preview остаётся неакцептуемым.
- Confirmation атомарно записывает status, accepted link, allocations, audit/outbox и idempotency. Cancellation освобождает ресурсы, сохраняет историю; payment не создаётся.
- V1: явно выбранные fixed Resources, `quantity=1`, `capacityImpact=1`; guests — отдельная величина. Shared capacity и scheduled-resource add-ons блокируются.
- Legacy allocation replacement выполняется одной транзакцией с Event CAS и replay.

## Verified boundaries
- PostgreSQL targeted acceptance suite: 17 passed, включая direct-SQL guards, races, lock-wait TTL, fault injection и legacy replacement.
- Полный registry: 32 migrations на disposable restricted-role DB; baseline upgrade, fresh, repeat и empty down→up проверены. Down с commercial data безопасно отказал и сохранил schema/data.
- Category dirty UI: 8 CRM + 2 shared editor tests; desktop/mobile Playwright 2 passed. Регрессии подтверждены red-before-green.
- HTTP create→quote→accept и replay проверены на отдельной test DB.

## Final gates
- Workspace unit: 605 passed (`pnpm -r --workspace-concurrency=1 test --maxWorkers=2`). Две старые async navigation assertions исправлены на ожидание итогового URL; таймауты не увеличивались.
- Root `pnpm typecheck`, `pnpm lint`, `pnpm build`: passed.
- Root PostgreSQL integration: 58/58, включая Event add-on API matrix и Booking/ProgramRegistration regressions.
- Root fixture Playwright: 62 passed / 22 existing skips. Новый Event scenario: desktop/mobile, обычный pointer, keyboard, dirty gate, accepted reopen и no-overflow. Event mobile toolbar разделён на range/action rows, чтобы убрать перекрытие controls.
- Root API Playwright: 4/4 на отдельной чистой test DB. API reload проверен для existing CRM/program consumers; новый fixture Event проверен через SPA reopen, поскольку fixtures in-memory.
- Test environment: PostgreSQL restricted role, отдельные disposable DB. Locale `C` в первоначальной базе ломала кириллический search; Unicode `en_US.UTF-8` соответствует `en_US.utf8` рабочей локальной БД. Поисковый product code не менялся. API E2E seed использует отдельную пустую DB, чтобы не смешиваться с integration fixtures.
- Промежуточные нагрузочные timeout/HTTP parse failures отделены от дефектов; финальные указанные прогоны passed. Git diff whitespace check passed.

## Рабочая локальная среда
- После сообщения пользователя воспроизведена несовместимость hot-reloaded API с рабочей DB на 29 migrations: отсутствовали новые Event columns; список зависал на skeleton, create показывал internal error.
- До изменения сделан полный custom-format backup вне репозитория: `/tmp/crmv7-event-test.4Wvux3/crm-v7-before-event-upgrade.dump`. На локальной `crm_v7` применены migrations 30–32, transaction committed. Данные не reseed/truncate.
- В рабочем browser на `http://localhost:5173/events` подтверждены загруженный список и открытие `/events/new` через меню с видимыми полями без internal error. Production не менялся.
- Последние fixture changes ограничены Event-local UUID mapping, resource pins, fixed allocation quantity/capacityImpact=1, preparation intervals, overlap/cancellation и shared fail-closed. Desktop/mobile E2E с допуслугой и ресурсом прошёл 2/2.
- Финальный Event repository targeted run после shared-resource guard: 13/13 passed.
