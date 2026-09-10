# Критерии приёмки

Это короткий gate для изменённого контура. Текущий статус и порядок Phase 4 находятся в `07-phase-4-cms/README.md` и релевантном разделе roadmap.

## Каждый increment

- проверки выбираются по матрице `testing-security.md`; docs-only не требует typecheck/lint/unit;
- для runtime/UI changes сначала проверяется уже запущенный stack, фактический host/port и затронутый API read; при API/DB изменении — schema/migration alignment. Mismatch фиксируется как environment blocker, не скрывается reseed или fixtures;
- для runtime/UI проверяется реальный consumer после reload, включая ошибку, loading, empty/disabled/readonly и conflict state по риску;
- UI проверяется на desktop и mobile/narrow, с keyboard и overflow; для docs-only и чистого unit/contract изменения эти проверки не требуются;
- acceptance фиксирует фактическую команду и результат в одном track log только при изменении состояния gate.

## Границы

- UI читает business facts через repository/API; fixtures включаются только явным data mode и не становятся authority;
- API/domain сохраняют permission checks, optimistic concurrency, idempotency, audit/outbox и immutable snapshots там, где они уже требуются контрактом;
- migration/DB/concurrency изменения проходят migration tests и PostgreSQL integration на disposable DB; integration и API E2E используют отдельные targets, а при ошибке setup проверка останавливается;
- public site использует published public API/projection, SSR meaningful HTML и не получает DB/internal API/PII;
- незавершённая mutation имеет честный unavailable/disabled state и не имитирует успех;
- данные сохраняются после reload, а accepted commercial facts не меняются обычным update.

## Полный gate

Для release, общей API/DB boundary или крупной миграции дополнительно выполнить workspace typecheck, lint, test, build, API integration, затронутые Playwright flows и security/accessibility checks из `testing-security.md`. Не запускать полный gate как первый шаг малой локальной правки.

## Общие запреты

Не дублировать availability/price authority, не редактировать проведённые payments, не silent-overwrite concurrency, не давать public site прямой DB access, не возвращать TypeORM entities из controllers, не включать `synchronize: true`, не добавлять микросервисы без доказанной необходимости и не строить второй UI kit.
