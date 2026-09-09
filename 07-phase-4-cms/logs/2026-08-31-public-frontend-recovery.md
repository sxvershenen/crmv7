# 2026-08-31 — Public frontend recovery against `9cd146a`

## Scope

- Restore the public homepage presentation after the `packages/site-ui` migration without reverting CMS/API/SSR work.
- Keep the already approved D-044 mobile card rails, compact mobile Programs cards and Astro-first Blog.
- Make the regression gate cover the complete homepage and the interaction families used by CMS consumers.

## Root cause

`@crm/site-ui` components contained responsive Tailwind utilities, but `packages/site-ui/src` was absent from the Tailwind v4 source graph of `apps/site`. The generated CSS therefore omitted package-only rules such as `xl:grid-cols-4` and `lg:grid-cols-5`. This produced the measured 7% desktop / 2% mobile viewport drift and also broke the mobile Dialog stacking/layout in `/dev/site-ui`.

## Changes

- Added the explicit package `@source` directive and an architecture assertion that prevents its removal.
- Re-verified every homepage section against an isolated detached worktree at `9cd146a`.
- Restored the mobile header and made its brand content/color CMS-configurable without changing the default presentation.
- Restored the reference desktop Program card media/density while preserving the approved compact mobile card contract.
- Preserved CMS navigation/hero/section/footer inputs, global ModalHub, public SSR adapter and safe fallback.
- Kept the D-044 Blog and mobile card rail changes as explicit post-reference exceptions.
- Added full-page desktop/mobile screenshots in addition to the existing viewport screenshots.
- Expanded interaction coverage to Programs and Venues filters, Program booking, review modal, map selection, FAQ, booking/call dialogs, SPA tabs and resource-page root anchors.
- Re-checked the canonical inventory: removed conflict names are absent; every canonical item has an actual consumer, and every gallery-required item is present in `/dev/site-ui`.
- Disabled the Astro development toolbar for `apps/site`: it sat below the fixed mobile navigation and introduced a nondeterministic 9px viewport shift. Screenshot baselines were regenerated only to remove that dev-only artifact; the product pixels above it were identical.

## Independent visual comparison

- Desktop document height and all reference section dimensions matched `9cd146a` before re-applying the intentional Blog exception.
- Events, Houses, Sauna, Venues, Reviews, Map, FAQ/location and Calculator matched their reference section screenshots exactly after image masking.
- Hero and Programs had only 297 antialias pixels total (emoji/filter glyph edges), below the 0.1% gate.
- Mobile differences remain intentionally concentrated in the D-044 cards; header and non-card interactions follow the reference contract.

## Verification

- `@crm/site-ui` typecheck: passed.
- Public architecture gate: passed, 14 registered sections.
- Astro check: 62 files, 0 errors/warnings/hints.
- Site lint: passed.
- Playwright: 18/18 desktop/mobile tests passed, including viewport/full-page screenshots and interaction coverage.
- Astro server build: passed.
- Environment warning remains: local Node 24; repository engines require Node `>=22.16 <23`.
