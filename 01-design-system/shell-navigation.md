# CRM shell и навигация

## Desktop

Каркас: sidebar + topbar + рабочая область.

### Sidebar

**CRM**
- Обзор
- Заявки
- Бронирования
- Расписание ресурсов
- Клиенты

**Ресурсы и расписание**
- Домики
- Баня и чан
- Площадки
- Палаточный кемпинг
- Программы
- Мероприятия

**Управление**
- Задачи
- Финансы
- Команда
- Настройки CRM

### Topbar

- breadcrumbs/раздел;
- saved view, если применимо;
- глобальный поиск + `Ctrl/Cmd + K`;
- глобальное создание;
- уведомления;
- live indicator;
- профиль.

## Mobile

Topbar: раздел/дата, назад по контексту, поиск, уведомления, профиль.

Bottom navigation:
1. Обзор;
2. Заявки;
3. Создать;
4. Брони;
5. Меню.

## Editor route

При переходе в create/edit основной shell уступает место editor-layout: fixed editor topbar + content + right sidebar + fixed bottom action bar. Это **страница**, не modal/overlay.
