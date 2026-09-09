# Предметная модель — кратко

Основные сущности:

`User`, `Role`, `Permission`, `Lead`, `Customer`, `Booking`, `BookingItem`, `Resource`, `ResourceGroup`, `ResourceAllocation`, `ResourceBlock`, `CatalogOffering`, `OfferingBinding`, `OfferingAddOnAssignment`, `EventServiceTemplate`, `PriceBook`, `RatePlan`, `PriceRule`, `BusinessCalendar`, `ProgramTemplate`, `ProgramOccurrence`, `ProgramRegistration`, `Event`, `Task`, `Payment`, `Comment`, `Visit`, `Notification`, `SavedView`, `ChangeLogEntry`, `OutboxEvent`.

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

Resource — физический inventory, а не прайс-лист и не public page. `ResourceGroup` выражает композицию кемпинга/общей зоны и участвует в authoritative allocations. Sellable unit, тариф и публичная eligibility принадлежат `CatalogOffering`.

## Commercial catalog and pricing

`CatalogOffering` — стабильное продаваемое предложение типов `house | campground | addon | venue | event_service | program`. Через typed `OfferingBinding` оно связано с Resource/ResourceGroup/ProgramTemplate/EventServiceTemplate.

`PriceBook → RatePlan → PriceRule` хранит immutable after activation версии: basis, weekday/weekend/calendar-holiday/custom-date rules, participant/guest/booking-lead tiers и extra-unit price. `BusinessCalendar` классифицирует локальные даты. Reusable и offering-specific catering/equipment/service add-ons являются `CatalogOffering(kind=addon)` и подключаются через `OfferingAddOnAssignment`, поэтому второго каталога и скопированных цен нет. Backend Quote выбирает один детерминированный набор правил; Booking/Event/Registration сохраняет immutable calculation snapshot и source versions.

Полные поля, authority и rollout: `../07-phase-4-cms/OFFERING-CATALOG-ARCHITECTURE.md`.

## Programs

`ProgramTemplate` → `ProgramOccurrence` → `ProgramRegistration`.
Occurrence может занимать resource, иметь лимит/регистрации/оплаты/перенос/отмену.

## Event

Сложная специализированная бронь; использует общие Booking/BookingItem/ResourceAllocation, а не отдельный механизм занятости.

`Event` — конкретный клиентский заказ с PII, датой, оплатами и operational comment. Публичный постоянный формат «свадьба/корпоратив» моделируется отдельным `EventServiceTemplate` + `CatalogOffering`; operational Event никогда автоматически не становится публичной страницей.

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
