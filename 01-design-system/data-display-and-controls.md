# Data display, controls и плотность

## Общие паттерны

- Важные и resource-иконки почти всегда с подложкой; категория/тип ресурса — цветная иконка + мягкая подложка того же семейства.
- `#ID` = номер заказ-наряда/операционной записи по контексту.
- Assignees: avatars `24×24`; при отсутствии — `+ Назначить`.
- Очевидные действия лаконизировать иконками; icon-only control обязан иметь tooltip/accessible name.
- «Гостей» обычно показывать person icon + число, а не словом.
- Карточки кликабельны.
- Табличные колонки сортируемы, если поле допускает полезную сортировку.
- Формат дат: `Завтра, 11:00` или `06 июл, 11:00`.
- Не вкладывать визуальные card-surfaces без необходимости: группы чаще разделять spacing/divider.

## Settings/filter bars

Desktop по умолчанию держать в одну строку:
- постоянно видны только частые/важные controls;
- второстепенное — Popover/Dropdown «Фильтры»/«Ещё»;
- однозначные действия — icon button + Tooltip;
- вид/масштаб/колонки — компактные controls справа.

Mobile:
- оставить 1–2 самых частых фильтра;
- остальные собрать в одну кнопку «Фильтры» с количеством активных.

## Типографика и размеры controls

Базовый контракт обязателен для shell и всех operational/editor-экранов:

- page/layout title — `14px / 600`;
- section/list title — `13px / 600`;
- рабочий текст строки и значение поля — `12–13px / 400`;
- field label — `12px / 500`;
- secondary metadata/helper — `10–11px / 400`;
- текстовая кнопка использует типографику shared `Button`: `13px / 400`; локальные переопределения размера/веса и ручная имитация кнопки без отдельной UX-причины запрещены;
- form controls (`Input`, `Textarea`, `FormSelect`, form-density `DatePicker`) используют значение `13px / 400`; однострочные controls имеют высоту `36px`;
- compact toolbar/filter controls (`FilterSelect`, compact `DatePicker`, icon actions) имеют высоту `32px`; их нельзя подставлять вместо form control внутри editor-поля;
- соседние controls одного semantic-уровня обязаны иметь одинаковую высоту, размер текста и border/radius независимо от primitive-типа.

Общие композиции: `EditorSection` для секций редактора, `FormField` для label/error anatomy, `FormSelect` для select-поля, `AssigneePicker` для назначения/смены исполнителя, `CommentThread` для формы нового внутреннего комментария и списка комментариев. Screen-local копии этих паттернов не допускаются. Действие секции (например, добавление позиции) передаётся через `EditorSection.actions`, а не собирается отдельной локальной шапкой.

## Таблицы

Нужны общие компоненты/паттерны:
- sortable header;
- main + secondary cell;
- sticky/scroll behavior;
- row actions;
- responsive fallback в cards там, где таблица на телефоне теряет смысл;
- column visibility/order позже как персональная настройка.

## Статусы и категории

Не смешивать:
- **category identity**: icon + category color;
- **status**: отдельный badge/text/shape/color;
- **payment state**: отдельная сущность отображения.

Цвет не должен быть единственным носителем статуса.

## Обязательные состояния компонентов

Default, hover, active/pressed, focus-visible, selected, disabled, loading, empty, error, success, dirty/saving, readonly, conflict, overflow/long-content, mobile/narrow container.
