# PostgreSQL / TypeORM

PostgreSQL — единственная СУБД development/test/staging/production.

## Правила

- TypeORM Data Mapper;
- `synchronize: false` везде;
- schema changes только migrations;
- те же migrations в test и production;
- business rules в domain/application, DB constraints — defense in depth;
- transaction manager инкапсулирован;
- controller не обращается к repository напрямую;
- module не импортирует repository другого module напрямую.

## Возможности PostgreSQL

Допустимы осознанно: `jsonb`, arrays/ranges, enums/check constraints, `ILIKE`/FTS, partial indexes, exclusion constraints, materialized views. Значимые решения фиксировать.

## Data semantics

- UUID генерирует приложение;
- timestamps UTC;
- business timezone: `Europe/Kirov`;
- money integers;
- явная serialization/validation enum/JSON/boolean.

## Test DB

Integration/e2e/concurrency — реальный PostgreSQL через Docker Compose/Testcontainers.
Никакой SQLite-подмены.

`DATABASE_URL` и `TEST_DATABASE_URL` проходят через config module, без `process.env` по всему коду.
