# 2026-08-31 — P4.4 media platform foundation

## Scope

- Replace the CMS media demo boundary with an implemented upload/read/update/archive API.
- Store private originals and create immutable responsive WebP/AVIF variants.
- Materialize a revision/release-aware usage graph and prevent silent archive of published assets.

## Implemented

- Added strict media list/detail/metadata/archive/upload contracts and documented admin/public OpenAPI paths.
- Added PostgreSQL migration `1788117600000` with `media_assets`, `media_blobs`, `media_variants`, `media_uploads`, `media_processing_jobs` and `media_usages`.
- Added a provider-neutral storage service with a local development adapter, path confinement, private/public namespaces and immutable writes.
- Added 15-minute single-use upload grants bound to exact MIME, size and SHA-256. The signed grant is checked before reading the request body, and the per-upload expected size is the streaming limit.
- Added normalized filename, MIME/magic, checksum, EICAR baseline signature, Sharp decode, dimension and 80M decoded-pixel guards.
- Added orientation normalization, sRGB output and metadata-free WebP/AVIF variants at bounded responsive widths. Originals have no public route.
- Added immutable public delivery with content type, year cache, ETag and `nosniff`.
- Added usage discovery across CMS revisions, site-settings revisions and release payloads, storing exact JSON pointers and published state.
- Added optimistic metadata updates and archive blocking when refreshed usage contains a published reference.
- Connected `apps/admin` API repository and media pages to real list/detail/upload/metadata/archive endpoints. Variant and usage tabs now show authoritative data; unsupported blob replacement is explicitly disabled instead of simulated.

## Security and production boundary

- The local storage adapter is for development/test. Production still requires the approved S3-compatible provider and credentials policy.
- The in-process signature guard is not a complete malware scanner. Production upload activation remains blocked until an external scanner/fail-closed worker is configured and tested.
- Failed processing may leave unreferenced storage objects; retention/cleanup worker and DLQ metrics remain part of production hardening.
- Versioned blob replacement is intentionally not exposed yet; the current API supports new asset upload and safe archive only.

## Verification

- Contracts: 26/26 passed.
- API unit: 31/31 passed after the public signed-upload CSRF boundary test.
- PostgreSQL integration: 20/20 passed, including real PNG → WebP/AVIF, public delivery, MIME spoof rejection, usage refresh and published-archive blocker.
- DB typecheck/lint and API typecheck/lint/build passed.
- Admin typecheck/lint/build tests: 27/27 passed (pre-existing React `act` warnings remain in auth-session tests).
- Local engine warning remains: Node 24; repository requires Node `>=22.16 <23`.
