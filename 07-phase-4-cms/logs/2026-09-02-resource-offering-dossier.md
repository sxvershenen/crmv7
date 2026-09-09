# Resource + offering CRM dossier — 2026-09-02

## Причина

CRM показывала домики и кемпинги дважды: как operational Resources и как отдельные offering registries. Связь существовала в `offering_bindings`, но не имела обратной read-модели и единого operator flow. Это заставляло воспринимать два owner aggregate как две вручную синхронизируемые сущности.

## Реализованный этап

- Primary CRM IA для house/campground перенесена в Resource dossier; существующие `Основное / Расписание / Блокировки / Правила / История` не перевёрстывались.
- Добавлена вкладка `Продажа и цены` с embedded-режимом shared offering editor: `Обзор / Состав / Цены`, отдельные segment save/conflict semantics, без вложенного `EditorFrame`.
- Добавлен authoritative reverse lookup `GET /offerings/by-resource/:resourceId` со состояниями `none | linked | ambiguous`. Неоднозначная legacy-связь fail closed и выводится как repair diagnostic.
- Добавлена cross-surface idempotent команда `POST /offerings/by-resource/:resourceId`. В одной SERIALIZABLE-транзакции создаются draft offering, campground terms при необходимости, primary binding, canonical CMS draft, ChangeLog, Outbox event и SSE delivery checkpoint.
- House/campground registries убраны из CRM sidebar; старые list routes перенаправляют в Resource lists, editor deep links сохранены для совместимости.
- Concrete campground resource kinds объединены в CRM-категорию `camping`, поэтому seeded owned tents и shared own-tent area теперь видны в общем списке.
- После первого сохранения нового Resource редактор заменяет `/new` на authoritative resource id, после чего коммерческое досье можно создать в той же карточке.
- Resource lookup по UUID и по operational code разведён до PostgreSQL predicate: text code больше не передаётся в UUID-сравнение, поэтому переход из списка в досье работает без hard reload.
- CMS dashboard проверен на authoritative demo data; нулевой denominator в funnel/CVR теперь показывает `—`, а не `Infinity%`.

## Acceptance

- contracts offering tests: 26/26;
- targeted API unit: 8/8;
- PostgreSQL integration: 36/36, включая Internal → Admin idempotent replay и exact offering/binding/CMS/audit/outbox assertions;
- full CRM unit/UI suite: 202/202;
- shared offering editor: 17/17;
- full CMS unit/UI suite: 62/62;
- CRM/API/contracts/offering-editor typecheck и lint зелёные;
- `git diff --check` зелёный.

## Следующие этапы

1. Провести тот же Resource-dossier IA review для venue, но только после фиксации typed venue fulfillment semantics.
2. Добавить отдельный audited repair flow для `ambiguous`; ordinary editor по-прежнему не делает unlink/relink автоматически.
3. После safe house/campground public projection убрать remaining compatibility editor routes, если telemetry не показывает внешних deep links.
