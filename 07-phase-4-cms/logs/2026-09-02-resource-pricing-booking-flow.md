# Resource pricing and booking quote flow — 2026-09-02

## Outcome

- CRM Resource получил одноуровневую вкладку «Продажа и цены» без внутренних overview/composition/pricing tabs, offering identity, binding controls и дублей capacity/availability.
- House/owned-tent показывают base price + included guests + extra guest; own-tent pitch показывает цену за место.
- Особые цены задаются явными weekdays, праздниками и arbitrary inclusive UI period; runtime хранит half-open interval.
- Internal/Admin получили `POST /offerings/by-resource/:resourceId/quotes/preview`; Public API его не раскрывает.
- `/bookings/new?tab=composition` автоматически пересчитывает stay-цену по Resource, датам и гостям. Форма показывает рубли, repository хранит копейки и корректно переводит скидку-процент в monetary discount.
- Исходная заявка осталась одним control в sidebar; клиент и телефон уложены в одну desktop-строку.

## Demo data

`HOUSE-PINE` активирован с ценой 12 000 ₽ до 4 гостей, +1 500 ₽ за следующего, 14 000/+1 750 ₽ на Пт–Вс, 16 000/+2 000 ₽ в праздники и 22 000/+2 500 ₽ на период «Новый год». Dev business calendar покрывает 2026-09-01…2027-12-31.

## Verification

- contracts: 65/65;
- domain: 37/37;
- offering editor: 19/19;
- CRM: 213/213;
- CMS: 63/63;
- API unit: 71/71;
- PostgreSQL integration: 36/36;
- typecheck, lint, `git diff --check`.

## Remaining boundary

Quote preview создаёт immutable snapshot, но accepted BookingItem пока не ссылается на `quoteId`; это следующий bounded acceptance increment.

## Unified dossier follow-up

- Resource tab переименован в «Цена и сайт»: цены, допы и сводка canonical website page находятся в одном dossier.
- Legacy `showOnSite` и manual `CMS ID` больше не редактируются в Resource Main; internal description явно помечено как непубличное.
- First save house/campground Resource одним user action подготавливает hidden offering/binding/CMS draft; legacy Resource получает business-labelled recovery action.
- CRM legacy stay detail URLs exact-resolve primary Resource и redirect в его dossier; invalid/ambiguous graphs fail closed.
- CRM→CMS ссылка ведёт в `/offers/houses|campgrounds/:offeringId?tab=content`; generic «Публичные профили» скрыт из primary CMS navigation, но diagnostics route сохранён.

## Visual density follow-up

- Embedded Resource pricing собран в компактную формулу `цена / включено гостей / доплата`; короткие numeric controls больше не растягиваются на ширину всей колонки.
- Особые цены показываются responsive-строками с типом, условием/датами, ценой и удалением; применение цен и quote стоят рядом на wide desktop.
- Offering content workspace в CMS использует компактную identity/route сетку, полную ширину для длинного текста и hero preview рядом с настройками.
- CRM и CMS явно сканируют shared `packages/offering-editor/src` в Tailwind source graph; production build и live browser подтвердили, что arbitrary responsive grids реально попадают в CSS.

Next staged dossiers: venue Resource → ProgramTemplate → EventServiceTemplate. Customer Event remains a separate operational order.
