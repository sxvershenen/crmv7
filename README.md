# «Свистоплясово» — web platform

Монорепозиторий для SEO-first сайта загородного глэмпинга/кемпинга, CMS, операционной CRM и общего NestJS/PostgreSQL backend.

## Scope и authority

- `apps/site` — публичный Astro frontend; читает только published public projections и создаёт Lead, но не подтверждённую Booking.
- `apps/admin` — CMS; владеет editorial content, SEO, media, composition и publication.
- `apps/crm` и `apps/api` — operational facts: ресурсы, availability/capacity, цены, Lead/Booking/Payment, права и concurrency.
- `packages/contracts`, `domain`, `db`, `config` — typed boundaries и backend foundation; `packages/site-ui` — единственная visual authority public site.

Один бизнес-факт имеет одного владельца. CMS не копирует operational authority CRM, а public site не обращается к БД/internal API и не публикует draft, internal data или PII.

Продуктовый scope: проживание, палаточные места, баня/чан, площадки, программы и мероприятия; путь ведёт от organic visit к заявке, брони, проведению, оплате и повторной коммуникации. Первый релиз исключает полноценную бухгалтерию, эквайринг/кассу/фискализацию, ЭДО, склад/закупки, housekeeping, demand-based dynamic pricing, личный кабинет, отдельное мобильное приложение, микросервисы и автоматическое подтверждение брони с public site. Ручные versioned price books, weekday/weekend/holiday rules и date overrides входят в scope.

## Baseline

Node/pnpm/TypeScript baseline и scripts берутся из корневого `package.json` и lockfile. Стабильные архитектурные решения:

- `packages/ui` — shared CRM/CMS design system на утверждённом shadcn preset `bIkezqK` и Tabler icons;
- `packages/site-ui` — отдельная Astro-first public design system, без импорта operational CRM UI;
- API namespaces: `/api/internal/v1`, `/api/admin/v1`, `/api/public/v1`;
- PostgreSQL migrations — единственный schema change path, `synchronize` запрещён; fixtures только в явном dev/test mode.

## Current work

- статус и следующий инкремент: [Phase 4 README](07-phase-4-cms/README.md);
- порядок и acceptance gates: [implementation roadmap](07-phase-4-cms/IMPLEMENTATION-ROADMAP.md);
- вход для AI-агентов и правила контекста: [AGENTS.md](AGENTS.md).

Открывайте один профильный документ, а не весь каталог:

- CMS/platform/publication: [platform architecture](07-phase-4-cms/PLATFORM-ARCHITECTURE.md), [CMS UX](07-phase-4-cms/CMS-UX-SPEC.md), [managed page authoring](07-phase-4-cms/PUBLIC-PAGE-AUTHORING.md);
- offering/pricing/CRM↔CMS: [offering catalog](07-phase-4-cms/OFFERING-CATALOG-ARCHITECTURE.md);
- public UI/routes/SEO: [public UI kit](07-phase-4-cms/PUBLIC-SITE-UI-KIT.md), [site structure](07-phase-4-cms/SITE-STRUCTURE.md), [SEO strategy](07-phase-4-cms/SEO-STRATEGY.md);
- analytics/privacy: [analytics](07-phase-4-cms/ANALYTICS.md);
- checks/security: [testing and security](06-quality-process/testing-security.md);
- scoped execution rules: `apps/*/AGENTS.md`, `packages/site-ui/AGENTS.md`, `apps/site/src/managed/AGENTS.md`.

## Local run

Требуются Node/pnpm из `package.json`, PostgreSQL и окружение из [`.env.example`](.env.example). Команды ниже — для первого запуска новой checkout/disposable БД; не выполняйте `db:seed` повторно против существующей БД.

```bash
pnpm install
pnpm db:migrate
pnpm db:seed
pnpm dev:api
```

В отдельных терминалах: `pnpm dev` (CRM `:5173`), `pnpm dev:admin` (CMS `:5174`), `pnpm dev:site` (public `:4321`). Перед runtime/UI QA сначала проверяйте уже запущенный stack и фактический host/port, затем затронутый API read и migration/schema alignment по [testing matrix](06-quality-process/testing-security.md). При mismatch остановитесь; не скрывайте его автоматическим reseed/migrate.

OpenAPI: `/api/internal/v1/openapi.json`, `/api/admin/v1/openapi.json`, `/api/public/v1/openapi.json` на API host.

Главная и CMS routes по умолчанию требуют опубликованный Public API (`CMS_PUBLIC_API_BASE_URL`, default `http://127.0.0.1:3000/api/public/v1`). Сбой API возвращает `503`, без подмены демонстрационными данными. Для просмотра статической главной без API: `SITE_CONTENT_SOURCE=fixture pnpm dev:site`. Этот режим работает только в Astro dev, помечает главную noindex и игнорируется production build. Переменные public frontend задаются окружением команды или в `apps/site/.env`.

Standalone site: `pnpm --filter @crm/site build`, затем `HOST=127.0.0.1 PORT=4329 node apps/site/dist/server/entry.mjs` из корня репозитория. `CMS_PUBLIC_API_BASE_URL` задаётся при сборке; `HOST`/`PORT` — при запуске. `pnpm --filter @crm/site test:e2e:cms:production` собирает и запускает приложение с HTTP contract stub, без БД. После теста для обычного запуска повторите build с нужным API-адресом.

Полный release gate: `pnpm -r typecheck`, `pnpm -r lint`, `pnpm -r test`, `pnpm -r build`. Для локальной задачи сначала используйте targeted commands из testing matrix. UI galleries: `/dev/ui`, `/dev/ui/admin`, `/dev/site-ui-v2`.
