# 2026-09-01 — P4.5B house pricing and quote core

## Scope

- implement the first backend-only vertical slice for `CatalogOffering(kind=house)`;
- expose one editor/pricing application service through both CRM internal and CMS admin namespaces;
- add deterministic per-night pricing for base, calendar holiday, day class and arbitrary custom-date overrides;
- persist immutable quote provenance and consumer-scoped Outbox delivery state;
- add activation/scheduling runtime guarantees and a read-only legacy migration dry-run;
- keep CRM/CMS operational UI, public offering endpoints and other offering kinds out of this increment.

## Delivered

- Pure domain resolver and activation validator with precedence `custom date → calendar holiday → day class → any date → base`; equal full rank fails closed.
- House pricing contracts for list/editor, full draft create/replace, activation, scheduling and internal quote preview. Internal and Admin OpenAPI expose the same commands; Public OpenAPI exposes none of them.
- Shared `OfferingEditorApplicationService` with segmented pricing CAS, cross-surface idempotent replay, serializable mutations, audit and typed Outbox.
- One immutable PriceBook lifecycle: draft children are editable, while scheduled/active/retired books and their rate/rule graph are database-guarded against commercial mutation.
- Scheduled activation worker and quote fail-closed behavior while a due activation is still pending.
- Append-only `offering_quote_snapshots` with offering/pricing/add-on, PriceBook, calendar source and request/result provenance.
- `outbox_deliveries` with independent `sse` and `public_projection` checkpoints; legacy producers receive an SSE checkpoint lazily.
- Explicit RouterModule child registration for both offering transport adapters, preserving `/api/internal/v1` and `/api/admin/v1` symmetry.
- Read-only `offering:backfill:dry-run` inventory. It recognizes unambiguous house/campground shapes, preserves `showOnSite` only as a signal, and sends unknown kinds, aliases, bath normalization and every legacy Program base-price basis to manual review. It performs zero writes.

## Important runtime corrections found by integration

- PostgreSQL TypeORM returns mutation `UPDATE … RETURNING` as a structured tuple; successful pricing CAS is now normalized before affected-row checks.
- Idempotency locks are acquired independently for `(scope, operationId)` and `(scope, idempotencyKey)` in stable order, closing same-key/different-operation races.
- Activation events use the reloaded post-transition PriceBook version rather than the pre-transition entity.
- New pricing events expose `pricingVersion` to the SSE version projection.
- Final Sol High review closed expired activation, finite calendar-horizon gaps, expired `processing` lease recovery, per-candidate schedule isolation, real operational-subject versions, cross-plan rule-ID validation, PUT CORS and UUID path validation.

## Verification

- `@crm/contracts`: typecheck, lint, 39/39 tests;
- `@crm/domain`: typecheck, lint, 22/22 tests;
- `@crm/db`: typecheck and lint;
- `@crm/api`: typecheck, lint, 37/37 unit tests;
- PostgreSQL API integration: 24/24, including one concurrent quote request through Internal and Admin surfaces resulting in one persisted snapshot, lifecycle gap checks and expired Outbox lease recovery;
- runtime DB migration was applied/reverted/applied and probed for single draft, immutable non-draft graph, lifecycle and append-only quote behavior;
- dry-run against the empty integration database reported `writeCount=0` and correctly blocked apply readiness without an active business calendar.

## Remaining P4.5B scope

- attaching typed calculation snapshots to Event/ProgramRegistration after their pricing resolvers; house `BookingItem` acceptance is completed in the follow-up below;
- a public-projection consumer, cache invalidation execution and delivery observability/DLQ;
- reviewed apply-mode migration after legacy inventory and product decisions for ambiguous rows;
- the next pricing resolver, campground, only after the house backend boundary remains green.

P4.5C/D UI work has not started in this increment. It must consume the stabilized shared editor contract rather than introduce a second CRM/CMS data model.

## Follow-up slice — business calendar, bindings and add-ons

### Delivered

- One shared Business Calendar application service and symmetric Internal/Admin API for complete date import, date override/removal, activation and retirement. Mutations use serializable transactions, stable locks, cross-surface idempotency, audit and typed Outbox events.
- Active calendars may be corrected or extended without replacing their identity, but coverage cannot shrink; retired calendars and their rows remain immutable. Content hashes include effective overrides, and draft reimport fails closed when it would orphan an existing override.
- Atomic house binding replacement with natural-key identity preservation, segmented CAS and semantic no-op detection. A no-op does not bump the segment version or emit audit/events.
- Searchable reusable add-on library, atomic assignment replacement and offering-specific custom add-on create-and-assign. New custom assignments start disabled; enabled quoted add-ons require compatible currency and active pricing.
- Calendar changes emit the calendar mutation event and one independent `public.offering_projection.invalidated` delivery per affected active offering. Public API exposes no operational commands.
- Internal/Admin OpenAPI and strict body contracts separate path-owned identifiers from mutation payloads.
- Final Sol High review closed global create-idempotency across changed calendar codes, request-only projection invalidation without a PriceBook, retired-calendar child reparenting, malformed date paths, surface-aware editor capabilities and reverse add-on assignment guards.

### Verification

- `@crm/contracts`: typecheck, lint, 43/43 tests;
- `@crm/domain`: typecheck, lint, 26/26 tests;
- `@crm/db`: typecheck and lint;
- `@crm/api`: typecheck, lint, 40/40 unit tests;
- PostgreSQL API integration: 25/25, including cross-surface calendar replay, concurrent import, override removal, activation, binding CAS/no-op behavior, custom add-on creation and independent projection checkpoints;
- migration `OfferingConfigurationRuntime1788118800000` is applied after pricing/catalog migrations in disposable `crm_v7_test`;
- `git diff --check` passes.

At this point the next deliberately narrow gate was accepted operational quote-snapshot links, followed by the projection consumer/cache/DLQ. The acceptance gate is completed in the section below; P4.5C/D operational UI remains downstream.

## Follow-up slice — accepted house quote to BookingItem

### Delivered

- New house quote snapshots pin a typed `house_stay` operational context with offering subject version and exact primary Resource identity/version. Older context-free snapshots cannot be accepted.
- Booking confirmation accepts an explicit array of `BookingItem ↔ quoteSnapshot` pairs. The links are created atomically only on `unconfirmed → confirmed`; replay requires the exact operation/idempotency pair and canonical request hash. Cancellation retains the immutable link.
- One quote can be accepted once and one BookingItem can receive one quote. A losing concurrent confirmation rolls back the Booking status/version as well as its link and events.
- Acceptance emits PII-minimal `crm.operational_quote.accepted`, ChangeLog and an independent SSE delivery checkpoint. No Public/Admin acceptance command was added.
- Event and ProgramRegistration targets are represented in the forward schema and transition contracts, but runtime and direct SQL reject them until their typed pricing resolvers can produce compatible snapshots.
- Migration `OperationalQuoteAcceptance1788119200000` adds the immutable link table and a fail-closed insert guard. The guard independently verifies active house/context/resource versions, confirmed Booking version, BookingItem resource/type/period/quantity/amount/currency and snapshot request/result shape.

### Concurrency and review corrections

- Both service and database use `clock_timestamp()` only after deterministic row locks, so a transaction waiting across quote expiry cannot accept stale validity.
- Multi-item acceptance pre-locks sorted items, snapshots, offerings, primary bindings and resources globally before validation/insertion. A two-offering/two-resource X→Y/Y→X fixture covers the former deadlock shape.
- Direct SQL probes reject incompatible BookingItem, Event and ProgramRegistration links. The final targeted Sol High review reported no remaining P0/P1 in expiry, database-boundary or lock-order handling.

### Verification

- `@crm/contracts`: typecheck, lint, 46/46 tests;
- `@crm/domain`: typecheck, lint, 29/29 tests;
- `@crm/db`: typecheck and lint;
- `@crm/api`: typecheck, lint, 40/40 unit tests;
- PostgreSQL API integration: 26/26, including lock-across-expiry rollback, shared-quote race, direct-SQL rejection and opposite-order multi-resource acceptance;
- migration `OperationalQuoteAcceptance1788119200000` passed a disposable `crm_v7_test` revert→run cycle;
- `git diff --check` passes.

The next gate is the public projection consumer, cache invalidation execution and delivery observability/DLQ. P4.5C/D house UI follows that gate; Event/ProgramRegistration acceptance remains deliberately fail-closed until their own pricing slices.

## Follow-up slice — offering projection delivery runtime

### Boundary

- This slice consumes already typed offering invalidations and completes their delivery lifecycle. It does not materialize `PublicOfferingSummary`, public prices/availability or a public offering resolver; those remain P4.5E safe-projection work.
- Cache execution uses a provider-neutral port with a durable PostgreSQL `database_epoch` adapter. A future CDN/tag-purge provider plugs into the same boundary rather than creating another authority or checkpoint system.

### Delivered

- One fenced delivery engine now handles both `sse` and `public_projection` consumers. It claims bounded batches with `SKIP LOCKED`, recovers expired leases and closes legacy `outbox_events.processed_at` only after every declared consumer succeeds.
- Typed public offering invalidations create exactly one monotonic projection generation and append-only receipt with canonical tags. Retry after a crash reuses the receipt and cannot bump the generation twice.
- Cache invalidation is a real durable effect: the database epoch advances before the receipt is acknowledged. Repeating the effect is idempotent, so a crash between effect and acknowledgement is safe.
- Delivery attempts, replay operations and failure codes are append-only and sanitized. Retry uses bounded exponential backoff with deterministic jitter; malformed or mismatched events go directly to DLQ.
- Crash-only lease exhaustion now writes a forensic `lease_expired` attempt and atomically dead-letters the delivery at `maxAttempts`; repeated polling cannot grow attempts forever.
- Admin-only list, health, detail and replay endpoints are capability-gated. Replay requires the operator-observed status, delivery epoch and attempt count, uses exact idempotency/hash semantics and writes both replay journal and ChangeLog. Public API exposes no delivery operations or raw payload/error data.
- Database guards independently reject a succeeded projection delivery without an applied receipt, direct succeeded inserts, mutable delivery identity and stale lease/epoch transitions.

### Verification and review

- `@crm/contracts`: typecheck, lint, 50/50 tests;
- `@crm/domain`: typecheck, lint, 31/31 tests;
- `@crm/db`: typecheck and lint;
- `@crm/api`: typecheck, lint, 52/52 unit tests;
- PostgreSQL API integration: 28/28, covering concurrent claims, crash/reclaim fencing, out-of-order invalidations, idempotent generation/effect recovery, poison DLQ, crash-only exhaustion, database bypass probes and Admin replay ABA protection;
- `git diff --check` passes;
- final targeted Sol High re-review reported no remaining P0/P1 after the crash-only, database-guard and replay-CAS corrections.

The house backend gate is now complete enough to begin one shared P4.5C/D house editor design. Production hosting/CDN selection, stale-pricing SLO, retention, replay-role assignment and on-call alerting remain explicit deployment decisions. P4.5E still owns the safe public offering DTO and resolver.
