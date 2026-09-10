# CMS frontend boundary

Читать перед изменением `apps/admin/**`. Начинать с текущих route, repository и tests; в `07-phase-4-cms/CMS-UX-SPEC.md` открывать только раздел затронутого flow.

- CMS использует `@crm/ui`, CRM session/capabilities и route-driven editor anatomy; вторая admin design system запрещена.
- Editorial content/SEO/media/composition/publication принадлежат CMS; `/content/tree` — основной реестр. Цены, availability, capacity, booking/payment и operational status редактируются в CRM dossiers; CMS показывает сводку/переход, не второй operational editor.
- Пересекающиеся поля показывают source/owner: `CRM`, `CMS`, `computed` или `inherited`.
- Draft/preview/review/publish/rollback не имитируют успех. Неподключённый backend flow имеет явный unavailable/demo state и disabled mutation.
- Публикация и media учитывают permissions, validation, optimistic conflict, stale preview, processing/failure и delivery state.
- Fixtures изолированы `VITE_DATA_MODE=fixtures`; production/development API mode не подменяет отсутствующую server authority.
- Mobile — отдельная адаптация; code mutation и сложные diff flows могут быть desktop-only при явном read-only mobile state.

До правки runtime/UI проверить целевой route и API-mode в работающей среде. Затем выбрать затронутые repository/page tests и states по риску: capabilities, URL tabs, dirty/conflict recovery, desktop/mobile, keyboard. Общий порядок и условие завершения — в корневом `AGENTS.md`.
