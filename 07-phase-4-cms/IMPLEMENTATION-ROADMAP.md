# Оставшаяся работа Phase 4

Текущий статус и ближайший инкремент — `README.md`. Здесь только незакрытый scope, зависимости и acceptance; реализованные foundations не являются очередью повторной реализации. Детали контрактов открывать в профильной spec по задаче.

## CMS — доведение продукта до production

Приоритеты: **P0** — сохранность данных и достоверность действий; **P1** — завершённые повседневные сценарии редактора; **P2** — расширение возможностей. Production gate требует закрытия P0, согласованного P1 и P4.9. Наличие endpoint, зелёных unit tests или отметки foundation не закрывает пользовательский сценарий.

### Порядок и пакеты работ

| Пакет | Приоритет | Объём и исходные точки | Критерий приёмки |
|---|---|---|---|
| C3. Правдивые статусы и действия | P0 | `cms-dashboard.service.ts`, `cms-repository.ts`, `navigation-page.tsx`, `media-pages.tsx`: убрать неподтверждённые server dashboard analytics fields, безусловное «Ошибок нет» и вымышленные media logs; исправить period-unique в аналитике. Статус revision отделить от присутствия в active release и результата delivery. | Нулевой active release, delivery failure, отсутствие измерений и ещё не сохранённый node имеют разные состояния. Ни одно сообщение «на сайте», «готово», «проверено» не выводится без соответствующего server evidence. Dashboard и analytics используют одинаковые определения/период либо явно разные подписанные показатели. |
| C4. Канонический редактор и права | P0/P1 | `router.tsx`, `ApiCmsRepository.getEditor`, `editorFromDetail`: тип и canonical route определять по server node, а не по запрошенному route kind; одинаково применять offering publication readiness. Для media/SEO/actions проверить capability→route→control→API. Переиспользовать CRM session и управление пользователями. | Альтернативный URL не открывает неподходящий редактор и не обходит readiness UX; backend сохраняет самостоятельные guards. Матрица editor/reviewer/publisher/readonly/technical admin проходит direct URL, 403, expiry и re-auth без потери draft. |
| C5. Обычные страницы и блог | P1 | `ContentTab`, `CompositionTab`, `LandingConfig`, `CategoryConfig`: дать typed authoring содержимого статей, information/legal и landing через существующий `editorial-content` contract; оглавление/заголовки/текст/ссылки/изображения и необходимые авторские поля. Сейчас базовые title/summary/hero не заменяют редактор тела статьи, а новые секции добавляются преимущественно для home. Закрыть list state, pagination, сортировку по timestamp, создание/дублирование и безопасное архивирование. | Редактор создаёт содержательную статью/landing из пустого состояния, сохраняет, повторно открывает и публикует её; public SSR показывает тот же текст и медиа. Back возвращает URL filters/sort/page/view. Дублирование создаёт новый draft/URL/IDs, не повторную operational authority. |
| C6. Композиция главной и globals | P1 | `HomeSections`, `CompositionTab`, `CollectionsTab`, `NavigationTab`, `ManagementPage`: порядок/скрытие/удаление typed sections; реальное наследование и origin/diff/reset; CRUD reusable presets/default slots, page-type defaults и blast radius. Подборки, manual pins/fallback, home anchors и mobile order — через typed bindings к safe public projections. Отдельно нужны CRM promotions, scheduled-resource contract бани/чана и media карточек; подборки должны переиспользовать `homepage-commerce` readers, сохраняя свежесть operational facts. | Редактор управляет согласованными секциями без исходников; visible/reorder/override/inherit переживают reload и дают ожидаемый SSR. Global change перечисляет затронутые страницы и local overrides до публикации; price/capacity остаются CRM-owned. Неподключённые advanced поля убраны из обычного flow. |
| C7. Меню, footer, настройки | P1 | `NavigationPage`, `ManagementPage`, `IntegrationsPage`: поверх существующего site-settings API добавить identity/domain/default SEO/contact/legal/default-slot формы; полноценные footer slots; проверку целевых ссылок и понятные ограничения редактора. Предупреждать о совместной публикации изменений настроек/меню/интеграций. | Header/mobile/footer и разрешённые site settings редактируются, валидируются, проходят preview и атомарную публикацию; редактор видит полный состав публикуемых изменений. Неработающая ссылка не превращается молча в `/`. Метрика остаётся только ID + consent-gated config. |
| C8. Preview, история и жизненный цикл | P1 | `ContentEditorPage`, `VersionTab`, `release-pages.tsx`: подключить визуальный preview через реальный public renderer, а не декоративный hero/mockup; revision history/diff/restore; понятный первый release, empty state и путь к публикации. Уточнить archive vs removal from public release, явно показать эффект и защиту зависимостей. | Draft → preview desktop/mobile → review → publish → public HTML → history → restore/rollback проходят в isolated API E2E. Пользователь видит before/after, affected paths и validation; stale preview/CAS не изменяет active release. История контента и журнал доставки различимы; пустой журнал объясняет следующий шаг. |
| C9. Медиа как редакционный инструмент | P1 | `MediaLibraryPage`, `AssetPage`, `UploadPanel`: picker из страницы с возвратом и точной binding; alt/caption/credit/license/tags/focal fields; настоящий upload/processing/error/retry, read-only по capabilities, pagination/search, usage/versions, предупреждение о published usages. Разделить mobile image и foreground contract. Production adapter work не переписывать. | Upload → ready → attach → preview → publish → versioned replacement → usage/delivery видны редактору. Ошибки scanner/decode/storage и conflict восстанавливаются; метаданные не теряются. Picker сохраняет draft страницы. Production storage/scanner/rights gate — P4.4/P4.9. |
| C10. SEO и редиректы | P1 | `/seo` и `/seo/pages/:nodeId`: настоящий отчёт по опубликованным/draft данным с объяснимыми checks и deep link в canonical SEO tab. Metadata/OG/indexing/canonical/schema policy, links/media/freshness по поддержанным данным. `/redirects`: release-scoped registry CRUD, collision/loop/chain validation и preview; существующие auto redirects при разрешённом move переиспользовать. | В отчётах отсутствуют demo числа; issue ведёт к конкретному полю/странице. Редирект проверяется реальным HTTP 301/404, без циклов и конфликта с active routes. Sitemap/robots/metadata соответствуют одному active release. Поисковые impressions/rankings не заявляются без источника. |
| C11. Аналитика и маркетинг | P1/P2 | Для минимального запуска: честные site-wide counters, period picker, empty/not configured/error, синхронные определения dashboard и analytics. Для полного раздела: page/section/source drilldown, attribution linkage, form funnel, campaigns/UTM/landing/CTA bindings; retention/cohorts и reconciliation — по P4.7. | Отчёт не выдаёт общий срез за детализацию; source/page/period filters проверены на известных событиях и server facts. Campaigns управляет presentation/UTM, скидки и цены — CRM. Недоступные формы/cohorts/quality скрыты или оформлены одним ясным unavailable состоянием. Privacy/retention остаются обязательным go-live gate независимо от глубины отчётов. |
| C12. Shell, mobile, доступность и проверки | P1 | Убрать оставшиеся demo management карточки из обычного production UX; dev gallery изолировать. Проверить остальные loading/empty/error, focus/labels/keyboard, 360–390px, long content и desktop; расширить API E2E на роли, конфликты и media lifecycle. Разделить тяжёлые routes при подтверждённом влиянии bundle. | Основные save/publish действия доступны без горизонтального поиска на телефоне; дерево не обрезано; icon buttons имеют accessible names. Изолированные CMS API E2E покрывают редактор, C3–C10, re-auth и два конкурирующих редактора. Общий release gate и production drills — P4.9. |

Зависимости: C3–C4 → C5–C9 → C10 и минимальный C11 → C12/P4.9. Mobile, язык и targeted regressions входят в каждый пакет, а не откладываются целиком на конец. C6 и C7 используют одну site-settings/publication authority. Полный marketing/attribution scope не должен блокировать исправление редакционного ядра.

Уточнения контрактов для реализации:

- C9: hero `backgroundAssetId`/`foregroundAssetId` сами по себе не заменяют resolved media objects. Picker должен формировать правильную media binding, а не принимать произвольный путь как asset ID. Карточкам главной нужны опубликованные media bindings: текущие safe summaries их не содержат.
- C3/C11: `getAnalytics` суммирует дневные `uniqueVisitors`; это не уникальные посетители за период. Добавить server period-unique либо явно назвать сумму visitor-days. Повторный визит одного visitor в разные дни не должен увеличивать period-unique. Server aggregates уже принимают pageNodeId/sectionKey: сначала подключить существующую фильтрацию, затем новые breakdown/attribution contracts.
- C7: общий settings publish и отдельный Metrika publish уже разделены сервером (`cms-site-settings.service.ts`); сохранить эту изоляцию. Общий diff показывает только действительно публикуемую часть. Матрица прав должна явно отражать, что Metrika publish требует `canManageIntegrations`, а general settings publish — `canPublishContent`.
- C8: signed draft preview сейчас возвращает `renderable:false`/`CMS_INHERITANCE_NOT_MATERIALIZED` (`public-content.service.ts`); materialized publication preflight не заменяет визуальный preview. Истории revisions/restore в content controller нет. `archive` архивирует node, но public resolver продолжает читать immutable active release; удаление возможно через release `removeNodeIds`. Добавить явный управляемый unpublish/restore flow и не обещать снятие с сайта кнопкой archive.
- C12: `getMedia` ограничен первой сотней записей; добавить media pagination. Node repository уже обходит cursor chain, но URL pagination/filter/view и large-tree UX требуют приёмки на большом наборе.

### Покрытие разделов

| Раздел/маршруты | Обязательный результат |
|---|---|
| Обзор `/` | C3: только реальные status/counts/actions; onboarding при отсутствии release. |
| Страницы `/content/tree`, home/pages/categories/profiles и `/offers/*` | C3–C6, C8: canonical typed editor, topology/list state, ownership/readiness и безопасный жизненный цикл. Compatibility routes ведут к одному редактору. |
| Блог `/content/articles/*` | C5: полноценный body authoring и связанный SEO/media/public SSR. |
| Публикации `/releases/*` | C8: empty state, понятный diff, delivery/error/retry/rollback и первый release. |
| Глобальные секции `/globals/sections/*` | C6: presets/defaults/inheritance, usage и impact до публикации. |
| Меню и подвал `/globals/navigation`, `/globals/footer` | C7: полный сохранённый контракт и общий settings diff. |
| Медиа `/media/*` | C4, C9: полный metadata/picker/processing/usage lifecycle. |
| SEO `/seo`, `/seo/pages/*` | C10: настоящие checks и переход к исправлению. |
| Маркетинг `/marketing/campaigns` | C11: editorial campaign bindings либо исключение из стартовой навигации до реализации. |
| Редиректы `/redirects` | C10: настоящий реестр и безопасная публикация. |
| Аналитика `/analytics/*` | C3, C11: overview/acquisition/content/funnels/forms/retention/quality показывают только доступный authoritative срез. |
| Настройки `/settings/site` | C7: сохранение и публикация поддержанных site fields. |
| Интеграции `/settings/integrations` | C7: надёжный текущий Metrika flow; новые integrations только под конкретного consumer. |
| Диагностика `/settings/access`, `/audit`, `/components/*` | C4/C12: реальная матрица прав/ссылка в CRM, scoped audit read, readonly renderer registry; убрать выдуманные пользователи/events/версии. Не строить второй user-management backend. |
| Code `/code/*`, вкладка «Файлы и код» | P4.8, P2: скрыть из обычного редакционного flow до реального use case и безопасного исполнения. Наличие code workspace не требуется для обычной typed CMS. |
| `/menu`, shell, dev gallery | C12: parity permissions, mobile actions, navigation/search, explicit dev-only diagnostics. |

### Граница первого production-релиза

- Первый release CMS должен закрывать редакционный цикл: страница/статья → медиа → SEO → preview → публикация → доставка → восстановление; меню, footer и базовые site settings доступны без разработчика.
- Не включать в обязательный первый release универсальный page builder, произвольное исполнение кода, глубокие cohorts и второй CRM editor. Незавершённые возможности можно исключить из стартового меню; это не означает закрытие их полного scope.
- Оценивать по пакетам после выбора поддержанных page/section types и глубины аналитики. Это несколько связанных инкрементов frontend/contracts/backend/public consumer/QA; cosmetic cleanup не закрывает оставшиеся редакционные сценарии.
- До финальной приёмки нужны disposable CMS API E2E с заполненными данными, roles/conflicts, реальным preview/public renderer и negative paths. Live smoke по пустой медиатеке/журналу и component tests не доказывают publication/media recovery.

### Связанный CRM scope

- Финансовая проекция (`apps/api/src/finance/finance.service.ts`) пока выбирает только booking payments: подключить Event/ProgramRegistration без двойного учёта и исправить fallback категории проживания. Gate: оплата каждого типа заказа появляется один раз в сводке и правильном направлении; возврат согласован с исходной оплатой.
- API-таблицы мероприятий/регистраций показывают customer/assignee IDs вместо имён; новые регистрации без расчёта могут выглядеть оплаченными при нулевой сумме. Подключить имена из разрешённых projections и отличать «не рассчитано» от «оплачено», сохранив CRM layout.

## P4.5 — Offering и публичная миграция

### Оставшиеся commercial boundaries

- Campground quote ещё требует typed operational acceptance context.
- Venue использует typed exclusive Resource, canonical CMS draft и safe public projection, но его server quote/acceptance остаются отдельным order contract.
- Request-only/scheduled-resource add-ons и shared-capacity Event resources остаются fail-closed до отдельной fulfillment semantics.
- Audited repair для ambiguous legacy mappings отделён от ordinary UI; не угадывать bindings/basis и не включать автоматический backfill.
- Acceptance любого нового order type: exact subject/version/composition, DB-clock expiry после locks, atomic capacity/lifecycle/accepted link/audit/outbox и DB guards. Quote preview не резервирует capacity; accepted history не пересчитывается.

### P4.5E — Typed public projections

- После add-on, venue и house slices нужны resolver/contracts campground, program и event-service: listing/detail/price readiness и, где предусмотрено сценарием, quote/availability.
- Exact profile/revision relation, release-pinned dependencies, strict allowlist, source versions/hash/asOf и честный unavailable/request fallback обязательны.
- Operational change инвалидирует active projection независимо от CMS release; existing fenced delivery/cache-effect port используется повторно.
- Non-leak tests проверяют отсутствие draft/internal/customer fields. CMS source locator сам по себе не разрешает public output.

### P4.5F — Route-by-route delivery

Gate закрыт для утверждённой URL-карты. Canonical paths: `/domiki`, `/kemping`, `/dopy`, `/poshadki`, `/programmy`, `/meropriyatiya`; прежние English prefixes и `/resources/sauna-chan` получают прямой 301 без цепочек. Active release владеет опубликованными indexable routes, schema bindings, sitemap и robots. Typed `editorial-content` доставляет статьи, information/legal и содержательные curated nodes; сами новые landings публикуются только с реальным editorial evidence.

Homepage editorial binding gate закрыт: стандартные секции главной используют typed `homepage-section`/`partners`/`why-us` contracts, release order и visibility, а footer — typed global navigation/settings slot; ContentSource, global identity/navigation/default slots и Astro/React consumers проверяются в desktop/mobile CMS delivery E2E. Operational card collections остаются отдельной public-projection boundary.

House vertical route gate закрыт: `public.house-summary.v1` проверяет exact `CatalogOffering(kind=house)` → active CMS profile/revision → одну primary fixed Resource → active calendar, а public API отдаёт bounded list и detail по canonical CMS path. `/domiki/*` требует совпадающие CMS page и house projection из одного release; missing/malformed/mixed operational response даёт `503` без partial HTML. Price отсутствует — честный `request_only`, availability не вычисляется в странице.

Campground vertical route gate закрыт: `public.campground-summary.v1` проверяет exact `CatalogOffering(kind=campground)` → active CMS profile/revision → одну primary Resource → совместимые `CampgroundOfferingTerms`/capacity mode → единственную active campground membership → active calendar. `owned_tent` и `own_tent_pitch` разделены в public contract; whole-camp rental не появляется. `/kemping/*` требует совпадающие CMS page и campground projection из одного release, shared capacity не суммируется в браузере, а отсутствие price остаётся `request_only`. Public quote/acceptance для campground — отдельный commercial boundary.

Addon vertical route gate закрыт: существующий `public.addon-summary.v1` подключён к CMS `addon_detail` через release dependency с exact offering ID; `/dopy/*` сверяет `offeringId`, `contentReleaseId`, title и не рендерит route без dependency, malformed data или outage. Strict add-on terms и conservative price/readiness projection остаются operational authority; route показывает request fallback, если price отсутствует.

Venue vertical route gate закрыт: `public.venue-summary.v1` подключён к CMS `resource_detail` через release dependency с exact offering ID; `/poshadki/*` сверяет `offeringId`, `contentReleaseId`, title и не рендерит route без dependency, malformed data или outage. Exclusive-resource capacity, space type и conservative price/readiness projection остаются operational authority; interval availability и quote не выдаются в браузер, а отсутствие price даёт request fallback.

Program vertical route gate закрыт: `public.program-summary.v1` подключён к CMS `program_detail` через release dependency с exact offering ID; `/programmy/*` сверяет `offeringId`, `path`, `contentReleaseId`, title и не рендерит route без dependency, malformed data, no-price/no-occurrence response или outage. Generic public listing продолжает отдавать безопасные program cards, а typed detail projection показывает только template limits, duration, next open occurrence и conservative price/readiness; registrations, customer fields и quote acceptance остаются за CRM.

Event-service vertical route gate закрыт: `public.event-service-summary.v1` подключён к CMS `event_detail` через release dependency с exact offering ID; `/meropriyatiya/*` сверяет `offeringId`, `path`, `contentReleaseId`, title и не рендерит route без dependency, malformed data или outage. Typed detail projection показывает только редакционный summary, allowlisted format, duration, guest bounds и request-only readiness; customer Event, PII, resource selections и private event-order quote flow остаются за CRM.

Для каждой страницы: meaningful SSR HTML, один H1, crawlable links, metadata, image dimensions, минимальная hydration и desktop/mobile/keyboard/visual checks по затронутому сценарию. Production outage/invalid response не становится fixture fallback или ложным индексируемым 404. Renderer key/version/schema и порядок/config sections валидируются. Не менять одобренный дизайн без задачи.

Listing authoring/filter UX вводится для реального consumer; SQL projection/index/load gate нужен перед ростом каталога, не как предварительная универсальная подсистема.

## P4.3 — Preview и сквозная видимость доставки

Gate закрыт. Page editor сначала получает server-materialized effective content, before/after, affected paths, exact dependencies, validation issues и cache tags. Publish принимает preview hash + active release/version guard; stale preview и concurrent release отклоняются до atomic pointer switch. `/releases` показывает безопасный delivery status, capability-gated CAS replay и immutable rollback. Approved canonical leaf move создаёт release-derived 301; произвольный published move и non-leaf subtree move остаются fail-closed.

## P4.4 — Media hardening

- Provider-neutral S3-compatible production storage/CDN adapter, внешний fail-closed HTTP scanner, staged processing retry/DLQ, orphan cleanup и capability-gated health metrics реализованы; local storage/scanner остаются development/test adapters.
- Миграция assets только после rights/source review. Spoof/oversize/decode/pixel/EXIF/SVG failures не проходят publish; published references защищены usage graph.

## P4.6 — Public intake

После готовности необходимых public projections: form endpoint, rate limit/anti-spam/sanitization, typed consent и UTM/referrer snapshot, idempotent Lead/contact creation, audit/outbox/notifications и CRM deep link.

Gate: retry не дублирует Lead; public success не подтверждает Booking и не раскрывает internal status/PII. Проверить реальную форму → CRM и error/consent paths.

## P4.7 — First-party analytics

Порядок: taxonomy/consent/stable IDs → collector/visitor/session/dedupe/bot classification → attribution и server conversion facts → aggregates/dashboards → consent-gated Metrika counter settings/tag runtime и reconciliation → retention/privacy/export audit.

Operational marketing reports не доказывают visitor collection. Gate: refuse/revoke, server reconciliation, отсутствие raw IP/contacts/form values/cookies, purpose-bound identity access. Спецификация — `ANALYTICS.md`.

## P4.8 — Controlled code

Начинать, только когда schema-driven CMS покрывает обычные страницы и появился конкретный source-authoring use case.

Allowlisted managed workspace, persisted artifact revisions/build/dependency hashes, linked virtual file tree, versioned drafts, isolated preview/diff/review и signed release artifacts. Gate отклоняет traversal/symlink, secrets/socket/config access, SSRF/exfiltration, unsafe imports/HTML/dependencies/scripts и resource exhaustion; production не исполняет DB source. Детали — `PUBLIC-PAGE-AUTHORING.md`.

## P4.9 — Go-live

- Выбрать hosting/render mode/SLO, storage/CDN/data location, recovery/rollback owner и staging/production/preview environments.
- Утвердить privacy purposes, consent/retention, legal owner и допустимость identity links; engineering defaults не заменяют утверждение.
- Инвентаризировать legacy URLs/redirects, завершить approved content/media migration. Research/новые SEO landings только по реальным источникам.
- Search Console/Метрика после consent/legal readiness; performance/security, backup/restore/incident runbooks, content freeze, production release и reconciliation.
- Final gate: workspace typecheck/lint/unit/build; три API namespaces; PostgreSQL migrations/concurrency/jobs; затронутые admin/site E2E; privacy/upload/a11y/performance; publish/rollback/restore drill; отсутствие draft/internal/PII в public API/HTML.

Не выполнять go-live gate после каждой локальной правки. Verification записывается в итог задачи/коммит; менять этот план только при изменении scope/order/gate, не дописывать сессионные отчёты.
