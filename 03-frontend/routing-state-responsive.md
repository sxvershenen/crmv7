# Routing, state restoration, responsive UX

## Routing

- Каждая рабочая сущность имеет прямой route для просмотра/редактирования.
- Create/edit — полноценная страница, не overlay.
- `Back` возвращает в предыдущий экран.
- По возможности сохранять background context: filters, view, date/range, scroll position.

## Responsive

- Desktop и mobile используют одну предметную модель, но разные представления.
- Table → compact cards на mobile, если горизонтальная таблица разрушает смысл.
- Scheduler → agenda/day flow на mobile.
- Filter bar → 1–2 key controls + одна кнопка Filters.
- Touch target ориентир минимум `44px`, даже если visual glyph меньше.

## Performance

Предусмотреть по мере надобности:
- virtualization scheduler/длинных списков;
- lazy tabs;
- request cancellation;
- prefetch;
- stable keys;
- partial rerender;
- сохранение scroll/period;
- `prefers-reduced-motion`.

Один DnD не должен заставлять перерисовываться весь scheduler.

## Accessibility

Keyboard navigation, visible focus, labels/errors, focus restoration, DnD alternatives, screen-reader announcement для важных операций, WCAG AA, safe area, icon buttons с tooltip + accessible name.
