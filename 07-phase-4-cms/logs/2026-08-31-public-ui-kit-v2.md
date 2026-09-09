# 2026-08-31 — Public UI kit v2 from the approved homepage

## Scope

- Не редактировать старую `/dev/site-ui`: она сохранена только как отклонённый v1 migration artifact.
- Создать новую `/dev/site-ui-v2` с нуля из компонентов, которые уже являются реальными consumers восстановленной главной.
- Не менять presentation, content density и interactions контрольной точки `9cd146a`; сохранить намеренные mobile card изменения D-044.

## Extraction sequence

1. Полная интерактивная Hero-разметка вынесена в `SiteHero`; `HeroSection` стал тонким consumer, сохранив CMS config, booking/call/navigation events, slider, dropdown и promo copy-state.
2. Media-паттерны домиков и SPA вынесены в `SiteHouseMedia` и `SiteSpaMedia`; hover-сегменты, availability badges и размеры сохранены.
3. Реальная social CTA-карточка Events вынесена в `SiteVkCommunityCard`.
4. Events, Houses и Sauna consumers переведены на exports пакета без изменения section composition.
5. Новая v2 gallery собрана из `SiteHero`, section headers/filter, реальных event/house/SPA/program/category/venue/blog cards, pagination, responsive rails, фактической Navigation и Footer главной.

## Canonical boundary

- `packages/site-ui/component-inventory-v2.json` содержит только main-derived exports текущего v2 slice.
- Для каждого export зафиксированы фактический homepage consumer и v2 gallery source.
- Architecture gate проверяет export → consumer → gallery и продолжает отдельно проверять старый inventory, пока v1 физически не удалён отдельной безопасной операцией после import audit.
- `/dev/site-ui-v2` использует те же fixtures главной, а не короткие искусственные demo-данные.
- Старые `apps/site/src/pages/dev/site-ui.astro` и `SiteUiGalleryIsland.tsx` не изменялись.

## Runtime fixes found by the new gate

- У повторяющихся SPA photo URLs были duplicate React keys; ключи сделаны позиционно-стабильными без изменения DOM/CSS.
- Mobile filter trigger получил доступное имя через `aria-label`; визуальная разметка не менялась.
- После Vite dependency re-optimization dev daemon был перезапущен чисто; это устранило `504 Outdated Optimize Dep` и восстановило Astro island hydration.

## Verification

- `@crm/site-ui` typecheck — passed.
- Astro typecheck — passed.
- site lint + architecture gate — passed, 14 registered sections.
- Astro server build — passed.
- `/dev/site-ui-v2` — HTTP 200.
- v2 desktop/mobile render, hydration, hero/modal/filter/SPA/category interactions and runtime-console tests — 6/6 passed.
- полный public Playwright gate — 24/24 passed, включая неизменённые viewport/full-page homepage screenshots; baseline не обновлялся.
