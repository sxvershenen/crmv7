# Component inventory CRM

Это **краткая выжимка потребностей всех экранов**. Для проектирования дизайн-системы читать её вместо всех `02-screens/*`.

## Foundations

- typography + secondary text;
- spacing/layout scale;
- border/divider/radius/surface tokens;
- semantic colors: neutral/info/warning/danger/success + category palette;
- focus/disabled/loading/readonly/dirty/conflict states;
- responsive container/grid rules.

## Icons & identity

- IconBox: иконка на подложке;
- CategoryIcon/CategoryTag: icon + configurable category color;
- StatusBadge;
- PaymentStatus/PaymentProgress;
- Attention/Conflict indicator;
- icon-only action button + Tooltip.

## People

- Avatar `24×24`;
- AvatarGroup;
- AssigneeControl: avatars / `+ Назначить`;
- person icon + guests/count.

## Navigation & controls

- AppSidebar;
- Topbar;
- MobileBottomNav;
- PageNav / section tabs;
- SettingsBar / FilterBar;
- SegmentedControl (Cards/Table, Agenda/Scheduler/Table etc.);
- DateNavigator `[<] [picker] [>]`;
- period/zoom controls;
- Search/Command palette;
- Dropdown/Popover filters;
- saved-view selector later.

## Data display

- ClickableCard;
- ListSection + Divider rows;
- ListRow with left/main/right slots;
- Counter;
- main + secondary cell;
- sortable DataTable header;
- row actions;
- responsive CardList fallback;
- KPI/stat card;
- ProgressBar;
- mini financial metric;
- timeline/history row;
- comment/communication row;
- payment operation row;
- empty/error/loading/skeleton states.

## Kanban

- KanbanBoard/Column;
- column header: color dot + title + counter + overdue badge;
- draggable lead/task/event card;
- mobile card-list alternative;
- drag preview / rollback/error state.

## Scheduler / Agenda

- VerticalScheduler;
- day separator;
- resource group/header;
- scheduler booking card;
- top/bottom resize handles;
- drag/resize time preview;
- preparation block;
- conflict state;
- capacity/progress resource;
- AgendaResourceBlock;
- AgendaOperationRow;
- zoom/period controls.

## Forms

- FormSection with divider-based grouping;
- Label/Hint/Error;
- Text/Phone/Email;
- Number/Stepper;
- Money;
- Select/Combobox;
- Date/Time/DateTime/Range;
- Textarea;
- Switch/Checkbox/Radio;
- IconPicker + ColorPicker;
- client/resource/program search-select;
- inline status fast-change;
- comment composer;
- payment composer;
- repeatable item/card editor;
- reorderable stages/items.

### Field sizing is semantic

Не растягивать все controls до одной ширины.

Ориентир:
- `compact`: guests, quantity, duration, percent, short amount modifiers;
- `short`: time, status, small enum;
- `medium`: phone, date, resource, assignee;
- `wide`: client/program search, title, email;
- `full`: message, description, comment.

Grid должен учитывать ожидаемую длину значения. Поле «2 гостя» визуально не должно занимать ширину телефона или имени только потому, что оно находится в той же форме.

## Editor page

- EditorTopbar;
- EditorTabs;
- EditorMain;
- EditorRightSidebar;
- EditorBottomBar;
- SaveStateIndicator;
- dirty/error/conflict presentation;
- collapsible/stacked mobile adaptation.

## Domain compositions

Нужны переиспользуемые composition-level компоненты, а не отдельные вариации для каждого экрана:
- ClientIdentity;
- BookingIdentity;
- ResourceIdentity;
- Assignees;
- MoneySummary;
- DateTimeSummary;
- StatusControl;
- EntityLink;
- MarketingSource/UTMSummary;
- RiskIndicator.
