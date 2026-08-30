# CRM v7 — декомпозированная документация

Документация переразложена из двух исходных ТЗ так, чтобы ИИ-агент получал минимальный релевантный контекст.

## Начало работы

Для агента: открыть **только `AGENTS.md`** и следовать таблице маршрутизации.

Для человека:

- `00-core/` — приоритеты, scope, порядок разработки, stack;
- `01-design-system/` — дизайн-система и общие UI-паттерны;
- `02-screens/` — экранные спецификации, преимущественно сохранённые из визуального ТЗ;
- `03-frontend/` — архитектура frontend;
- `04-domain-backend/` — предметная модель, API, PostgreSQL, concurrency;
- `05-site-admin/` — будущая интеграция публичного сайта и админки;
- `06-quality-process/` — тесты, security, критерии этапа;
- `reference/` — исходные файлы без изменений + карта разрешённых конфликтов.

## Почему исходники оставлены

`reference/original-ui-visual.md` и `reference/original-fullstack.md` сохранены без редактирования для проверки потерь. Они не предназначены для чтения на каждом шаге.

## Phase 1 frontend

```bash
pnpm install
pnpm dev
```

- CRM Dashboard: `http://localhost:5173/`
- UI gallery: `http://localhost:5173/dev/ui`
- Проверки: `pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm test:e2e`

## Public site (Astro)

```bash
pnpm install
pnpm dev:site
```

- Публичный сайт: `http://localhost:4321/`
- Проверки: `pnpm --filter @crm/site typecheck && pnpm --filter @crm/site lint && pnpm --filter @crm/site build`
