# Технологический стек

Фактический baseline: Node `>=24 <25`, TypeScript strict, `pnpm` workspaces и единый lockfile.

## Applications

| Workspace | Назначение | Основной стек |
|---|---|---|
| `apps/crm` | операционный CRM frontend | React 19, Vite 7, React Router 7, Tailwind CSS 4, TanStack Query, React Hook Form + Zod, dnd-kit, Recharts, Vitest, Playwright |
| `apps/admin` | CMS/admin frontend | React 19, Vite 7, React Router 7, Tailwind CSS 4, shared `@crm/ui`, Recharts, Vitest |
| `apps/site` | public SEO-first frontend | Astro 7 server output, React islands, Tailwind CSS 4, `@crm/site-ui`, Playwright |
| `apps/api` | internal/admin/public API | NestJS 12, Express 5, TypeORM, PostgreSQL, Zod/OpenAPI, Pino, cookie sessions, Vitest/integration tests |

## Shared packages

- `packages/ui` — CRM/CMS primitives и domain compositions; shadcn-generated foundation, Tabler user icons, Roboto.
- `packages/site-ui` — отдельная versioned public design system; не импортирует operational CRM UI.
- `packages/contracts` — strict Zod contracts и раздельные Internal/Admin/Public OpenAPI schemas.
- `packages/domain` — framework-independent domain rules.
- `packages/db` — TypeORM Data Mapper, migrations и PostgreSQL adapter; `synchronize` запрещён.
- `packages/config` — проверка окружения и runtime configuration.

## Архитектурные границы

- API namespaces: `/api/internal/v1`, `/api/admin/v1`, `/api/public/v1`.
- Public site не обращается к PostgreSQL или internal API напрямую.
- Internal/CMS auth — cookie session + CSRF/capabilities; public intake имеет отдельную защиту.
- Status transitions, availability/conflicts, prices, payments, permissions, idempotency и optimistic concurrency authoritative на backend.
- Live invalidation/notifications используют outbox/SSE там, где это оправдано.
- Fixtures разрешены только в явном dev/test режиме.

Версии библиотек брать из workspace `package.json`/lockfile, а не из этого документа. Актуальные UI-правила находятся в scoped `AGENTS.md` и текущих shared packages; CMS/public architecture — в `../07-phase-4-cms/`.
