# 2026-08-31 — Removal of rejected public UI kit v1

## Scope

- Удалить отклонённую v1 gallery после import/removal-аудита.
- Оставить `/dev/site-ui-v2` единственной поддерживаемой public UI gallery.
- Перевести executable inventory/architecture gate на v2-only.

## Result

- Удалены `apps/site/src/pages/dev/site-ui.astro`, `apps/site/src/components/islands/SiteUiGalleryIsland.tsx`, v1 Playwright test/snapshots и `packages/site-ui/component-inventory.json`.
- `packages/site-ui/manifest.json` теперь указывает на `component-inventory-v2.json`.
- Architecture gate больше не читает удалённые v1 inventory и gallery.
- Актуальные package/Phase 4 docs и README обновлены; исторические логи не переписаны.

## Verification

- `pnpm --filter @crm/site architecture` — passed.
- `pnpm --filter @crm/site typecheck` — passed, 0 errors/warnings/hints.
- `pnpm --filter @crm/site build` — passed, Astro server build.
- `pnpm --filter @crm/site lint` — passed.
- `pnpm --filter @crm/site-ui typecheck` — passed.
- `pnpm --filter @crm/site-ui lint` — passed.
- `pnpm --filter @crm/site exec playwright test -c playwright.config.ts e2e/site-ui-v2-gallery.spec.ts` — passed, 10/10.
- `git diff --check` — passed.
- `curl /dev/site-ui-v2` — HTTP 200; `curl /dev/site-ui` — HTTP 404.
