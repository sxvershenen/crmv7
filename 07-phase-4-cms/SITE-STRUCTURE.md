# Site structure and page system

Этот документ описывает target architecture и будущие gates; текущая реализация определяется Phase 4 status, source и фактическими проверками.

Это target architecture, а не утверждённый список URL. Финальные slugs и набор indexable pages утверждаются после семантики и миграционного crawl текущего сайта.

## 1. Типы страниц

| Page kind | Назначение | Data owner |
|---|---|---|
| Home | основной entry и подборки | CMS + public projections |
| Landing | отдельный search/campaign intent | CMS |
| Listing/hub | каталог типа | CMS taxonomy + CRM profiles |
| Category | curated subset с уникальным intent | CMS taxonomy |
| Resource detail | домик/доп/площадка и т.п. | CRM identity + CMS public profile |
| Program detail | постоянная программа | CRM template + CMS profile |
| Event detail | мероприятие/формат | EventServiceTemplate/offering + CMS public profile; customer Event private |
| Article/listing | информационный кластер | CMS |
| Information/legal | о базе, контакты, privacy и т.п. | CMS/settings |
| Custom code | исключительный уникальный experience | Git artifact + CMS manifest |

## 2. Предлагаемая логическая иерархия

```text
/
├── /domiki
│   ├── /{house-slug}
│   └── /{curated-category-or-landing}
├── /kemping
│   ├── /{campground-slug}
│   └── /{curated-category-or-landing}
├── /dopy
│   ├── /{category-slug}
│   └── /{service-slug}
├── /ploshchadki
│   ├── /{category-slug}
│   └── /{venue-slug}
├── /programmy
│   ├── /{category-slug}
│   └── /{program-slug}
├── /meropriyatiya
│   ├── /{category-slug}
│   └── /{event-slug}
├── /akcii
│   └── /{promotion-or-landing-slug}
├── /blog
│   ├── /{category-slug}
│   └── /{article-slug}
├── /o-baze
├── /kak-dobratsya
├── /faq
├── /kontakty
└── /privacy
```

`/resources/:slug` из текущего прототипа не объявляется permanent URL автоматически. При миграции каждый старый published path получает mapping: keep, canonical alias или 301 to approved new path.

Текущий опубликованный house slice использует `/houses/{house-slug}` — это фактический CMS path, создаваемый source locator и обслуживаемый catch-all route. Целевой `/domiki/{house-slug}` пока не включён; его alias/redirect map остаётся отдельным миграционным gate.

## 3. Catalog model

Один reusable listing engine обслуживает домики, кемпинги, допы, площадки, программы и мероприятия под заказ. Конфигурация задаёт:

- entity/public-profile types;
- manual pins + dynamic include/exclude rules;
- card variant and visible fields;
- filters and options source;
- sorts and stable tie-breaker;
- pagination/load strategy;
- empty/error/stale fallback;
- CTA and analytics IDs.

Category — реальный CMS node with copy/SEO/links, не просто filter query. Operational program/event categories могут связываться с CMS category, но не становятся публичной страницей без published profile.

CMS, public API and Astro share one versioned `ListingDefinition/FilterDefinition` contract: field, operator, source, value type, allowed values/cardinality, control, default, URL key, normalization and index policy. Server resolver owns validation, deterministic parameter order, limits, pagination and unknown-param behavior; UI does not reproduce the rules independently.

Mapping gate: every commercial page binds to allowlisted `CatalogOffering`. Program pages use `ProgramTemplate`; event-service pages use `EventServiceTemplate`, never a customer operational `Event`; occurrences appear only through a dedicated safe public projection. «Допы» map to `CatalogOffering(kind=addon)` with optional Resource binding or are explicitly non-bookable CMS content without price/availability. Campground projection resolves ResourceGroup/shared-area capacity on backend, never in page code.

## 4. Filter/index policy

Default query combinations (`?guests=`, `?sort=`, etc.) имеют canonical на listing/category и `noindex` where applicable. Indexable combination создаётся только как curated node with:

- unique intent and H1/title/description;
- fixed filter rule;
- own canonical path;
- intro/useful content;
- internal links and owner;
- minimum item/fallback policy;
- review/expiry date.

CMS показывает potential URL count. Нельзя массово добавлять sitemap routes из всех combinations. Sort URLs никогда не становятся отдельными indexable pages.

## 5. Page composition defaults

Каждая page kind получает body template and global slots. Effective order by default:

`Header/Nav → Hero → Page-specific body → Map → FAQ → Directions → Calculator → Footer`.

Каждый global slot: `inherit | override patch | disabled`. Footer всегда последний. Body sections can reorder within approved layout rules.

## 6. Internal linking

- home links to all top hubs and featured profiles;
- hub links to categories, visible profiles and supporting guides;
- category links to parent hub, sibling categories, matching profiles and relevant guide/FAQ;
- detail links to hub/category, related profiles/programs/events and contextual CTA;
- article links to one primary commercial destination and related informational content when relevant;
- breadcrumbs derive from canonical tree, not manual strings;
- CMS reports orphan, dead-end, broken, redirected and overly deep nodes.

No invented cross-links: relation must be editorially selected or produced by an approved deterministic rule visible in CMS.

## 7. Schema map

Final eligibility is validated by page facts, not page-name guessing.

| Kind | Candidate schema |
|---|---|
| Home | `Organization`, suitable local/lodging subtype after validation, `WebSite` |
| Listing/category | `CollectionPage`, `ItemList`, `BreadcrumbList` |
| Resource/service | suitable `Product`/`Service`/lodging subtype only when required fields exist |
| Program/event | `Event` only for an actual scheduled event; otherwise `Service`/`WebPage` |
| Article | `Article`/`BlogPosting`, author/reviewer when real |
| Contact/directions | `ContactPage`, organization/location data |
| Any | `BreadcrumbList` where visible hierarchy exists |

FAQ markup is not added mechanically to every visible FAQ; CMS has explicit eligibility/status and validator.

## 8. Sitemap and route lifecycle

Sitemap contains canonical, published, indexable routes only. Route lifecycle:

- slug change proposes redirect and checks descendants;
- unpublish requires redirect/404/410 decision;
- archive removes from navigation and future release but keeps history;
- scheduled content does not appear early;
- preview hosts/tokens are noindex and excluded;
- redirect chains/loops block release.

## 9. Content quality gates by kind

Instead of universal word-count blockers, CMS validates purpose and uniqueness:

- unique title/meta/H1 and canonical;
- meaningful page-specific copy where indexable;
- no empty category/indexable landing;
- source/owner/review date for claims;
- alt/focal point/size for meaningful media;
- required relation and CTA mapping;
- no broken links/assets/data bindings;
- structured data only with complete facts;
- mobile and long-content preview;
- explicit index policy.

Advisory word-count/duplication checks may guide editors, but do not replace editorial review or encourage filler.
