# 2026-08-31 — Offering catalog and CMS re-architecture

## Scope

- audited every top-level CMS area and the current generic categories/public-profiles UX;
- designed six business directions: houses, campgrounds, add-ons/services, venues, event services and programs;
- specified cross-app CRM↔CMS editing without duplicate authority;
- designed versioned calendar/tier pricing, options/catering, quote provenance and historical snapshots;
- re-phased active P4.5 into bounded P4.5A–P4.5F increments;
- identified and scheduled a fail-closed fix for Event/ProgramOccurrence source-draft leakage.

The initial architecture pass did not change pricing/catalog persistence or UI. The confirmed-product follow-up completed the bounded P4.5A contract and additive schema foundation; current readers/writers and UI were intentionally not switched.

## Inputs and review

- mandatory source-of-truth, development order, project scope and stack;
- Phase 4 README, roadmap, CMS UX, platform architecture, page authoring, site structure and technical defaults;
- current Resource/Program/Event/Content/Listing/Public contracts;
- TypeORM entities and CMS migrations;
- current CMS routes/navigation/repository and public listing/source-draft/publication services;
- CRM domain/editor/API/concurrency specifications.

Three bounded Sol High reviews covered resources/campgrounds/add-ons, venues/event services/programs and the cross-domain authority/public-page contract. Reviewers did not edit documentation or overlap implementation ownership.

## Durable outcome

- `CatalogOffering` is the CRM-owned sellable identity and binds to Resource/ResourceGroup/ProgramTemplate/EventServiceTemplate.
- PriceBook/RatePlan/PriceRule, BusinessCalendar, add-on offerings with typed assignments and backend Quote own deterministic prices; accepted operational records keep immutable calculation provenance.
- Operational `Event` remains a customer order and cannot be a public event-service page.
- CRM and CMS are two UI surfaces over one application service/version/audit, not replicated stores.
- CMS primary IA is six `/offers/*` workspaces; generic profiles/categories become registry/diagnostic surfaces.
- Managed Astro pages use strict typed public bindings and never query DB/internal API or copy price/availability.
- Authored weekday/weekend/holiday/date rules are in scope; demand-based algorithmic pricing remains outside v1.

The durable decision is appended as D-071 in `DECISIONS.md`; the full design lives in `OFFERING-CATALOG-ARCHITECTURE.md`.

## Updated specifications

- `00-core/project-scope.md`;
- `02-screens/editors-resources-programs-events.md`;
- `04-domain-backend/domain-model.md`;
- `04-domain-backend/api-auth-concurrency.md`;
- `07-phase-4-cms/README.md`;
- `07-phase-4-cms/P4-0-DECISIONS.md`;
- `07-phase-4-cms/PLATFORM-ARCHITECTURE.md`;
- `07-phase-4-cms/CMS-UX-SPEC.md`;
- `07-phase-4-cms/PUBLIC-PAGE-AUTHORING.md`;
- `07-phase-4-cms/SITE-STRUCTURE.md`;
- `07-phase-4-cms/IMPLEMENTATION-ROADMAP.md`;
- `DECISIONS.md`;
- `AGENTS.md` context routing.

## Code gaps recorded for P4.5A/B

- free-form Resource kind/settings and missing ResourceGroup/CatalogOffering operational aggregates;
- ProgramTemplate only has one base price;
- EventServiceTemplate does not exist;
- BookingItem lacks quote/rule/version provenance;
- public listing supports only broad resource/program kinds and uses release time as operational freshness;
- `cms_source_links` currently participates in listings even though it should not grant public eligibility;
- source-link freshness and per-consumer outbox delivery remain incomplete;
- CMS current implementation still exposes generic primary profiles/categories and placeholder management routes.

## Verification

- documentation cross-links/headings inspected;
- `git diff --check` passed for the architecture edits;
- non-leak code changed `cms-source-draft`, Event/ProgramOccurrence call sites and source-aware publication/activation/rollback validation;
- Event/Occurrence internal comments/phone no longer seed CMS editorial fields; source links remain available for internal workflow;
- API unit `35/35`, API integration `21/21`, API typecheck and API lint passed;
- root agent repeated the API unit gate: `13` files, `35/35` tests passed.

## Product confirmations before schema lock

1. campground sold as whole group, individual pitches/tents, or both;
2. official Russian production calendar plus manual overrides versus fully manual business calendar;
3. multi-night holiday price application;
4. adults/children versus one guest count for extra-guest rules;
5. early-booking trigger: request, confirmation or payment date;
6. reusable cross-offering catering catalog versus offering-local options;
7. public exact quote versus `from/request` display by direction and the units used for venue/sauna/program prices.

## Product confirmation follow-up

The owner confirmed:

- campground sells individual owned tents plus capacity places for guests’ own tents; no whole-camp rental;
- initial own-tent area is expected to hold around 15 tents, but capacity remains configurable;
- official calendar holidays and arbitrary custom date overrides are separate price-rule selectors;
- accommodation/campground resolves each night independently;
- catering/add-ons are reusable and searchable, allow inline custom creation, and each offering selects its own set;
- optional early-booking/lead-days rules are acceptable and are fixed at backend quote time;
- public display supports exact/from/request while intake still creates only Lead.

These confirmations are recorded in D-072 and unblock P4.5A contracts/migration design.

## P4.5A implementation follow-up

Implemented:

- strict `packages/contracts/src/offerings.ts` schemas for six offering kinds, typed fulfillment/bindings, business calendar, price books/rate plans/rules, add-on assignments, segmented editor versions/capabilities and internal/public quote projections;
- contract tests locking both campground sales units, per-night stay intervals, separate `calendar_holiday`/`custom_date_override`, optional lead-days pricing, reusable/offering-specific add-ons and public DTO no-leak behavior;
- additive `1788118000000-offering-catalog-foundation` migration and TypeORM entities for ResourceGroup, EventServiceTemplate, CatalogOffering, typed campground/add-on terms, bindings, calendar/corrections, versioned pricing and searchable add-on assignments;
- migration registration in both DB CLI and API runtime lists;
- no controller, quote engine, backfill, dual-read or public endpoint was added, so existing consumers retain current behavior until P4.5B.

Integration reconciliation removed a duplicate option authority: an add-on is always `CatalogOffering(kind=addon)` with `reusable | offering_specific` scope, and `OfferingAddOnAssignment` references its stable rate-plan key without copying a price. Contract and DB fields were aligned for quantity metric, included quantity, duration minutes, exclusive-end validity, business-calendar ownership, typed campground mode and safe public explanation codes. Persistent catalog/subject/pricing/add-on aggregate versions back the named CAS contracts; composite active-price FK prevents cross-offering activation, while separate active/scheduled exclusions permit an immutable future price revision to be planned over the current open-ended book.

## P4.5A verification evidence

- `@crm/contracts`: 7 files, 36/36 tests; typecheck and lint passed;
- `@crm/db`: typecheck and lint passed;
- `@crm/api`: 13 unit files, 35/35 tests; integration 21/21; typecheck and lint passed;
- clean isolated `crm_v7_test`: all 16 migrations applied, P4.5A reverted, then applied again successfully;
- transactional DB probes confirmed invalid campground allocation pair, ownerless offering-specific add-on, non-addon assignment target, overlapping scheduled books, a cross-offering active-price pointer, a dimensionless base override and a holiday selector carrying custom dates are rejected; scheduling a future book over the current open-ended active book is allowed;
- `git diff --check` is part of the final gate.

Final Sol High contract↔DB review found no remaining blocking issue after segment-version, composite-FK, selector-label, minor-amount and safe-public-reason reconciliation. One parallel API unit+integration run produced a transport-level HTTP parse error in one CMS release test while 20/21 passed; the isolated integration rerun passed 21/21, so the final gate uses the isolated result.

Next bounded increment is P4.5B: one shared `OfferingEditorApplicationService`, draft/activation commands, deterministic quote resolver, controlled legacy backfill and independent outbox deliveries. UI and public readers remain out of that first backend slice.
