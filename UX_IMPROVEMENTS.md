# Открытый cross-cutting UX backlog

Здесь остаются только не закрытые улучшения, затрагивающие несколько контуров. Реализованные пункты фиксируются в `IMPLEMENTATION_LOG.md` и профильных Phase 4 logs, а не накапливаются здесь.

## CRM operations

- подключить управление saved views и персональными колонками к реестрам;
- добавить workload-aware рекомендации с учётом роли, графика, отпуска и текущей очереди;
- спроектировать безопасный undo для статусов, DnD, назначений и связей с учётом concurrency/idempotency;
- собрать единую activity timeline клиента: заявки, брони, оплаты, звонки, задачи и изменения связей;
- добавить массовые действия в реестрах с permissions, progress и частичным failure state.

## Public site ↔ CMS ↔ CRM

- завершить production public intake: anti-spam/rate limit, consent snapshot, UTM/referrer, idempotency, Lead creation, audit/outbox, CRM deep link и уведомления;
- показать source/owner для пересекающихся данных (`CRM`, `CMS`, `computed`, `inherited`) во всех релевантных CMS flows;
- добавить render-ready preview/diff и blast-radius перед публикацией, включая stale-preview state;
- добавить integration health: последняя доставка, очередь, cache invalidation, ошибки/retry и correlation ID;
- завершить publication quality gate: обязательные media/alt, SEO/canonical/schema, consent/legal и полнота public profile;
- перенести временные public content fixtures в CMS без визуальной и SEO-регрессии;
- провести evidence-backed keyword/competitor research до создания новых индексируемых категорий и landing pages.

## Production hardening

- подключить production S3-compatible storage/CDN и внешний fail-closed malware scanning worker;
- добавить cleanup/DLQ/metrics для неуспешной media processing;
- утвердить legal privacy/retention/consent policy и provider-specific deployment decisions;
- проверить end-to-end notifications для заявок, публикаций, ошибок доставки и операционных изменений по ролям и каналам.

При реализации пункт должен перейти в профильный roadmap/log. Не добавлять сюда локальные косметические задачи одного экрана.
