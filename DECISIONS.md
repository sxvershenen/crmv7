# DECISIONS

Append-only реестр долговременных архитектурных и продуктовых решений. Это не обязательное чтение целиком и не progress log: агент открывает релевантное решение по ссылке/поиску. Текущий статус реализации находится в профильном roadmap и logs.

## D-001 — Порядок разработки

Текущий порядок: **design system → frontend → backend + интеграция CRM → public site/admin**.
Это заменяет старое требование начинать каждую функцию сразу как full-stack vertical slice.

## D-002 — Create/edit UX

Create/edit сущности открываются как **отдельные route-driven страницы**, а не overlay/dialog.
Сохраняются полезные route-принципы: прямые URL, browser Back, восстановление контекста списка по возможности.

## D-003 — Иконки

Пользовательская иконография CRM — **Tabler Icons**, согласно более позднему визуальному ТЗ.
Generated shadcn-примитивы не переписывать только ради замены их внутренних служебных иконок, если это ломает происхождение preset-кода.

## D-004 — shadcn/ui

Сохраняется требование общего ТЗ: UI-примитивы получать официальным `shadcn` CLI с preset `bIkezqK`; доменные компоненты строить композицией поверх них.

## D-005 — Fixtures до backend

На этапах design system/frontend допускаются локальные fixtures для визуализации сценариев.
Они должны быть изолированы от компонентов и не становиться источником бизнес-правил. После появления API транспорт заменяется без переписывания UI.

## D-006 — Оригинальное визуальное ТЗ

`reference/original-ui-visual.md` считается высшим исходным источником по компоновке, плотности, отображаемым данным и screen-level UX, если текущие рабочие документы не уточняют иначе.

## D-007 — Тема Phase 1

Phase 1 использует light-first neutral тему из официального shadcn preset `bIkezqK` (Vega + Roboto). Фирменных цветов и логотипа пока нет. Semantic tokens имеют значения для будущего dark mode, но переключатель и dark-mode UI в Phase 1 не реализуются.

## D-008 — Frontend границы Phase 1

`packages/ui` хранит generated primitives и общие CRM-compositions; `apps/crm` — shell, routes и screens. Временные fixtures доступны UI только через typed repository interface. Маршруты ещё не собранных экранов открывают явный Phase 2 placeholder, а не имитацию backend.

## D-009 — Responsive Dashboard

На desktop «Внимание» занимает `2/3`, «Сегодня» — `1/3`. На mobile «Сегодня» идёт первым и в визуальном, и в DOM-порядке; desktop-порядок меняется CSS grid order. Это сохраняет нужный mobile UX и корректную keyboard/screen-reader последовательность.

## D-010 — Плотность identity/status UI

Рабочие аватары ответственных по умолчанию отображаются `28×28`, компактный вариант сохраняется `24×24`. Статусные бейджи — лёгкие, высотой около `18px`, normal weight и без декоративной точки. Dirty/saving/saved/conflict показываются отдельным компактным semantic indicator с контрастными foreground/background. Scheduler-карточки используют status-tinted surface, border и foreground того же semantic tone, что и их badge.

## D-011 — Структура Dashboard

Каждая смысловая секция Dashboard имеет собственную surface-группу; строки внутри неё разделяются divider, а секции — spacing. Информация «что бронировали/что проводится» отображается отдельным content summary; количество людей всегда представляется person icon + числом без слова «гостей».

## D-012 — Типографика строк и оплата

Рабочее содержимое карточек и строк использует единый размер `12px` и normal weight; `10–11px` допустимы только для вторичных metadata/captions. Иерархия строится отступами и цветом, а не случайным bold. Связка ресурса и количества людей имеет вид `ресурс · person icon + число`. Payment progress использует светлый нейтральный track `oklch(0.95 0 0)` и серый fill; контраст текста обеспечивается двумя clipped слоями и не зависит от процента заполнения.

## D-013 — Vertical Scheduler

Scheduler бронирований использует вертикальную ось времени. На desktop ресурсы отображаются в 1–5 адаптивных lane-колонках без постоянного горизонтального scroll; лишние ресурсы доступны через выбор и постраничное переключение lane. На mobile Scheduler показывает одну выбранную resource lane, при этом Agenda остаётся default day-centric видом. Вертикальная навигация использует скользящее окно из пяти дней: диапазон можно продолжать в обе стороны, но DOM остаётся ограниченным. DnD перемещает интервал по Y; resize выполняется верхней и нижней границами. Date navigation строится на generated shadcn Calendar/Popover. Карточка использует непрозрачную status-tinted surface и border того же семейства, а preparation всегда является отдельным интервалом той же ширины.

## D-014 — Shared UI gate для экранов

Operational screen не дублирует название раздела внутри страницы: authoritative title находится в breadcrumbs/topbar; исключение — содержательный greeting Dashboard. Page navigation строится через shared `PageNav` поверх `Tabs variant="line"`, а переключение вида — через compact icon-only `Tabs variant="default"`; single-choice filters — через generated shadcn `Select`, date/date-range — через generated `Calendar`. Settings bars, data tables, clickable cards и scheduler blocks являются shared domain compositions. Визуальные raw controls и локальные копии этих паттернов в screen-файлах запрещены архитектурной проверкой.

## D-015 — Модель программ на frontend-этапе

Шаблон программы — переиспользуемая основа с категорией, длительностью, лимитом и базовой стоимостью. Проведение программы — отдельная сущность, созданная по шаблону и имеющая собственные дату/время, участников, регистрации, статус, ответственных и финансовые показатели. Регистрация относится к конкретному проведению, а не к шаблону. Управление категориями программ вынесено на отдельный route `/programs/categories`; create/edit остаются route-driven страницами. До появления backend все изменения проходят через typed repository boundary и не считаются authoritative бизнес-правилами.

## D-016 — Модель мероприятий на frontend-этапе

Мероприятие — самостоятельная сущность и не является проведением программы. Тип называется `Выездное мероприятие`; автоматической связи с ProgramRun нет. Категории управляются на отдельном route `/events/categories`. Основные table/mobile/scheduler представления используют date-centric календарь без resource lanes: три дня или неделя на desktop, один день на mobile. Ответственный или compact assign-control располагается слева от быстрого статуса. Денежный прогресс использует shared `PaymentProgress`; mutations до backend проходят только через typed repository boundary.

## D-017 — Единый компактный payment progress

Оплата во всех таблицах, карточках и scheduler использует тот же компактный progress-паттерн, что и вместимость: оплаченная сумма слева, `из всего` справа и стандартные цвета общего `Progress`. В проведениях колонка «Выручка» показывает прогресс `paid / revenue`; её сортировка циклически проходит общую сумму по убыванию/возрастанию, затем оплаченную сумму по убыванию/возрастанию.

## D-018 — Модель проблем задач на frontend-этапе

«Проблемы» задач — вычисляемое представление, а не самостоятельный статус: туда входят просроченные, заблокированные и оставшиеся без исполнителя открытые задачи. Рабочий статус сохраняет отдельную линейку `Задачи / В работе / Проверка / Выполнено`, архив является отдельным признаком. До backend вычисление и mutations изолированы в typed fixture-repository и не считаются authoritative бизнес-правилами.

## D-019 — Общие композиции Kanban и обзорных показателей

Operational Kanban строится из shared `KanbanBoard`, `KanbanColumn` и `KanbanDropPlaceholder`; конкретный экран задаёт только статусы, карточку и mutation. Desktop Kanban обязан поддерживать pointer/keyboard DnD, а mobile — отдельное компактное представление с доступной action-menu альтернативой. Обзорные показатели используют shared `SummaryMetric`, а списочные блоки — `ListSection`/`ListRow`, чтобы Dashboard, Tasks и последующие экраны сохраняли одну анатомию заголовков, divider и semantic icon tones.

## D-020 — Модель финансов на frontend-этапе

Финансовый экран до backend является операционным представлением typed fixture-ledger: реестр операций, ожидаемые платежи, агрегаты, динамика и разрезы доступны через `FinanceRepository`. Показатели периода вычисляются только внутри repository boundary; UI не объявляет fixtures бухгалтерским источником истины. Оплата и выручка во всех разрезах используют shared `PaymentProgress` в формате `сумма слева / из общего справа` без видимой подписи «Оплачено»; фильтры, период, раздел и сортировка хранятся в URL.

## D-021 — Финансовые графики, KPI и пагинация

Графики строятся generated shadcn `Chart` поверх Recharts и не получают локальную screen-only обёртку. Сводка использует area/line dynamics; отдельный раздел «Динамика» дополнительно показывает долг/возвраты, собираемость и количество оплат. KPI на mobile представлены shared snap-strip с видимой частью следующей карточки, подсказкой и индексом; desktop использует адаптивную grid. Реестр пагинируется после фильтрации и сортировки, а смена страницы меняет только URL-параметр `page`, сохраняя период, фильтры и sort state.

## D-022 — Shared editor chrome

Route-driven create/edit страницы используют общий `EditorFrame`. Identity `[<] Название #id` заменяет breadcrumbs в global topbar; отдельная editor-шапка запрещена. URL-backed navigation, быстрый статус и overflow actions находятся в одной sticky строке под global topbar. На mobile статус переносится к identity, tabs затухают градиентом под фиксированной overflow-кнопкой. Рабочая область — `main + 320px sidebar` с mobile single-column adaptation; bottom action bar всегда `fixed` к viewport над mobile navigation. Поля используют shared `FormField`/`FormSelect`, секции — `EditorSection`, назначение исполнителя — `AssigneePicker`, внутренние комментарии — `CommentThread`; dirty/saving/saved/conflict остаются в `EditorSaveStateIndicator`. Рабочие consumers — `/leads/:id`, `/customers/:id`, `/tasks/:id` и `/bookings/:id`, включая route `new`.

## D-023 — Модель редактора бронирования на frontend-этапе

Scheduler/table продолжают использовать компактную плоскую `Booking`, а route-driven editor работает с расширенной `BookingEditorRecord` через `BookingEditorRepository`. Состав брони, внутренние комментарии и платёжные операции не встраиваются во fixtures экрана и не объявляются серверными бизнес-правилами. Сохранение временно сводит первую позицию к scheduler-представлению только внутри fixture repository; authoritative расчёт цены, валидация доступности, проведение оплат и возвратов должны появиться на backend-этапе.

## D-024 — Модель редактора ресурса на frontend-этапе

Monitoring cards используют компактную `Resource`, а `/resources/:kind/:resourceId` и route `new` работают с расширенной `ResourceEditorRecord` через `ResourceEditorRepository`. Иконка/цвет представлены общей `ResourceIdentityIcon`, а основное, расписание, блокировки, правила и история используют shared editor anatomy. Интервалы блокировок и незаполненные правила являются fixture-состоянием: frontend не вычисляет authoritative availability, пересечения или допустимость правил. Действие блокировки на карточке ведёт сразу на URL-backed `?tab=blocks` и включается только при `canManageBlocks`.

## D-025 — Модель редактора шаблона программы на frontend-этапе

Таблицы и карточки продолжают использовать компактный `ProgramTemplate`, а `/programs/:id` и `/programs/new` работают с расширенным `ProgramTemplateEditorRecord` через `ProgramTemplateEditorRepository`. Этапы, editor-only настройки и snapshot связанных проведений не расширяют list fixtures и до backend не являются authoritative данными. Порядок этапов хранится одним массивом: pointer DnD, keyboard DnD и кнопки вверх/вниз изменяют одну и ту же последовательность; дублирование создаёт новый стабильный id. Редактор использует shared `EditorFrame`, identity программы, controls и operational sidebar без повторения статуса публикации.

## D-026 — Модель редактора проведения программы на frontend-этапе

Реестр и scheduler используют компактный `ProgramRun`, а `/programs/runs/:id` и route `new` работают с `ProgramRunEditorRecord` через `ProgramRunEditorRepository`. Детальная регистрация расширяет компактный `ProgramRegistration` только внутри editor boundary; resource booking является связью-заготовкой и открывает предзаполненный редактор брони. Локальное добавление/удаление обновляет видимый snapshot участников, регистраций, выручки и оплаты для честной интерактивной демонстрации, но frontend не объявляет эти расчёты authoritative. Проверка доступности, конфликтов, цен, вместимости, платежей и status transitions остаётся обязанностью backend. На mobile длинная форма регистрации по умолчанию свёрнута, чтобы operational list не уходил за несколько экранов.

## D-027 — Модель редактора регистрации на программу

Реестр использует компактный `ProgramRegistration`, а `/programs/registrations/:id` и route `new` — расширенный `ProgramRegistrationEditorRecord` через `ProgramRegistrationEditorRepository`. Детали участников, internal comments, payment/refund operations и snapshot проведения не сериализуются в list DTO. Добавление оплаты обновляет локальные `paid/debt` для интерактивного frontend-сценария, но не меняет статус автоматически: authoritative финансовые проверки, возвраты и status transitions появятся только на backend. Для завершённого факта посещения в status-модель добавлен отдельный `visited`, не смешанный с `paid`.

## D-028 — Модель редактора мероприятия и общий сценарий

Реестр и scheduler продолжают использовать компактный `CrmEvent`, а `/events/:id` и `/events/new` работают с `EventEditorRecord` через `EventEditorRepository`. Комментарии, связи ресурсов и этапы сценария остаются editor-only данными и не протекают в list DTO. Ресурсная связь лишь подготавливает `/bookings/new`; authoritative проверка доступности, конфликтов и финансов остаётся на backend. Порядок этапов мероприятия и программы реализуется общей композицией `OrderedStageList`: pointer/keyboard DnD и кнопки вверх/вниз изменяют один массив. Статус показывается в editor chrome и не дублируется в operational sidebar.

## D-029 — Общий редактор справочных категорий

Категории программ и мероприятий редактируются одной shared-композицией `CategoryEditor`; доменная обёртка задаёт допустимые иконки/цвета, tone, usage label и связанные route-элементы. Compact category остаётся моделью списков, а editor DTO хранит snapshot связанных шаблонов или мероприятий за отдельным repository interface. Frontend может синхронно обновить category presentation у fixture-сущностей для честной демонстрации, но удаление используемой категории, referential integrity и каскадные изменения определит backend.

## D-030 — Отдельный route расписания без дублирования scheduler

`/schedule` и `/bookings` используют один `BookingsPage`, repository state и `VerticalScheduler`. Различается только default view: Agenda для бронирований и Scheduler для отдельного расписания ресурсов. Явный URL-параметр `view` всегда имеет приоритет, поэтому переключение вида остаётся shareable; самостоятельная копия scheduler-компонентов и mutations запрещена.

## D-031 — Компактные действия и демонстрационные данные редакторов

Текстовые кнопки, menu actions и tabs используют общий размер `13px` и normal weight `400`; иерархия действий задаётся variant, цветом и расположением, а не увеличенным полужирным текстом. До подключения backend связанные вкладки route-driven редакторов заполняются явно помеченными fixture-данными с несколькими состояниями: история, задачи, коммуникации, посещения, оплаты и связанные заказы должны позволять оценить плотность и переполнение. Маркетинговая атрибуция хранит полный набор `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`, channel/source и внешние client/integration IDs отдельно от операционного статуса.

## D-032 — Консистентные операционные действия редакторов

Комментарии и коммуникации вводятся через общий messenger-like `MessageComposer`: textarea, тип коммуникации и icon-only отправка находятся в одной рамке. Клиенты, шаблоны, проведения и ресурсы выбираются через searchable `EntityCombobox`; выбранного клиента можно открыть без потери контекста. Дата и время в составных сущностях задаются общей композицией `DateTimePicker` поверх shadcn Calendar. Операционные сводки используют multi-select `AssigneePicker`, поэтому ответственных можно не только заменить, но и добавить. Связанные заявки, брони, посещения, оплаты, регистрации и задачи должны открываться из самой строки. Финансовые операции во frontend-fixtures демонстрируют оплату, подтверждаемый возврат и, где применимо, отмену возврата, но не объявляют эти действия authoritative до backend-интеграции.

## D-033 — Ручная связь заявок и броней

Бронь хранит nullable typed `sourceLeadId`, а не свободную текстовую подпись. Подпись и ссылка выводятся из заявки. В редакторах брони и заявки связь можно найти, добавить, открыть и снять через общий `ManualRelationPicker`; поиск индексирует `#ID`, цифры телефона, имя клиента и контекст записи.

Authoritative backend хранит append-only историю и не более одной активной связи на бронь. Несколько броней могут ссылаться на одну заявку; несовпадение клиентов само по себе не запрещает ручную связь. Missing/archived target отклоняется, но существующую связь с архивной заявкой можно снять. Связь не меняет клиента, статусы или оплаты и не выполняет автоконверсию. Capability, actor и timestamps определяет сервер.

Code/UUID брони сначала нормализуется в canonical UUID. В пределах общего link/unlink idempotency scope точный повтор результата проверяется до текущей версии; повтор ключа с иным intent конфликтует. Затем сервер блокирует бронь и проверяет `expectedVersion`; link с уже выбранной заявкой и unlink без связи являются no-op только после успешной проверки версии и не создают version/history/audit/outbox side effects. `from_lead` обозначает происхождение команды, но не обещает атомарный create+link. CRM выполняет отдельную relation command с UI-observed version, сохраняет dirty draft и обновляет только связь и booking version.

## D-034 — Границы профиля, команды и настроек

`/profile` хранит личные данные, уведомления и безопасность текущего сотрудника; `/team` — людей, роли и нагрузку; `/settings` — общие правила workspace и интеграционные контракты. Публичный сайт и CMS остаются отдельной будущей admin-фазой: CRM задаёт правила обмена, но не дублирует content/SEO/media UI. Форма сайта создаёт Lead с UTM/consent metadata и не создаёт confirmed Booking.

## D-035 — Frontend-safe UX improvements до backend

Глобальный `Cmd/Ctrl+K` ищет не только разделы, но и людей/сущности по `#ID`, телефону, e-mail, имени и ресурсу через typed `GlobalSearchRepository`. Нормализация телефона и relation matching на frontend служат только поисковой подсказкой: группы `точные / похожие / недавние`, причины и риски не создают автосвязь и не заменяют backend referential integrity/audit/RBAC. Shared assignee presentation после трёх аватаров показывает `+N` с tooltip всей группы. Mobile operational summary использует shared disclosure: критичные сигналы риска/долга остаются видимыми, остальные детали свёрнуты по умолчанию. Шкала нагрузки команды явно обозначена как относительная по fixture-очереди; график, роль и отпуск не влияют на расчёт до backend.

## D-036 — Единый directory boundary для editor lookup-данных

Страницы и UI-компоненты не импортируют fixtures напрямую. Клиенты, заявки, брони, ресурсы и кандидаты назначения доступны через `DirectoryRepository` как узкие lookup-проекции; fixture adapter остаётся единственным местом временных импортов. Асинхронный directory hook кэширует одну загрузку, а редакторы, которым справочник нужен для создания draft, ждут его до инициализации. Scope ответственных сохраняется явно, чтобы не смешивать доступность назначения между доменами и позже заменить adapter permissions-aware API.

## D-037 — Пилот React Hook Form + Zod в shared category editor

Миграция редакторов на React Hook Form + Zod начинается с общего `CategoryEditor`, который обслуживает категории программ и мероприятий. Zod-схема является presentation validation: проверяет только уже существовавшее правило непустого названия и принадлежность иконки/цвета переданным options, не вводя новые бизнес-ограничения. Загруженный editor DTO остаётся носителем `id`, usage counters и related snapshots; mapper отделяет его от четырёх form fields. Успешное сохранение сбрасывает RHF baseline по ответу repository, а rejected save продолжает использовать общий conflict state. Следующие редакторы мигрируются инкрементально без изменения `EditorFrame`, URL-tabs и fixed action bar.

## D-038 — Task editor form boundary и отдельная вкладка связей

`/tasks/:id` использует `TaskEditorRecord` и React Hook Form + Zod presentation schema: list-модель задачи не хранит editor-only `reminderMinutes`, а fixture repository явно проецирует DTO в обе стороны. Форма валидирует непустое название, допустимые enum-значения, дату и неотрицательное напоминание; успешный save сбрасывает baseline по repository response, rejected save сохраняет общий conflict state. Связь редактируется на URL-вкладке `?tab=relations` согласно screen spec, а operational sidebar показывает только компактный snapshot без дублирования формы. Mobile status control ограничен по ширине, чтобы длинный editor chrome не создавал horizontal overflow.

## D-039 — Astro-first фундамент публичного сайта

Шаблон публичного сайта переносится в отдельный workspace `apps/site`; исходная папка `/Users/a1111/Downloads/website` остаётся неизменным визуальным эталоном. Astro 7 использует static output, владеет HTML-документом, route registry, metadata, canonical, robots, sitemap и статическими секциями. React не образует единый SPA-root: интерактивные секции гидрируются независимыми islands, а межостровные booking/call/house/privacy/toast/navigation действия проходят через typed browser event boundary. `WhyUs`, partners marquee и footer являются чистыми Astro-компонентами; весь значимый контент React-islands также prerendered в production HTML.

Шаблонные цены, даты, промокоды, доступность, контакты, отзывы и внешние media URL сохраняются только как визуальные content fixtures и не считаются опубликованными бизнес-фактами. Будущий сайт получает данные только через `/api/public/v1`/content source boundary; public form создаёт Lead с UTM/consent metadata и никогда не создаёт confirmed Booking. Публичный сайт не импортирует CRM UI, ORM entities, internal API или PostgreSQL.

## D-040 — Authoritative категории программ и мероприятий

Категории программ и мероприятий стали отдельными PostgreSQL-агрегатами с ограниченными icon/tone enum’ами, optimistic version, capabilities, audit ChangeLog и Outbox. CRUD/archive выполняется через `/programs/categories` и `/events/categories`; editor GET возвращает snapshot связанных сущностей. `program_templates.category_id` и `events.category_id` используют nullable FK с `ON DELETE SET NULL`, поэтому удаление справочной категории не ломает операционные записи. Frontend API repositories используют эти endpoints в обычном режиме, а `VITE_DATA_MODE=fixtures` оставляет явный fixture fallback.

## D-041 — Единый authoritative allocation boundary для событий и проведений

Аллокации ресурсов для `event` и `program_occurrence` читаются через глобальный фильтруемый `/resources/allocations` и изменяются только через idempotent create/cancel API с permission check, optimistic resource version, ChangeLog и Outbox. Editor repositories сначала сохраняют core-сущность, затем reconciles additions/removals по её реальному UUID; fixture mode сохраняет прежний локальный fallback. После каждой mutation версия ресурса перечитывается, а API-конфликты пробрасываются в общий conflict state редактора.

## D-042 — Workspace API boundary для профиля, команды и настроек

Профиль текущего пользователя, команда и versioned workspace settings читаются и изменяются через `/workspace/*` API; `VITE_DATA_MODE=fixtures` сохраняет явный локальный repository для UI-тестов. Открытая нагрузка команды считается сервером по назначенным задачам, заявкам, броням, проведениям и мероприятиям; schedule/leave возвращают расширяемый readiness `unconfigured`, пока источник не настроен. Site/CMS connection status остаётся `planned` до Phase 4.

## D-043 — Phase 3 authority и граница fixture-режима

Обычный CRM runtime использует internal API как единственный authoritative источник для клиентов, заявок, броней, ресурсов, программ, мероприятий, задач, финансов, уведомлений и workspace. Переходы статусов, availability/conflicts, платежный ledger, назначения, связи, права, версии и idempotency проверяются сервером; каждая значимая mutation атомарно пишет ChangeLog и Outbox. `VITE_DATA_MODE=fixtures` остаётся явным изолированным режимом для UI-regression и не должен случайно включаться в production/API runtime. Публичный сайт, public intake, CMS/admin и публикация не используют этот internal boundary и остаются Phase 4.

## D-044 — Адаптивные карточные рельсы и блог публичного сайта

Мобильные горизонтальные ленты событий, домиков, бани/чана, площадок и блога используют видимый левый gutter страницы (`margin-left: 0` + `padding-left: 16px` на compact mobile), а отрицательный край оставляют только справа для peek следующей карточки; на `sm` сохраняется page gutter `24px`. Ширина карточки ограничена `380px`, но на узком viewport считается от ширины экрана, сохраняя peek следующей карточки. Один `useSwipeHint` даёт одноразовую mobile-подсказку при попадании ленты в viewport. Список программ использует фиксированную высоту, line clamp и ограниченное число metadata-баблов без preview-изображения.

Блоговый блок между площадками и social proof остаётся Astro-first: четыре featured-карточки и шесть compact-анонсов prerendered в HTML, `/blog` включён в route registry и sitemap. Тексты анонсов являются временными content fixtures без новых бизнес-утверждений и позже заменяются content/admin API.

## D-045 — Отдельный CMS workspace и ownership

Phase 4 создаёт отдельный `apps/admin` на общей CRM design system из `packages/ui`, с app-switcher и deep links в CRM. CRM остаётся authoritative для ресурсов, availability/capacity, цен, программ/мероприятий, Lead/Booking/Payment; CMS владеет публичными профилями, текстом, media, композицией, SEO и публикацией. Поля CMS показывают source marker `CRM / CMS / computed / inherited`; дублирование operational authority запрещено. Произвольный operational `Event` не публикуется: public eligibility для Event/occurrence/«Допов» утверждается отдельным allowlisted projection contract до migrations.

## D-046 — Versioned composition, inheritance и atomic release

Контент поддерживает schema-driven sections, versioned reusable blocks и controlled custom-code artifacts. Глобальные `hero`, map, FAQ, directions, calculator и footer разрешаются по цепочке `site default → page type → parent/category → page` с режимами `inherit / override patch / disabled`. Route topology, navigation/defaults, profiles, redirects and relations are revision-scoped. Published revision immutable; complete release manifest pins all dependency revisions and activates through one `active_release_id` CAS, а rollback создаёт новую release на ранее валидированные artifacts.

## D-047 — Безопасные code/media boundaries

CMS не исполняет TSX/HTML из БД и не редактирует production checkout напрямую. Ручной и AI-generated код проходит allowlisted Git workspace и ephemeral non-root secretless/network-denied sandbox с realpath/symlink/import checks, quotas and signed artifacts; затем isolated preview/typecheck/lint/build/security/a11y gates и atomic release/rollback. Media проходит private staging, MIME/scan/decode и WebP responsive variants; usage graph блокирует silent deletion published assets.

## D-048 — Public delivery и API namespaces Phase 4

Сохраняются `/api/internal/v1`, добавляются изолированные `/api/admin/v1` и `/api/public/v1` с раздельными OpenAPI. Public site получает только published public projections. Это решение **заменяет только static-output часть D-039**: Astro-first, islands и server-rendered meaningful HTML сохраняются, но target runtime для быстрого publish — server/hybrid + cache invalidation; static rebuild допускается только как явно выбранный fallback с честным SLO. Конкретный hosting adapter/CDN утверждается P4.0. Draft preview обновляется отдельно и не меняет production.

## D-049 — Privacy-aware analytics boundary

Собственная аналитика использует server-issued first-party opaque visitor/session IDs, allowlisted event schemas, UTM/referrer normalization и server conversion facts Lead → Booking → Payment. Raw IP, contacts, form values, full referrer/query and cookies не записываются в analytics events/CRM/ChangeLog/exports; raw IP допустим только в отдельно утверждённом краткоживущем security/rate-limit contour. Metrika identifiers не считаются подтверждённым Яндекс-аккаунтом; интеграция consent-gated и остаётся сравнительным источником, а identity links требуют отдельной цели, retention, capability и audit. Эта безопасная интерпретация исходного пожелания отдельно подтверждается владельцем данных в P4.0.

## D-050 — Модель агентной работы Phase 4

Сложная архитектура и весь CMS/public frontend UI/UX проектируются и реализуются Sol High. Terra/Luna допустимы для узких backend, migration, test и inventory задач с явным file ownership; изменения контрактов и интерфейса проходят Sol High review. Детальный порядок и gates зафиксированы в `07-phase-4-cms/IMPLEMENTATION-ROADMAP.md`.

## D-051 — Public site UI kit как обязательный frontend boundary

Публичный сайт получает отдельный versioned `packages/site-ui`, не импортирующий operational CRM `packages/ui`. Semantic tokens/typography являются единственным глобальным style authority; public routes собираются из registered primitives/compositions/sections, а homepage становится первым полным consumer. Kit включает catalog/content/navigation/media/forms/overlays/feedback и booking/date-range components, но не переносит authoritative availability/price logic на клиент. `/dev/site-ui`, section manifest и AI page contract обязательны до массовой сборки новых public pages.

## D-052 — Autonomous P4.0 technical defaults

Phase 4 реализуется по staged delivery: существующий Astro static сохраняется на время миграции UI kit, production target — server/hybrid runtime с CDN invalidation и immutable release pointer. Media использует provider-neutral S3-compatible boundary, private originals и public WebP variants. CRM остаётся authority цены, availability и скидок. Редактируемый из CMS код ограничен `apps/site/src/managed/**`; UI kit, configuration и dependencies доступны только для чтения, а сборка выполняется в secretless sandbox. Полные operational `Event` не публикуются: наружу выходит только отдельная safe projection. Privacy, retention, RPO/RTO и SLO defaults подробно зафиксированы в `07-phase-4-cms/P4-0-DECISIONS.md`; provider/legal sign-off остаётся go-live gate, а не блокером разработки.

## D-053 — Phase 4 contracts и OpenAPI изоляция

Content, SEO, media, publication, public page, intake и analytics получают отдельные strict Zod-контракты в `packages/contracts`. CMS inheritance использует явные `inherit / disabled / override` и конечную patch grammar; releases фиксируют exact dependency refs. `/api/admin/v1` и `/api/public/v1` имеют независимые OpenAPI documents, причём public registry не импортирует draft, raw analytics или media administration DTO. Публичный intake создаёт только Lead, а не Booking; произвольный operational `Event` не является допустимым public profile kind. Phase 4 payloads используют bounded JSON grammar вместо рекурсивного «любого JSON».

## D-054 — Первый CMS persistence slice и совместимая API topology

Первый persistence slice включает стабильные `cms_nodes`, immutable `cms_node_revisions`, immutable release manifest/items, public profiles и singleton `cms_active_release` с optimistic CAS version. Path uniqueness проверяется внутри release, а не глобально среди drafts; у node может быть только один активный draft. PostgreSQL constraints дублируют ключевые enum/path/hash/profile invariants. Nest использует global `/api`, монтирует все прежние CRM modules под `/internal/v1` через `InternalApiModule` и открывает изолированные OpenAPI endpoints admin/public namespaces. До DB-enabled compatibility gate эта topology считается implemented foundation, но не production-complete CMS API.

## D-055 — CMS content lifecycle и route topology

`/api/admin/v1/content/nodes` владеет list/search/detail/create/update/review/return/archive lifecycle. Каждое content-изменение создаёт immutable revision, использует `expectedVersion`, `operationId` и `idempotencyKey`, атомарно пишет ChangeLog/Outbox и проверяет granular capability. Canonical path выводится из parent placement + slug; root `/` зарезервирован для `home`. Одинаковые draft paths разрешены для staged route transfer; уникальность является publish/release invariant.

## D-056 — Public page выходит только из materialized release payload

`/api/public/v1/pages/resolve` читает active release, published release/item и pinned published revision одним snapshot-consistent SQL statement. `cms_release_items.resolved_content` хранит строго валидированные renderer configs без authoring `policy`; hash проверяется при чтении. Mutable editorial archive не меняет уже активный release. Signed preview token аудируется и отдаёт private/noindex authoring snapshot с `renderable=false`, пока P4.3 materializer не соберёт inheritance chain в полный render-ready preview.

## D-057 — Credentialed origins и module routing

`CORS_ORIGIN` является allowlist только для credentialed CRM/CMS origins; public site не добавляется в этот trust contour и обращается к public API через same-origin server/proxy. Nest `RouterModule` явно монтирует child modules под `/internal/v1`; простая регистрация wrapper-module не распространяет prefix на его imported controllers и запрещена compatibility integration gate.

## D-058 — Atomic publication core и честная граница inheritance

Release builder принимает только approved revisions, наследует секции по explicit parent chain, материализует public renderer config и детерминированно фиксирует все inherited revision dependencies. Build, CAS activation и rollback выполняются в `SERIALIZABLE` транзакциях вместе с idempotency, ChangeLog и typed Outbox; rollback создаёт новый immutable release. Persisted `site default` и `page type default` ещё не созданы: корневой `inherit` без явной базы блокирует release с `CMS_INHERITANCE_BASE_MISSING`, а не подменяется выдуманным default.

## D-059 — Pixel-preserving migration и hydration regression gate

Перенос существующего public frontend в `@crm/site-ui` не является разрешением на редизайн. Commit `9cd146a` служит точной pre-migration контрольной точкой; намеренные последующие изменения перечисляются отдельно. Токенизация выполняется инкрементально: визуально подтверждённые legacy-компоненты временно допускаются architecture gate до появления их fixture/regression coverage, а затем переводятся без изменения DOM, размеров, поведения и content density.

Обязательный gate публичного сайта включает desktop/mobile Playwright: полный набор homepage-секций, контрольную типографику, React-island hydration, booking dialog, Escape/scroll lock, интерактивные табы, глобальные modal actions на внутренних страницах и root anchors. Межостровный event runtime буферизует раннее действие пользователя до регистрации listener. Параллельные Astro dev-серверы одного checkout не могут делить `apps/site/node_modules/.vite`; визуальная контрольная точка запускается из изолированного cache/worktree или сравнивается статически.

## D-060 — CMS session boundary без потери редакторского состояния

CMS использует canonical cookie-session из `/api/internal/v1/auth/*`; login/session/logout имеют отдельную transport policy без mutation retry и без ложного expiry-event на `INVALID_CREDENTIALS`. Первый `401` открывает полноэкранный вход, а `401` после загрузки приложения показывает обязательный re-auth dialog поверх всё ещё смонтированной CMS, сохраняя текущий URL и dirty editor state. Повторный вход другим пользователем требует полной перезагрузки текущего URL.

`canViewContent` является глобальной границей CMS. Навигация, quick-create и прямые technical/create/upload routes фильтруются теми же granular capabilities; logout считается завершённым и при подтверждённом сервером отсутствии сессии. Локальная разработка использует same-origin `/api` proxy, а auth response/status закреплены общими контрактами и HTTP 200.

## D-061 — Прямая публикация и CRM-origin черновики

Редактор CMS не работает с `REL-*`, build и activation: страница публикуется одной idempotent/CAS командой `POST /content/nodes/:id/publish`, а навигация и глобальные defaults — `POST /site-settings/publish`. Immutable `cms_releases` остаются только внутренним atomic publication journal/rollback snapshot. После публикации GET возвращает published revision как current, а первый PATCH автоматически ответвляет новый draft.

Создание Resource, ProgramTemplate, ProgramOccurrence, Event и категорий программ/мероприятий в той же PostgreSQL-транзакции идемпотентно создаёт `cms_source_links` + явный CMS draft. Служебный route `/drafts/...` является publish blocker до выбора канонического public URL. Эта связь не даёт public eligibility: operational Event/occurrence остаётся непубличным, пока редактор не создаст и не опубликует безопасный публичный профиль.

`cms_site_settings_revisions` версионирует всё дерево desktop/mobile/footer navigation (включая icon/color/anchor/target), site hero default и materialized `sectionDefaults`. Root pages получают из них hero/map/FAQ/directions/calculator/footer; page policy по-прежнему может inherit/override/disable каждую часть. Public read доверяет immutable release snapshot, а не mutable archive/state; media в hero должно быть материализовано public variants, иначе publish блокируется.

## D-062 — Tailwind source graph и полноростовой public regression gate

`@crm/site-ui` использует Tailwind utilities внутри package source, поэтому `apps/site/src/styles/global.css` обязан явно включать `packages/site-ui/src` в Tailwind v4 source graph. Architecture gate блокирует сборку без этого directive: иначе responsive classes пакета молча исчезают из production CSS.

Commit `9cd146a` остаётся desktop presentation reference. Намеренные более поздние исключения из D-044 сохраняются: mobile card rails/compact Programs и Astro-first Blog. Program card имеет явно разные contracts: compact mobile без preview и reference desktop с preview. Visual gate хранит как viewport, так и full-page desktop/mobile screenshots; baseline можно менять только после независимой сверки с reference и фиксации намеренного отличия.

## D-063 — Media identity, private blob и immutable public variants

Media asset является versioned логической сущностью, а original blob и его WebP/AVIF variants — immutable. Scoped upload grant одноразовый, подписанный и ограничен точным MIME, byte size, SHA-256 и 15 минутами; до чтения body сервер валидирует grant и применяет его индивидуальный byte limit. Pipeline проверяет filename, MIME/magic, checksum, baseline security signature, decode и decoded-pixel limits, нормализует orientation/color space и не переносит EXIF/GPS в публичные варианты. Original хранится только в private storage namespace; public endpoint отдаёт только variant текущего ready blob с immutable cache и `nosniff`.

`media_usages` является пересобираемым индексом ссылок из immutable CMS revisions, site-settings revisions и release payloads с точным JSON pointer. Archive всегда обновляет usage graph и блокируется при любом published usage; физическое удаление не выполняется. Текущий local storage adapter реализует provider-neutral boundary для development/test; production S3 provider, полноценный malware scanner и versioned blob replacement остаются обязательными deployment gates, а UI не имитирует их готовность.

## D-064 — Release-pinned listing engine и безопасные публичные профили

Публичный каталог разрешается только из `ListingDefinition`, закреплённого в materialized item активного immutable release. Вложенный definition получил отдельный общий strict schema: CMS может атомарно заменить его через bounded scalar patch, не открывая произвольный recursive JSON для остальных section configs. Public resolver принимает dynamic query keys только из опубликованного definition, отклоняет неизвестные sort/filter values, проверяет allowlist публичных полей, content hashes, eligibility CRM-source и добавляет UUID tie-breaker к детерминированной сортировке.

Первый production-shaped slice публикует только `resource` с `settings.showOnSite=true` и `program_template` со статусом `published`; archived records исключаются. Operational Event и occurrence не проецируются и fail closed, пока для них не появится отдельный утверждённый safe projection. Filter/sort/page query URLs получают `noindex, follow` и canonical на базовый CMS route; индексируемые curated combinations остаются самостоятельными CMS nodes.

Astro SSR получает только `PublicCardProjection`, а canonical `CatalogCard`, `ListingFilterBar`, ссылочная `Pagination` и `PublicProfileIntro` живут в `@crm/site-ui` и показаны в `/dev/site-ui-v2`. Profile fallback отображает только опубликованные CMS title/summary и lead CTA; он не выводит выдуманные availability, цену или operational Event data.

## D-065 — Runtime baseline Node 24

Локальная и CI-разработка проекта использует Node 24; workspace и API engines закреплены как `>=24.0.0 <25`. Старое ограничение Node 22 удалено из активного stack-документа и больше не является compatibility gate. Архивные записи Phase 4 сохраняют исторический контекст запусков на Node 24.

## D-066 — Public UI kit v2 строится только из consumers эталонной главной

Старая `/dev/site-ui` и связанный с ней v1 inventory признаны отклонённым миграционным артефактом и не являются источником canonical presentation. Чтобы не переписывать историю и не смешивать старые абстракции с восстановленной главной, файл и route v1 не редактируются; новая canonical галерея собирается отдельно на `/dev/site-ui-v2`.

Компонент попадает в v2 только по цепочке `эталонная разметка главной → export @crm/site-ui → реальный homepage consumer → v2 gallery → desktop/mobile pixel + interaction gate`. Простая токенизация локальной разметки не подтверждает компонентную миграцию. `component-inventory-v2.json` фиксирует для каждого export реальный consumer и gallery source, а architecture gate блокирует отсутствие любого звена. Screenshot baseline главной при этой миграции не обновляется; намеренные mobile card изменения D-044 сохраняются.

## D-067 — Source-locked foundations, blog SSR boundary и booking composition v2

Правило D-066 распространяется и на foundations: каждый primitive/composition обязан указать в `component-inventory-v2.json` существующие `sourceConsumer` и `sourceNeedle`. Architecture gate блокирует foundation без доказанного public-источника. Новая композиция может вводить только flow/state, но не собственный стиль поля, таба, кнопки, типографики или spacing. Calculator главной и v2 gallery используют одни `Tabs`, `Input` и `Button`; FAQ главной и gallery используют один `Accordion`.

Blog сохраняет SSR meaningful HTML, но собирается одной React island-композицией. Это уточняет Astro-first деталь D-044: передача Astro JSX как `children` в server-rendered React запрещена, потому что несовместимая renderer boundary оборвала HTML главной после площадок. Намеренное Blog-исключение по явному решению пользователя: без category badge, hover только через zoom изображения, круглая arrow-подложка на media, выровненный mobile gutter и compact rows с muted description/right action.

Resource-specific booking flow переиспользует controls/density калькулятора: `40px` controls, `12–13px` hierarchy, `sm/md` radii, muted surfaces, segmented controls и canonical Back/Next actions. Выбор ресурса не повторяется; availability/quote остаются server-authoritative, success подтверждает только регистрацию заявки. Desktop flow обязан помещаться без внутреннего скролла на `1280×720` и выше. Homepage baselines обновлены только после side-by-side сверки в изменённых Blog/Calculator/FAQ зонах; прочие interaction gates сохранены.

## D-068 — Единая платформа, SEO-first public frontend и управление документацией

Проект является единой платформой для свистоплясово.рф, а не тремя независимыми приложениями. Public site, CMS и CRM связываются typed contracts, safe projections, audit/outbox, notifications и cache/delivery events, сохраняя одного владельца каждого факта: CRM/backend — operational data, CMS — editorial/SEO/media/composition, public site — только published presentation и intake.

Public frontend проектируется SEO-first: meaningful server HTML, crawlable links/routes, canonical/schema/sitemap, performance и отсутствие draft/internal/PII leakage входят в acceptance gate. Публичная форма создаёт Lead и сквозное notification/audit событие, но не Booking.

Документация разделена по назначению: `AGENTS.md` маршрутизирует контекст; `07-phase-4-cms/IMPLEMENTATION-ROADMAP.md` хранит текущий долговременный план; профильные `logs/` — факты инкремента; корневой `IMPLEMENTATION_LOG.md` — краткую хронологию; `DECISIONS.md` — только долговременные решения. Параллельные случайные plan/status/log files не создаются.

## D-069 — Удаление отклонённой v1 public UI gallery

После import/removal-аудита старые `/dev/site-ui` route/island, v1 inventory, тест и snapshots удалены. Единственная поддерживаемая public UI gallery — `/dev/site-ui-v2`, а architecture gate проверяет только `component-inventory-v2.json`; renderer identifier `site-ui@1` сохраняется исключительно для совместимости CMS-контрактов.

## D-070 — Source-authored public pages, CMS editing и единый styling contract

CMS не становится универсальным drag-and-drop конструктором. Standard pages используют Astro template + typed CMS content/SEO/media; уникальные Codex/AI-композиции живут как allowlisted artifacts только в `apps/site/src/managed/**`. CMS по умолчанию редактирует manifest-declared fields и preview, а capability-gated code editor показывает/изменяет только связанный managed artifact через gated Git/build/release pipeline. CMS не хранит и не исполняет TSX/HTML из БД; active release владеет route/canonical/robots/schema/sitemap eligibility.

`@crm/site-ui` является единственным visual authority. Tailwind в page/managed code ограничен structural placement; palette/type/radius/shadow/component anatomy реализуются semantic tokens/classes и named variants. Несовпадающий существующий UI сохраняется отдельным variant и проходит real consumer → `/dev/site-ui-v2` → desktop/mobile regression. Component CSS использует Tailwind `components` layer, общая animation foundation поставляется kit-ом, а `[class*=...]` styling selectors запрещены.

## D-071 — Commercial offering и multi-surface single authority

Домики, кемпинги, допы, площадки, мероприятия под заказ и готовые программы получают общий CRM-owned `CatalogOffering` с typed binding к Resource/ResourceGroup/ProgramTemplate/EventServiceTemplate. Versioned PriceBook/RatePlan/PriceRule, BusinessCalendar, addon-offerings с typed assignment и backend Quote владеют календарными/праздничными/количественными тарифами; принятый Booking/Event/Registration хранит immutable calculation snapshot. Ручные weekday/weekend/holiday/date rules входят в v1, demand-based algorithmic pricing — нет. Клиентский operational `Event` остаётся отдельным от public EventServiceTemplate.

У authoritative поля может быть два UI entry point: CRM и CMS вызывают один application service, используют одну запись/версию/capability/audit и не синхронизируют копии. Operational поля не попадают в CMS revision; editorial fields из CRM редактируют ту же CMS draft revision. Active operational/pricing change обновляет safe public projection по своей activation/effective semantics, editorial change — только после CMS publication. `cms_source_links` не дают public eligibility; Event/ProgramOccurrence и customer/internal comments fail closed и не могут попасть в release без explicit allowlisted public offering/profile contract.

Основной CMS UX строится вокруг шести разделов `/offers/*`; generic categories/public profiles остаются technical diagnostics. Детальная модель, поля, UX и rollout зафиксированы в `07-phase-4-cms/OFFERING-CATALOG-ARCHITECTURE.md`.

## D-072 — P4.5A campground, calendar и reusable add-on semantics

Кемпинг не продаётся целиком: owned tents являются отдельными inventory resources/offers, а зона под палатки гостей — shared-capacity resource `own_tent_area` с настраиваемым числом мест (первичный ориентир около 15); одна палатка расходует одну capacity unit. Каждая локальная ночь считается отдельно.

Производственный календарь РФ даёт отдельный selector `calendar_holiday`; ручные цены на произвольные даты/диапазоны задаются отдельным более специфичным `custom_date_override`. Кейтеринг и другие допы образуют searchable library из `CatalogOffering(kind=addon)`; reusable и offering-specific записи не дублируют второй option-каталог, а typed assignment выбирает набор и stable rate-plan key без копирования цены. Lead-days rule опционален для early-booking/акций, вычисляется и фиксируется в server quote. Публичное предложение выбирает `exact | from | request`, но public v1 по-прежнему создаёт только Lead.

## D-073 — House pricing resolution, immutable quote и delivery checkpoints

Первый production-shaped pricing resolver ограничен `house + per_night`: каждая локальная ночь считается отдельно в timezone предложения. Победитель выбирается детерминированно по порядку `custom_date_override → calendar_holiday → day_class → any_date → base`, затем по числу дополнительных dimensions и priority; одинаковый полный rank блокирует активацию и runtime quote. Одно правило владеет base/extra override целиком, правила не каскадируются. Проживание через границу двух PriceBook в первом slice fail closed.

CRM Internal и CMS Admin являются двумя transport entry points одного `OfferingEditorApplicationService`, segmented pricing CAS, idempotency record, ChangeLog и Outbox transaction. Quote сохраняется append-only вместе с PriceBook/rule/calendar IDs и versions; повтор через другой surface возвращает первоначальный snapshot. Принятые Booking/Event/ProgramRegistration в следующем bounded increment должны ссылаться на этот snapshot без перерасчёта.

Outbox delivery отслеживается отдельно по consumer. Старое `outbox_events.processed_at` — только summary после подтверждения всех объявленных consumers; успех SSE не может отметить public projection доставленной. Legacy backfill начинается с read-only inventory: `showOnSite`/publication являются сигналами, а не eligibility, и неоднозначные Resource aliases/Program base-price semantics нельзя мигрировать автоматически.

## D-074 — Fenced delivery и provider-neutral offering projection epoch

Typed offering invalidation доставляется через единый consumer-scoped state machine с lease token/epoch, append-only attempts/replays, bounded retry и DLQ. `outbox_events.processed_at` остаётся только сводным признаком: событие закрывается после успеха всех объявленных consumers. Успех `public_projection` разрешён базой только после applied receipt; identity delivery и уже созданные generation/receipt неизменяемы.

Offering projection использует строго монотонный generation и идемпотентный cache-effect port. Встроенный адаптер повышает durable PostgreSQL `database_epoch`; production CDN/tag purge подключается к тому же порту после выбора провайдера и не создаёт второй checkpoint или authority. Этот runtime сам по себе не материализует public DTO и не разрешает operational данные наружу: safe offering projection/resolver остаётся отдельным P4.5E gate.

Ручной replay доступен только через Admin capability, проверяет наблюдавшиеся status + delivery epoch + attempts, имеет exact idempotency/hash semantics и оставляет append-only replay journal вместе с ChangeLog. Raw payload и raw provider error не входят в operator response. Hosting/CDN, stale-pricing SLO, retention, replay-role assignment и on-call/alerts остаются production deployment decisions.

## D-075 — Один offering editor и сегментированное сохранение в CRM/CMS

Каноническая identity operational editor — `CatalogOffering`; `Resource` остаётся fulfillment subject, а CMS node/revision — отдельным editorial owner. CRM и CMS используют один transport-neutral `@crm/offering-editor`, одинаковые route semantics `/offers/houses/:offeringId?tab=...` и один backend application service. Host-адаптеры различаются только Internal/Admin namespace, auth/capability chrome и navigation; копий offering/pricing state в CMS нет.

Первый house slice открывает только реализованные `overview` и `pricing`: full-replacement PriceBook draft с pricing CAS, exact idempotency и server-authoritative quote preview. Глобального Save между catalog, subject, pricing, add-ons и CMS revision нет; каждый owner segment сохраняется отдельно и обязан иметь собственные dirty/conflict/recovery semantics. Content/media/SEO/publication не отображаются до прямого `catalog_offering` editorial locator, bindings не становятся редактируемыми без authoritative subject lookup, а legacy `Resource.settings.showOnSite`, `cmsId` и description не приобретают authority.

## D-076 — Canonical offering editorial locator отделён от public eligibility

`CatalogOffering` связывается с одним canonical CMS node через расширение существующего `CmsSourceLink` значением `sourceKind=catalog_offering`. Существующие unique source и unique node дают one-to-one locator без второго registry и без обратной CMS-ссылки в operational aggregate. Route, slug и fulfillment binding не являются identity locator. Первый разрешённый mapping ограничен `house → resource_detail`; остальные offering kinds подключаются только вместе со своим strict CMS/public contract.

`CmsPublicProfile` не используется как locator и остаётся отдельным explicit publication/launch gate. Создание source link не даёт public eligibility, не создаёт profile/relation/release item и не эмитит public projection invalidation. Публикация offering-linked node fail closed без exact profile+relation, compatible active offering, safe public projection и release-pinned projection version/hash.

Legacy `resource` link можно атомарно promote на той же строке только если Resource является exact primary binding одного non-archived house offering. Неоднозначные кандидаты не меняются и попадают в reconciliation report. Ordinary UI не получает unlink/relink; исправление связи является отдельным audited repair flow.

## D-077 — Primary offer dossier переиспользует canonical CMS editor

CMS route `/offers/:kind/:offeringId` является primary dossier, но не вторым владельцем editorial state. Operational workspace и canonical content workspace переключаются на одном route, монтируя только один `EditorFrame`, один fixed action bar и один repository state за раз. CMS repository получает исключительно `CmsSourceLink.nodeId` из safe offering locator; `offeringId`, route и legacy `cmsId` не подменяют CMS identity. Контент, композиция, SEO, review и publication продолжают использовать существующий `ContentEditorPage`/`cmsRepository`, а operational editor не получает копий editorial полей.

Переход между owner segments проходит через dirty guard. Shared offering presentation даёт host-опциональный `onOpenEditorial(nodeId)` для same-app guarded navigation и сохраняет cross-app href fallback для CRM. CMS revision state хранится точно: `draft → review`, `review → draft | approved`; capability-gated actions не создают параллельный workflow. Наличие locator не ослабляет D-076: publish action показывает typed blockers и остаётся disabled до exact public profile/relation и P4.5E safe projection. Media без page-filtered usage query честно открывает canonical manager, а не имитирует локальную галерею.

## D-078 — Campground продаёт Resource, а ResourceGroup остаётся навигационным

`ResourceGroup(kind=campground)` группирует объекты и зоны, но не является sellable subject, primary binding или источником цены/availability. Наша палатка — отдельный `CatalogOffering(kind=campground)` с `owned_tent + discrete_inventory`, одним fixed primary Resource и активным membership role `owned_tent`; вместимость означает максимум гостей. Место под палатку гостя — отдельный offering с `own_tent_pitch + shared_capacity`, одним shared primary Resource и role `own_tent_area`; вместимость означает число палаточных мест, а цена каждой локальной ночи умножается на запрошенные units.

Subtype после создания не меняется. Database guards не позволяют привязать ResourceGroup, несовместимый capacity mode или Resource без единственного активного sellable membership. Quote preview проверяет форму quantities и статическую вместимость, но не обещает фактическую availability; campground snapshot сохраняется immutable с `operationalContext=null`, пока отдельный typed allocation/acceptance slice не реализован. CRM и CMS используют общий stay editor и один application service; canonical CMS locator разрешён, но публикация остаётся заблокированной до P4.5E safe projection.

## D-079 — Resource dossier является primary CRM IA для проживания

`Resource` и `CatalogOffering` сохраняют разные authority и версии, но больше не представлены оператору CRM как два независимых справочника. Для house/campground primary CRM entry point — `/resources/:kind/:resourceId`; вкладка «Продажа и цены» разрешает exact primary offering через read-модель `none | linked | ambiguous` и встраивает тот же transport-neutral offering editor без второго `EditorFrame`. Существующие Resource tabs и их визуальная анатомия не меняются. Старые stay registry routes остаются только compatibility redirects/deep links, а CMS сохраняет offer-first IA из D-077, потому что там dossier объединяет operational и editorial owners.

Обычный Resource может иметь не более одного выбранного primary stay offering на уровне application flow; legacy ambiguity никогда не разрешается выбором первой строки. Для состояния `none` CRM выполняет одну idempotent SERIALIZABLE-команду, которая из Resource создаёт draft `CatalogOffering`, typed campground terms при необходимости, primary binding и canonical `catalog_offering` CMS draft, затем пишет ChangeLog/Outbox. Команда требует ровно один active BusinessCalendar и для campground проходит существующие membership/capacity guards; при любой неоднозначности транзакция откатывается целиком. Глобальный unique по `resource_id` пока не вводится, чтобы не заблокировать будущие явно спроектированные pooled semantics и до отдельной reconciliation миграции.

## D-080 — Resource pricing имеет один operator-facing тариф

Для house и campground Resource CRM не показывает operator-facing `CatalogOffering`, binding, PriceBook и RatePlan. Вкладка «Продажа и цены» редактирует ровно одну default-цену: base за ночь, included guests и extra guest amount; own-tent pitch остаётся unit-priced. Legacy множественные plans fail closed, а разные operator-facing тарифы остаются для будущих program/event resolvers.

PriceRule допускает explicit `recurring_weekdays` с набором `mon…sun`; приоритет остаётся `custom period → calendar holiday → recurring weekday → base`. Booking не выбирает RatePlan: Internal/Admin resource-scoped preview exact-resolves одно active offering и server-side default plan, затем переиспользует единый immutable quote pipeline. CRM показывает major RUB, но transport/storage сохраняют integer minor units; discount UI переводит процент в monetary discount только на repository boundary. Привязка accepted BookingItem к `quoteId` остаётся отдельным acceptance step и не подменяется автоподстановкой цены.

## D-081 — UI показывает бизнес-dossier, а не CatalogOffering

`CatalogOffering`, `OfferingBinding` и `CmsSourceLink` остаются внутренними typed authority boundaries и не становятся самостоятельными operator-facing сущностями. Primary CRM dossier: Resource для house/campground/venue, `ProgramTemplate` для готовой программы и будущий `EventServiceTemplate` для публичного формата мероприятия. Создание hidden commercial identity, binding и canonical CMS draft входит в один guided user action; обычный UI не показывает manual link/relink.

Фактический customer `Event` не является public offer dossier: он хранит PII, дату, платежи, задачи и snapshot условий. CMS/public content привязывается к `EventServiceTemplate`, а не к `/events/:id`. Generic CMS public-profile routes остаются diagnostics/repair surface; primary navigation и cross-app deep links ведут в business-direction dossier.

## D-082 — CMS является editorial-only, а дерево — единый реестр страниц

CMS больше не является вторым operational entry point из D-070/D-075/D-077. Цена, вместимость, доступность, привязки, исполнение, тарифы, PriceBook lifecycle и технические версии показываются и изменяются только в CRM. CMS владеет содержимым, композицией блоков, медиа, SEO и публикацией; cross-app ссылка открывает CRM dossier, но не копирует его поля. Создание bookable business entity из CRM или CMS по-прежнему атомарно создаёт hidden commercial identity и canonical CMS draft, поэтому это одна сущность для пользователя, а не два синхронизируемых справочника.

`/content/tree` является единственным primary registry страниц сайта. Главная, посадочные, категории и offering-linked pages представлены в дереве типизированными узлами и открывают один editorial editor. Старые list routes и `/offers/*` остаются redirects/locator deep links, а public profiles, bindings и release internals доступны только как capability-gated diagnostics/repair, не как основная навигация.

Публичный сайт не читает цену из CMS revision. Он server-side объединяет опубликованную editorial release с allowlisted active CRM/backend projection по stable `offeringId`; изменение active operational price инвалидирует projection/cache независимо от CMS publication. Если безопасная цена недоступна или устарела, public UI fail closed показывает «по запросу», а не CMS fallback. D-082 уточняет UI-границу и заменяет CMS IA частей D-070, D-075, D-077 и последнего предложения D-079, не меняя их storage, CAS и public safety contracts.

## D-083 — Program offering отделён от ProgramRegistration acceptance

`ProgramTemplate` владеет сценарием, длительностью и границами участников; `CatalogOffering`/PriceBook — коммерческими условиями; `ProgramOccurrence` — фактическими датами и лимитами; `ProgramRegistration` — заказом клиента и будущим принятым snapshot. CMS владеет только editorial/SEO/publication. Для program pricing basis всегда задан явно: `per_person` умножает цену на участников, `flat_package` использует одну пакетную цену и допускает доплату сверх included quantity только когда included quantity и extra-unit amount заданы вместе. Количество участников не равно количеству регистраций.

Template preview является отдельным `quoteType=template_preview`, фиксирует server clock, template/subject/pricing/calendar/rule versions, currency/minor units, inputs, breakdown и bounded expiry. Он не резервирует capacity и имеет `acceptanceReady=false`. Runtime выбирает правило детерминированно по date specificity, затем constrained quantity/lead/duration dimensions и priority; равный лучший rank блокирует расчёт. Occurrence override может ссылаться только на совместимый active/scheduled rate plan exact program offering, но произвольные суммы и новые pricing rules не вводятся.

Canonical editorial mapping для программы — `catalog_offering(program) → program_detail`. Единственная допустимая legacy `program_template` связь promote-ится in-place с сохранением node/revision/path/history; неоднозначность блокирует операцию. `cmsReady` не означает `publicReady`: до отдельного safe public resolver программа остаётся закрытой наружу. Legacy `basePrice/published` не доказывают basis или CMS release, поэтому старые записи остаются review-only, а новые получают явный basis. Immutable occurrence-bound quote и его атомарное принятие ProgramRegistration являются отдельным следующим gate.
