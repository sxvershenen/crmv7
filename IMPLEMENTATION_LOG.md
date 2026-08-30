# IMPLEMENTATION LOG

## 2026-08-23 — Phase 1 frontend foundation

- Создан pnpm workspace с `apps/crm` и `packages/ui`; настроены strict TypeScript, Vite, React Router, Tailwind CSS, ESLint, Vitest и Playwright.
- Официальным `shadcn` CLI decoded preset `bIkezqK`; decode сохранён в `packages/ui/preset/bIkezqK.json`. Generated `components.json`, theme, `cn` и primitives получены через временный Vite generator-project и перенесены в `packages/ui`.
- Добавлены semantic theme tokens, Roboto, Tabler product icons и CRM-compositions: IconBox, StatusBadge, Assignees, divider list sections, page states, loading rows, scheduler preview.
- Собран responsive shell: desktop sidebar/topbar, mobile topbar/bottom navigation/menu, command search (`Cmd/Ctrl+K`), create menu, notifications и profile actions.
- Собран `/` Dashboard с typed fixture repository boundary, URL-backed `Все/Мои`, настройкой блоков, clickable rows, demo-назначением, payment/status/people compositions и responsive ordering.
- Собран `/dev/ui`: foundations, primitives, forms, navigation/overlays, data display, states, editor chrome fragments и scheduler preview.
- Добавлены unit/component tests для repository/Dashboard и Playwright desktop/mobile smoke flows.
- Независимый QA-pass устранил декоративные focusable resize handles, активные no-op controls в editor preview, отсутствие focus restoration у mobile menu и потенциально активный AssigneeControl без обработчика.
- Повторно пройдены typecheck, lint, unit/component tests, production build и desktop/mobile Playwright; overflow и console errors на основных маршрутах не обнаружены.
- По визуальному фидбеку увеличены рабочие аватары, облегчены badge/status patterns, убраны status dots, переработаны editor save/conflict states, icon-only back, ширина editor summary sidebar и neutral scheduler presentation.
- Dashboard разбит на отдельные section surfaces; введён typed content summary для объекта бронирования/активности, а количество людей унифицировано как person icon + число.
- Regression после визуальных правок: typecheck, lint, 9 unit/component tests, production build и 4 desktop/mobile Playwright scenarios — успешно.
- Унифицированы 12px content typography и paddings Dashboard sections/rows; облегчены assignee controls, убран лишний booking label, добавлена reusable compact PaymentSummary/PaymentProgress с empty/unpaid/partial/full states.
- Dashboard rows переведены на font-normal 12px и единый vertical stack; resource summary упрощён до `ресурс · person count`, а payment пересобран как dark-fill bar с contrast-safe clipped text layers и preview 0/5/50/95/100%.

## 2026-08-23 — Phase 2 frontend: «Заявки»

- Route `/leads` заменён на полноценный CRM-экран: desktop Kanban/Table и отдельный compact card list для mobile.
- Добавлены typed Lead model, fixtures, `LeadRepository` boundary и `useLeads`; UI не импортирует fixture data напрямую.
- Scope, stage, view, маркетинговые фильтры и table sort хранятся в URL; все controls меняют реальный local demo-state.
- Добавлен `@dnd-kit/core`: pointer/keyboard DnD между статусами, accessible menu alternative, live announcements и явно помеченный one-time demo rollback без имитации backend authority.
- Карточки и строки показывают клиента, `#ID`, телефон, спокойное `Хотят:`, дату, assignees и person icon + count; добавлены overdue, loading, error, empty и long-content states.
- Добавлены 6 focused Leads repository/hook/component tests и Playwright desktop/mobile critical flows; typecheck, lint, 16 общих unit/component tests, production build и общий Playwright regression (6 passed, 2 profile skips) пройдены.

## 2026-08-23 — Phase 2 frontend: «Бронирования»

- Route `/bookings` заменён на полноценный экран с desktop Agenda/Scheduler/Table и отдельным mobile agenda/day flow.
- Добавлены typed Booking/Resource/Operation models, fixtures, строгий `BookingRepository` boundary и feature-hook с локальным optimistic interval update.
- Категория, вид, дата/диапазон, ресурс, источник, конфликт-фильтр и table sort хранятся в URL; bounded demo window обозначено честным sentinel с явной навигацией.
- Agenda сгруппирована по ресурсам, операции сортируются по времени, отменённые вынесены вниз и приглушены; quick booking ведёт на параметризованный create route.
- Scheduler использует вертикальные resource rows и горизонтальную часовую сетку без period-navigation через horizontal scroll; есть отдельные preparation blocks, dnd/resize preview, zoom и keyboard/touch menu alternative.
- One-time fixture conflict демонстрирует rollback после optimistic move, не выдавая client fixture logic за backend availability authority.
- Table получила полезную сортировку, shared dark PaymentSummary, assignees/actions; добавлены loading/error/empty/conflict/overflow states и focused unit/component/e2e tests.

## 2026-08-23 — Phase 2 frontend: «Клиенты»

- Route `/customers` заменён на полноценный CRM-экран: сортируемая desktop-таблица и отдельные compact mobile cards без горизонтальной таблицы.
- Добавлены typed Customer model/fixtures, строгий `CustomerRepository` boundary и `useCustomers`; UI не импортирует fixture data напрямую.
- Тип, канал, признаки active/debt/duplicates/archive, период последнего посещения и сортировка хранятся в URL; доступны точечное снятие фильтра и полный сброс.
- Таблица показывает клиента/телефон, заявки и активные, брони и будущие, задачи, оборот, долг, текстовый duplicate-risk, следующий контакт, 28px assignees и рабочие row actions.
- Mobile cards оставляют только имя, телефон, долг и 24px assignees, с отдельными 44px phone/action controls; карточки и строки ведут на честный placeholder `/customers/:id`.
- Добавлены loading/error/empty/long-content states, repository/hook/component tests и desktop/mobile Playwright flows.

## 2026-08-24 — Shared UI gate и operational compositions

- Через официальный `shadcn` CLI повторно проверен preset `bIkezqK` и добавлен generated `Calendar`; CLI добавил `react-day-picker`/`date-fns`, а generated-код получил только узкую strict-TypeScript поправку для `exactOptionalPropertyTypes`.
- В `packages/ui` добавлен общий operational layer: `PageFrame`, controlled `PageNav`/`ViewTabs`, slot-based `SettingsBar`, `FilterSelect`, `IconButton`, single/range `DatePicker`, `DateNavigator`, `DataTableShell`/`SortableHeader`/`MainSecondaryCell`/`RowActions` и `ClickableCard`.
- Жёсткий demo-only `SchedulerPreview` заменён на параметрические `SchedulerBookingBlock` и `PreparationBlock`: нейтральная surface, отдельный status accent, density по высоте и consumer-owned top/bottom resize slots без DnD-логики.
- `/dev/ui` переведён на реальные shared compositions: удалены локальные `SortableTable`/hardcoded scheduler и raw date inputs; добавлены controlled navigation/filter/date/view demonstrations и focused component assertions.
- В ESLint добавлен scoped architecture rule для `apps/crm/src/pages/**`: styled raw `button`/`input`/`select` запрещены; узкие documented escape hatches оставлены только для DnD handle, resize hitzone и route link overlay.

## 2026-08-24 — P0 shared UI rebuild: «Заявки»

- Leads переведён на shared operational compositions: titleless `PageFrame`, line `PageNav` по этапам, `SettingsBar`, generated `FilterSelect`, icon-only `ViewTabs`, `DataTableShell`/`SortableHeader`/`MainSecondaryCell`/`RowActions` и `ClickableCard`.
- Scope `Все/Мои/Просрочено` стал единственным select в settings; локальные segmented controls, `Все активные`, внутренний заголовок/subtitle и локальные view/filter/table controls удалены. На mobile вторичные select-фильтры собраны в generated `Sheet`.
- Desktop DnD использует всю карточку без grip-иконки и activation distance 8px; меню действий остаётся keyboard/touch альтернативой, optimistic rollback — за typed repository/hook boundary и сообщается через alert/live region без видимой demo-подсказки.
- Карточки desktop/mobile унифицированы: 12px normal content, muted content area без divider над телефоном, `ресурс · person + число`, neutral attention badge слева и 24px assignee справа. Table overdue представлен нейтральной icon/text-индикацией без danger field/row styles.
- Fixture direction `Мероприятия` синхронизирован с generated select; обновлены repository, component и desktop/mobile Playwright regressions на shared UI gate и новую анатомию.

## 2026-08-24 — P0 shared UI rebuild: «Бронирования»

- Bookings переведён на titleless `PageFrame`, line `PageNav`, `SettingsBar`, generated `DateNavigator`/`Calendar`/`FilterSelect`, icon-only `ViewTabs` и shared DataTable compositions; удалены внутренние create/quick/nearby-booking controls и raw date inputs.
- Scheduler полностью перестроен на вертикальную ось времени: Y-delta с часовым snap, `top/height` preview, отдельный двигающийся `PreparationBlock`, исходный ghost, invalid-preview/blocked commit и верхний/нижний `ns-resize` hitzone.
- Desktop показывает до трёх адаптивных resource lanes без горизонтального overflow и с generated resource selection/paging; mobile при явном `view=scheduler` сохраняет scheduler и показывает один выбранный ресурс, без скрытой подмены Agenda.
- Реализовано честное bounded fixture-окно предыдущий/выбранный/следующий день с day dividers и URL-синхронизацией даты; empty hour slots остаются route links на create page.
- Keyboard/touch альтернатива использует action menu + generated `Sheet`: раньше/позже, точные начало/окончание, ресурс, apply/cancel. One-time optimistic fixture conflict восстанавливает исходный интервал и ресурс.
- Обновлены fixtures, hook, component/repository tests и Playwright regression: shared gate, Calendar popover, Y geometry/preparation, lane overflow на 1024/1280/1680, mobile one-resource scheduler и rollback.
- Chrome visual QA выявил и устранил старт на пустом предыдущем дне: scheduler получил собственный вертикальный viewport и при открытии/смене даты позиционирует выбранный день у верхней границы, сохраняя controls страницы на экране. Контракт закреплён в Playwright.
- У горизонтальных `PageNav` line-tabs скрыт нативный scrollbar при сохранённой touch/trackpad прокрутке; mobile Leads и Bookings повторно проверены без горизонтального overflow.
- Финальный общий gate после visual QA: typecheck, lint, 35 unit/component tests, production build и Playwright (12 passed, 8 intentional profile skips) — успешно.

## 2026-08-24 — P0 shared UI rebuild: «Клиенты»

- Экран переведён на titleless `PageFrame`, `SettingsBar`, generated `FilterSelect`, `DataTableShell`/`SortableHeader`/`MainSecondaryCell`/`RowActions`, `ClickableCard`, `IconButton` и `Assignees`; локальные копии settings/table controls удалены.
- Desktop сохраняет URL-backed type/channel/flags/last-visit filters и сортировку всех осмысленных колонок; debt и duplicate risk показаны нейтрально, 12px normal weight, без danger-полей и тяжёлых badges.
- Mobile остался отдельным compact card flow: имя, телефон, долг, assignee и 44px phone/actions; desktop table не сжимается в карточку.
- `+ Назначить` получил active typed local handler с мгновенным обновлением desktop/mobile и live-region; все row/card/phone/menu actions выполняют реальное действие.
- Chrome visual QA на 1440×900 и 390×844 устранил horizontal scroll на обычном desktop, крэш Base UI checkbox-menu и недостаточный mobile hit-area; focused typecheck/lint/tests/build/e2e пройдены.

## 2026-08-24 — Phase 2 frontend: «Ресурсы»

- Добавлен единый strict route `/resources/:kind` для домиков, бани и чана, площадок и кемпинга; invalid category канонически перенаправляется на `/resources/houses`, а внутренний title/subtitle отсутствует.
- Экран собран на shared `PageFrame`, line `PageNav`, `SettingsBar` и generated `FilterSelect`; блокировка и предупреждения хранятся в URL, page-level create action отсутствует.
- Добавлены typed Resource model, fixtures, `ResourceRepository` boundary и `useResources`; мониторинговые агрегаты и shared-capacity приходят готовыми и не вычисляются из booking fixtures в UI.
- Добавлен shared `ActionableCard` для кликабельной surface с отдельными toolbar actions без вложенных interactive controls, а `IconBox` и theme получили четыре независимых resource-category tone.
- Карточки используют 12px normal content, divider-секции, person icon для вместимости, compact warning и accessible generated Progress только для explicit `capacity.mode="shared"`.
- Resource-scoped действие блокировки показано как disabled control с объяснением до определения interval/day/open-ended semantics; карточка и действие «Открыть ресурс» ведут на честный route placeholder.
- Добавлены repository/component/navigation и desktop/mobile Playwright acceptance checks, включая canonical redirect, URL filters, отсутствие page create, single-column mobile и horizontal overflow guard.

## 2026-08-24 — UX correction pass: Dashboard, Leads и Bookings

- Dashboard select получил белую surface; общий payment progress переведён на светлый `oklch(0.95 0 0)` track и серый fill с contrast-safe clipped text layers.
- `SettingsBar` и navigation tabs получили симметричные отступы; compact view switch переведён с line-tabs на обычные tabs. Кнопки «Фильтры»/«Признаки» и global Create унифицированы по высоте, `12px` и normal weight.
- В Leads добавлен явный таб «Все»; stage-колонки используют цветной dot вместо верхней обводки. Карточки избавлены от внутренней muted-surface и лишнего правого padding, secondary-информация приглушена, assignees стоят слева, attention — справа.
- Leads DnD переведён на portal `DragOverlay` поверх колонок; активная колонка показывает явный destination placeholder, а keyboard/touch menu остаётся альтернативой.
- Scheduler cards получили непрозрачные status-tinted surfaces, badge-like borders, status-tinted secondary text, `p-3.5`, встроенный action slot без перекрытия `#ID` и compact one-hour anatomy. Preparation выровнен по ширине и упрощён до icon + text.
- Scheduler resource headers получили category `IconBox`, строка `занято X / Y` и zoom удалены. Desktop lane count адаптивен от 1 до 5, mobile сохраняет одну lane; selector вынесен вправо от category navigation, в settings используется resource pager.
- Реализован двунаправленный вертикальный scroll со скользящим окном из пяти дней и сохранением scroll anchor; пустой scheduler не исчезает и сохраняет create-slots. Исправлено позиционирование выбранного дня относительно внутреннего viewport.
- Chrome QA выполнен на desktop `1440×900` и mobile `390×844`: Dashboard colors, Leads anatomy, Agenda density, Scheduler lanes/cards/preparation, bounded day window и отсутствие horizontal overflow подтверждены.
- Финальный regression gate: typecheck, lint, 45 unit/component tests, production build и Playwright desktop/mobile — успешно.

## 2026-08-24 — UX correction pass: Scheduler, Agenda и Leads cards

- Divider выбранного дня Scheduler унифицирован с остальными серыми day dividers; отличие оставлено только за цветным `выбранный день` badge.
- Для confirmed/paid/pending/neutral/conflict Scheduler cards поверхность, border, foreground и status badge сведены к одним semantic tone-токенам. Resize handles используют текущий status color, action-кнопка наследует цвет карточки и не имеет белой surface или тени.
- Resource select получил белый trigger, end-aligned popover с ограничением по viewport и единое место справа от category tabs на desktop/mobile; дублирующий mobile control удалён.
- Agenda избавлена от неоднозначного `занято X / Y`: resource headers усилены category `IconBox` и отдельной surface, operations уплотнены до непрерывных divider-строк без нижних зазоров.
- Lead card перестроена в grid `content | 32px rail`: action, вертикальные 24px assignees или круглый `+`, затем icon-only tinted attention. Локальное demo-назначение ответственного работает и сообщает изменение assistive technologies.
- Chrome QA на `1440×900` и `390×844` подтвердил совпадение computed colors карточек и badges, отсутствие clipping у resource popover, single-lane mobile Scheduler, правый rail Leads и отсутствие horizontal overflow/console warnings.

## 2026-08-24 — Phase 2 frontend: «Программы»

- `/programs` реализован как frontend-only экран с URL-backed разделами `Шаблоны`, `Проведения`, `Регистрации`; шаблон является переиспользуемой основой, а каждое проведение — отдельной сущностью с датой, участниками, статусом и финансовыми показателями.
- Добавлены typed ProgramTemplate/ProgramRun/ProgramRegistration/ProgramCategory models, fixtures, repository boundary и feature-hook с локальными status mutations без имитации backend authority.
- Шаблоны, проведения и регистрации получили сортируемые desktop tables и отдельные compact mobile cards; filters, section, view, period, date range и sort синхронизированы с URL.
- Для проведений добавлено date-centric расписание на 3 дня/неделю без resource lanes; mobile показывает один день и не сжимает desktop table.
- Управление категориями вынесено на отдельный route `/programs/categories` с category icon/color presentation и route-driven create/detail placeholders.
- Финальный frontend regression gate: typecheck, lint, 56 unit/component tests, production build и Playwright `20 passed / 14 intentional profile skips`; Chrome desktop/mobile QA — без overflow и ошибок консоли.

## 2026-08-24 — Programs identity и responsibility correction

- Identity шаблонов, проведений и регистраций унифицирована как `[category IconBox][stack: title + secondary]`; secondary больше не начинается под иконкой.
- В table, mobile cards и scheduler ответственный объединён со статусом в одну строку и всегда расположен слева; отдельные дальние колонки ответственных удалены.
- Shared `Assignees` получил compact `emptyVariant="icon"`: круглый `24×24` `+` с entity-specific accessible label. Назначение проходит через typed repository/hook и live announcement.
- Chrome QA на `1440×900` и `390×844` подтвердил иерархию identity, status/assignee order, mobile one-day scheduler и отсутствие overflow; дополнительно уплотнены заголовки таблицы шаблонов.

## 2026-08-24 — Phase 2 frontend: «Мероприятия»

- `/events` реализован как frontend-only operational screen с URL-backed статусами `Все / В работе / Бронь / Завершено / Отмена / Архив`, счётчиками, сортировкой, диапазоном и фильтрами ближайших/требующих действия/неоплаченных/конфликтных, типа и ответственного.
- Мероприятие является самостоятельной сущностью; тип `Выездная программа` заменён на `Выездное мероприятие` и не связан с ProgramRun.
- Добавлены typed Event/EventCategory models, fixtures, repository boundary и hook с локальными status/assign mutations без имитации backend authority.
- Реализованы sortable desktop table, отдельные mobile cards и date-centric scheduler на 3 дня/неделю; mobile показывает один день, а пустой период сохраняет day columns.
- Identity использует `[category IconBox][title + secondary]`; avatar или круглый assign `+` стоит слева от быстрого статуса во всех представлениях. Денежные показатели используют shared серый `PaymentProgress`.
- Управление категориями вынесено на `/events/categories` с route-driven create/detail placeholders; самостоятельный create route — `/events/new`.
- Chrome QA на `1440×900` и `390×844` устранил desktop table overflow и подтвердил mobile cards/scheduler, назначение, payment colors, category route и отсутствие console warnings.
- Финальный общий gate: typecheck, lint, 66 unit/component tests, production build и Playwright `22 passed / 16 intentional profile skips` — успешно.

## 2026-08-24 — Phase 2 frontend: «Задачи»

- Route `/tasks` заменён на полноценный frontend-only экран с URL-backed разделами `Дашборд / Канбан / Таблица / Проблемы / Архив`, фильтрами исполнителя, приоритета, типа связи и порядка.
- Добавлены typed Task model, fixtures, `TaskRepository` boundary и `useTasks`; локальные назначение, смена статуса и архивирование проходят через repository без имитации backend authority.
- Dashboard показывает просроченные/сегодня/мои открытые/выполненные, фокус очереди и нагрузку команды; Kanban сохраняет четыре рабочих статуса, table поддерживает полезную сортировку, быстрое завершение и раскрытие комментария.
- `Проблемы` автоматически собирают просроченные, заблокированные и неназначенные задачи; mobile использует отдельный компактный одноколоночный список с 24px assignees и рабочими actions.
- Добавлены repository/component и desktop/mobile Playwright проверки. Browser QA на `1440×900` и `390×844` подтвердил отсутствие horizontal overflow в dashboard, Kanban, table и mobile cards, а также отсутствие console warnings.
- Regression gate: 76 unit/component tests, typecheck, lint, production build и focused Playwright `3 passed / 1 intentional profile skip` — успешно.

## 2026-08-24 — Tasks consistency correction

- Kanban задач переведён на общие `KanbanBoard`/`KanbanColumn`/`KanbanDropPlaceholder`, уже применённые в заявках; заявки также переведены с локальной разметки на эти shared compositions.
- Desktop Kanban задач получил pointer/keyboard DnD всей карточкой, `DragOverlay`, явную destination-зону и live announcements; mobile сохранил отдельный список с menu-альтернативой смены статуса.
- Четыре сухих счётчика Dashboard заменены на информативные shared `SummaryMetric` с вторичным контекстом; «Фокус очереди» и «Нагрузка команды» используют тот же `ListSection`/`ListRow`, что и обзор CRM.
- Focused regression Leads/Tasks: 76 unit/component tests, typecheck, lint, production build и Playwright `7 passed / 5 intentional profile skips`; browser QA на `1440×900` подтвердил четыре DnD-колонки, shared section anatomy и отсутствие overflow.

## 2026-08-24 — Phase 2 frontend: «Финансы»

- `/finance` заменён на frontend-only operational screen с URL-backed разделами, диапазоном, быстрым периодом, типом операции, способом оплаты, возвратами и сортировкой реестра.
- Добавлены typed finance entities/fixtures, `FinanceRepository` boundary и feature-hook; сводные показатели вычисляются за repository boundary без имитации authoritative бухгалтерской логики.
- Реализованы семь shared `SummaryMetric`, динамика начислений/оплат, ближайшие ожидаемые платежи и разрезы через `ListSection`/`ListRow` и единый `PaymentProgress`, sortable desktop registry и отдельные mobile cards.
- Mobile получил отдельный bottom Sheet для финансовых фильтров; сетка показателей адаптируется по фактической ширине, не обрезая названия и суммы.
- Browser QA на `1440×900` и `390×844` подтвердил читаемость метрик, работу mobile filter sheet, отсутствие horizontal overflow и console errors.
- Финальный общий gate: typecheck, lint, 82 unit/component tests и production build; focused Leads/Tasks/Finance Playwright — `10 passed / 6 intentional profile skips`.

## 2026-08-24 — Finance consistency and analytics correction

- Mobile finance operations переведены на тот же shared `EntityCardLayout`/`EntityCardRail`/`EntityCardAssignees`, что и заявки: `12px`, четыре icon-row, единая кнопка действий и вертикальные `24px` avatars.
- KPI собраны в shared `SummaryMetricStrip`: на mobile snap-scroll с видимой частью следующей карточки, подсказкой и индексом, на desktop читаемая grid без обрезания названий.
- Самодельные bar columns удалены; официальный generated shadcn `Chart` поверх Recharts используется для area/line dynamics. Раздел «Динамика» получил отдельные графики начислений/оплат, долга/возвратов, собираемости и количества оплат.
- Разрезы направлений стали контекстными: ресурсы для домиков/бани/площадок/кемпинга, категории для программ/мероприятий, отдельный источник-разрез.
- Реестр получил repository-level pagination после фильтрации/sort и URL-backed `page`; переходы между страницами не сбрасывают остальные параметры.
- Visual QA на `1440×900` и `390×844` подтвердил KPI swipe `1/7 → 2/7`, одинаковую анатомию карточек, четыре dynamics charts и отсутствие overflow/console errors.
- Официальные generated shadcn `Chart` и `Pagination` добавлены CLI; Recharts вынесен в отдельный production chunk без circular chunk warnings.

## 2026-08-24 — Phase 2 frontend editors: заявка

- Добавлены shared `EditorFrame` и `FormField`; editor chrome включает sticky topbar/navigation, desktop main+sidebar, mobile single column и sticky bottom save bar.
- Placeholder `/leads/:id` заменён на редактор заявки; `/leads/new` использует тот же route. Основные данные, запрос, диапазон дат, комментарии, status/source sidebar и все допустимые поля доступны сразу.
- Вкладки `Основное / Коммуникации / Задачи / Брони / Маркетинг / История` хранятся в URL; save проходит через расширенный typed `LeadRepository` fixture boundary и показывает dirty/saving/saved/conflict.
- Mobile QA выявил и устранил переполнение bottom action bar; итоговая ширина страницы совпадает с viewport, панель стоит над bottom navigation.
- Финальный общий gate: typecheck, lint, 88 unit/component tests и production build; focused Finance/Leads/editor Playwright — `10 passed / 4 intentional profile skips`.

## 2026-08-24 — Shared editor consistency и редакторы клиента, задачи, бронирования

- Editor identity перенесена в global topbar; status и overflow объединены с URL-backed tabs, а mobile получил status рядом с identity, gradient fade навигации и фиксированный overflow. Bottom action bar закреплён к viewport над mobile navigation.
- Добавлены общие `EditorSection`, `FormField`, `FormSelect`, `AssigneePicker` и `CommentThread`; типографика кнопок, labels, input/select/textarea и section headers сведена к единому контракту.
- Placeholder-маршруты клиентов и задач заменены route-driven редакторами с dirty/saving/saved/conflict state и typed repository boundaries.
- `/bookings/:id` и `/bookings/new` получили редактор брони с составом, комментариями, маркетингом, оплатами/возвратами и scheduler presets; расширенный editor DTO изолирован от плоской scheduler/table-модели.

## 2026-08-24 — Phase 2 frontend editor: ресурс

- Placeholder `/resources/:kind/:resourceId` заменён общим route-driven editor; route `new` поддерживается той же страницей.
- Реализованы URL-backed вкладки `Основное / Расписание / Блокировки / Правила / История`, activity status в editor chrome и fixed save bar.
- Основное содержит общее превью `ResourceIdentityIcon`, выбор иконки/цвета, направление, тип, вместимость, описание, публикацию и CMS ID; площадки получают отдельный тип пространства.
- Блокировка с monitoring card ведёт прямо на `?tab=blocks`; форма создаёт интервал с причиной, список поддерживает отмену. Правила используют пустые значения как «не настроено» и не имитируют серверную availability-логику.
- Расширенный `ResourceEditorRecord` изолирован за `ResourceEditorRepository`; list cards продолжают использовать компактную `Resource`.
- Browser QA выполнен на desktop `1280×800` и mobile `390×844`: shared chrome, tabs fade, fixed bottom bar, rules layout и отсутствие horizontal overflow подтверждены.
- Финальный gate: typecheck, lint, 107 unit/component tests, production build и Playwright `42 passed / 20 intentional profile skips` — успешно.

## 2026-08-24 — Phase 2 frontend editor: шаблон программы

- Placeholder `/programs/:id` заменён route-driven редактором шаблона; `/programs/new` использует ту же страницу и создаёт черновик.
- Реализованы shared editor chrome и URL-backed вкладки `Основное / Наполнение / Проведения / Настройки / История`, статус публикации в chrome, operational sidebar без его дублирования и fixed bottom action bar.
- Основное получило identity preview, выбор иконки/цвета/категории и параметры участия. В наполнении есть быстрое добавление и редактируемые этапы с pointer/keyboard DnD, кнопками вверх/вниз, дублированием и удалением.
- Расширенный `ProgramTemplateEditorRecord` изолирован за `ProgramTemplateEditorRepository`; список продолжает работать с компактным `ProgramTemplate`, а связанные проведения остаются fixture snapshot до backend.
- Desktop/mobile browser QA на `1280×800` и `390×844` подтвердила tab/status chrome, фиксированную нижнюю панель, читаемую компоновку этапов и отсутствие горизонтального overflow.
- Финальный gate: typecheck, lint, 113 unit/component tests, production build и Playwright `45 passed / 21 intentional profile skips` — успешно.

## 2026-08-24 — Phase 2 frontend editor: проведение программы

- Placeholder `/programs/runs/:id` заменён общим route-driven editor; `/programs/runs/new` поддерживает создание из выбранного шаблона через query `template`.
- Реализованы URL-backed вкладки `Основное / Регистрации / Ресурсы / Задачи / История`, быстрый статус в editor chrome, назначение ответственного, mobile overflow и fixed bottom action bar.
- Форма регистрации поддерживает клиента, участников, стоимость/скидку/оплату, промокод, источник, комментарий и статус; список показывает единый payment progress и быстрые действия. На mobile форма сворачивается, сохраняя список участников выше по странице.
- Вкладка ресурсов создаёт editor-only связь-заготовку и открывает предзаполненный `/bookings/new`; sidebar показывает два progress-bar заполняемости и выручку через shared `PaymentProgress`.
- `ProgramRunEditorRecord` и детальные регистрации изолированы за `ProgramRunEditorRepository`; frontend mutation остаётся fixture snapshot до серверной проверки цен, мест, оплат и конфликтов.
- Browser QA на `1280×800` и `390×844` подтвердила плотность desktop-формы, компактный mobile flow, tab fade, fixed action bar и отсутствие horizontal overflow.
- Финальный gate: typecheck, lint, 119 unit/component tests, production build и Playwright `47 passed / 21 intentional profile skips` — успешно.

## 2026-08-24 — Phase 2 frontend editor: регистрация на программу

- Placeholder `/programs/registrations/:id` заменён shared route-driven editor; `/programs/registrations/new?run=...` создаёт регистрацию с контекстом выбранного проведения.
- Реализованы URL-backed вкладки `Основное / Участники / Оплата / Коммуникации / История`, быстрый статус, назначение ответственного, mobile overflow и fixed save bar.
- Основное связывает клиента с проведением; состав группы вынесен отдельно. Добавлен статус `Посетил`, не смешанный с состоянием оплаты.
- Финансовая вкладка использует shared `PaymentProgress`, поддерживает локальные оплаты/возвраты и не форсирует status transition. Коммуникации используют shared `CommentThread`.
- `ProgramRegistrationEditorRecord` изолирован за `ProgramRegistrationEditorRepository`; payment operations, comments и participant details не протекают в компактный реестр.
- Browser QA на `1280×800` и `390×844` подтвердила плотность основных/финансовых форм, mobile tab fade, fixed bottom bar и отсутствие horizontal overflow.
- Финальный gate: typecheck, lint, 125 unit/component tests, production build и Playwright `49 passed / 21 intentional profile skips` — успешно.

## 2026-08-24 — Phase 2 frontend editor: мероприятие

- Placeholder-маршруты `/events/:id` и `/events/new?category=...` заменены shared route-driven редактором мероприятия.
- Реализованы URL-backed вкладки `Основное / Ресурсы / Сценарий / Коммуникации / Задачи / История`, быстрый статус, назначение ответственного, mobile gradient fade и fixed bottom action bar.
- Основное содержит category identity, клиента, время, гостей, финансовые суммы, комментарий и признак внимания. Sidebar не дублирует статус и показывает operational summary с единым `PaymentProgress`.
- Ресурсы создают editor-only связь-заготовку с переходом в предзаполненный редактор брони. Сценарий поддерживает добавление, редактирование, дублирование, удаление, кнопочную перестановку и pointer/keyboard DnD.
- Программные и event-сценарии сведены к общей композиции `OrderedStageList`; компактный `CrmEvent` изолирован от editor-only данных за `EventEditorRepository`.
- Browser QA на `1280×800` и `390×844` подтвердила desktop main/sidebar, mobile tab fade, fixed action bar, DnD-список и отсутствие horizontal overflow.
- Финальный gate: typecheck, lint, 131 unit/component tests, production build и Playwright `52 passed / 22 intentional profile skips` — успешно.

## 2026-08-24 — Phase 2 frontend editors: категории программ и мероприятий

- Четыре placeholder-route категорий заменены route-driven редакторами: detail/new для программ и мероприятий.
- Оба домена используют общий `CategoryEditor` с live icon preview, generated form controls, URL-backed `Основное / Связанные`, sidebar summary, mobile overflow/fade и fixed save bar.
- Вкладка связей открывает шаблоны или мероприятия в существующих редакторах; меню карточек категорий больше не содержит заглушку «появится позже».
- `ProgramCategoryEditorRepository` и `EventCategoryEditorRepository` изолируют related snapshots от compact category и синхронизируют presentation связанных fixture-сущностей без имитации серверной referential integrity.
- Browser QA на `1280×800` и `390×844` подтвердила одинаковую анатомию обоих доменов, sidebar `320px`, mobile gradient fade, action bar над bottom navigation и отсутствие horizontal overflow.
- Финальный gate: typecheck, lint, 137 unit/component tests, production build и Playwright `54 passed / 22 intentional profile skips` — успешно.

## 2026-08-24 — Phase 2 frontend: отдельное расписание ресурсов

- Навигационный route `/schedule` перестал попадать на wildcard-placeholder и открывает существующий operational `VerticalScheduler` по умолчанию.
- `BookingsPage` получил конфигурируемый default view: `/bookings` сохраняет Agenda, `/schedule` — Scheduler; явный `view` в URL имеет приоритет и переключается без редиректа между разделами.
- Scheduler data, DnD/resize, conflict rollback, filters, date navigation и mobile single-lane adaptation не дублировались и продолжают использовать один repository/hook boundary.
- Browser QA на `1280×800` подтвердила активный sidebar route и три resource lanes; на `390×844` — одну выбранную lane, корректную панель управления и отсутствие horizontal overflow.
- Финальный gate: typecheck, lint, 138 unit/component tests, production build и Playwright `56 passed / 22 intentional profile skips` — успешно.

## 2026-08-30 — Phase 2 stabilization и UX improvements

- Глобальный `Cmd/Ctrl+K` расширен до typed cross-entity поиска: клиенты, заявки, брони, ресурсы, программы, мероприятия, задачи и команда ищутся по `#ID`, нормализованному телефону, e-mail, имени и ресурсу через `GlobalSearchRepository`.
- `ManualRelationPicker` получил группы `точное совпадение / похожие / недавние`, причины, risk tooltip и shortcut `⌥L`; заявка↔бронь остаётся ручным fixture-сценарием без имитации backend authority.
- Shared `Assignees` и `EntityCardAssignees` показывают `+N` после трёх аватаров и tooltip с полным списком ответственных.
- Добавлен shared `OperationalSummary`: на mobile детали сворачиваются, а риск дубля/конфликт и долг остаются видимыми; паттерн подключён к клиенту, брони, мероприятию, проведению и регистрации.
- `/team?section=workload` объясняет относительную шкалу нагрузки и явно показывает готовность данных графика/отпуска без выдумывания доменных правил.
- Устаревшая wildcard Phase 2 placeholder заменена на честную 404; активные no-op controls профиля/команды/интеграций переведены в явные disabled states.
- Финальный gate: typecheck, lint, 148 unit/component tests, production build и Playwright `56 passed / 22 intentional profile skips` — успешно.

## 2026-08-30 — Phase 2 architecture closure: directory boundary и forms pilot

- Добавлен `DirectoryRepository` с узкими typed lookup-проекциями клиентов, заявок, броней, ресурсов и scope-aware ответственных; fixture adapter изолирован в data layer.
- Все 16 прямых production-импортов fixtures удалены из девяти page-файлов. Settings использует существующий `WorkspaceRepository.listTeam()`, cross-entity editor data — кэшируемый async directory hook.
- Создание новой брони ждёт загрузки directory snapshot, поэтому default resource/customer context больше не зависит от module-level fixture constants.
- `CategoryEditor` переведён на React Hook Form + Zod через presentation schema и DTO↔form mapper; inline validation использует shared `FormField.error`, а успешный repository response становится новым form baseline.
- Добавлены unit-тесты directory boundary и whitespace-валидации без вызова save; общий suite вырос до 150 тестов.
- Browser QA на desktop подтвердила компактную inline-ошибку и отсутствие overflow; на `390×844` новый booking draft получил ресурс из async directory и сохранил mobile composition/fixed action bar.
- Финальный gate: typecheck, lint, 150 unit/component tests, production build и Playwright `56 passed / 22 intentional profile skips` — успешно.

## 2026-08-30 — Phase 2 forms migration: редактор задачи

- `/tasks/:id` переведён с page-local draft updates на React Hook Form + Zod с отдельными DTO↔form mapper и `TaskEditorRecord`.
- `reminderMinutes` изолирован как editor-only поле: fixture repository сохраняет его в editor snapshot, но не протекает в компактную list-модель `CrmTask`.
- Добавлена inline-валидация обязательного названия, даты и неотрицательного напоминания; невалидная форма не вызывает repository save, а пустой рабочий заголовок не стирает editor identity.
- Спецификация навигации закрыта отдельной URL-вкладкой `?tab=relations`; sidebar оставлен компактной операционной сводкой без второй редактируемой формы связи.
- Browser QA на `1440×900` и `390×844` подтвердил desktop/mobile composition, fixed action bar, validation state и отсутствие устойчивого horizontal overflow; ширина mobile status control скорректирована по найденному пограничному переполнению.
- Финальный gate: typecheck, lint, 151 unit/component test, production build и Playwright `56 passed / 22 intentional profile skips` — успешно.

## 2026-08-30 — Public site foundation: Astro-first migration

- Шаблон `/Users/a1111/Downloads/website` перенесён в новый workspace `apps/site` без изменения исходника; monorepo получил команду `pnpm dev:site`.
- Внедрён Astro 7.2.9 static output с русским документом, canonical, OG/Twitter metadata, безопасным `WebSite` JSON-LD, `robots.txt`, sitemap и отдельным `/privacy` route-заполнителем до утверждения юридического текста.
- Монолитный React root заменён независимыми islands. Navigation/hero загружаются сразу, тяжёлые секции — при появлении во viewport, floating helper — в idle; все секции prerendered в HTML. Межостровные действия изолированы typed CustomEvent boundary.
- `WhyUsSection`, `PartnersMarquee` и `Footer` перенесены в чистые Astro-компоненты. Общие Tailwind 4 стили, Inter и точные классы/DOM исходного шаблона сохранены; desktop/sidebar и mobile layout визуально не перепроектировались.
- Локальные данные выделены в site-local content fixture; будущий content source/public API не связан с CRM fixtures или внутренним API. Демонстрационный калькулятор не считается authoritative бронированием.
- Gate нового сайта: Astro check `0 errors / 0 warnings / 0 hints`, ESLint, production build. Browser QA на `1440×900` и `390×844` подтвердил исходную композицию, отсутствие horizontal overflow, работу sidebar collapse и booking modal; console errors отсутствуют.
