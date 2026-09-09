# CRM promotion, booking and datetime UX

- Promotion editor: one tagged resource/offering multi-picker; operational contract still stores `resourceIds` and `offeringIds`. Removed explanatory admin sidebar; status and long-value layout revised.
- Marketing registry: whole promotion row/card opens editor; desktop keyboard activation covered.
- Booking: local wall-clock intervals serialize as Moscow instants; validation surfaces API `fieldErrors`; initial pricing warning removed and blocked save opens Composition with an actionable message.
- Shared UI: shadcn/Base UI date-time trigger is one field; popover contains calendar, month/year selectors, time, clear/commit. Added committed date-time range picker. Adopted by booking composition, event/program periods and resource blocks; lead desired dates use date range.
- Lead Main: compact contact/request grid; desired range, next contact, source and promo are editable in main; sidebar reduced to operational relations/assignees.
- Shared `business-datetime` adapter prevents browser-timezone and repeated-save shifts across booking, tasks, events, programs, leads, promotions and blocks.
- Dev seed: production guard before demo operational rows; representative resources/categories/registration/event/block/tasks and scoped promotions. Campground resources are now included in CRM directory mapping.

Acceptance: UI/API/CRM typecheck; targeted ESLint; full CRM suite (245), marketing API tests (4), promotion domain tests (4); `git diff --check`. Local seed execution was not possible in the agent shell because `DATABASE_URL` was absent; no DB rows were written.
