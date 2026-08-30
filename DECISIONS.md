# DECISIONS

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

Бронь хранит nullable typed `sourceLeadId`, а не свободную текстовую подпись. Подпись и ссылка выводятся из заявки. В редакторах брони и заявки связь можно найти, добавить, открыть и снять через общий `ManualRelationPicker`; поиск индексирует `#ID`, цифры телефона, имя клиента и контекст записи. На frontend-этапе это fixture-демонстрация; backend должен добавить referential integrity, permissions и audit event.

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
