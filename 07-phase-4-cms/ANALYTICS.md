# Собственная аналитика

## 1. Цель и граница

Раздел отвечает на вопросы: откуда пришёл трафик, что нажимают, какие page/section/category/filter работают, где теряется funnel и какие источники приводят к authoritative Lead → Booking → Payment.

`ChangeLog` остаётся аудитом действий сотрудников. `analytics_events` — отдельный append-only контур. Я.Метрика — внешний comparative/ad platform, не источник истины для Lead, Booking, consent или revenue.

## 2. Identity model

- `visitorId`: случайный first-party opaque ID в server-issued signed Secure/SameSite cookie; не fingerprint и не доверенное client value.
- `sessionId`: server-issued/signed session, стартовая политика — 30 минут inactivity.
- `attributionId`: first touch + last non-direct + conversion touch.
- known link появляется только после successful server intake и только при утверждённой цели/consent.
- Booking/Payment связь строится сервером через authoritative Lead/Booking/payment data.

Public intake получает короткоживущий signed correlation token. Только сервер после успешного создания Lead может связать его с permitted visitor/session. Browser никогда не передаёт произвольный Lead/Booking/customer ID. Обязательны fixation/hijacking/replay tests.

IP не является надёжным user ID из-за NAT/VPN/mobile/dynamic addresses. Raw IP не хранится в analytics events, CRM card, UTM, ChangeLog или export. Для security/rate-limit он обрабатывается в отдельном краткоживущем контуре. Любой HMAC/coarse geo вариант требует отдельного privacy decision.

`yclid`, Metrika Client ID и account-level «Яндекс ID» — разные вещи. CMS не пытается добыть или угадать Яндекс-аккаунт. Допустимый external analytics identifier хранится только как минимизированная, consented reference в закрытом mapping-контуре и не показывается обычному менеджеру.

## 3. Event envelope

```ts
type ClientEventInput = {
  eventId: string
  schemaVersion: number
  occurredAt: string
  eventName: AllowedEventName
  pageId?: string
  pagePath?: string // no query/hash
  sectionId?: string
  contentVersion?: string
  properties: AllowedPropertiesByEvent
}

type StoredAnalyticsEvent = ServerEnriched<ClientEventInput> & {
  receivedAt: string
  visitorId?: string
  sessionId?: string
  consentSnapshot: ConsentSnapshot
  deviceClass: DeviceClass
  trafficClass: TrafficClass
  normalizedReferrerHost?: string
}

type DomainConversionFact = {
  domainEventId: string
  occurredAt: string
  eventName: ServerConversionName
  leadId?: string
  bookingId?: string
  paymentId?: string
  pageContext?: PublishedPageContext
}
```

`properties` — discriminated Zod union, не arbitrary JSON. Visitor/session, consent enforcement, referrer/device/bot class and `receivedAt` are server-enriched. Collector rejects excessive clock skew and retains both received/occurred timestamps. Domain facts can be offline and do not require page context. Нельзя отправлять form values, phone/email/name, comments, full referrer/query, search text или full User-Agent.

## 4. Taxonomy v1

| Группа | События |
|---|---|
| Навигация | `page_view`, `section_impression`, `navigation_click`, `outbound_click`, `file_download` |
| Контент | `resource_card_opened`, `resource_viewed`, `category_viewed`, `program_viewed`, `event_viewed`, `faq_opened`, `map_point_opened` |
| Listing | `filter_applied`, `filter_cleared`, `sort_changed`, `pagination_changed`, `zero_results_seen` |
| CTA | `cta_clicked`, `phone_revealed`, `phone_clicked`, `messenger_clicked`, `promo_copied` |
| Calculator | `calculator_started`, `calculator_step_viewed`, `calculator_option_changed`, `calculator_quote_updated`, `calculator_completed` |
| Form | `form_started`, `form_step_completed`, `form_validation_failed` (field code only), `form_submit_attempted|succeeded|failed` |
| Server conversion | `lead_created|qualified|rejected`, `booking_linked|confirmed`, `payment_recorded|refunded` |
| Technical | `collector_rejected|rate_limited`, `schema_version_mismatch`, `consent_changed` |

Impression default: at least 50% visible for 1 second, once per section/contentVersion/session. CTA/filter IDs are stable registry identifiers from CMS, never DOM selector or current button text.

## 5. Attribution

Allowlist: `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term` with length limits and normalization. Unknown query parameters are discarded. Referrer keeps hostname/channel only.

On Lead creation server stores immutable attribution snapshot. Dashboard must let user switch first-touch/last-non-direct/conversion-touch and label the selected model.

## 6. Storage/read models

- `analytics_pages`, `analytics_sections`, `analytics_content_versions`, `analytics_campaigns`;
- `analytics_visitors`, `analytics_sessions`, `analytics_attribution_touches`;
- non-partitioned `analytics_ingest_dedup(event_id, received_at)` for global idempotency plus monthly-partitioned `analytics_events`;
- restricted `analytics_identity_links` with purpose/consent/expiry/revocation;
- `analytics_conversion_facts` from domain events;
- daily page/section/campaign/funnel aggregates;
- ingest failures, data quality runs, alerts, export audit, privacy requests.

Collector: `POST /api/public/v1/analytics/events`, small batch, body limit, rate limit, dedupe, accepted schema versions. Aggregation is asynchronous. Server facts arrive through per-consumer Outbox delivery.

## 7. CMS/CRM analytics IA

Полный раздел находится в `apps/admin`; CRM получает deep link и compact operational view on the same read models, без второй логики расчёта.

Tabs:

1. **Обзор:** visitors, engaged sessions, leads, confirmed bookings, paid revenue, conversion, compare.
2. **Привлечение:** channel/source/medium/campaign, landing, attribution model.
3. **Страницы и контент:** page/category/resource/program/event, section, CTA, content-version impact, zero results.
4. **Воронки:** configurable steps, drop-off, time-to-convert.
5. **Калькулятор и формы:** step funnel, validation codes, success → Lead reconciliation.
6. **Retention:** new/returning and aggregate cohorts.
7. **Качество:** collector health, rejects, missing dimensions, consent coverage, domain reconciliation.
8. **Интеграции и privacy:** Metrika coverage, policy version, retention, privacy requests, export audit.

Filters: period/compare, page/type/category/section, source/campaign/channel, device, new/returning, traffic class, consent. Drilldown stops at pseudonymous/aggregated data unless explicit elevated capability and audited purpose exist.

## 8. Funnels

- page → section → CTA → form → server Lead;
- resource → quote/calculator → form → Lead link → confirmed Booking;
- program/event → interest/registration → payment;
- campaign → qualified Lead → confirmed Booking → paid revenue.

Money comes only from payment ledger. Calculator quote is labelled estimated and never merged with revenue.

## 9. Consent, retention и legal gate

Separate purposes: necessary security, first-party analytics, marketing attribution, Я.Метрика. Contact processing for a request is separate from marketing analytics consent. Withdrawal stops new tracking and invokes approved unlink/delete workflow; irreversible aggregates can remain only under an approved policy.

Enforcement matrix before launch:

| Purpose | Before consent/refusal | After consent | After revoke |
|---|---|---|---|
| Necessary security | short-lived security/rate-limit only | same | same; never reused for marketing |
| First-party analytics | drop non-essential browser events; no hidden queue | set signed visitor/session and collect allowlisted events | stop, clear/expire IDs, run approved unlink/delete workflow |
| Marketing attribution | retain only strictly necessary intake snapshot if separately permitted | store allowed UTM/click mapping | stop and remove/expire mapping by policy |
| Я.Метрика | tag not loaded | load configured tag | disable future collection and follow provider/policy workflow |
| Server business facts | always remain in CRM domain | remain | remain; do not visitor-link without permitted purpose |

Consent evidence is versioned with timestamp/source/policy version. Cookie names, TTL, `Secure`, `HttpOnly` where applicable and `SameSite` are part of the approved contract. Export/delete/DSAR operations and identity-link access are audited.

Starting engineering proposal, not legal policy:

- pseudonymous raw events: 90 days;
- sessions/touches: 180 days;
- identity link: purpose-bound review TTL, initially 90–180 days;
- raw IP in analytics: never; security logs use separately approved minimal TTL;
- irreversible monthly aggregates: up to 25 months if approved.

Before production, the operator/legal/privacy owner must approve purposes, notices/consent, retention, access/export/delete, providers, data location and cross-border flows. The current official text requires an accessible privacy policy for Internet collection and contains localization restrictions for collection of Russian citizens' personal data: [Федеральный закон № 152-ФЗ, официальный текст](https://ips.pravo.gov.ru/api/ips/legislation/document?baseid=None&hash=98490812b3409e2a8d78a11ca9010f434ea3d9250a11dbbdb78690cd5551bdd6).

## 10. Я.Метрика

- consent-gated tag/config;
- encrypted integration settings, secrets never returned;
- aggregate reconciliation by date/page/campaign;
- discrepancies shown as coverage, not overwritten business facts;
- no phone/email/internal entity IDs/raw IP/consent evidence sent;
- no person-level identity graph imported into CRM.

## 11. Alerts/data quality

- traffic/form/Lead coverage drop;
- collector rejects/duplicates/schema mismatch spike;
- form success without server Lead;
- unusual bot/internal share;
- CRM facts differ from aggregates;
- missing page/section/contentVersion;
- Metrika disabled or coverage drift;
- delayed worker/outbox delivery.

Alerts notify technical/admin roles; they never mutate business statuses or money.

## 12. Tests

- contract/OpenAPI for every event;
- UTM normalization, attribution, consent, TTL, dedupe, bot classification;
- PostgreSQL partitions/aggregates/outbox fan-out/idempotency;
- public collector abuse/body/CORS/redaction tests;
- Playwright accept/refuse/revoke, impression once, calculator/form → Lead;
- reconciliation against Lead/Booking/Payment fixtures;
- assertions that logs/errors/exports/ChangeLog contain no raw IP, cookie, phone/email or event payload values;
- retention purge and privacy access audit.
