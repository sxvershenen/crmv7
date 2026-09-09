# Public site UI kit

## 1. Назначение и граница

Публичный frontend получает собственный versioned `packages/site-ui`. Он не импортирует operational CRM `packages/ui`, но следует тем же инженерным принципам: единые tokens, primitives, compositions, states, accessibility and `/dev` gallery.

Все public routes, включая главную, собираются из зарегистрированных UI-kit components and sections. Screen-local копии button/card/modal/calendar/heading/filter styles и scattered magic colors/sizes запрещены. Уникальная страница может иметь уникальную композицию и custom code, но использует approved tokens, primitives, media, analytics and API boundaries.

## 2. Package contract

```text
packages/site-ui/
  src/
    foundations/
      tokens.css
      typography.css
      motion.css
      utilities.css
    primitives/
    layout/
    forms/
    overlays/
    navigation/
    content/
    catalog/
    booking/
    feedback/
    registry/
    index.ts
  manifest.json
  SITE_UI_KIT.md
  AGENTS.md

apps/site/
  src/pages/dev/site-ui-v2.astro
  src/components/sections/*
  src/components/islands/*
```

Package exports CSS, React components, framework-neutral types/variants and Astro-compatible class/attribute contracts. Meaningful content остаётся SSR. React используется только для реального interaction; Astro JSX нельзя передавать как `children` в React SSR component — вся такая композиция должна находиться по одну сторону renderer boundary.

## 3. Foundations

Global style editing happens through semantic CSS variables, not page files.

### Tokens

- brand/accent/contrast and accessible hover/active tones;
- neutral background/surface/elevated/border/divider;
- primary/secondary/muted/inverse/link text;
- success/warning/danger/info;
- resource/category palettes with foreground/surface/border triples;
- typography families, weights, tracking and fluid display/H1/H2/H3/body/label/meta scales;
- spacing and section rhythm;
- container widths, page gutters, grids and breakpoints;
- radii for control/card/modal/pill;
- border widths and shadows/elevation;
- focus ring;
- overlay/backdrop;
- motion durations/easing and reduced-motion behavior;
- z-index layers;
- safe-area and sticky navigation offsets.

Raw brand hex/px values may exist only in foundation files. Consumers use semantic tokens/variants. Changing tokens must update homepage, detail routes, modals and dev gallery consistently.

## 4. Primitive inventory

- `Button`, `IconButton`, `TextLink`, `LinkOverlay`;
- `IconBox`, `Badge`, `StatusTag`, `CategoryTag`;
- `Surface`, `Card`, `InteractiveCard`, `Divider`;
- `Container`, `Section`, `Stack`, `Inline`, `Grid`, `Cluster`, `AspectFrame`;
- `Heading`, `Text`, `Eyebrow`, `SectionHeading`, `PriceText`;
- `ResponsiveMedia`, `Picture`, `Avatar`, `Logo`;
- `Input`, `Textarea`, `Select`, `Checkbox`, `RadioGroup`, `Switch`, `Field`, `FieldError`;
- `Tabs`, `Accordion`, `Disclosure`;
- `Tooltip`, `Popover`, `Dialog`, `Sheet`, `Drawer`;
- `Skeleton`, `Spinner`, `EmptyState`, `ErrorState`, `Toast`, `Progress`.

Every interactive primitive has default, hover, pressed, focus-visible, disabled and loading states, accessible name/description and keyboard/touch behavior.

## 5. Public compositions

### Navigation

- desktop sidebar/header variants;
- mobile header/bottom navigation/drawer;
- breadcrumbs;
- anchor navigation;
- action/contact clusters;
- footer columns/legal/social/contact.

### Content and marketing

- hero variants: media, split, search/calculator, campaign;
- section shell + eyebrow/title/description/CTA;
- benefits/features/stats/trust facts;
- rich text, callout, quote/review;
- gallery/lightbox/media rail;
- FAQ and directions;
- map/hotspot shell;
- partners/logo rail;
- promo/announcement/CTA banners;
- article header/body/author/related content.

### Catalog

- resource/category/program/event/article cards;
- price/capacity/duration/feature summaries;
- responsive grid and horizontal snap rail;
- filter chips, select/range filter, active filter summary;
- sort/view controls;
- results count, pagination/load more and zero-results state;
- card/list/table presentation where semantically justified.

### Conversion

- CTA group and sticky mobile CTA;
- phone/messenger/contact actions;
- lead form and consent anatomy;
- calculator stepper/summary;
- booking/resource/program/event dialog shells.

## 6. Date, availability and booking UI

UI kit provides presentation and interaction, not authoritative availability/price rules.

### `DateRangeCalendar`

- one/two month responsive layout;
- previous/next and direct month/year navigation;
- today, available, unavailable, selected start/end, in-range, hover-preview and partially available states;
- minimum/maximum/date-window hints supplied by public API contract;
- keyboard navigation and announced range;
- locale-aware Russian labels and Monday-first week;
- desktop popover/dialog and mobile full-screen sheet;
- loading/error/stale availability states;
- clear/apply actions and readable selected summary;
- no client claim that selection is reserved until server confirms.

### Supporting controls

- date trigger/range summary;
- time slot/group selector;
- guest/child/quantity stepper with min/max hints;
- resource/program/event selector;
- extras selector;
- price estimate rows and authoritative/stale marker;
- booking summary, conflict/unavailable message and alternative dates;
- multi-step form progress;
- consent and success/error/retry states.

`BookingDialog` composes these pieces and emits typed user intent. Site/public API owns data fetching; CRM backend remains authoritative for availability, totals and final Lead/Booking operations.

## 7. Section registry and CMS bridge

Each section renderer registers:

- stable `sectionKey` and renderer version;
- Zod/JSON props schema;
- supported page kinds and slots;
- Astro/React implementation and hydration reason;
- configurable fields and variants exposed to CMS;
- media usages and required aspect ratios;
- stable `analyticsId` namespace;
- allowed children/data bindings;
- default/empty/error/long/mobile fixture;
- accessibility/performance budgets.

Unknown renderer/schema versions block preview/publish. CMS stores structured props/references, not classes or arbitrary style fragments.

## 8. AI-generated page contract

Detailed authoring and CMS/source ownership rules live in `PUBLIC-PAGE-AUTHORING.md`. CMS is not required to assemble arbitrary page trees: standard pages use approved Astro templates plus typed fields, while unique compositions are controlled managed-source artifacts.

Every custom/AI bundle declares:

- route/page kind and `site-ui` version;
- renderer/section manifest;
- all files/imports and permitted island boundaries;
- public API bindings;
- asset manifest and alt/focal-point usage;
- analytics actions;
- SEO/schema inputs;
- responsive, long-content, empty/error and accessibility fixtures;
- hydration and performance budget.

Forbidden: direct DB/internal API/CRM fixtures, arbitrary npm dependencies, hardcoded brand values, duplicated primitives, untracked media, SPA root and nonessential hydration.

Page-level Tailwind is limited to structural placement. Palette, typography, radii, shadows and component anatomy live in semantic `@crm/site-ui` tokens/classes/variants. A differing approved consumer becomes a named variant; it is not silently restyled to match an existing generic component.

## 9. `/dev/site-ui-v2`

`/dev/site-ui-v2` is rebuilt from the approved homepage, not from the old generic component gallery. The rejected `/dev/site-ui` v1 route has been removed and is not canonical or acceptance evidence.

A component may enter v2 only through: `approved homepage markup → @crm/site-ui export → actual homepage consumer → v2 gallery example → desktop/mobile pixel and interaction test`. Therefore the list below is a target inventory: each family is added only after its real consumer is migrated without changing presentation.

То же правило действует для foundations. Каждый primitive/composition указывает `sourceConsumer` и `sourceNeedle` в `component-inventory-v2.json`; gate проверяет существование исходного pattern. Generic shadcn anatomy можно использовать как inventory/accessibility reference, но внешний default-style не переносится. Calculator, FAQ и другие реальные public consumers являются источником размеров, плотности, радиусов, typography и states.

Gallery must include:

- complete tokens and typography specimen;
- layout/container/section rhythm;
- all primitive variants/states;
- public cards/listings/rails;
- navigation/footer desktop/mobile;
- hero and shared sections;
- forms, validation and consent;
- tooltip/popover/dialog/sheet/drawer/toast;
- `DateRangeCalendar`, guest stepper, booking dialog and calculator shell;
- loading/empty/error/stale/disabled/long-content;
- narrow/mobile examples;
- reduced-motion and focus-visible checks.

Gallery uses fixtures only and has no backend dependency.

## 10. Homepage migration map

Current homepage becomes the first complete consumer:

- Navigation → site-ui navigation compositions;
- Hero → registered hero/CTA/promo/date components;
- Events/Houses/Sauna/Programs/Venues/Blog → shared section shell + typed cards/rails;
- Why us/Reviews/Partners → content/trust compositions;
- Territory map/FAQ/Directions/Calculator → global section renderers;
- ModalHub/booking/call/detail/privacy → shared overlay/form/feedback foundations;
- Footer → shared navigation/contact/legal composition.

Migration preserves approved information architecture and meaningful prerendered content. Visual differences require an explicit design improvement, not incidental refactor drift.

## 11. Acceptance gate

- `packages/site-ui` is the only public primitive/style authority;
- homepage and existing detail/blog/privacy routes consume the kit;
- no meaningful content disappears from Astro HTML;
- global token edit demonstrably affects all consumers;
- canonical `/dev/site-ui-v2` covers every migrated main-derived component and its required states; the removed `/dev/site-ui` v1 route is not part of acceptance;
- TypeScript/Astro checks, lint and production build green;
- keyboard/focus/labels/reduced-motion/mobile safe-area verified;
- responsive media has dimensions/alt/srcset contract;
- no authoritative availability or price logic moved client-side.
