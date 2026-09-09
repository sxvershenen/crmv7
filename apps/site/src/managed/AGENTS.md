# Managed public source pages

Это единственная CMS-editable source boundary public artifacts.

Начинать с linked artifact manifest, content schema и текущего route adapter. Дополнительный контекст выбирать по изменению:

- page/artifact contract → нужный раздел `07-phase-4-cms/PUBLIC-PAGE-AUTHORING.md`;
- presentation или shared variant → `packages/site-ui/AGENTS.md` и текущий consumer;
- release metadata/publication → релевантный contract/code, не весь Phase 4 roadmap.

Правила:

- Строить meaningful SEO HTML в Astro; React — только минимальный interaction island.
- Использовать `@crm/site-ui`; Tailwind здесь только structural. Новый visual pattern сначала становится named kit variant с consumer/gallery/coverage.
- Не владеть production title/canonical/robots/social/schema/sitemap; их передаёт active release через route adapter/BaseLayout.
- Не импортировать CRM UI, DB, internal API, filesystem, secrets или operational fixtures.
- Price, availability, capacity, promotions и booking success — server-authoritative.
- Manifest объявляет files/imports, fields, media, public APIs, analytics, islands/hydration reasons, SEO/H1 strategy, fixtures и budgets.
- Через CMS source tooling не менять dependencies, lockfiles, build config и файлы вне `apps/site/src/managed/**`.
