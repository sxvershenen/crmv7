# 2026-08-31 — Public UI kit implementation

## Scope

Sol High реализовал отдельную публичную дизайн-систему и перевёл на неё весь существующий Astro frontend.

## Delivered

- `packages/site-ui` v1.0.0 без зависимости от CRM `@crm/ui`;
- semantic colors/status/category tokens, typography, weights, spacing, radii, shadows, containers, breakpoints, controls, motion, focus and z-index;
- layout/actions/forms/disclosure/overlay/feedback/media/catalog/navigation components;
- accessible date-range calendar, unavailable/today/range states, guest steppers, booking summary/dialog and server-authority disclaimer;
- Astro wrappers for zero-hydration composition;
- section registry with 14 current homepage sections;
- stable analytics IDs, renderer/schema versions, manifest + JSON Schema and AI-agent boundary;
- comprehensive noindex `/dev/site-ui`;
- homepage, blog, privacy, resource routes, navigation, footer, floating helper and modals migrated to tokens/components;
- Zod schemas isolated behind `@crm/site-ui/schemas` to keep them out of public islands.

## Architecture gate

`apps/site/scripts/check-site-ui-architecture.mjs` rejects:

- `@crm/ui`, DB, TypeORM and internal API imports;
- direct semantic color literals and named palette utilities;
- local radius/shadow/type-size/font-weight utilities;
- registered homepage section files without the correct section marker.

Only black-alpha media overlays and unique illustrative geometry remain local.

## Verification

- `@crm/site-ui` typecheck/lint/build — passed;
- public architecture gate — 14/14 sections;
- Astro check — 56 files, 0 errors/warnings/hints;
- site lint and production build — passed, 6 pages built;
- Sol High desktop/mobile runtime and visual smoke for six routes and booking dialog — passed, no console/page errors;
- root independent monorepo typecheck/lint/build — passed;
- `git diff --check` — passed;
- environment warning: Node 24, project expects Node `>=22.16 <23`.

## Regression recovery addendum

Первичная массовая токенизация изменила approved homepage visual baseline и совпала с поломкой dev hydration. Восстановление выполнено относительно точной git-точки `9cd146a`, а не старой папки `/Users/a1111/Downloads/website`.

- возвращены исходные DOM/classes/assets и интеракции без отката намеренных mobile rail/Programs/filter/Blog изменений;
- исправлены typography/color/shadow/glass/divider/motion tokens и сняты глобальные font-size/tracking overrides;
- ModalHub стал layout-global, а event boundary буферизует действия до готовности listener;
- архитектурный gate разделён на строгую проверку новых/migrated presentation files и временный pixel-verified legacy allowlist;
- устранён конфликт двух Astro процессов, деливших один Vite cache;
- новый desktop/mobile Playwright gate прошёл `6/6`; Astro check/build, UI-kit typecheck, architecture `14/14` и `git diff --check` зелёные.

Финальная Sol High проверка нашла системный cascade residual: поздний shorthand `font: inherit` у form controls стирал локальные Tailwind font-size/font-weight. Он заменён на `font-family: inherit`; вычисленные размеры и насыщенность CTA, dropdown, tabs, pagination, footer и calculator снова соответствуют `9cd146a`. Также выровнены последние измеренные gaps/colors/sizes без изменения DOM и функциональности.
