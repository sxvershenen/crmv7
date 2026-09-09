# CMS admin · Phase 4

`@crm/admin` is the isolated CMS workspace. It uses the shared `@crm/ui` design system and keeps both API and fixture data behind `CmsRepository`.

The normal production/development mode uses the authenticated admin API. Set `VITE_DATA_MODE=fixtures` only for isolated visual development. Vitest selects fixtures by default; set `VITE_DATA_MODE=api` in a test that intentionally exercises the real-mode singleton.

## Run

```sh
pnpm --filter @crm/admin dev
pnpm --filter @crm/admin typecheck
pnpm --filter @crm/admin lint
pnpm --filter @crm/admin test
pnpm --filter @crm/admin build
```

Development is available at `http://localhost:5174`; `vite preview` uses `http://localhost:4174`. Both ports are strict so the CMS never silently starts on the CRM port or another unexpected address.

The default endpoints are `/api/admin/v1` for CMS content and `/api/internal/v1` for the current session. They can be changed with `VITE_ADMIN_API_BASE_URL` and `VITE_INTERNAL_API_BASE_URL`. Requests include the session cookie and `x-request-id`.

## API coverage

The content node repository is authoritative for list/search/filter, detail, create, immutable revision update with optimistic node version, submit review, return to draft and archive. Render-ready preview, publication, media, analytics, code workspace and the remaining management APIs are not simulated in API mode: their routes show an explicit unavailable or demo state and their mutations are disabled.

## Representative routes

- `/` — CMS dashboard and explicit prototype states via `?state=loading|empty|error`;
- `/content/tree` — split route tree and URL-backed selection/search;
- `/content/home`, `/content/pages/:nodeId`, `/content/categories/:nodeId`, `/content/public-profiles/:entityType/:entityId` — route-driven editors with URL tabs;
- `/media`, `/media/:assetId` — processing queue, WebP variants and usage graph;
- `/releases/:releaseId` — effective diff, validation gates, approvals and rollback boundary;
- `/analytics/*` — overview, acquisition, content, funnel, forms, retention and quality shells;
- `/code/:artifactId` — allowlisted file tree, read/diff/preview/build/dependency states;
- `/dev/ui/admin` — CMS composition and state gallery.

All remaining routes from `CMS-UX-SPEC.md` resolve to typed list/management/report shells. Real uploads, materialized preview, publication, analytics collection and code execution remain later backend phases.
