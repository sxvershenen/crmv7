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

`VITE_PUBLIC_SITE_URL` configures “Open site” and signed page preview; development defaults to `http://localhost:4321`. The API needs `CMS_PREVIEW_SIGNING_SECRET` (at least 32 characters) to issue preview links. `VITE_CRM_URL` configures the app switcher; development defaults to `http://localhost:5173`, deployed setups default to `/crm`. Configure both URLs for separate production hosts.

The content repository covers list/search/filter, detail, create, immutable revision update with optimistic node version, review transitions and archive. Guarded publication preflight/diff, direct publication, signed visual page preview, delivery replay/rollback, media storage/processing adapters and bounded site-wide analytics with daily rollups exist. Lossless adapters, draft/conflict recovery and page-owned FAQ/review editing are implemented. Full body/media authoring and several management sections still require work. Current status is canonical in the [Phase 4 README](../../07-phase-4-cms/README.md); the [roadmap](../../07-phase-4-cms/IMPLEMENTATION-ROADMAP.md) defines CMS production scope and acceptance. API mode still contains demo/unavailable surfaces and cannot be treated as a production-ready editor.

Representative surfaces are `/`, `/content/tree`, route-driven content editors, `/media`, `/releases/:releaseId`, `/analytics/*`, `/code/:artifactId` and `/dev/ui/admin`. Detailed UX contract: [CMS UX](../../07-phase-4-cms/CMS-UX-SPEC.md).
