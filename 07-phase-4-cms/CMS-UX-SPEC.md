# CMS UX specification

Этот документ описывает target UX и будущие gates; текущая реализация определяется Phase 4 status, source и фактическими проверками.

## 1. Продуктовая граница

CMS живёт в отдельном `apps/admin` и управляет только тем, что посетитель видит на сайте: content, composition, media, SEO и publication. Между CRM и CMS есть app switcher и deep links, но operational поля имеют единственный UI entry point в CRM. Копии цены, доступности, вместимости, привязок и client-side «синхронизация» запрещены.

Каждое значение с потенциально неочевидным владельцем показывает source marker:

- `CRM` — operational authoritative; в CMS поле не отображается, вместо него при необходимости есть «Открыть в CRM»;
- `CMS` — маркетинговый/контентный owner, редактируется здесь;
- `Вычисляется` — public projection или системное значение;
- `Наследуется` — effective value пришло от site/type/parent default.

Frontend CMS использует существующие tokens, generated shadcn primitives и shared compositions `EditorFrame`, `FormField`, `DataTable`, `PageNav`, `SettingsBar`, `IconBox`, `StatusBadge`, `PageState` и Tabler Icons из `packages/ui`. Ownership и порядок работ задают root/scoped `AGENTS.md` и current Phase 4 status.

## 2. Shell и навигация

### Desktop sidebar

**Сайт**

- Обзор;
- Страницы сайта;
- Блог и материалы.

**Оформление**

- Глобальные секции;
- Навигация и footer;
- Медиа;

**Продвижение**

- SEO;
- Маркетинг и кампании;
- Редиректы;
- Аналитика.

**Настройки**

- Настройки сайта;

Главная, посадочные, категории/listings и страницы домиков, кемпингов, площадок, программ и допов являются типизированными узлами единого дерева «Страницы сайта». Public profiles, source links, bindings, access matrix, raw versions, components registry и code artifacts доступны только как capability-gated diagnostics/tools и не входят в обычную навигацию администратора.

Topbar: breadcrumbs/route identity, environment `Черновик / Preview / Production`, глобальный поиск, «Открыть сайт», очередь публикации, уведомления, app switcher, профиль.

Mobile: отдельная адаптация — компактный topbar, bottom nav `Обзор / Страницы / Создать / Медиа / Меню`; таблицы становятся card lists; editor tabs горизонтально прокручиваются; preview открывается отдельным full-screen режимом.

## 3. Route map admin

```text
/
/content/tree
/content/pages
/content/pages/new
/content/pages/:nodeId
/content/categories
/content/categories/new
/content/categories/:nodeId
/content/public-profiles
/content/public-profiles/:entityType/:entityId
/offers/:kind/:offeringId
/content/articles
/content/articles/new
/content/articles/:nodeId
/globals/sections
/globals/sections/new
/globals/sections/:presetId
/globals/navigation
/globals/footer
/media
/media/:assetId
/components
/components/new
/components/:blockId
/code
/code/new
/code/:artifactId
/seo
/seo/pages/:nodeId
/marketing/campaigns
/redirects
/analytics
/analytics/acquisition
/analytics/content
/analytics/funnels
/analytics/forms
/analytics/retention
/analytics/quality
/publication-log
/publication-log/:publicationId
/settings/site
/settings/integrations
/settings/access
/audit
/quality
```

List/view/filter state хранится в URL: `q`, `status`, `type`, `owner`, `updatedBy`, `hasIssues`, `sort`, `page`, period/compare для аналитики. Editor tabs use `?tab=...`; Back restores list filters/scroll. Unsaved navigation uses the shared dirty guard. Permission-denied and missing routes have explicit full-page states.

`/seo/pages/:nodeId` is a report/drilldown route only; «Редактировать» deep-links to the canonical content editor `...?tab=seo`, so SEO fields never have two editors.

`/content/categories` и `/content/public-profiles` остаются technical/reporting routes для taxonomy/profile diagnostics и миграции. Основной CRUD коммерческого контента идёт через единый `/content/tree`; `/offers/*` — только canonical locator/deep link к CMS node. Operational editor открывается в CRM, а CMS хранит и редактирует только editorial revision.

## 4. Обзор CMS

Секции без лишних card-in-card:

- **Требует внимания:** failed publish, broken reference, SEO blocker, unprocessed media, stale CRM relation, expiring preview, analytics gap.
- **Статус сайта:** production release, время последней публикации, pending draft count, queue/worker health.
- **Быстрые действия:** новая посадочная, статья, asset upload, preview, release.
- **Контент:** draft/review/scheduled/published, обновления за период.
- **SEO:** indexable pages, blockers/warnings, redirects, orphan pages.
- **Воронка:** visitors → leads → confirmed bookings → paid revenue, только агрегаты.
- **Последние изменения:** actor, entity, diff summary, status.

## 5. Структура сайта

Основной экран — split view:

- слева дерево route nodes с DnD/reorder, expand, status, page type, SEO issue dot;
- справа выбранный node: effective URL, owner, template, published/draft revision, children, inbound/outbound links, media count, действия;
- alternative table view для массовых операций и сортировки;
- search по title, slug, route, CRM entity, media filename.

Действия: создать child/sibling, duplicate, move, change slug, preview, request review, publish, schedule, archive. Изменение path сначала показывает affected descendants, redirect proposal, canonical/sitemap impact.

## 6. Общий route-driven editor

Используется существующая анатомия `EditorFrame`: identity в topbar, sticky tabs + status/actions, main + right sidebar, fixed bottom action bar.

### Общие tabs

1. **Содержимое** — собственные поля типа страницы и ordered section outline.
2. **Композиция** — секции, наследование, order, visibility, responsive settings.
3. **SEO** — metadata, canonical/indexing, schema, social, internal links.
4. **Медиа** — assets и usage graph текущей revision.
5. **Файлы и код** — file tree/artifact/diff/dependencies, если доступно.
6. **Аналитика** — effective analytics IDs, события и агрегаты page/version.
7. **Версии** — draft/published diff, comments, release history, rollback.

Right sidebar:

- status/revision/release;
- owner/source markers;
- URL; Phase 4 v1 is Russian-only, without a decorative locale switcher;
- author/reviewer;
- updated/published timestamps;
- SEO score по правилам, не «магическое число»;
- CRM relation;
- affected pages для reusable content;
- capabilities и blocked reasons.

Bottom bar: dirty/saving/saved/error/conflict, «Закрыть», «Preview», primary action по capability: `Сохранить`, `На проверку`, `Запланировать`, `Опубликовать`.

## 7. Наследуемые секции

Для hero, map, FAQ, directions, calculator и footer единый control:

`Наследовать | Настроить | Скрыть`.

При `Наследовать` показывается effective preview, уровень-источник и deep link к нему. При `Настроить` editor создаёт patch поверх effective config; рядом доступны «Показать отличия» и «Сбросить к наследованию». При `Скрыть` обязательно показывается page-level результат и SEO/conversion warning, если секция обязательна по quality policy.

Иерархия:

`site default → page-type default → parent/category → page/public profile`.

Изменение global/reusable секции показывает blast radius: affected drafts, published routes, custom overrides и какие routes войдут в release. Production не меняется скрыто.

### Hero fields

- enabled mode;
- eyebrow/badge;
- H1/title, subtitle/description;
- background media + focal point + mobile media;
- overlay/contrast theme;
- primary/secondary CTA: label, action kind, target, analytics ID;
- trust facts/badges;
- optional quick-search/calculator preset;
- breadcrumb visibility;
- alignment, max text width и safe-area preview;
- structured data bindings where relevant.

### Нижние секции

- Map: asset/map config, markers, labels, CTA.
- FAQ: source preset, ordered items, category, schema eligibility, page-only overrides.
- Directions: address, transport modes, route links, contact CTA; operational contact source visible.
- Calculator: approved preset, input visibility/defaults, CTA, analytics funnel IDs; цены/availability readonly from public API.
- Footer: inherited navigation, contacts, social, legal links, campaign CTA; usually edited globally, page override only with elevated permission.

## 8. Главная страница

`/content/home` — специальный editor поверх того же node/revision model.

Tabs:

- **Секции:** hero, события, домики, баня/чан, программы, площадки, blog, why us, reviews, map, FAQ/directions, calculator, partners; reorder/visibility/source.
- **Карточки и подборки:** source (`CRM query`, `manual`, `computed`), фильтры, sort, limit, pinning/fallback.
- **Навигация:** anchors/menu labels, mobile order, CTA.
- далее общие SEO/Media/Analytics/Versions.

Для каждой секции: title/eyebrow/description, source, filters/sort, card variant, item limit, empty fallback, CTA, analytics ID, desktop/mobile preview. Нельзя вручную подменять authoritative availability/price.

## 9. Посадочная страница

Поля `Содержимое`:

- internal name, public H1, slug/parent;
- intent/topic and audience note;
- page mode: template / composition / custom code;
- ordered sections;
- primary CTA and lead direction mapping;
- related entities/categories/articles;
- campaign association and expiry/archive policy.

Композиция допускает rich text, media, gallery, benefits, catalog slice, comparison, reviews, FAQ, CTA, calculator. Indexable landing обязана иметь unique intent, owner, canonical, internal links и review date.

## 10. Каталоги, категории, фильтры и сортировки

Это техническая настройка public listing/SEO, а не основной список бизнеса. Направления: Домики, Кемпинги, Допы, Площадки, Программы, Мероприятия под заказ. Они используют configurable taxonomies/listing pages and one registry, not independent UI systems.

Tabs listing/category editor:

- **Основное:** name, slug, parent, intro, icon/color, cover, visibility.
- **Источник:** public profile entity types, include/exclude rules, manual pins.
- **Фильтры:** field, label, control type, values/source, order, default, URL key, index policy.
- **Сортировки:** label, stable key, direction, default, tie-breaker.
- **Карточка:** card variant, fields/badges/CTA, missing-data fallback.
- **Empty state:** text, suggested resets, CTA.
- общие Composition/SEO/Media/Analytics/Versions.

Faceted URLs по умолчанию не индексируются. Только curated filter combination может стать отдельным `landing/category node` с собственными H1, copy, canonical и internal links. CMS показывает estimated URL explosion и блокирует массовую индексацию неизвестных комбинаций.

## 11. Предложения и публичные профили

Полная domain model: `OFFERING-CATALOG-ARCHITECTURE.md`. `/offers/:kind/:offeringId` — locator к canonical CMS node, а не primary operational editor.

Tabs:

- **Контент:** public title/summary/description, benefits, included/not included, restrictions, related offers, sections and preview.
- **Медиа:** gallery, focal point, alt and usage state.
- **SEO:** canonical/index/social/schema checks without duplicate SEO editor.
- **Публикация и история:** draft/live diff, first-launch readiness, schedule, versions, audit and rollback links.

Commercial summary — компактная read-only сводка в существующем редакторе, не новая вкладка: offering kind, display mode, readiness/freshness и typed blockers; price/availability/capacity/bindings/tariffs ведут в CRM.

Для программ и event service CMS показывает только editorial title/description, relation, public schedule copy и safe readiness summary; package/rate/capacity/options остаются read-only и ведут в CRM. Произвольный operational CRM `Event` не eligible for publication и никогда не передаёт customer/internal comments в CMS. Occurrence fields появляются только через allowlisted safe projection и не редактируются через content JSON. «Доп» либо привязан к `CatalogOffering(kind=addon)`, либо является CMS-only non-bookable content without price/availability.

Calendar/rule explanation, quote preview и activation blockers приходят из CRM/public projection; CMS не редактирует price book, calendar или tariffs. Action bar ограничен `Сохранить черновик`, `На проверку`, `Опубликовать страницу`; `Запустить на сайте` допускается только как editorial first-launch orchestration после read-only CRM readiness gates.

## 12. Blog/materials

List: status, type, author/reviewer, category/tags, publish/update dates, SEO issues, related pages, performance.

Editor fields:

- title, dek, body/sections, cover/social image;
- content type, category/tags, author/reviewer and experience signals;
- publish/update date and freshness review;
- related resources/programs/events/landings;
- citations/source notes where applicable;
- common SEO/schema/media/analytics/versions.

## 13. Глобальные секции, navigation и components

`/globals/sections`: presets for hero/map/FAQ/directions/calculator/footer, usage count, published version, affected routes, variants.

`/globals/navigation`: desktop/mobile menus, nesting, external/internal links, visibility, active rules, CTA, broken-link validation. Header/footer share link registry, not copied strings.

`/components`: block registry and reusable instances. Each row shows key, schema version, renderer version, owner, usage, status. Editors can duplicate/configure an instance, but cannot create an unknown renderer from JSON.

## 14. Media manager

Views: grid/table, folders as virtual collections, filters by type/status/uploader/date/usage/alt/license/dimensions.

Upload drawer:

- drag/drop or picker;
- queue with checksum/dedupe;
- processing states: upload → scan → decode → WebP variants → ready/error;
- title, alt, caption, credit/license, tags, focal point;
- replace creates a new blob/revision; published usages never silently mutate.

Asset page tabs:

- Preview + metadata;
- Variants (dimensions/size/WebP status);
- Used on (page/revision/section/code line);
- Versions;
- Technical log.

Archive is blocked for published usage until replace/unlink. Original may remain private; delivery UI presents public WebP URLs/variants, not storage secrets.

## 15. Files and code

Трёхпанельный desktop view: allowlisted file tree, Monaco-like editor/diff, preview/dependencies/usage. Mobile — browse/diff/read-only by default; code mutation requires desktop and elevated capability.

Tabs: Files, Diff, Preview, Build, Dependencies, Media usage, History.

Actions: create draft workspace, edit, format, save draft, validate, typecheck/lint/build, open preview, request review, publish artifact, rollback. CMS never exposes secrets, `.env`, migrations, DB config, package-manager execution or arbitrary filesystem paths.

«Сразу на фронте» означает:

- draft preview/HMR — секунды;
- production — только после successful gated release;
- failed build never changes production;
- release has immutable Git/build reference and one-click rollback.

## 16. SEO, marketing и redirects UI

SEO dashboard tabs: Overview, Pages, Indexing, Metadata, Schema, Internal links, Images, Sitemap/robots, Redirects, Content freshness.

Page SEO fields:

- SEO title, description, H1 check;
- canonical mode/value;
- index/follow;
- OG/Twitter title/description/image;
- breadcrumb label;
- schema types + validated typed fields;
- sitemap eligibility;
- redirect on slug change;
- primary topic/query note, search intent, related links;
- preview for desktop/mobile snippet and share card.

Marketing: campaigns, UTM builder/allowlist, campaign landings/CTA, active dates, promotion display content. Campaign does not own authoritative discount calculation unless CRM explicitly gains that domain rule.

## 17. Publish workflow

Обычный editor использует direct page/settings publication; internal release IDs/build/activation steps не становятся пользовательским workflow.

Page editor before publish shows effective before/after diff, affected routes/dependencies/cache tags, gates, reviewer, schedule/timezone and stale preview state. The primary command is `Опубликовать страницу` or `Запустить на сайте` for a coordinated first offer launch.

`/publication-log` is a readonly operational journal: page/settings/code publication, status, actor, affected paths, validation/delivery/cache outcome, rollback target and audit deep links. A detail page may retry failed delivery or start capability-gated rollback, but never edits an arbitrary release manifest.

By default an author cannot approve own code release; emergency capability is separate and audited. Content validation and infrastructure delivery status are shown independently. Rollback creates a new immutable publication from a prior complete snapshot. Conflict screen follows the existing CRM pattern and distinguishes operational, pricing and editorial source versions.

## 18. Обязательные UI states

Для каждого list/editor/upload/release/code flow: loading, empty, error, permission denied, readonly, disabled, dirty, saving, saved, conflict, validation warning/blocker, processing, scheduled, publish in progress, publish failed, stale preview, long content, missing CRM relation, broken media, mobile/narrow.

No-op controls запрещены. Действие либо работает на fixture boundary в frontend-прототипе, либо явно disabled с причиной.

## 19. Контракт UI kit для public-site AI agent

Нужно создать versioned manifest, например `packages/site-ui/manifest.json`, и документацию `/dev/site-ui-v2`:

- design tokens, typography, spacing, radii, colors, breakpoints;
- Astro/React section and island registry;
- props Zod schemas and schema version;
- approved CTA/action types and stable `analyticsId` rules;
- media component with responsive WebP/focal point/alt contract;
- accessibility, motion, performance and hydration budgets;
- layout slots and inheritance-compatible section keys;
- forbidden imports and server/client boundaries;
- fixture examples for default/empty/error/long/mobile states;
- visual regression stories/screens.

AI-generated page must declare template/renderer version, CMS fields used, assets manifest, analytics IDs, public API dependencies and pass typecheck/lint/build/a11y/visual gates before preview/publish.

## 20. Section completeness and simplification map

This matrix is the target product review of every top-level CMS area. A section is not considered implemented merely because a route/placeholder exists.

| Area | Keep / change | Required complete workflow |
|---|---|---|
| Обзор | keep, reduce decorative cards | attention queue, site/publication/worker health, content and offer readiness, quick actions, aggregate funnel, recent audited changes |
| Страницы сайта | make the single primary registry | one typed tree for homepage, landings, categories/listings and offering-linked pages; move/slug/redirect blast radius, preview, archive/unpublish and filtered views |
| Главная | edit through its typed tree node | typed sections/sources, offer selections, navigation anchors, responsive preview, SEO/media/analytics and direct publish |
| Посадочные | edit/filter through the tree | template/managed mode, intent/owner/expiry, content/relations, SEO/media, preview/publish; no second list authority |
| Offering-linked pages | editorial-only locator | content/composition/media/SEO/publication plus CRM deep link; no price, fulfillment, bindings, tariffs, versions or access matrix |
| Категории/listings | typed tree nodes plus deep configuration | taxonomy, ListingDefinition, filters/sorts/cards, curated indexable nodes and URL-explosion guard; no competing primary registry |
| Blog/materials | keep | article lifecycle, author/reviewer/source notes, relations, freshness, SEO/schema/media and publication |
| Глобальные секции | keep | named defaults/presets, inheritance/effective preview, usage and blast radius, versioning/direct settings publication |
| Navigation/footer | merge into one link registry UI | desktop/mobile/footer trees, visibility, CTA, broken links, preview and settings publication |
| Media | keep and finish backend states | upload/scan/process, metadata/rights/focal point, variants/usages/version/replace/archive, provider/worker errors |
| Components/templates | capability-gated tool, not primary navigation | renderer/schema versions, reusable instances, usage/blast radius and approved variants; no arbitrary JSON renderer |
| Files/code | capability-gated tool, not ordinary page tab | linked managed artifacts only, diff/build/preview/dependencies/media/history and sandbox gates |
| SEO | keep as reporting/control center | issues and drilldowns; field editing deep-links to canonical page/offer editor; sitemap/schema/indexing/links/images/freshness |
| Marketing | keep, clarify boundary | campaign metadata, UTM allowlist, CTA/landing schedule and promotion copy; discounts/calculation remain CRM Pricing |
| Redirects | keep | proposed slug redirects, validation, chains/loops, source/target lifecycle, import/export and audited publication |
| Analytics | keep, implement later | acquisition/content/funnel/forms/retention/quality with consent, server conversion facts and data-quality states |
| Publication log | replace manual release editor | direct publication history, validation/delivery/cache status, retries and rollback; immutable releases stay internal |
| Integrations | keep | connection health, scopes, last delivery, retries/DLQ, secrets never displayed, test connection with audit |
| Users/rights | keep | role/capability matrix, invitations/session state and high-risk capability warnings; backend rechecks every command |
| Site settings | keep | identity/contacts/default timezone/calendar/public base URL/feature settings with field ownership and publish semantics |
| Audit | keep | actor/surface/request/entity/version/change summary, filters/export capability and deep links; no PII spill |
| Data quality | make first-class route | broken relations/media/links, stale source versions, pricing gaps/ambiguity, unpublished/archived dependencies and remediation action |

Primary navigation exposes the single editorial tree and common content tasks. Registry/diagnostic areas remain available, while offering kinds are represented as typed tree nodes and canonical locators rather than separate CMS workspaces.
