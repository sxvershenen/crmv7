# CRM frontend boundary

Читать перед изменением `apps/crm/**`. Начинать с текущих route, components, repository/hook и tests; старые screen specs не искать без конкретного пробела.

- Create/edit — отдельные route-driven страницы в CRM shell, не modal/overlay.
- Editor: global topbar identity, URL tabs/status/actions, main + right sidebar и fixed bottom action bar; поля сразу редактируемы.
- Использовать `@crm/ui` и существующие shared compositions; не создавать «карточку в карточке» и локальную версию shared pattern.
- Resource/category identity — цветная иконка с оттеночной подложкой; ответственные — avatars, при отсутствии `+ Назначить`.
- Карточки кликабельны, таблицы осмысленно сортируемы, controls не no-op.
- Mobile — отдельная адаптация, не уменьшенный desktop.
- UI читает business facts через repository/API; fixtures допустимы только в явном dev/test mode.

Проверять затронутые repository/hook/component tests, route state, desktop/mobile, overflow, keyboard и loading/empty/error/disabled/readonly/conflict states.
