# Карта конфликтов исходных ТЗ

Этот файл нужен только если рабочие документы выглядят противоречиво.

| Тема | Старое full-stack ТЗ | Более поздний visual/current request | Решение |
|---|---|---|---|
| Порядок разработки | каждый этап full-stack vertical slice; UI не делать отдельно | design system → frontend → backend → site | использовать новый порядок |
| Create/edit | route-driven overlay поверх экрана | отдельная страница, main + right sidebar, fixed top/bottom | отдельная route page |
| Иконки | Lucide | Tabler Icons | Tabler для product UI |
| UI primitives | shadcn CLI + Vega `bIkezqK` | visual файл не отменяет shadcn | shadcn/preset сохраняется |
| Mock/fixtures | mock runtime запрещён | frontend создаётся до backend | локальные typed fixtures разрешены до API, но не как business authority |
| Mobile scheduler | agenda вместо уменьшенного desktop | совместимо | agenda/mobile-specific |
| Категории ресурсов | icon + color | visual файл подтверждает цветные icon backgrounds | совместимо |

Оригиналы лежат рядом и не изменены.
