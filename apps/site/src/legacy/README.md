# Legacy public site backup

The pre-migration public homepage is pinned at commit `9cd146a`.

- Page: `git show 9cd146a:apps/site/src/pages/index.astro`
- Styles: `git show 9cd146a:apps/site/src/styles/global.css`
- Local components: `git ls-tree -r --name-only 9cd146a apps/site/src`
- Generic UI-kit API: `@crm/site-ui/legacy-v1`

Do not mount this snapshot in production. Restore it on a separate branch when a rollback comparison is needed; current routes must keep CMS release metadata and published-section filtering.
