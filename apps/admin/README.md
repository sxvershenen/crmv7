# CMS admin · Phase 4

`@crm/admin` is the isolated CMS workspace. It uses `@crm/ui` and keeps API and fixture data behind `CmsRepository`.

## Data modes

- Normal development/production uses the authenticated admin API.
- `VITE_DATA_MODE=fixtures` is explicit visual-development mode only.
- Vitest uses fixtures by default; a test that exercises the real-mode singleton sets `VITE_DATA_MODE=api` explicitly.

## Commands

```sh
pnpm --filter @crm/admin dev
pnpm --filter @crm/admin typecheck
pnpm --filter @crm/admin lint
pnpm --filter @crm/admin test
pnpm --filter @crm/admin build
```

Development is normally `http://localhost:5174`; `vite preview` uses `http://localhost:4174`, with strict ports. API bases default to `/api/admin/v1` and `/api/internal/v1`; `VITE_ADMIN_API_BASE_URL` and `VITE_INTERNAL_API_BASE_URL` may override them. Requests carry the session cookie and `x-request-id`.

The content repository covers list/search/filter, detail, create, immutable revision update with optimistic node version, review transitions and archive. Direct publication and media upload flows exist. Pending work is render-ready preview/diff, production media hardening, analytics collection and code execution; current status is canonical in the [Phase 4 README](../../07-phase-4-cms/README.md). UI exposes explicit unavailable/demo states rather than pretending pending mutations succeeded.

Representative surfaces are `/`, `/content/tree`, route-driven content editors, `/media`, `/releases/:releaseId`, `/analytics/*`, `/code/:artifactId` and `/dev/ui/admin`. Detailed UX contract: [CMS UX](../../07-phase-4-cms/CMS-UX-SPEC.md).
