# Direct publishing, navigation defaults and CRM source drafts

## Scope

- Replaced the editor-facing release workflow with direct page and site-settings publication commands.
- Added transactional CRM-origin CMS drafts for resources, programs, occurrences, events and their categories.
- Added direct page hero policies plus the complete homepage hero field set.
- Added versioned navigation/global defaults and a public active-publication snapshot.
- Hardened immutable published reads against mutable archive/revision state.

## Persistence and contracts

- Migration `1788117200000-cms-direct-publishing.ts` adds `cms_source_links`, `cms_site_settings`, `cms_site_settings_revisions`, page `hero` and the settings revision pinned by each immutable publication.
- `CmsSourceLink` marks imported nodes as drafts without granting public eligibility.
- `CmsSiteSettingsValue` stores nested header/mobile/footer menus, icons, colors, link targets/anchors, global hero and resolved section defaults.
- Page hero supports slides, badge, CTAs, feature cards, focal points and autoplay; public snapshots require resolved public image variants.

## Runtime behavior

- `POST /api/admin/v1/content/nodes/:id/publish` validates, materializes and atomically activates the page in one SERIALIZABLE transaction with idempotency, optimistic concurrency, ChangeLog and Outbox.
- `PATCH /content/nodes/:id` auto-forks a new immutable draft when the current snapshot is published.
- `GET/PATCH/POST /api/admin/v1/site-settings[/publish]` owns navigation and global defaults.
- `GET /api/public/v1/site-settings` resolves only the settings revision pinned by the active publication.
- Public page reads validate the immutable `cms_release_items.resolved_content` hash and do not depend on mutable node archive or revision lifecycle state.

## Verification

- Contracts: 26/26.
- API unit: 30/30.
- PostgreSQL integration: 19/19, including all six CRM source kinds, direct settings/page publish, post-publish reload/edit/republish, global section inheritance and immutable archive behavior.
- Typecheck: contracts, DB and API green.
- Migration 14 applied successfully to the local development and local integration PostgreSQL databases.

## Remaining boundary

- The full media upload/WebP worker remains P4.4. Until it materializes trusted public variants, an asset ID without resolved public variants is a publish blocker.
- Legacy release endpoints remain temporarily callable for compatibility/rollback tooling, but are no longer required by the editor workflow and must stay outside ordinary CMS navigation.
