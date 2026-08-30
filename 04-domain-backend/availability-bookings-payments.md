# Availability, bookings, payments

## Единое ядро занятости

`ResourceAllocation` нормализует все интервалы, влияющие на доступность:
- booking items;
- events;
- program occurrences/registrations при необходимости;
- technical blocks;
- preparation intervals.

Минимально: `id`, `resourceId`, `sourceType`, `sourceId`, `startAt`, `endAt`, `quantity`, `capacityImpact`, `status`, `version`.

Все schedulers и conflict checks используют один availability module.

## Availability учитывает

Пересечения, capacity/quantity, preparation, blocks, status, resource compatibility, min duration, allowed hours, manual override permissions.

Интервалы: полуоткрытые `[startAt, endAt)`.

## Concurrency

- optimistic `version` обязательно;
- критичные operations дополнительно защищать row lock/exclusion/эквивалентом PostgreSQL;
- stale version → conflict, не silent overwrite;
- move/resize/create/payment/refund используют `operationId` для idempotency.

## Payments

Проведённая операция immutable.
Коррекция — refund/compensating operation с причиной.
Деньги — integers в минимальных единицах; currency explicit; итог считает backend.

Payment state отдельно от Booking lifecycle: unpaid / partial / paid / overpaid / refund / debt.
