# AGENTS.md — платформа «Свистоплясово»

Монорепозиторий связывает SEO-first public site, CMS, CRM и NestJS/PostgreSQL backend. Активна Phase 4: CMS, public delivery, media, intake, analytics и SEO expansion.

## Authority

- Backend/CRM владеет operational facts: статусы, availability/capacity, цены, брони, оплаты, права и concurrency.
- CMS владеет editorial content, SEO, media, composition и publication.
- Public site читает только published public API/projections, не обращается к БД/internal API, не публикует draft/internal/PII и не подтверждает бронь.
- Один бизнес-факт не имеет двух authority; границы проходят через typed contracts, audit/outbox, notifications и cache invalidation.

Приоритет при конфликте: явная задача пользователя → актуальное решение в `DECISIONS.md` → рабочая спецификация контура → код как свидетельство реализованного состояния. `reference/*` — только архив для разрешения конкретной неоднозначности.

## Контекстный бюджет

1. Определить контур и проверить dirty worktree; затем либо открыть релевантный код/тесты для собственной работы, либо делегировать discovery без дублирующего чтения.
2. До кода читать одну primary spec и максимум одну зависимую; остальное — только по выявленной границе.
3. Не читать целиком human README/MANIFEST, `DECISIONS.md`, `IMPLEMENTATION_LOG.md`, roadmap или `logs/`: найти heading через `rg` и открыть только его диапазон.
4. При изменении scoped-каталога один раз прочитать его ближайший `AGENTS.md`; не перечитывать уже переданный в task контекст.

## Маршруты

| Задача | Основной контекст |
|---|---|
| Общий scope / стек | `00-core/project-scope.md` / `00-core/stack.md` — только нужный из них |
| CRM UI | `apps/crm/AGENTS.md`, затем текущие page/components/tests |
| CMS UI | `apps/admin/AGENTS.md`, затем нужный раздел `07-phase-4-cms/CMS-UX-SPEC.md` |
| Backend/domain/PostgreSQL | `04-domain-backend/domain-model.md`, затем один профильный backend-документ |
| API/auth/concurrency | `04-domain-backend/api-auth-concurrency.md` |
| Live/notifications | `04-domain-backend/live-notifications.md` |
| Public UI/sections/booking | `packages/site-ui/AGENTS.md`, затем текущий consumer |
| Managed public page | `apps/site/src/managed/AGENTS.md` |
| Offering/pricing/CRM↔CMS | только нужный раздел `07-phase-4-cms/OFFERING-CATALOG-ARCHITECTURE.md` |
| CMS/publication/media/delivery | `07-phase-4-cms/README.md`, затем один документ из его индекса |
| Public intake/integration | `07-phase-4-cms/PLATFORM-ARCHITECTURE.md` + релевантные contracts/code |
| SEO/site structure/content | один из `07-phase-4-cms/SEO-STRATEGY.md` / `07-phase-4-cms/SITE-STRUCTURE.md`; live-выводы только по source evidence |
| Analytics/я.Метрика | `07-phase-4-cms/ANALYTICS.md` |
| Tests/security/release | один из `06-quality-process/testing-security.md` / `06-quality-process/stage-deliverables.md` |

Текущий статус и следующий инкремент находятся только в `07-phase-4-cms/README.md`. `07-phase-4-cms/IMPLEMENTATION-ROADMAP.md` открывать точечно при изменении порядка или проверке acceptance gate.

## Реализация

- Не откатывать чужие dirty changes; использовать shared contracts/design systems/repository boundaries без второй authority.
- Для затронутых границ проверять `authority → contract/API → consumer → audit/notification/cache`.
- Public frontend сохраняет Astro-first HTML, crawlability, metadata/accessibility и минимальную hydration; fixtures только в явном dev/test mode.
- Проверки пропорциональны риску; UI включает desktop/mobile, overflow, keyboard и ключевые states.

## Делегирование

Простую последовательную задачу main делает сам; bounded implementation, независимые подзадачи и шумную read-only/механическую работу можно делегировать.

- До worker - main ограничивается instructions, `git status` и `rg`; broad source discovery не делает.
- Предпочитать узкого worker'а с циклом discovery → edit → targeted tests вместо цепочки ролей.
- worker возвращает evidence map: paths/symbols/lines, dependencies, relevant tests/spec section, unknowns; без source dumps.
- После worker - main читает только critical boundaries или спорные факты; owned source читает worker.
- Integration review: worker summary + `git diff`; source перечитывать только при необходимости.
- Параллельная запись только в disjoint owned files, обычно ≤2 workers.
- Task packet: цель, owned files, одна spec/section, ограничения, acceptance commands.
- Workers не меняют roadmap, `DECISIONS.md`, `IMPLEMENTATION_LOG.md` и logs; документацию после интеграции обновляет main.

## Планы и логи

- Task plan — во встроенном plan. Roadmap менять только при изменении scope/order/gate, Phase 4 status — в её README.
- Main agent обновляет один `07-phase-4-cms/logs/YYYY-MM-DD-<track>.md` только при значимом acceptance change.
- `DECISIONS.md` — durable решения, `IMPLEMENTATION_LOG.md` — крупные milestones; README/spec/AGENTS не progress log.
- После каждого завершённого изменения, выполненного по запросу пользователя, создавать отдельный git-коммит с понятным сообщением.
- Не включать в коммит чужие или unrelated dirty changes.
- `git push` выполнять только по прямому запросу пользователя.
