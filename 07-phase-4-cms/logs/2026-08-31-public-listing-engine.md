# 2026-08-31 — Public listing engine foundation

## Выполнено

- Добавлен общий strict `ListingDefinition` contract и отдельный wire contract для GET query с dynamic URL keys.
- `PublicResolvedSection.config` и CMS scalar patch принимают полный типизированный listing definition без ослабления остальных bounded JSON configs.
- Реализован `GET /api/public/v1/listings/resolve`:
  - читает definition и карточки из одного active release;
  - проверяет hash listing page и каждого profile item;
  - отклоняет неизвестные фильтры, sort, значения option и недействительную page;
  - нормализует порядок фильтров и добавляет стабильный UUID tie-breaker;
  - отдаёт только allowlisted resource/program attributes;
  - исключает archived records, скрытые resources и unpublished programs;
  - не читает и не возвращает operational events/occurrences;
  - ставит `X-Robots-Tag: noindex, follow` для filter/sort/page query.
- Public OpenAPI описывает listing resolver отдельно от admin namespace.
- Astro SSR adapter подключён к resolver; query canonical остаётся базовым CMS path.
- В `@crm/site-ui` добавлены canonical `CatalogCard` и `PublicProfileIntro`; фильтры поддерживают select/search/range, apply/reset, а pagination использует реальные href для crawlability.
- `/dev/site-ui` показывает catalog card, profile fallback и существующие loading/empty/error/listing states.
- Catch-all route отображает CMS-first resource/program profile fallback без выдуманных CRM значений.

## Проверки

- Contracts: 26/26.
- API unit: 34/34.
- PostgreSQL integration: 21/21, включая настоящий active release + CMS source link + resource eligibility и отказ неизвестного query key.
- Contracts/API/site-ui/site typecheck: зелёные.
- API/site lint и API/site build: зелёные.
- Public Playwright: 18/18 desktop/mobile; homepage viewport и full-page baselines не обновлялись.

## Осознанные границы следующего slice

- Admin form для удобного редактирования listing definitions и category options ещё не построен; контракт и atomic patch boundary готовы.
- `program_occurrence`, `public_event_offering` и article listing fail closed до отдельных safe projection/eligibility правил.
- Filter execution сейчас выполняется над release-pinned safe card set после одного SQL read. До больших каталогов нужен SQL projection/index plan и load gate без изменения публичного контракта.
- CMS-managed resource/program profiles пока получают только editorial fallback; gallery/sections и authoritative CRM quote/availability подключаются отдельными безопасными endpoints.
