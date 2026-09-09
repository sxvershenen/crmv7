# Public UI source lock and booking v2 — 2026-08-31

## Контекст

После первой foundation/booking итерации пользователь обнаружил две системные ошибки: новые controls не повторяли калькулятор главной, а Blog SSR падал на renderer boundary и обрывал всю главную после Venues.

## Исправлено

- Blog перенесён в единый `BlogSectionIsland`: SSR снова выдаёт Blog, Why us, Reviews, Map, FAQ, Calculator, Partners и Footer.
- ArticleCard: удалён category badge, hover не двигает card и zoom-ит только media, добавлена круглая arrow-подложка; compact rows получили правильные отступы, muted description и right action.
- Mobile Blog rail выровнен по gutter остальных horizontal card rails.
- Calculator главной мигрирован на canonical `Tabs`, `Input`, `Button`; FAQ — на canonical `Accordion`.
- Input/Tabs/Back action извлечены из реальной геометрии Calculator: `40px`, radius `16/12px`, muted surface, brand selected state.
- Старый booking flow удалён и пересобран как compact resource-specific composition: dates/guests → extras/promo → contacts → registered request.
- Desktop popup `1280×720`: шаги имеют `scrollHeight === clientHeight` (518, 483 и 391px соответственно), то есть внутреннего vertical scroll нет.
- `component-inventory-v2.json` теперь требует `sourceConsumer`/`sourceNeedle`; architecture gate проверяет эту связь.
- Official shadcn inventory зафиксирован как roadmap/reference без переноса его presentation defaults.

## Visual baseline

До обновления baseline вручную сопоставлены expected/actual crops. Изменения full-page ограничены явно согласованным Blog treatment и component-preserving Calculator/FAQ extraction. Mobile viewport screenshot дополнительно стабилизирован против динамического FloatingHelper; full mobile gate сохраняет исторический width `416px` независимо от изменений device table Playwright.

## Проверки

- `pnpm --filter @crm/site-ui typecheck` — green;
- `pnpm --filter @crm/site typecheck` — Astro 67 files, 0/0/0;
- `pnpm --filter @crm/site lint` — architecture + ESLint green;
- v2 gallery/booking interaction — `10/10` desktop/mobile green;
- homepage structure/pixel/modal/interaction gates — `12/12` desktop/mobile green;
- production build — green после final muted-button alignment.
