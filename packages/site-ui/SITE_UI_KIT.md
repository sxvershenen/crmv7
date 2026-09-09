# Public UI kit — v2 presentation migration

`@crm/site-ui` is a versioned, Astro-first component contract for the public site. Its canonical presentation is rebuilt from the approved homepage through real consumers; the old generic v1 gallery is rejected. The existing `site-ui@1` renderer identifier remains temporarily stable for CMS contract compatibility and does not make the removed v1 gallery canonical.

## Global editing

Edit `src/styles/theme.css`. Semantic tokens (`--site-color-*`, typography, spacing, radii, shadow, container, focus, motion and z-index) are consumed by every exported component. Avoid using raw palette values in pages.

## Layers

- foundations: theme CSS, `cn`, analytics attributes and action types;
- primitives: controls, fields, surfaces, layout, disclosure and feedback;
- public compositions: cards, listings, gallery, breadcrumbs, navigation and footer;
- booking: date range, guest stepper, summary and responsive flow shell;
- Astro wrappers: `Container`, `SectionShell`, `ResponsiveMedia` for zero-hydration composition.

## Stable exports in v1

- layout/identity: `Container`, `Stack`, `Cluster`, `Grid`, `Divider`, `Surface`, `Card`, `SectionHeading`, `Badge`, `IconBox`;
- actions/forms: `Button`, `IconButton`, `SiteLink`, `Field`, `Input`, `Textarea`, `Select`, `Checkbox`, `Radio`, `Switch`;
- disclosure/overlays/feedback: `Tabs`, `Accordion`, `Tooltip`, `Popover`, `Dialog`, `Sheet`, `Drawer`, `Skeleton`, `Alert`, `EmptyState`, `ErrorState`, `Toast`, `ToastViewport`;
- public media/content: `ResponsiveMedia`, `SiteListingRail`, `CategoryCard`, `ArticleCard` and the canonical homepage-matched `Site*FeatureCard` family;
- catalogs: `ListingFilterBar`, `Gallery`, `Breadcrumbs`, `Pagination`;
- booking: `DateRangeCalendar`, `GuestStepper`, `BookingSummary`; modal composition uses the canonical `Dialog` foundation until the restored booking modal is fully migrated;
- shell/contracts: `SiteFooter*`, `SITE_SECTION_REGISTRY` and analytics helpers. Build/CMS-only Zod contracts are imported from `@crm/site-ui/schemas`, so they do not inflate public islands.

Astro-only wrappers are imported through `@crm/site-ui/astro/Container`, `@crm/site-ui/astro/SectionShell` and `@crm/site-ui/astro/ResponsiveMedia`.

All React exports can be server-rendered by Astro. Components do not require a SPA root. Interactive overlays/calendar are intended as small islands.

## Analytics contract

Pass `analyticsId` to actionable components. The library writes `data-analytics-id`; action kind is written as `data-analytics-action`. IDs are semantic and stable across copy edits. Never include names, contacts, raw URLs, query strings or entity IDs supplied by visitors.

## Booking boundary

`DateRangeCalendar` accepts unavailable dates and selection from a public projection. `BookingSummary` only presents quoted lines. A booking flow composes these with `Dialog`; it does not calculate authoritative totals, promise availability or create a confirmed booking.

## Custom page artifact declaration

Each generated artifact must declare:

```json
{
  "rendererVersion": "site-ui@1",
  "schemaVersion": 1,
  "sectionKeys": ["hero", "houses", "faq"],
  "cmsFields": ["hero.title", "listing.items", "faq.items"],
  "assets": [{ "id": "asset-revision-id", "usage": "hero", "alt": "..." }],
  "analyticsIds": ["landing.hero.booking"],
  "publicApi": ["GET /api/public/v1/pages/:path"]
}
```

See `component-inventory-v2.json`, `manifest.json`, `manifest.schema.json`, `AGENTS.md` and `/dev/site-ui-v2` for the executable allowlist and main-derived gallery. The rejected v1 gallery has been removed.

## Public application gate

`pnpm --filter @crm/site architecture` protects the consumer boundary. It rejects CRM/internal-data imports, direct semantic color, radius, shadow, type-size and font-weight utilities, and verifies every current homepage section against its registry key. Black alpha image overlays and unique illustrative geometry remain page-local; semantic presentation must use this package.
