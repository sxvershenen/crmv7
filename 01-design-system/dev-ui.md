# `/dev/ui` — страница предпросмотра дизайн-системы

Цель: визуально проверять компоненты независимо от бизнес-экранов.

## Обязательно показать

- typography scale, text colors, surfaces, borders, radii, spacing tokens;
- icon + icon-background variants;
- Button/IconButton;
- Input/Textarea/Number/Phone;
- Select/Combobox/Date/DateTime;
- Checkbox/Switch/Radio;
- Badge/status/payment/category tags;
- Avatar/assignee group + `+ Назначить`;
- Tooltip/Popover/Dropdown/Command;
- Tabs/Nav/SettingsBar;
- Card/ListRow/Divider;
- DataTable primitives;
- Progress/financial progress;
- Alert/empty/error/loading/skeleton;
- form section patterns;
- editor topbar/bottombar/right-sidebar fragments;
- scheduler card + resize handles + preparation block preview.

## Для каждого базового компонента

Показать: default, hover/focus where meaningful, disabled, loading, error, selected, long content, compact/narrow/mobile variant.

`/dev/ui` не должен зависеть от backend.
