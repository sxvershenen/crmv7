# Public page authoring and style contract — 2026-08-31

## Scope

Зафиксировать модель, в которой Codex/разработчик собирает SEO-first Astro pages, CMS редактирует content/SEO/media и только controlled managed source, а существующая публичная главная не получает случайный редизайн при унификации UI kit/Tailwind.

## Result

- Добавлен `PUBLIC-PAGE-AUTHORING.md`: standard template и managed source modes, authority, artifact manifest, CMS code UX, styling и SEO gates.
- `AGENTS.md`, `packages/site-ui/AGENTS.md` и новый `apps/site/src/managed/AGENTS.md` направляют будущего агента к `@crm/site-ui`, Astro SSR и allowlisted managed boundary.
- Durable decision D-070 фиксирует отказ от arbitrary CMS page builder, release-owned SEO metadata и structural-only Tailwind для page code.
- `@crm/site-ui` component CSS перенесён в Tailwind `components` layer. Consumer `className` utilities снова могут намеренно переопределять defaults; gallery test фиксирует это на `Typography className="mt-3"`.
- `tw-animate-css` подключён как dependency/theme foundation `@crm/site-ui`; используемые `animate-in/fade-in/zoom/slide` classes больше не являются no-op.
- Добавлены Astro `SitePageShell`, `SitePageFrame` и `SiteSectionHeader`. Home/catch-all/blog/resource/gallery используют общий sidebar/page shell без изменения 1400/1200 geometry и 280/98 sidebar offsets.
- FAQ, Reviews, Territory map, Calculator и Why us переведены с локальных копий heading markup на общий React/Astro section-header contract.
- Удалён глобальный `[class*=...]` style hack. Exact approved eyebrow tint сохранён semantic brand variant-ом; architecture gate блокирует возврат class-fragment selectors.
- Architecture gate теперь проверяет page-shell consumers, shared section-header consumers, React/Astro semantic anatomy, Tailwind layer и animation foundation.
- `BaseLayout` получил серверный social/JSON-LD input с безопасной JSON serialization. Home и CMS catch-all передают release SEO index policy, custom canonical, social title/description и enabled structured-data bindings. Not-found catch-all теперь `noindex,nofollow`.
- Placeholder privacy page помечена `noindex,nofollow` и исключена из sitemap до появления утверждённого текста.
- `packages/site-ui/manifest.json` синхронизирован с authoritative CMS page kind names.

## Verification

- `pnpm --filter @crm/site-ui typecheck` — green.
- `pnpm --filter @crm/site architecture` — 14 registered sections, green.
- `pnpm --filter @crm/site typecheck` — 65 files, 0 errors/warnings/hints.
- `pnpm --filter @crm/site build` — green.
- Fresh isolated Astro server + Playwright — `24/24` desktop/mobile homepage and `/dev/site-ui-v2` tests green, including full-page pixel baselines, privacy index policy and interaction gates.

## Remaining risks / next increments

- Public API fetch must distinguish `not_found` from `unavailable/invalid`; production outage may not become an indexable fixture/false 404.
- Sitemap/redirect lifecycle must be generated from active release rather than static `publicRoutes`.
- Managed artifact/release contracts still need persisted artifact revision/build/dependency hashes and a real CMS source/diff/build service.
- Standard template renderer must validate renderer key/version/schema and either honor resolved order/config or explicitly expose only template-owned visibility/variants.
- Release gate still needs raw SSR checks for exactly one H1, metadata/canonical, crawlable links, schema, image dimensions and hydration budget.
