# «Свистоплясово» — web platform

Монорепозиторий нового веб-проекта для **свистоплясово.рф**: SEO-first публичный сайт загородного глэмпинга/кемпинга, CMS, операционная CRM и единый NestJS/PostgreSQL backend.

## Состав

- `apps/site` — публичный Astro frontend;
- `apps/admin` — CMS;
- `apps/crm` — операционная CRM;
- `apps/api` — Internal/Admin/Public API;
- `packages/site-ui` — публичная дизайн-система;
- `packages/ui` — CRM/CMS дизайн-система;
- `packages/contracts`, `domain`, `db`, `config` — общие контракты и backend foundation.

Public site, CMS и CRM связаны через типизированные API, projections, audit/outbox и notifications. Public site не читает БД/internal API и не создаёт подтверждённую бронь; CMS не дублирует operational authority CRM.

## Текущий этап

CRM и основной backend реализованы. Активная работа идёт в Phase 4: route-by-route public delivery, media hardening, intake, analytics и SEO expansion.

- актуальный статус: `07-phase-4-cms/README.md`;
- roadmap и acceptance gates: `07-phase-4-cms/IMPLEMENTATION-ROADMAP.md`;
- вход для ИИ-агентов: `AGENTS.md`;
- карта документации: `MANIFEST.md`.

## Локальный запуск

Требуются Node 24, pnpm 11 и PostgreSQL; значения окружения описаны в `.env.example`.

```bash
pnpm install
pnpm db:migrate
pnpm db:seed
pnpm dev:api
```

В отдельных терминалах:

```bash
pnpm dev         # CRM: http://localhost:5173
pnpm dev:admin   # CMS: http://localhost:5174
pnpm dev:site    # Public site: http://localhost:4321
```

Перед browser QA сначала проверьте уже запущенный stack, фактический host/port, затронутый API read и schema/migration alignment по матрице risk → command → stop condition в `06-quality-process/testing-security.md`. Если health, route, read contract или schema не совпадают, остановитесь до длинного цикла; не исправляйте environment автоматическим reseed/migrate.

OpenAPI:

- Internal: `http://localhost:3000/api/internal/v1/openapi.json`;
- Admin: `http://localhost:3000/api/admin/v1/openapi.json`;
- Public: `http://localhost:3000/api/public/v1/openapi.json`.

## Проверки

Полный gate для release или общей границы:

```bash
pnpm -r typecheck
pnpm -r lint
pnpm -r test
pnpm -r build
```

Для затронутых runtime flows сначала используйте targeted команды из `06-quality-process/testing-security.md`. PostgreSQL integration и API E2E требуют `APP_ENV=test`, явный disposable `TEST_DATABASE_URL` и restricted test role.

UI galleries: CRM `/dev/ui`, CMS `/dev/ui/admin`, public canonical `/dev/site-ui-v2`. Отклонённая v1-галерея удалена.
