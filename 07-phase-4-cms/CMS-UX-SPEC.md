# CMS UX specification

Этот документ описывает target UX и будущие gates; текущая реализация определяется Phase 4 status, source и фактическими проверками.

## 1. Продуктовая граница

CMS живёт в отдельном `apps/admin` и управляет только тем, что посетитель видит на сайте: content, composition, media, SEO и publication. Между CRM и CMS есть app switcher и deep links, но operational поля имеют единственный UI entry point в CRM. Копии цены, доступности, вместимости, привязок и client-side «синхронизация» запрещены.

Основной сценарий администратора: найти страницу → изменить содержимое → сохранить черновик → посмотреть результат → опубликовать. Администратор не создаёт релиз и не переносит в него отдельные элементы. Сложность публикации, проверки версий и доставки скрыта внутри этой команды; ошибки объясняются через действие, нужное пользователю. Hash/cache/API diagnostics раскрываются отдельно. Изменения этого контура не меняют вёрстку CRM без отдельного согласования.

При создании каждого Resource в CRM CMS-черновик создаётся автоматически и виден в «Страницах сайта», даже если ресурс пока внутренний. Для поддержанных публичных видов адрес предлагается из названия, допускает изменение до публикации и не требует ручного создания CMS-профиля или релиза. Текст и фотографии редактируются в CMS. Изменения действующей цены/доступности читаются из CRM public projection независимо от редакционной публикации. Отключение Resource в CRM означает «Временно недоступно», архивирование — «Архив»: опубликованная страница и её SEO-настройки сохраняются, а заявка на этот ресурс недоступна. Снять страницу с сайта можно только отдельным действием в CMS. Первый запуск страницы требует опубликованных настроек сайта. Частный заказ клиента не становится публичным анонсом.

Каждое значение с потенциально неочевидным владельцем показывает source marker:

- `CRM` — operational authoritative; в CMS поле не отображается, вместо него при необходимости есть «Открыть в CRM»;
- `CMS` — маркетинговый/контентный owner, редактируется здесь;
- `Вычисляется` — public projection или системное значение;
- `Наследуется` — effective value пришло от site/type/parent default.

Frontend CMS использует существующие tokens, generated shadcn primitives и shared compositions `EditorFrame`, `FormField`, `DataTable`, `PageNav`, `SettingsBar`, `IconBox`, `StatusBadge`, `PageState` и Tabler Icons из `packages/ui`. Ownership и порядок работ задают root/scoped `AGENTS.md` и current Phase 4 status.

## 2. Shell и навигация

### Desktop sidebar

**Сайт**

- Обзор;
- Страницы сайта;
- Блог и материалы.

**Оформление**

- Навигация и footer;
- Медиа;

**Продвижение**

- SEO;
- Редиректы;
- Аналитика.

**Настройки**

- Настройки сайта;

Главная, посадочные, категории/listings и страницы домиков, кемпингов, площадок, программ и допов являются типизированными узлами единого дерева «Страницы сайта». Public profiles, source links, bindings, access matrix, raw versions, components registry и code artifacts доступны только как capability-gated diagnostics/tools и не входят в обычную навигацию администратора.

В реестре и редакторе статус относится к текущей редакции. Если после публикации создан новый черновик, отдельно показывается факт прежней публикации. Редактор отдельно читает `GET /content/nodes/:id/publication-status`: присутствие и URL в активной публикации определяются по её immutable manifest, а не по истории редакций. Доставку публикации до сайта проверяют отдельно; active-release membership сама по себе её не подтверждает.

`/settings/access` показывает только capabilities и роли текущей сессии. Состав команды открывается в CRM; приглашения и изменение прав пока не имеют рабочего UI. CMS не показывает вымышленные количества пользователей и не создаёт вторую authority для доступа.

«Снять с сайта» доступно только для страницы в активной публикации и требует подтверждения её текущего URL. Команда создаёт новую активную публикацию без страницы, сохраняя node, черновики и историю; опубликованные дочерние страницы и внутренние ссылки сначала нужно убрать. После доставки бывший URL отдаёт 404 и отсутствует в sitemap. Повторная публикация может использовать последнюю опубликованную редакцию без создания пустого черновика. Архивирование не заменяет снятие с сайта.

Topbar: breadcrumbs/route identity, environment `Черновик / Preview / Production`, глобальный поиск, «Открыть сайт», очередь публикации, уведомления, app switcher, профиль.

Mobile: отдельная адаптация — компактный topbar, bottom nav `Обзор / Страницы / Создать / Медиа / Меню`; таблицы становятся card lists; editor tabs горизонтально прокручиваются; preview открывается отдельным full-screen режимом.

## 3. Route map admin

```text
/
/content/tree
/content/home
/content/pages
/content/pages/new
/content/pages/:nodeId
/content/categories
/content/categories/new
/content/categories/:nodeId
/content/public-profiles
/content/public-profiles/:entityType/:entityId
/offers/:kind/:offeringId
/content/articles
/content/articles/new
/content/articles/:nodeId
/globals/navigation
/globals/footer
/media
/media/:assetId
/components
/components/new
/components/:blockId
/code
/code/new
/code/:artifactId
/seo
/seo/pages/:nodeId
/marketing/campaigns
/redirects
/analytics
/analytics/acquisition
/analytics/content
/analytics/funnels
/analytics/forms
/analytics/retention
/analytics/quality
/publication-log
/publication-log/:publicationId
/settings/site
/settings/integrations
/settings/access
/audit
/quality
```

List/view/filter state хранится в URL: `q`, `status`, `type`, `owner`, `updatedBy`, `hasIssues`, `sort`, `page`, period/compare для аналитики. Editor tabs use `?tab=...`; Back restores list filters/scroll. Unsaved navigation uses the shared dirty guard. Permission-denied and missing routes have explicit full-page states.

`/seo/pages/:nodeId` is a report/drilldown route only; «Редактировать» deep-links to the canonical content editor `...?tab=seo`, so SEO fields never have two editors.

`/content/categories` и `/content/public-profiles` остаются technical/reporting routes для taxonomy/profile diagnostics и миграции. Основной CRUD коммерческого контента идёт через единый `/content/tree`; `/offers/*` — только canonical locator/deep link к CMS node. Operational editor открывается в CRM, а CMS хранит и редактирует только editorial revision.

Для существующего node тип редактора определяется `node.kind` из API; несовпадающий URL переводит на канонический адрес с сохранением вкладки. CRM offering locator с несовместимым видом CMS node не открывает редактор. Для нового несохранённого материала тип задаёт маршрут создания.

## 4. Обзор CMS

Секции без лишних card-in-card:

- **Требует внимания:** failed publish, broken reference, SEO blocker, unprocessed media, stale CRM relation, expiring preview, analytics gap.
- **Статус сайта:** активная версия, время последней публикации, pending draft count, доставка именно активной версии: выполняется/ошибка/нет уведомлений. Наличие версии само по себе не подтверждает доставку.
- **Быстрые действия:** новая посадочная, статья, asset upload, preview, release.
- **Контент:** draft/review/scheduled/published, обновления за период.
- **SEO:** indexable pages, blockers/warnings, redirects, orphan pages.
- **Последние изменения:** actor, entity, diff summary, status.

Воронка показывается в аналитике с единым периодом измерения; обзор CMS не подставляет ноль посетителей и несопоставимые общие CRM-счётчики.

## 5. Структура сайта

Основной экран — split view:

- слева дерево route nodes с DnD/reorder, expand, status, page type, SEO issue dot;
- справа выбранный node: effective URL, owner, template, published/draft revision, children, inbound/outbound links, media count, действия;
- alternative table view для массовых операций и сортировки;
- search по title, slug, route, CRM entity, media filename.

Выбор узла, поиск и вид дерева остаются в URL при переходе в редактор и возврате. Списки страниц сохраняют фильтр, вид и сортировку в URL; «Обновлено» сортируется по server timestamp, а не по текстовой подписи.

Действия: создать child/sibling, duplicate, move, change slug, preview, request review, publish, schedule, archive. Изменение path сначала показывает affected descendants, redirect proposal, canonical/sitemap impact.

## 6. Общий route-driven editor

Используется существующая анатомия `EditorFrame`: identity в topbar, sticky tabs + status/actions, main + right sidebar, fixed bottom action bar.

### Общие tabs

1. **Содержимое** — собственные поля типа страницы и ordered section outline.
2. **Композиция** — секции, наследование, order, visibility, responsive settings.
3. **SEO** — metadata, canonical/indexing, schema, social, internal links.
4. **Медиа** — assets и usage graph текущей revision.
5. **Файлы и код** — file tree/artifact/diff/dependencies, если доступно.
6. **Аналитика** — effective analytics IDs, события и агрегаты page/version.
7. **Версии** — draft/published diff, comments, release history, rollback.

Вкладка «История» читает реальные сохранённые редакции страницы через `GET /content/nodes/:id/revisions` (до 30 за запрос, курсор по номеру редакции). Она показывает номер, состояние, заголовок, URL, время и доступный идентификатор автора; присутствие редакции со статусом `published` не означает, что URL сейчас в активной публикации. «Сравнить» загружает выбранную редакцию через `GET /content/nodes/:id/revisions/:revisionId` и показывает различия поддержанных редактором полей; дополнительные SEO-настройки пока не раскрыты в сравнении. После подтверждения `POST /content/nodes/:id/revisions/:revisionId/restore` с проверкой версии создаёт новый черновик из её текста, hero, секций и полного SEO. Текущие URL и связи с CRM сохраняются; действующая публикация не меняется. Восстановление недоступно при несохранённых правках, архивной странице и неподдерживаемом формате. В fixture-режиме история содержит только реально сохранённые редакции.

Right sidebar:

- status/revision/release;
- owner/source markers;
- URL; Phase 4 v1 is Russian-only, without a decorative locale switcher;
- author/reviewer;
- updated/published timestamps;
- SEO score по правилам, не «магическое число»;
- CRM relation;
- affected pages для reusable content;
- capabilities и blocked reasons.

Bottom bar: dirty/saving/saved/error/conflict, «Закрыть», «Preview», primary action по capability: `Сохранить`, `На проверку`, `Запланировать`, `Опубликовать`.

## 7. Наследуемые секции

Для hero, map, FAQ, directions, calculator и footer единый control:

`Наследовать | Настроить | Скрыть`.

При `Наследовать` показывается effective preview, уровень-источник и deep link к нему. При `Настроить` editor создаёт patch поверх effective config; рядом доступны «Показать отличия» и «Сбросить к наследованию». При `Скрыть` обязательно показывается page-level результат и SEO/conversion warning, если секция обязательна по quality policy.

Иерархия:

`site default → page-type default → parent/category → page/public profile`.

Изменение global/reusable секции показывает blast radius: affected drafts, published routes, custom overrides и какие routes войдут в release. Production не меняется скрыто.

### Hero fields

- enabled mode;
- eyebrow/badge;
- H1/title, subtitle/description;
- background media + focal point + mobile media;
- overlay/contrast theme;
- primary/secondary CTA: label, action kind, target, analytics ID;
- trust facts/badges;
- optional quick-search/calculator preset;
- breadcrumb visibility;
- alignment, max text width и safe-area preview;
- structured data bindings where relevant.

В редакторе страницы фон и отдельный фон для телефона выбираются из готовых изображений медиатеки без перехода со страницы и потери черновика. Пользователь с `canManageMedia` может загрузить файл прямо в picker: готовый файл выбирается сразу, обрабатываемый — только после явной проверки готовности. Сохранение закрепляет ID, alt и публичные WebP/AVIF варианты; произвольный путь в поле не вводится. При отсутствии мобильного фона используется основной. Старое `foreground` читается и сохраняется без изменений, но не подменяет мобильный фон. Публикация блокируется, если выбранное изображение не имеет готового публичного варианта. Визуальный макет в форме остаётся упрощённым; кнопка «Предпросмотр» открывает сохранённую редакцию через public renderer.

На главной во вкладке «Основное» редактор дополнительно управляет плашкой, упорядоченными слайдами (до пяти, с фото, заголовком и подзаголовком, с возможностью автопереключения) и двумя видимыми карточками справа (с фото, текстом и внутренней ссылкой). Всё хранится в hero той же редакции страницы. Выбранные изображения сохраняются с готовыми публичными вариантами; карточка не может вести на внешний или исполняемый адрес. Если слайдов нет, используется основной фон. Упрощённый макет формы показывает первый слайд и карточки; точный результат проверяется в публичном предпросмотре.

### Нижние секции

- Map: asset/map config, markers, labels, CTA.
- FAQ: source preset, ordered items, category, schema eligibility, page-only overrides.
- Directions: address, transport modes, route links, contact CTA; operational contact source visible.
- Calculator: approved preset, input visibility/defaults, CTA, analytics funnel IDs; цены/availability readonly from public API.
- Footer: inherited navigation, contacts, social, legal links, campaign CTA; usually edited globally, page override only with elevated permission.

## 8. Главная страница

`/content/home` — специальный editor поверх того же node/revision model.

Tabs:

- **Секции:** hero, события, домики, баня/чан, программы, площадки, blog, why us, reviews, map, FAQ/directions, calculator, partners; reorder/visibility/source.
- **Композиция:** section policies и доступные typed формы, включая партнёров.
- **Карточки домиков, программ и площадок:** в формах соответствующих секций выбираются CRM-ресурсы и их порядок (до 12 на секцию). У новых секций выбор пуст; старые опубликованные секции без выбора сохраняют прежнюю автоматическую выдачу до явной настройки. Черновик ресурса доступен для выбора, но карточка появляется на сайте и в подписанном предпросмотре только после публикации его CMS-страницы. Архивные и неопубликованные ресурсы не подменяются демоданными. Ближайшие события определяются автоматически по дате.
- **Навигация сайта:** редактируется в общем меню, а не во вкладке главной.
- далее общие SEO/Media/Analytics/Versions.

Для каждой секции: доступные typed редакционные поля, порядок/видимость, CTA и предпросмотр. Цена и доступность всегда приходят из CRM/public projection. Не показывать неработающие фильтры, fallback и переключатели источника.

`Партнёры` редактируются во вкладке `Композиция`: добавить секцию, задать заголовок/описание, добавить, переименовать, переставить или удалить элементы; скрытие использует общий section policy. Неполный черновик сохраняется; пустой заголовок/список/название и повторяющиеся item IDs блокируют публикацию. Форма версии 1 пишет полный scalar override `title`, `description`, `items`, сохраняя section ID/order/analytics. Составные keyed-array/object patches и неизвестные версии остаются readonly; правка других полей сохраняет их без преобразования. Унаследованные effective values до render-ready preview не имитируются.

`Why us` редактируется тем же typed flow: надзаголовок/заголовок/описание, упорядоченные факты и командный блок. Неполный черновик сохраняется; пустой заголовок, факт или поле командного блока, повторяющиеся fact IDs и неизвестные поля блокируют публикацию. Форма версии 1 пишет полный scalar override `eyebrow`, `title`, `description`, `facts`, `team`; составные patches и неизвестные версии остаются readonly. Фотография командного блока сохраняет текущий approved presentation asset до отдельного media binding.

Остальные стандартные секции главной (`events`, `houses`, `sauna-chan`, `programs`, `venues`, `blog`, `reviews`, `map`, `faq/directions`, `calculator`) используют shared renderer `homepage-section` версии 1. В typed форме редактируются надзаголовок, заголовок, описание и внутренний CTA; published release сохраняет их `order` и visibility. Footer остаётся typed global navigation/settings slot. При отсутствии опубликованных событий, программ или площадок включённая секция остаётся видимой с пустым состоянием без вымышленных карточек. В секциях программ, бани/чана и отзывов массив `cards` хранит только редакционные названия, описания и фото. Фото выбирается или загружается через медиатеку с сохранением asset ID и публичного варианта; HTTPS-адрес можно указать вручную. Направления программ дополнительно выбирают опубликованные CRM-программы по ID для фильтра. Карточки бани/чана показывают контактное действие без вымышленной цены до подключения публичной проекции scheduled resources. Содержимое operational карточек, цены, availability, capacity и live event facts остаётся за соответствующими safe public projections и не копируется в CMS.

Промокоды первого экрана выбираются во вкладке «Основное» главной: до трёх CRM-промокодов в заданном порядке. CMS сохраняет только их ID в hero редакции; название, код, размер и условия скидки остаются в CRM. В active release выбор фиксируется публикацией, а public API при каждом запросе берёт текущие CRM-условия и не отдаёт выключенные, архивные, ещё не начавшиеся или завершённые промокоды. Изменение условий действует без новой публикации CMS. Для этого блока public API не кэширует ответ между запросами; сайт показывает название, скидку, минимальную сумму и ограниченную область действия, если они заданы. Подписанный предпросмотр главной показывает выбранные коды с текущими CRM-условиями, остаётся noindex/no-store и не отправляет заявки. В fixture-режиме CMS предлагает два демонстрационных промокода; production их не подставляет.

Отзывы и FAQ редактируются непосредственно в секции главной: добавить, изменить, удалить, поднять/опустить элемент. Optional scalar arrays `reviews` (id/name/text/rating и необязательные avatarUrl/date/sourceLabel) и `faq` (id/question/answer) входят в существующий `homepage-section` v1; отдельных сущностей, миграций и публикаций элементов нет. Фото автора задаётся HTTPS-ссылкой или публичным адресом медиа CMS; дата и источник показываются только если заполнены. Для отзывов `cards` задаёт ролики рядом со списком: администратор вставляет прямую HTTPS-ссылку на MP4/WebM и выбирает обложку из медиатеки или указывает её HTTPS-адрес. Видео воспроизводится только по нажатию; старые карточки без видео остаются фотографиями. CMS не загружает видео и не выдаёт фото за работающий плеер или подтверждённый рейтинг внешнего сервиса. Неполный draft можно сохранить, но пустые обязательные поля, повторяющиеся IDs, недопустимый рейтинг/URL и неизвестные поля блокируют публикацию. Отсутствующий или пустой список отзывов скрывает секцию; production не подставляет демо-отзывы/FAQ. Старые редакции без этих массивов читаются; неподдержанные версии/составные patches сохраняются без преобразования.

## 9. Посадочная страница

Текущий редактор сохраняет H1, описание, адрес/родителя, hero, поддержанные блоки и SEO. Несохраняемые поля intent, аудитории, режима страницы и направления заявки в форме не показываются.

Целевое расширение `Содержимого` после подключения контракта и public consumer:

- internal name, public H1, slug/parent;
- intent/topic and audience note;
- page mode: template / composition / custom code;
- ordered sections;
- primary CTA and lead direction mapping;
- related entities/categories/articles;
- campaign association and expiry/archive policy.

Композиция допускает rich text, media, gallery, benefits, catalog slice, comparison, reviews, FAQ, CTA, calculator. Indexable landing обязана иметь unique intent, owner, canonical, internal links и review date.

## 10. Каталоги, категории, фильтры и сортировки

Это техническая настройка public listing/SEO, а не основной список бизнеса. Направления: Домики, Кемпинги, Допы, Площадки, Программы, Мероприятия под заказ. Они используют configurable taxonomies/listing pages and one registry, not independent UI systems.

Текущий редактор категории сохраняет H1, описание, адрес/родителя, hero, поддержанные блоки и SEO. Вымышленные счётчики URL, фильтры и настройки источника не показываются. Следующие вкладки — целевой объём после появления server contract и public listing consumer:

Tabs listing/category editor:

- **Основное:** name, slug, parent, intro, icon/color, cover, visibility.
- **Источник:** public profile entity types, include/exclude rules, manual pins.
- **Фильтры:** field, label, control type, values/source, order, default, URL key, index policy.
- **Сортировки:** label, stable key, direction, default, tie-breaker.
- **Карточка:** card variant, fields/badges/CTA, missing-data fallback.
- **Empty state:** text, suggested resets, CTA.
- общие Composition/SEO/Media/Analytics/Versions.

Faceted URLs по умолчанию не индексируются. Только curated filter combination может стать отдельным `landing/category node` с собственными H1, copy, canonical и internal links. CMS показывает estimated URL explosion и блокирует массовую индексацию неизвестных комбинаций.

## 11. Предложения и публичные профили

Полная domain model: `OFFERING-CATALOG-ARCHITECTURE.md`. `/offers/:kind/:offeringId` — locator к canonical CMS node, а не primary operational editor.

Tabs:

- **Контент:** public title/summary/description, benefits, included/not included, restrictions, related offers, sections and preview.
- **Медиа:** gallery, focal point, alt and usage state.
- **SEO:** canonical/index/social/schema checks without duplicate SEO editor.
- **Публикация и история:** draft/live diff, first-launch readiness, schedule, versions, audit and rollback links.

Commercial summary — компактная read-only сводка в существующем редакторе, не новая вкладка: offering kind, display mode, readiness/freshness и typed blockers; price/availability/capacity/bindings/tariffs ведут в CRM.

Для программ и event service CMS показывает только editorial title/description, relation, public schedule copy и safe readiness summary; package/rate/capacity/options остаются read-only и ведут в CRM. Произвольный operational CRM `Event` не eligible for publication и никогда не передаёт customer/internal comments в CMS. Occurrence fields появляются только через allowlisted safe projection и не редактируются через content JSON. «Доп» либо привязан к `CatalogOffering(kind=addon)`, либо является CMS-only non-bookable content without price/availability.

Calendar/rule explanation, quote preview и activation blockers приходят из CRM/public projection; CMS не редактирует price book, calendar или tariffs. Action bar ограничен `Сохранить черновик`, `На проверку`, `Опубликовать страницу`; `Запустить на сайте` допускается только как editorial first-launch orchestration после read-only CRM readiness gates.

## 12. Blog/materials

List: status, type, author/reviewer, category/tags, publish/update dates, SEO issues, related pages, performance.

Editor fields:

- title, dek, body/sections, cover/social image;
- content type, category/tags, author/reviewer and experience signals;
- publish/update date and freshness review;
- related resources/programs/events/landings;
- citations/source notes where applicable;
- common SEO/schema/media/analytics/versions.

Первый рабочий текстовый блок в редакторе главной и обычной страницы использует `editorial-content`: абзацы, H2/H3, списки и внутренние ссылки редактируются в «Текст и блоки», сохраняются в редакции страницы и проходят обычный preview/publish. Главная отображает этот блок в порядке секций. Для статьи здесь же указывается необязательное публичное имя автора без отдельной сущности. Если включена Article/BlogPosting-разметка, публикация берёт её `author` из этого имени; старые статьи без имени сохраняют прежний SEO payload. Пустые блоки допускаются только в черновике; перед публикацией нужен хотя бы один заполненный блок. Неподдерживаемые сложные patches форма оставляет без изменений. Изображения в теле статьи, reviewer и остальные авторские метаданные остаются в C5/C9; сохранённая редакция уже открывается в public preview.

## 13. Секции страниц, navigation и components

Секции главной редактируются на `/content/home?tab=composition`; порядок, содержимое и видимость относятся к редакции этой страницы. Отдельный реестр пресетов не нужен для текущего сценария. Старые `/globals/sections/*` ведут в редактор главной. Общие настройки сайта остаются в `/settings/site`; управление одним блоком сразу на нескольких страницах добавляется только при подтверждённом сценарии переиспользования.

`/globals/navigation`: desktop/mobile menus, nesting, external/internal links, visibility, active rules, CTA, broken-link validation. Header/footer share link registry, not copied strings.

Сейчас редактор меню различает текущий черновик и факт предыдущей публикации. Формат внутренних и внешних ссылок проверяется при сохранении; пустые и некорректные адреса не заменяются на `/`. Публичный сайт отдаёт ссылки всех трёх разрешённых уровней меню в HTML и показывает их на компьютере и телефоне, включая клавиатурное раскрытие; обычные переходы работают без JavaScript. Footer показывает все опубликованные колонки и их ссылки без демо-подстановки при пустом списке. Контакты, описание и реквизиты footer редактируются в настройках сайта и публикуются вместе с меню; старые публикации сохраняют прежний текст через fallback. Выключенные вложенные ссылки скрыты. Если общий черновик содержит другие изменения настроек сайта, меню предупреждает, что они выйдут вместе с ним. При публикации настроек или страницы CMS сверяет включённые внутренние ссылки меню и кнопки шапки с опубликованными маршрутами; неопубликованные цели блокируют публикацию с указанием адресов. Пока страниц нет, настройки можно опубликовать для первого релиза. После публикации нужна доставка active release; локальный предварительный вид не подтверждает появление меню на сайте.

`/settings/site` читает тот же серверный черновик, позволяет изменить название сайта, контакты, описание и реквизиты подвала и показывает состав изменений, которые выйдут вместе с ними. Опубликованные контакты питают подвал, FAQ, меню и окна связи сайта. Сохранение сохраняет меню, CTA, hero и секции; публикация применяет весь общий черновик. Права редактирования и публикации проверяются отдельно. Домен пока задаётся конфигурацией сервера; ссылки на юридические документы остаются в шаблоне до отдельной проверки маршрутов.

Секции и шаблоны настраиваются в редакторе соответствующей страницы. Старые `/components/*` ведут в секции главной; отдельный CRUD блоков без подтверждённого сценария переиспользования не нужен. Проверка допустимых renderer/schema остаётся на сервере. `/audit` не показывает вымышленные события: до подключения scoped audit API он сообщает о недоступности журнала и ведёт в реальную историю публикаций.

## 14. Media manager

Views: grid/table, folders as virtual collections, filters by type/status/uploader/date/usage/alt/license/dimensions.

Upload drawer:

- drag/drop or picker;
- queue with checksum/dedupe;
- processing states: upload → scan → decode → WebP variants → ready/error;
- title, alt, caption, credit/license, tags, focal point;
- replace creates a new blob/revision; published usages never silently mutate.

Asset page tabs:

- Preview + metadata;
- Variants (dimensions/size/WebP status);
- Used on (page/revision/section/code line);

В карточке файла редактируются название, alt, подпись, автор/источник, права, метки и точка фокуса. Фокус сразу виден на изображении. Без `canManageMedia` поля доступны только для чтения, а замена и архивирование недоступны. Несохранённые изменения защищены и при переключении вкладки; конфликт версий не выдаётся за успешное сохранение. Пустой alt допустим для декоративного изображения, необходимость осмысленного alt проверяется в контексте публикации.

Библиотека и выбор hero-фона читают серверный поиск и фильтр по состоянию через `GET /media/assets`; по 30 файлов с `nextCursor` и кнопкой «Показать ещё». Смена поиска/фильтра начинает список заново; пустой результат не означает, что за пределами первой страницы нет файлов. Кнопка обновления перечитывает статусы с первой страницы текущего поиска; ранее загруженные страницы можно снова открыть кнопкой «Показать ещё».

«Где используется» показывает source, путь страницы и опубликованность ссылки, ведёт в реестр страницы или журнал публикации. Поиск принимает адрес страницы, а не UUID; при ограниченном ответе API экран показывает общее число и предупреждает о неполном списке. JSON pointer и ID доступны в раскрываемых технических деталях. Опубликованное использование объясняет блокировку архивации.

Карточка файла показывает состояние последней загрузки или замены из API: ожидание загрузки, обработку, автоматический повтор со временем следующей попытки или ошибку. Для ошибки выводится безопасное объяснение по коду и действие; сырой текст инфраструктуры не передаётся в CMS. При ошибке замены готовая прежняя версия остаётся доступной. Статус можно обновить вручную; проценты и ручной retry без серверной команды не показываются.
Пока принятая замена обрабатывается или ожидает автоматического повтора, новую замену начать нельзя. После ошибки замена доступна снова; если прервалась сама загрузка до принятия файла, можно выбрать его повторно. Сохранение названия, alt и других метаданных во время обработки не отменяет замену: новая версия файла применится к тому же asset и сохранит актуальные метаданные. Другая завершившаяся замена или архивирование делают ожидающую замену устаревшей.

Upload grant содержит `assetId`. Если signed upload возвращает `MEDIA_PROCESSING_QUEUED`, файл уже принят: CMS читает этот asset, сообщает об автоматическом повторе и даёт прямой переход в его карточку для проверки статуса. После любой попытки можно выбрать тот же файл снова; новая попытка убирает ссылку на предыдущий результат. Остальные ошибки загрузки остаются ошибками.

«Версии файла» показывают завершённые загрузки из серверной `media_blobs`: номер, время, формат, размер, текущую версию и публичный WebP-предпросмотр прежней версии, пока asset доступен. Показаны последние 100 версий с явным предупреждением об ограничении. Правка названия, alt и других метаданных новой версии файла не создаёт. Восстановление старого файла отдельной кнопкой и технический журнал не имитируются: серверных команд и журнала для них пока нет. Интерфейс не генерирует временные метки, проверки или проценты обработки.

Archive is blocked for published usage until replace/unlink. Original may remain private; delivery UI presents public WebP URLs/variants, not storage secrets.
Замена создаёт новые публичные URL вариантов: ранее опубликованные URL продолжают отдавать прежние неизменяемые варианты, пока asset активен. Новое изображение попадает на опубликованную страницу только после публикации обновлённой CMS-ссылки.

## 15. Files and code

Трёхпанельный desktop view: allowlisted file tree, Monaco-like editor/diff, preview/dependencies/usage. Mobile — browse/diff/read-only by default; code mutation requires desktop and elevated capability.

Tabs: Files, Diff, Preview, Build, Dependencies, Media usage, History.

Actions: create draft workspace, edit, format, save draft, validate, typecheck/lint/build, open preview, request review, publish artifact, rollback. CMS never exposes secrets, `.env`, migrations, DB config, package-manager execution or arbitrary filesystem paths.

«Сразу на фронте» означает:

- draft preview/HMR — секунды;
- production — только после successful gated release;
- failed build never changes production;
- release has immutable Git/build reference and one-click rollback.

## 16. SEO, marketing и redirects UI

Текущий `/seo` читает `currentSeo` списка content nodes: число рабочих страниц, title/description warnings, index policy и canonical. `/seo/pages/:nodeId` отдельно показывает SEO четырёх полей из immutable active release item, сравнивает его с рабочей редакцией и ведёт в canonical editor `?tab=seo`. Если опубликованный payload не читается, сравнение явно недоступно; принадлежность странице к active release и доставку сайта не смешивать. Остальные проверки ниже остаются scope C10.

Текущий `/redirects` показывает только реальные 301 из public route manifest активной публикации: старый адрес, конечный адрес, поиск и ссылку на публикацию. При отсутствии публикации список пуст, ошибка доставки показывается отдельно. Редактирования и ручного создания пока нет; планируемый реестр и проверки slug changes остаются в C10.

В редакторе поле индексации меняет `index_follow`/`noindex_follow`/`noindex_nofollow` через обычное сохранение черновика. Canonical пока показывается без отдельной формы; custom canonical из существующей редакции сохраняется при изменении других SEO-полей.

SEO dashboard tabs: Overview, Pages, Indexing, Metadata, Schema, Internal links, Images, Sitemap/robots, Redirects, Content freshness.

Page SEO fields:

- SEO title, description, H1 check;
- canonical mode/value;
- index/follow;
- OG/Twitter title/description/image;
- breadcrumb label;
- schema types + validated typed fields;
- sitemap eligibility;
- redirect on slug change;
- primary topic/query note, search intent, related links;
- preview for desktop/mobile snippet and share card.

Текущий `/marketing/campaigns` сохранён только для старых ссылок: он объясняет, что промокоды и скидки редактируются в CRM, и ведёт в её реестр. Фиктивные кампании и кнопка создания удалены из обычного меню CMS. Если понадобится редакционное управление баннерами и UTM, оно должно использовать реальные данные/сохранение; расчёт скидки остаётся в CRM.

## 17. Publish workflow

Обычный editor использует двухшаговую direct publication: server-side preflight, затем guarded confirmation. Internal build/activation не нужны для page flow; `/releases` — readonly operational journal с capability-gated recovery actions.

Page editor before publish shows effective before/after diff, affected routes/dependencies/cache tags, gates, reviewer, schedule/timezone and stale preview state. The primary command is `Опубликовать страницу` or `Запустить на сайте` for a coordinated first offer launch. «Предпросмотр» сначала сохраняет локальные правки, проверяет актуальность редакции, затем открывает короткоживущую ссылку в новой вкладке. Если браузер блокирует окно, редактор показывает явную ссылку. Публичный renderer показывает плашку черновика; CRM-цены, доступность, заявки и аналитику в этом режиме не включает. Сломанный/чужой URL и токен закрываются 404.

`/releases` is a readonly operational journal: immutable manifest, affected paths, validation и public API/CDN delivery outcome. Если публикаций нет, журнал ведёт к настройкам сайта и реестру страниц, объясняя публикацию из редактора без ручной сборки релиза. Detail использует существующий CAS replay для failed/dead-letter consumer и создаёт новый immutable release при rollback; произвольное редактирование manifest отсутствует.

By default an author cannot approve own code release; emergency capability is separate and audited. Content validation and infrastructure delivery status are shown independently. Rollback creates a new immutable publication from a prior complete snapshot. Conflict screen follows the existing CRM pattern and distinguishes operational, pricing and editorial source versions.

## 18. Обязательные UI states

Для каждого list/editor/upload/release/code flow: loading, empty, error, permission denied, readonly, disabled, dirty, saving, saved, conflict, validation warning/blocker, processing, scheduled, publish in progress, publish failed, stale preview, long content, missing CRM relation, broken media, mobile/narrow.

No-op controls запрещены. Действие либо работает на fixture boundary в frontend-прототипе, либо явно disabled с причиной.

## 19. Контракт UI kit для public-site AI agent

Нужно создать versioned manifest, например `packages/site-ui/manifest.json`, и документацию `/dev/site-ui-v2`:

- design tokens, typography, spacing, radii, colors, breakpoints;
- Astro/React section and island registry;
- props Zod schemas and schema version;
- approved CTA/action types and stable `analyticsId` rules;
- media component with responsive WebP/focal point/alt contract;
- accessibility, motion, performance and hydration budgets;
- layout slots and inheritance-compatible section keys;
- forbidden imports and server/client boundaries;
- fixture examples for default/empty/error/long/mobile states;
- visual regression stories/screens.

AI-generated page must declare template/renderer version, CMS fields used, assets manifest, analytics IDs, public API dependencies and pass typecheck/lint/build/a11y/visual gates before preview/publish.

## 20. Section completeness and simplification map

This matrix is the target product review of every top-level CMS area. A section is not considered implemented merely because a route/placeholder exists.

| Area | Keep / change | Required complete workflow |
|---|---|---|
| Обзор | keep, reduce decorative cards | attention queue, site/publication/worker health, content and offer readiness, quick actions, aggregate funnel, recent audited changes |
| Страницы сайта | make the single primary registry | one typed tree for homepage, landings, categories/listings and offering-linked pages; move/slug/redirect blast radius, preview, archive/unpublish and filtered views |
| Главная | edit through its typed tree node | typed sections/sources, offer selections, navigation anchors, responsive preview, SEO/media/analytics and direct publish |
| Посадочные | edit/filter through the tree | template/managed mode, intent/owner/expiry, content/relations, SEO/media, preview/publish; no second list authority |
| Offering-linked pages | editorial-only locator | content/composition/media/SEO/publication plus CRM deep link; no price, fulfillment, bindings, tariffs, versions or access matrix |
| Категории/listings | typed tree nodes plus deep configuration | taxonomy, ListingDefinition, filters/sorts/cards, curated indexable nodes and URL-explosion guard; no competing primary registry |
| Blog/materials | keep | article lifecycle, author/reviewer/source notes, relations, freshness, SEO/schema/media and publication |
| Секции главной | edit in home page | typed content, order, visibility, preview and direct publication; shared editing only for confirmed multi-page use |
| Navigation/footer | merge into one link registry UI | desktop/mobile/footer trees, visibility, CTA, broken links, preview and settings publication |
| Media | keep and finish backend states | upload/scan/process, metadata/rights/focal point, variants/usages/version/replace/archive, provider/worker errors |
| Components/templates | capability-gated tool, not primary navigation | renderer/schema versions, reusable instances, usage/blast radius and approved variants; no arbitrary JSON renderer |
| Files/code | capability-gated tool, not ordinary page tab | linked managed artifacts only, diff/build/preview/dependencies/media/history and sandbox gates |
| SEO | keep as reporting/control center | issues and drilldowns; field editing deep-links to canonical page/offer editor; sitemap/schema/indexing/links/images/freshness |
| Marketing | hide until real editorial use | campaign metadata, UTM allowlist and promotion copy only if needed; promo terms and discount calculation remain CRM Pricing |
| Redirects | keep | proposed slug redirects, validation, chains/loops, source/target lifecycle, import/export and audited publication |
| Analytics | keep, implement later | acquisition/content/funnel/forms/retention/quality with consent, server conversion facts and data-quality states |
| Publication log | replace manual release editor | direct publication history, validation/delivery/cache status, retries and rollback; immutable releases stay internal |
| Integrations | keep | connection health, scopes, last delivery, retries/DLQ, secrets never displayed, test connection with audit |
| Users/rights | keep | role/capability matrix, invitations/session state and high-risk capability warnings; backend rechecks every command |
| Site settings | keep | identity/contacts/default timezone/calendar/public base URL/feature settings with field ownership and publish semantics |
| Audit | keep | actor/surface/request/entity/version/change summary, filters/export capability and deep links; no PII spill |
| Data quality | make first-class route | broken relations/media/links, stale source versions, pricing gaps/ambiguity, unpublished/archived dependencies and remediation action |

Primary navigation exposes the single editorial tree and common content tasks. Registry/diagnostic areas remain available, while offering kinds are represented as typed tree nodes and canonical locators rather than separate CMS workspaces.
