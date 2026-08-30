# Предметная модель — кратко

Основные сущности:

`User`, `Role`, `Permission`, `Lead`, `Customer`, `Booking`, `BookingItem`, `Resource`, `ResourceGroup`, `ResourceAllocation`, `ResourceBlock`, `ProgramTemplate`, `ProgramOccurrence`, `ProgramRegistration`, `Event`, `Task`, `Payment`, `Comment`, `Visit`, `Notification`, `SavedView`, `ChangeLogEntry`, `OutboxEvent`.

## Lead

Контакт/клиент, имя, телефон/канал, направление, желаемые даты, гости, комментарий, источник, UTM, ответственный, следующий контакт, статус, связи с задачами/бронями.
Публичный сайт создаёт Lead, не confirmed Booking.

## Customer

Физлицо/компания/организатор/постоянный клиент; несколько телефонов/каналов; dedup/merge; история обращений/визитов/броней/оплат/долга; consent.

## Booking

Агрегат заказа из нескольких `BookingItem`: проживание, баня/чан, площадка, палатки, программа/услуги и т.д. У item свой resource, start/end, quantity, price/discount, preparation, capacity rules.

## Resources

Проживание, баня/чан, площадки, палаточный кемпинг; есть inventory и capacity resources.
Resource/ResourceGroup имеют настраиваемые `icon` + `color` из ограниченных наборов.

## Programs

`ProgramTemplate` → `ProgramOccurrence` → `ProgramRegistration`.
Occurrence может занимать resource, иметь лимит/регистрации/оплаты/перенос/отмену.

## Event

Сложная специализированная бронь; использует общие Booking/BookingItem/ResourceAllocation, а не отдельный механизм занятости.

## System fields

Изменяемые сущности: `id`, `version`, `createdAt/By`, `updatedAt/By`, `archivedAt`.
Исторические операционные данные не удалять физически.

## Базовые статусы

- Lead: `new`, `in_progress`, `waiting`, `success`, `rejected`, `spam`, `archived`.
- Booking: `draft`, `unconfirmed`, `confirmed`, `in_progress`, `completed`, `cancelled`, `archived`.
- ProgramOccurrence: `draft`, `open`, `closed`, `completed`, `cancelled`.
- Event: `inquiry`, `planning`, `booked`, `completed`, `cancelled`.
- Task: `open`, `completed`, `cancelled`.

На реализации каждого модуля уточнить allowed transitions, required fields, permissions, side effects, notifications, availability/payment impact.
