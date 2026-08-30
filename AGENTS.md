# AGENTS.md — CRM v7 «Свистоплясово»

Этот файл — **единственная обязательная точка входа** для ИИ-агента.
Не читать весь каталог документации «на всякий случай»: сначала определить тип задачи и открыть только указанные ниже файлы.

## 1. Источники истины

Всегда сначала прочитать:

1. `00-core/source-of-truth.md`;
2. `00-core/development-order.md`;
3. только документы своей задачи из таблицы ниже.

`reference/*` — архив исходников. **Не читать**, если рабочие документы не содержат явной неоднозначности.

## 2. Маршрутизация контекста

| Задача | Читать |
|---|---|
| Дизайн-система / UI kit | `01-design-system/README.md` и перечисленные там файлы |
| Shell / navigation | `01-design-system/visual-foundation.md`, `01-design-system/shell-navigation.md`, `01-design-system/data-display-and-controls.md` |
| Scheduler / timeline / agenda / DnD | `01-design-system/visual-foundation.md`, `01-design-system/scheduler.md`, затем нужный экран из `02-screens/` |
| Конкретный CRM-экран | `01-design-system/visual-foundation.md`, `01-design-system/data-display-and-controls.md`, соответствующий `02-screens/*.md` |
| Create/edit страница | `01-design-system/editor-layout.md` + соответствующий `02-screens/editors-*.md` |
| Frontend architecture | `00-core/stack.md`, `03-frontend/architecture.md`, `03-frontend/routing-state-responsive.md` |
| Backend/domain | `04-domain-backend/domain-model.md` + только нужный backend-документ |
| PostgreSQL | `04-domain-backend/database-postgres.md` + релевантный domain-документ |
| API/auth/concurrency | `04-domain-backend/api-auth-concurrency.md` |
| Live updates/notifications | `04-domain-backend/live-notifications.md` |
| Public site/admin | `05-site-admin/public-site-admin.md` + релевантные domain/API docs |
| Тесты/security/release | `06-quality-process/testing-security.md`, `06-quality-process/stage-deliverables.md` |

## 3. Приоритет правил

При конфликте:

1. текущая явная задача пользователя;
2. `00-core/source-of-truth.md` и `DECISIONS.md`;
3. рабочие UI-спеки из `01-design-system/` и `02-screens/` для внешнего вида/UX;
4. архитектурные документы `03-*` / `04-*` / `05-*`;
5. `reference/original-ui-visual.md`;
6. `reference/original-fullstack.md`.

Не пытаться «усреднить» конфликтующие требования.

## 4. Текущий порядок разработки

**Design system → frontend → backend + интеграция CRM → public site/admin.**

Старое требование делать каждый UI-этап сразу full-stack vertical slice больше не определяет порядок текущей разработки. Детали — `00-core/development-order.md`.

## 5. Базовые правила работы агента

- Перед реализацией проверить существующий код и не ломать уже работающие части.
- Не придумывать новые бизнес-факты. Если данных не хватает — проектировать расширяемую механику, а не выдумывать предметные правила.
- UI/UX не исполнять механически: проверять плотность, иерархию, переполнение, mobile, empty/loading/error/disabled/conflict states.
- Не дублировать один паттерн разными визуальными реализациями без причины.
- Для UI использовать дизайн-систему и общие компоненты; экран не должен становиться локальной «второй дизайн-системой».
- В backend после его появления бизнес-правила authoritative на сервере.
- Значимые изменения фиксировать в `DECISIONS.md`.

## 6. Ключевые UX-решения, которые нельзя откатывать

- Create/edit сущности — отдельные route-driven страницы внутри основного CRM layout (sidebar/topbar сохраняются), не modal/overlay.
- Editor page: основной контент + правый sidebar, fixed top bar, tabs, fixed bottom action bar.
- Поля в editor сразу редактируемые.
- Один глобальный визуальный язык и компактная информационная плотность.
- Важные/resource-иконки — с подложкой; ресурс/категория — цветная иконка + оттеночная подложка.
- Ответственные — аватары `24×24`; если нет — `+ Назначить`.
- Карточки кликабельны; табличные колонки сортируемы там, где сортировка осмысленна.
- Размер элемента должен соответствовать типу и ожидаемой длине данных.
- Не строить «карточка внутри карточки внутри карточки»: предпочитать секции и divider.
- Mobile — отдельная адаптация, а не уменьшенный desktop.

## 7. Что читать при сомнении

Если рабочий документ кажется неполным, сначала открыть `reference/conflict-map.md`.
Только затем — соответствующий оригинал из `reference/`.
