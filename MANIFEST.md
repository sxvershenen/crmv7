# Карта документации

Human navigation only. ИИ-агент начинает с `AGENTS.md` и не читает эту карту по умолчанию.

| Раздел | Назначение |
|---|---|
| `00-core/` | product scope, stack и human summaries authority/order |
| `04-domain-backend/` | domain, PostgreSQL, API/auth/concurrency, live updates |
| `05-site-admin/` | compatibility pointer на Phase 4 |
| `06-quality-process/` | testing, security и acceptance gates |
| `07-phase-4-cms/README.md` | единый current status и следующий инкремент |
| `07-phase-4-cms/IMPLEMENTATION-ROADMAP.md` | долговременный порядок и gates; читать по разделам |
| `07-phase-4-cms/logs/` | фактические журналы треков; не читать весь каталог |
| `DECISIONS.md` | durable decisions; находить по ID/ключевому слову |
| `IMPLEMENTATION_LOG.md` | крупные historical milestones, не current context |
| `reference/` | архив, только для разрешения неоднозначности |

Близкие к коду instructions: `apps/crm/AGENTS.md`, `apps/admin/AGENTS.md`, `packages/site-ui/AGENTS.md`, `apps/site/src/managed/AGENTS.md`.
