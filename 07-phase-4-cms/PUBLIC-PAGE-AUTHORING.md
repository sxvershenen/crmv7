# Public page authoring contract

## 1. Выбранная модель

CMS не является универсальным drag-and-drop конструктором. Публичные страницы имеют два основных режима:

1. **Standard template page** — Astro-шаблон задаёт семантическую структуру, CMS редактирует typed content, SEO, media, navigation and visibility/variants разрешённых sections.
2. **Managed source page** — Codex/разработчик создаёт уникальную Astro-композицию в `apps/site/src/managed/**`; CMS редактирует объявленные manifest-поля и показывает связанный source/diff/preview. Ручная правка кода — capability-gated escape hatch.

Reusable blocks являются частью standard template mode. Они не превращают каждую страницу в произвольное дерево классов. `custom_code_page` используется только когда approved template/variant действительно недостаточен.

CMS authoritative для route, editorial content, SEO, media и active release. Managed source authoritative только для presentation/composition. CRM/backend authoritative для цены, availability, capacity, скидки, брони и operational status.

## 2. Source layout

```text
apps/site/src/managed/pages/<artifact-key>/
  Page.astro                 # body/section composition, не html/head
  artifact.manifest.ts       # allowlisted graph и build contract
  content.schema.ts          # CMS-editable typed fields
  islands/*                  # только реальная интерактивность
  fixtures/*                 # default/long/empty/error/mobile
```

Specific source route in `apps/site/src/pages/**` is a thin adapter: resolves the published CMS route/context, passes it to the managed artifact and delegates metadata to `BaseLayout`. It must not copy the artifact presentation. Specific Astro routes take precedence over the generic CMS catch-all.

CMS code tooling may expose only the linked `apps/site/src/managed/**` artifact through a virtual allowlisted tree. `packages/site-ui`, dependencies, lockfile, build config, `.env`, API/DB/migrations and arbitrary filesystem paths remain read-only or invisible. Code is never stored/evaluated from PostgreSQL and never mutates the production checkout directly.

## 3. Artifact manifest

Every managed page declares:

- `artifactKey`, manifest/schema version and compatible authoritative CMS page kinds;
- `siteUiRendererVersion`, entry file and full allowlisted file/import graph;
- CMS-editable fields and content schema;
- strict typed public data bindings; arbitrary URL strings are forbidden;
- media usages with alt, dimensions/aspect ratio and focal point;
- stable analytics IDs without copy or PII;
- React islands, hydration directive and reason;
- SEO input source, H1 strategy and allowed structured-data profiles;
- default, long, empty, error and narrow/mobile fixtures;
- accessibility, JS/hydration and performance budgets.

Release pins the CMS revision, artifact revision/Git hash, build hash and dependency hash. Route/canonical/sitemap eligibility come only from the active release, never from a source file by itself.

Managed binding declares `key`, versioned contract (`public.offering-detail`, `public.listing`, `public.quote`, `public.availability`), release relation role, selected public fields, `ssr_required | island_on_demand`, `release_pinned | live_operational` freshness and one explicit fallback (`block_publish | hide_section | unavailable | lead_cta`). Entity identity comes from a release-pinned typed relation, not from source constants or arbitrary user input.

SSR adapter resolves required content/detail bindings and passes a typed `ManagedPageContext`; the artifact cannot import an internal API client or choose an endpoint. Quote/availability islands receive only an allowlisted public capability and allowed inputs. Missing required binding blocks build/publication; optional binding uses its declared fallback. Live price/availability responses carry source version and `asOf`, while source code never owns their value.

## 4. Component and styling contract

`@crm/site-ui` is the only public visual authority.

- Page/managed code composes exported Astro/React primitives, sections and named variants.
- Tailwind in a page is limited to structural placement when no exported layout primitive exists. Page-local palette, type scale, radius, shadow, button, field, card or modal styling is forbidden.
- Raw brand values live only in `packages/site-ui/src/styles/theme.css`.
- A visual mismatch with an existing element is not permission to redesign it. Add a named kit variant that preserves the existing DOM, geometry, density and states.
- Migration order is mandatory: approved consumer → kit export/variant → same real consumer → `/dev/site-ui-v2` → desktop/mobile pixel and interaction tests.
- Repeated layout or heading anatomy becomes a semantic kit class/component; global selectors that infer a component from `[class*=...]` are forbidden.
- Package component rules live in Tailwind `components` layer, so an intentional consumer utility/className override remains possible. `tw-animate-css` is the shared animation foundation; motion respects `prefers-reduced-motion`.

## 5. SEO-first contract

Every indexable route must pass all of the following:

- Astro/server output contains meaningful page copy, real crawlable `<a href>` links and exactly one meaningful `<h1>` before hydration;
- React is the smallest possible interactive island; `client:only` is forbidden for indexable content;
- title, description, canonical, robots, social metadata and JSON-LD are rendered server-side from the active CMS release through the shared layout contract;
- canonical URL, redirects and sitemap membership share the same release-owned route lifecycle;
- schema is emitted only from complete validated facts; a page name alone never implies schema eligibility;
- meaningful images have useful alt, width/height or stable aspect ratio and responsive public variants; LCP media has explicit priority;
- preview is private, `noindex,nofollow`, excluded from sitemap and never used as canonical;
- production CMS/public API failure is distinguished from not-found and must not silently become an indexable fixture page;
- UI cannot claim authoritative price, availability, discount, reservation or booking success without the public/backend response.
- managed source cannot query PostgreSQL, `/api/internal/v1`, arbitrary URLs, environment or filesystem; no copied operational value may be a public fallback.

## 6. CMS editing UX

Default editor flow is fields + media + SEO + desktop/mobile preview. A page lists which fields come from CMS, CRM projection, computed values or source code.

The optional **Files and code** tab shows the linked managed artifact, diff, dependencies, media usage, build result and history. Source mutation requires desktop, `canManageSiteCode`, draft workspace, validation/typecheck/lint/build/SSR/a11y/performance gates, private preview, review and atomic release. A failed build never changes production.

## 7. Required gates

- site-ui architecture and forbidden-import/style checks;
- managed artifact manifest/import graph validation;
- raw SSR HTML: status, metadata, canonical, robots, one H1, meaningful copy and links;
- parseable JSON-LD and social metadata;
- sitemap exact match to canonical published indexable routes;
- 404/410/redirect and CMS `not_found` versus `unavailable` behavior;
- image alt/dimensions/LCP priority;
- hydration/client-only and JS budget;
- keyboard/focus/mobile/reduced-motion;
- production build and desktop/mobile visual regression.
