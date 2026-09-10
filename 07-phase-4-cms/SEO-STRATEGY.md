# SEO strategy embodied in CMS

## 1. Mode and evidence boundary

This is a CMS/site architecture strategy for a local hospitality/recreation business. Generic and local-business SEO templates were used selectively. No live domain, keyword volumes or named competitors were provided, so ranking claims, page counts and traffic forecasts are intentionally absent.

## 2. Goals

- cover distinct commercial intents with useful hubs/categories/details/landings;
- keep resource/program/event facts consistent with CRM;
- prevent duplicate/faceted index bloat;
- make every release inspectable, reversible and measurable by content version;
- preserve Astro-first server-rendered HTML, performance and accessible mobile UX;
- connect organic/campaign traffic to server-authoritative Lead/Booking/Payment without PII-heavy surveillance.

## 3. Page-level SEO model

Required/conditional fields:

- editorial intent, owner, review date;
- slug/parent/effective path;
- SEO title and description;
- one visible H1 check;
- canonical mode/value;
- index/follow and sitemap eligibility;
- OG/social title/description/image;
- breadcrumb label;
- typed schema profile;
- primary and related internal links;
- hero/cover alt/focal point;
- content freshness and campaign expiry;
- redirect decision when route changes.

Effective previews: SERP-like snippet, social card, desktop/mobile page, schema validation, link graph and published/draft diff.

## 4. Quality gates

### Publish blockers

- non-unique/colliding canonical path;
- indexable page without title, description, H1 or canonical;
- redirect loop/chain introduced by release;
- broken required internal link, media or CRM relation;
- published page references unfinished media/code build;
- invalid structured data required by selected profile;
- indexable generated filter URL without curated node;
- preview/private URL leaking into canonical/sitemap;
- unsafe HTML or client-only rendering of critical SEO content.

### Warnings requiring acknowledgement/review

- duplicate/near-duplicate title/copy;
- orphan or dead-end page;
- missing optional alt/caption/credit;
- stale content or expired campaign;
- too few matching items for category;
- overly deep route;
- global preset change affecting many routes;
- custom-code page exceeding hydration/performance budgets.

## 5. Technical foundation

- public site accesses only `/api/public/v1`;
- server-rendered/prerendered meaningful content, no SPA root;
- route registry generated from published release, not hand-maintained fixtures;
- canonical, robots, sitemap and redirects all derive from one release manifest;
- responsive WebP delivery, dimensions and focal points;
- cache invalidation tied to release and safe public projections;
- 404/410 and redirect behavior tested;
- CSP/sanitization and no secrets/internal DTO in HTML;
- stable analytics IDs independent of display copy.

Target performance gate for templates should be defined using Core Web Vitals and project budgets after hosting baseline; no synthetic number is claimed before measurement.

## 6. Content clusters

Initial pillars come from real product types, not invented keywords:

- accommodation/houses;
- additions/services;
- venues;
- programs;
- events;
- directions/location/FAQ;
- useful editorial materials.

Each pillar can contain hub → category/curated landing → detail → supporting article. A new page requires distinct intent and linking role; otherwise enrich an existing page.

## 7. Local and trust signals

CMS should centralize organization/contact/address/map/opening/route facts so pages and structured data cannot diverge. Reviews, author credentials, licenses, partner names and claims appear only when backed by approved content/source; placeholders are never published as facts.

## 8. GEO/AI citation readiness

- clear answers and definitions near relevant headings;
- factual, source-owned statements and visible update date;
- entity relationships and typed structured data;
- self-contained FAQ/route/pricing explanations without hiding core facts in client-only widgets;
- original media with useful context;
- stable canonical URLs and consistent organization/resource naming;
- page passages that remain understandable outside the full layout.

`llms.txt` may be supported as configurable static text later, but is not treated as a ranking or crawler-control authority.

## 9. Reporting

Baseline must be captured at go-live: indexed pages, organic landing sessions, leads, confirmed bookings, paid revenue, query coverage, CWV, broken/indexing issues.

CMS reports by page/release/version and period:

- published/indexable coverage;
- organic entry and conversions;
- page/section CTA performance;
- zero-result filters;
- content changes correlated with trends (correlation, not claimed causation);
- crawl/indexing/schema/media/link issues;
- Metrika versus first-party coverage.

No numeric 3/6/12-month targets are set without current domain baseline, seasonality and budget.

## 10. Implementation priorities

1. canonical content/route/release model;
2. public profiles and real intake;
3. media/redirect/sitemap/schema gates;
4. migrate current home and existing resource routes;
5. build hubs/categories/details;
6. add curated landings only from evidence;
7. connect analytics and content-version reports;
8. run competitor/semantic research and populate editorial calendar.

## 11. Planning input gate

Mass landing/page work waits for evidence: confirm production domain, geography, real services/resources and team owners; collect SERP competitors by pillar; record source, date and uncertainty; then update `SITE-STRUCTURE.md` and the editorial backlog. Each backlog item needs distinct intent, owner/reviewer, status, evidence/source, dependencies, review/publish date and internal-link role. Workflow is `evidence → brief → draft → editorial/SEO/claims review → approved → scheduled → published → measured → refresh/archive`; invented titles, prices, claims, schedules or publishing cadence are not baseline requirements.
