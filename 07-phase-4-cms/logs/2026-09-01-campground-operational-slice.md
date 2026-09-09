# 2026-09-01 — P4.5B/C/D campground operational slice

## Scope

Закрыть один сквозной campground vertical slice после домиков: owned-tent inventory и shared-capacity зона для палаток гостей, один backend authority, общие CRM/CMS редакторы, canonical CMS locator и development demo data. Safe public projection и operational quote acceptance в scope не входили.

## Architecture

- `ResourceGroup(kind=campground)` используется только для operational grouping и навигации.
- `owned_tent`: отдельный offering, `discrete_inventory`, fixed primary Resource, membership `owned_tent`, capacity в гостях, одна продаваемая единица.
- `own_tent_pitch`: отдельный offering, `shared_capacity`, shared primary Resource, membership `own_tent_area`, capacity в палаточных местах, per-night сумма умножается на units.
- Campground subtype immutable. Binding принимает только один compatible Resource, не ResourceGroup.
- Quote snapshot хранит PriceBook/calendar/rule versions и остаётся fail closed для Booking acceptance: `operationalContext=null`.
- CMS locator ведёт в `resource_detail`; locator не даёт public eligibility, publication ждёт P4.5E.

## Delivered

- Stay offering list/editor/quote contracts и общий Internal/Admin API для `house | campground`.
- Domain validation для campground bindings и deterministic per-night resolver для обеих sales units.
- Static capacity и quantity-shape guards: owned tent проверяет гостей и `units=1`, shared area требует `guests=null` и ограничивает units.
- Migration `1788120400000-campground-offering-integrity` с source-link guard, sellable membership uniqueness и deferred resource/group/terms integrity checks.
- CRM и CMS routes `/offers/campgrounds` и `/offers/campgrounds/:offeringId`, shared compact workspace, subtype badges, semantic capacity labels, binding/add-on/pricing panels и quote simulator.
- Gateways проверяют expected offering kind, поэтому house ID не открывается в campground workspace и наоборот.
- Idempotent development seed: `CAMP-MEADOW`, `CAMP-TENT-PINE` (4 гостя, 6 500 ₽/ночь), `CAMP-OWN-TENT-AREA` (15 мест, 1 200 ₽/место-ночь), active PriceBooks и CMS drafts.

## Verification

- contracts `58/58`;
- domain `34/34`;
- API unit `58/58`;
- PostgreSQL integration `34/34`, включая editor/list/CMS locator, shared quote multiplication, quantity/capacity rejection и immutable fail-closed snapshot;
- `@crm/offering-editor` `13/13`;
- CRM `190/190`;
- CMS/Admin `44/44`;
- typecheck и lint всех затронутых packages, `git diff --check`;
- migration применена к disposable `crm_v7_test` и локальной `crm_v7_dev`, seed повторно выполнен только для local development.

Один существующий house integration race единично вернул ожидаемый allocation conflict не в той фазе; контрольный полный повтор прошёл `34/34`. Рабочая conflict policy не менялась.

## Next

Следующий bounded vertical slice — `CatalogOffering(kind=addon)` как самостоятельный реестр/dossier поверх уже существующей reusable/offering-specific library. Затем venue → program → event service. Public operational data не включать до P4.5E safe release-pinned projection.
