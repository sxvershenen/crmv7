# Live updates, notifications, outbox

## Live

Первый релиз: SSE или другой простой однонаправленный канал.
Update меняет только нужную row/card, не сбрасывает route/scroll/date/filters и не уничтожает dirty local form state.

## Notifications

Типы: новая заявка, conflict, изменение другим сотрудником, cancel, overdue task, insufficient payment, assignee change, move, capacity exceed, unblock.
Клик ведёт на связанную route-driven entity page.

## Outbox

Внешние эффекты писать как `OutboxEvent`: CRM notification, VK/MAX/email, integrations/webhooks.
Ошибка внешнего сервиса не должна откатывать успешно сохранённую операцию.
