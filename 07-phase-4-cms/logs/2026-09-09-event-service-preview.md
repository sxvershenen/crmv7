# Event-service dossier and typed preview

## Result

- CRM `/events/categories` теперь единственный user-facing registry/create/dossier для `EventServiceTemplate`; отдельный menu item не создан.
- Исправлен UX-regression переноса: create/edit/list снова используют название, внутреннюю заметку, allowlisted icon и цвет; template и offering owner-поля сохраняются одной атомарной командой с отдельными CAS versions. Fixture-create создаёт тот же canonical CMS draft state, что и API.
- Backend атомарно создаёт template, exact primary `CatalogOffering(kind=event_service)` binding, canonical `event_detail` CMS draft, audit/outbox и idempotency result; ambiguity и stale named CAS fail closed.
- Named `flat_package` тарифы считают included/extra guests и календарные rules только на сервере. Same-local-date interval сохраняется как immutable `event_service_preview` с exact binding/template/pricing/rule/calendar/preparation pins, server clock и TTL не дальше next pricing activation/local midnight.
- Preview не проверяет availability, не резервирует ресурсы и не создаёт Event/Booking/Payment. Public resolver и Event acceptance остаются закрыты.

## Evidence

- `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build` — passed.
- Fixture Playwright gate после обновления route expectation: 60 passed, 22 intentional viewport skips. Отдельно устранена подтверждённая race в старом customer-тесте: assertion теперь ждёт результат назначения, а не промежуточное количество кнопок.
- Contracts 78, domain 54, API 102, DB migration/safety unit 12, CRM 274, shared offering editor 21 tests passed.
- Presentation follow-up: API 103, CRM 274; новая additive migration icon/tone — 2/2; focused create/edit repository+route — 8/8; desktop/mobile create dossier E2E — 2/2.
- `test:integration`, `test:e2e:api`, fresh/repeat/revert migration run не запущены: `TEST_DATABASE_URL` не задан, `APP_ENV` не `test`; unsafe database fallback не использован.

## Next gate

Event add-ons + lifecycle acceptance для фактического `/events/:id`; legacy `EventCategory` и EventServiceTemplate не связывать по имени/ID без отдельного exact contract.
