# Предложения по UX и функционалу

## P0 — до backend-интеграции

1. Ввести единую `LeadBookingLink`/relation service с referential integrity, правами, `linkedAt`, `linkedBy`, `method` и audit history.
2. Нормализовать телефоны для поиска и дедупликации; совпадение номера показывать как подсказку, не как автосвязь.
3. Определить RBAC-матрицу: кто может менять связи, назначать людей, менять цены, возвраты и публикацию.
4. Для форм сайта заложить idempotency, anti-spam, consent version, request tracing и явный mapping полей в Lead.
5. Разделить public/admin API: public видит только published projection, admin управляет content/SEO/media и публикацией.

## P1 — операционная эффективность

1. Расширить глобальный `Cmd/Ctrl+K` до поиска по людям и сущностям: `#ID`, телефон, e-mail, имя, ресурс.
2. Добавить workload-aware назначение с учётом роли, графика, отпуска и текущей очереди.
3. Показывать в relation picker причину совпадения и риск: «тот же телефон», «пересекаются даты», «уже связано с другой заявкой».
4. Добавить undo для быстрых статусов, DnD, назначений и снятия связи.
5. Сделать единую activity timeline по клиенту: заявки, брони, оплаты, звонки, задачи и изменения связей.
6. Добавить saved views, персональные колонки таблиц и персистентные фильтры.
7. Добавить массовые действия в реестрах: назначить, поменять статус, экспортировать, архивировать.

## P2 — сайт, CMS и контроль качества

1. Показывать в CRM owner-маркер поля: `CRM`, `CMS`, `computed`, чтобы не было неясно, где его менять.
2. Добавить preview/diff перед публикацией цен, ресурсов и программ.
3. Добавить integration health: последняя синхронизация, очередь, ошибки, retry и correlation/request ID.
4. Ввести versioned publication и rollback для CMS-контента и public projection.
5. Добавить quality gate перед публикацией: фото, alt, public price, SEO, consent и полнота public profile.

## Точечные UI-улучшения

1. После трёх аватаров показывать `+N` с tooltip-списком всех ответственных.
2. В relation picker добавить keyboard shortcut и группы «точное совпадение / похожие / недавние».
3. На mobile позволить сворачивать длинную операционную сводку, но оставлять видимыми конфликты и долг.
4. В команде добавить график/отпуск и объяснение расчёта нагрузки.

## Статус frontend-внедрения на 30 августа 2026

- Внедрены без backend authority: global entity search, `+N` аватаров, grouped relation picker с причинами/рисками, mobile disclosure операционной сводки, объяснение текущей fixture-нагрузки и явные состояния готовности графика/отпуска.
- Остаются на Phase 3/4: authoritative `LeadBookingLink`, RBAC, workload-aware recommendation, undo с concurrency/idempotency, unified activity aggregation, bulk actions, integration health, publication versions/diff/rollback и quality gate.
- Saved views и персональные колонки остаются отдельным frontend-инкрементом после закрытия текущего acceptance gate.
