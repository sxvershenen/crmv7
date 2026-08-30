# Порядок разработки

## Phase 1 — Design system

Цель: получить визуально и технически устойчивый UI-фундамент до массовой сборки экранов.

Нужно:
- tokens/theme;
- generated shadcn primitives + domain components;
- desktop/mobile shell;
- базовые layout/data-display/form/navigation patterns;
- основные состояния;
- `/dev/ui`;
- один демонстрационный рабочий CRM-экран на fixtures.

На этом этапе backend не нужен.

## Phase 2 — Frontend

Собрать CRM-экраны и user flows на общей дизайн-системе.

Разрешены локальные typed fixtures. Требования:
- данные не хардкодить внутри визуальных компонентов;
- доступ к данным держать за отдельным client/repository boundary;
- не реализовывать authoritative бизнес-правила на клиенте;
- предусмотреть loading/error/empty/conflict/permissions states, даже если часть пока демонстрационная.

## Phase 3 — Backend + интеграция CRM

Реализовать NestJS + domain/application + PostgreSQL + API и заменить frontend fixtures реальными запросами.

С этого момента backend authoritative для:
- статусов и переходов;
- availability/conflicts;
- вместимости;
- цен/итогов;
- платежей;
- прав;
- optimistic concurrency/idempotency.

## Phase 4 — Public site + admin

Подключить Astro/public API, формы сайта, UTM, content/admin API, публикацию, SEO/media, hardening.

## Что не переносить из старой схемы этапов

Не требуется заставлять design-system/front-end агента читать PostgreSQL, migrations, outbox и серверные тесты, пока его задача их не касается.
