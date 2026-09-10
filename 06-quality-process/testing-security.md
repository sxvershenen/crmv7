# Проверки, доступность и безопасность

Проверять только затронутую границу. Для runtime/UI изменений сначала выполнить короткий live preflight, затем targeted checks; для docs-only и чистого unit/contract анализа live stack не нужен. Полный gate нужен для release или изменения общей границы.

## Runtime/UI preflight

Сначала проверьте уже запущенный stack и фактический host/port; не запускайте сервисы автоматически как часть первой проверки:

```bash
lsof -nP -iTCP -sTCP:LISTEN | rg ':(3000|5173|5174|4321)\b'
```

Проверяйте health и затронутый API read endpoint по адресу из listener output (`localhost`, `[::1]` или другой фактический bind), затем откройте затронутый UI route. Shell с HTTP 200 сам по себе не подтверждает рабочий контракт.

Для API/DB boundary дополнительно read-only сверяйте применённые migrations с `packages/db/src/migrations.ts`, например:

```bash
psql "$DATABASE_URL" -XAtc 'SELECT timestamp,name FROM migrations ORDER BY id DESC LIMIT 1'
```

Если обязательный endpoint не отвечает, read возвращает schema/contract error или рабочая БД отстаёт от текущего migration registry, это environment blocker: остановиться и зафиксировать его. Не делать автоматический reseed/migrate или переход на fixtures, чтобы скрыть mismatch.

## Матрица риска и проверки

| Изменение | Targeted command | Поведение и stop condition |
|---|---|---|
| docs-only | `git diff --check`; `rg -n 'path|command' <changed-docs>`; `test -e <referenced-path>` | Проверить ссылки, команды и diff; unit/full/live suite не запускать без затронутого runtime. |
| contracts/domain/API без БД | `pnpm --filter @crm/contracts exec vitest run test/<changed>.test.ts -t '<case>'`; аналогично для domain/API | Проверить error shape, permissions, idempotency и serialization; остановиться при изменении общего контракта без consumer check. Для небольшого изменения не запускать весь package suite. |
| migration, DB guard или concurrency | `pnpm --filter @crm/db exec vitest run src/migrations/<changed>.test.ts`; `pnpm test:integration` | Integration запускается только с `APP_ENV=test`, явным `TEST_DATABASE_URL` вида `*_test_<unique>` и restricted test role. Integration и API E2E получают разные disposable DB targets; не переиспользовать рабочую БД или один target для параллельных suites. Failure миграции, rollback или race блокирует acceptance. |
| CRM/CMS UI | `pnpm --filter @crm/app exec vitest run src/pages/<changed>.test.tsx -t '<case>'`; `pnpm --filter @crm/admin exec vitest run src/pages/<changed>.test.tsx -t '<case>'` | После live preflight проверить реальный route, dirty/conflict/error/loading/readonly states, keyboard, narrow/mobile и overflow. Неработающий mutation или потеря draft останавливает проверку. |
| CRM fixture/API flow | Fixture: `pnpm --filter @crm/app exec playwright test e2e/<changed>.spec.ts --project=desktop --grep '<case>'`; API: `pnpm --filter @crm/app exec playwright test --config playwright.api.config.ts e2e-api/<changed>.spec.ts --grep '<case>'` | Fixture и API режимы проверяются отдельно; API E2E имеет собственный fail-closed setup и не использует DB integration fixtures. Расширять до полного suite только при общей границе или риске для других consumers. |
| public site или `@crm/site-ui` | `pnpm --filter @crm/site architecture`; `pnpm --filter @crm/site typecheck`; `pnpm --filter @crm/site exec playwright test e2e/<changed>.spec.ts --project=desktop-chromium --grep '<case>'` | После live preflight проверить SSR HTML, desktop/mobile, keyboard, reduced motion и long content. Architecture или meaningful HTML regression блокирует acceptance. |
| migration/public release boundary | `pnpm -r typecheck`; `pnpm -r lint`; `pnpm -r --if-present test`; `pnpm -r build` | Запускать после targeted checks; failures разбираются по затронутому пакету, а не обходятся исключением. |

`<changed>`/`<case>` — подставить существующий файл/сценарий; пути считаются от выбранного package. `packages/db test` запускает только `src/test-database-safety.test.ts`; все migration tests — `pnpm --filter @crm/db exec vitest run src/migrations`. Полные runtime suites: `pnpm test:integration`, `pnpm test:e2e`, `pnpm test:e2e:api`, `pnpm --filter @crm/site test:e2e`. `apps/site`, `packages/site-ui` и `packages/ui` не имеют `test` script; для public consumers используются typecheck/lint, site architecture и site Playwright.

`pnpm --filter @crm/site test:e2e:cms` проверяет SSR delivery через отдельный HTTP contract stub без БД: published/404/503, invalid responses, timeout, release mismatch, обязательный listing и error UI desktop/mobile/keyboard. Это не API/DB integration gate. Обычный site Playwright явно включает fixture mode. Оба harness запускают Astro через `dev()` под управлением Playwright, без CLI `--force` и замены рабочего dev-сервера.

## Accessibility

Проверять keyboard, focus-visible и focus restoration, labels/errors, DnD alternatives, screen-reader announcements, WCAG AA, touch targets не менее `44px`, safe area, отсутствие color-only semantics и accessible name для icon-only controls.

## Acceptance invariants

- UI получает business facts через repository/API; fixtures включаются только явным data mode и не становятся authority.
- API/domain сохраняют permission checks, optimistic concurrency, idempotency, audit/outbox и immutable snapshots там, где это требует контракт.
- Public site использует published public API/projection, SSR meaningful HTML и не получает DB/internal API/PII.
- Незавершённая mutation показывает честный unavailable/disabled/error state, а сохранённые данные и accepted commercial facts не меняются после reload обычным update.
- Для migration/DB/concurrency failure setup или race останавливают acceptance; production publish/recovery provider checks относятся к go-live.

## Security

Проверять input validation, parameterized queries, CSRF, secure cookies, constrained CORS, public rate limit, отсутствие PII в логах, backend permission checks, masking, brute-force protection и safe uploads. Backup/restore и production provider checks относятся к go-live gate, а не к каждому локальному UI изменению.

Engineering recovery targets, пока не подтверждённые provider drill: metadata RPO до 5 минут; assets используют versioned object storage; RTO до 30 минут; rollback activation target — менее 10 минут. До go-live нужны backup/restore verification, retention/legal approval, data-location/provider review и emergency rollback procedure; эти цели нельзя считать достигнутыми по одному конфигу.
