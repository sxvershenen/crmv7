# Create/Edit page — общий layout

## Исходное правило

# Страницы создания и редактирования записей
Страница открывается переходом, а не окно. Она разделена на основное пространство и правый сайдбар.

Editor переиспользует глобальный top-navbar shell вместо второй локальной шапки:
[< назад] Название/клиент #id

Следующая строка editor содержит:
[навигация по вкладкам]                 [быстрый статус] [доп. действия]

bottom-navbar:
(ico) статус изменений/сохранений       справа: кнопки типа [Закрыть или что нибудь ещё] [Сохранить]

## Общий паттерн

Desktop:
- identity `[<] Название #id` заменяет обычные breadcrumbs в global topbar;
- под ним sticky tabs/navigation и в той же строке status/actions;
- main content area;
- right sidebar с operational summary/actions;
- fixed bottom action bar;
- scroll только в рабочей области, без прыжков shell.

Mobile:
- identity и быстрый status находятся в global topbar;
- одна колонка;
- sidebar-содержимое превращать в логические секции/compact summary;
- fixed save action всегда прилеплен к viewport над mobile navigation и учитывает safe-area;
- tabs становятся horizontal scroll; правая action-кнопка остаётся фиксированной, а край навигации визуально затухает под ней градиентом.

## Поведение

- Все допустимые поля сразу editable.
- Dirty/saving/saved/error/conflict state видим в bottom bar.
- Browser Back должен вести в предыдущий контекст; желательно восстанавливать filters/scroll/date/view.
- Поля и actions проектировать по фактической ширине содержимого: короткий numeric/select не обязан растягиваться как phone/name input.
