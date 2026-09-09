# CMS frontend boundary

Читать перед изменением `apps/admin/**`. Начинать с текущих route, repository и tests; в `07-phase-4-cms/CMS-UX-SPEC.md` открывать только раздел затронутого flow.

- CMS использует `@crm/ui`, CRM session/capabilities и route-driven editor anatomy; вторая admin design system запрещена.
- Editorial content/SEO/media/composition/publication принадлежат CMS. Цены, availability, capacity, booking/payment и operational status редактируются только через общий CRM-owned application service.
- Пересекающиеся поля показывают source/owner: `CRM`, `CMS`, `computed` или `inherited`.
- Draft/preview/review/publish/rollback не имитируют успех. Неподключённый backend flow имеет явный unavailable/demo state и disabled mutation.
- Публикация и media учитывают permissions, validation, optimistic conflict, stale preview, processing/failure и delivery state.
- Fixtures изолированы `VITE_DATA_MODE=fixtures`; production/development API mode не подменяет отсутствующую server authority.
- Mobile — отдельная адаптация; code mutation и сложные diff flows могут быть desktop-only при явном read-only mobile state.

Проверять затронутые repository/page tests, capabilities, URL tabs, dirty/conflict recovery, desktop/mobile, keyboard и основные async states.
