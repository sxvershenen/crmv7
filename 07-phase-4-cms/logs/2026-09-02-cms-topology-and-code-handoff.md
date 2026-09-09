# CMS topology and controlled-code handoff

## Scope

Closed the read topology hardening and the bounded leaf-safe write increment before the add-on vertical slice.

- `ContentTreePage` now builds arbitrary-depth hierarchy from revision `parentNodeId`; it no longer guesses depth from known fixture IDs or treats the compatibility `children` array as authority.
- Branch disclosure is an independent keyboard-focusable control with `aria-expanded`; collapsed IDs remain in the route URL and search temporarily reveals matching ancestor chains.
- Duplicate IDs, missing parents and parent cycles fail safe; missing/cyclic relations remain visible with an explicit topology warning rather than inferred grouping by path text.
- The admin read model retains exact page kind, `sortOrder` and source kind from the public CMS contract; roots and siblings use deterministic `sortOrder → title → path → id` ordering.
- Offer dossiers again expose the capability-gated Files/Code tab. The tab explicitly reports that page → artifact binding is not implemented and links only to the global controlled workspace; it does not pretend that source was saved or change the public checkout.
- Create child opens the canonical editor with the authoritative parent, derives the future path and appends the node after existing siblings by `sortOrder`.
- Draft leaf reparent is saved as a route-only immutable revision with `expectedVersion`; full content saves preserve relations and the offering locator.
- Parent selection excludes self, descendants and archived nodes. Published nodes, branches and unavailable topology keep route controls read-only with an explicit reason.
- The API validates expected version first and then parent/cycle/path placement inside a serializable transaction. A published route change returns `CMS_REDIRECT_REQUIRED`; a branch move returns `CMS_SUBTREE_MOVE_REQUIRED`.

## Boundary

This increment does not invent parent relations for CRM drafts, implement DnD, move a subtree, author redirects, or start P4.8. Published route changes and branch moves remain fail closed until their redirect/subtree contracts exist; the real controlled artifact backend remains a separate roadmap stage.

## Acceptance

- CMS route tests cover collapse/re-expand, nested house visibility, search ancestry and disclosure ARIA.
- A focused offer-editor test covers the restored Files/Code handoff and explicit unbound-artifact state.
- Admin tests (54/54), typecheck, lint and production build pass.
- API tests (63/63), typecheck and lint pass, including draft-leaf success plus subtree/published-route guards and expected-version precedence.
