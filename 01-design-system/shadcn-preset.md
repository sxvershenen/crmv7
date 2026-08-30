# shadcn/ui + preset `bIkezqK`

## Обязательный принцип

UI-примитивы не имитировать самописным Tailwind/CSS. Получать исходники официальным `shadcn` CLI с preset `bIkezqK` и использовать их как базу.

## Перед реализацией

1. `pnpm dlx shadcn@latest preset decode bIkezqK --json`.
2. Сохранить decode-артефакт, например `packages/ui/preset/bIkezqK.json`.
3. Инициализировать shadcn в workspace либо во временном чистом Vite-проекте, если monorepo мешает CLI.
4. Добавлять нужные primitives через `shadcn add`/`apply`.
5. Переносить именно generated files + `components.json`, theme variables, `cn`, зависимости.
6. Временный generator-project не хранить в репозитории.

## Разделение слоёв UI

- `packages/ui/src/components/ui/*` — generated primitives.
- `packages/ui/src/components/domain/*` — композиции: category icon/tag, status badge, assignee avatars, money summary, scheduler item etc.
- screen components — сборка паттернов, но не новая локальная UI-библиотека.

## Иконки

Пользовательская иконография — Tabler Icons.
Не переписывать структуру generated shadcn primitive только ради замены его внутренней служебной иконки.

## Критерий выполнения

Недостаточно «похожей темы». Должно быть видно происхождение generated source: preset decode, `components.json`, фактические файлы и импорты.
