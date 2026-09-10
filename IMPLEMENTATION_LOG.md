# Крупные milestones

История, не текущий статус и не список задач. Текущий статус — `07-phase-4-cms/README.md`, действующие решения — `DECISIONS.md`, команды проверок — `06-quality-process/testing-security.md`.

Подробные сессионные записи до ревизии 2026-09-10 доступны через `git show 9c8da8b:IMPLEMENTATION_LOG.md`. Профильные Phase 4 logs сохраняют acceptance evidence на дату прогона; их Next/Remaining и названия моделей исторические. Старый passed не подтверждает текущий HEAD.

## 2026-08-23 — 2026-08-30: CRM frontend

Shared UI, route-driven CRM screens/editors, fixture data boundary, responsive flows и forms pilot. Public site переведён на Astro-first foundation.

## 2026-08-31: Backend и CMS foundation

NestJS/PostgreSQL/domain/contracts и CRM API integration; отдельный CMS workspace, три API namespace, versioned content и atomic publication. Public UI kit/homepage, source-authored page contract, media foundation и release-pinned listing engine. Отдельная v1 gallery удалена; поддерживается `/dev/site-ui-v2`.

## 2026-09-01 — 2026-09-03: Commercial authority

Typed catalog/pricing/calendar/bindings, immutable quotes и accepted house BookingItem links. House/campground/add-on editors, provider-neutral fenced projection delivery, canonical CMS drafts. CRM stay IA сведена к Resource dossier, CMS — к editorial-only tree. Добавлены safe add-on projection и Booking add-on composition.

## 2026-09-05 — 2026-09-06: CRM marketing и UX

Operational promotions, order-level скидки, отчёты по броням и UTM сохранённых Lead; visitor collection не включён. Уточнены CRM date/time и demo flows. Контракт — `07-phase-4-cms/CRM-MARKETING-IMPLEMENTATION.md`.

## 2026-09-09: Booking↔Lead и programs

Link/relink/unlink/history согласованы с versions/idempotency/audit/outbox. Migration registry един для CLI/API/seed, destructive tests защищены disposable DB/restricted-role guard. Program offering template preview и occurrence-bound ProgramRegistration acceptance разделены; legacy unpriced flow сохранён.

## 2026-09-10: Event acceptance

Customer Event/version-bound quote, fixed-resource allocation/cancellation, quantity/person add-ons и PostgreSQL guards. Preview не принимает заказ; shared-capacity Event resources заблокированы. После поздней проверки live-среды обнаружено отставание локальных migrations; рабочая DB обновлена с backup без reseed. Подробные проверки и ограничения — `07-phase-4-cms/logs/2026-09-10-event-order-acceptance.md`.

## 2026-09-10: Ревизия документации

Убраны повторные completed tasks из планов, дубли и временный planning report; current status отделён от исторического evidence. Правила работы требуют ранней проверки целевой среды, соразмерных проверок и остановки после acceptance. Runtime и тестовая логика этой ревизией не меняются.
