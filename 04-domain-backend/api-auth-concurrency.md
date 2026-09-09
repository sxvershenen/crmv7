# API, auth, permissions, conflicts

## API namespaces

- `/api/internal/v1` — CRM;
- `/api/public/v1` — public site;
- `/api/admin/v1` — technical/content admin.

Public API не отдаёт internal comments, чужие PII, finance history, audit, internal statuses, staff personal data.

## Contracts

`packages/contracts` — Zod schemas/types/errors/events без Nest/TypeORM/React dependencies.
Одна каноническая схема используется для runtime validation, OpenAPI, api-client, error mapping, contract tests.
TypeORM entity != API DTO.

## Error shape

```json
{
  "code": "RESOURCE_CONFLICT",
  "message": "Ресурс уже занят",
  "fieldErrors": {"endAt": ["Интервал пересекается с другой бронью"]},
  "details": {},
  "requestId": "..."
}
```

Frontend должен уметь показать global + field errors и conflict details.

## Auth

Внутренние приложения: secure cookie-based session; не хранить long-lived token в `localStorage`.
Login/logout/session expiry/user block/password change/login audit.

## Permissions

Backend возвращает capabilities (`canEdit`, `canChangeStatus`, `canAddPayment`, `canRefund`, `canArchive`, `canOverrideConflict`...), frontend использует их для UI, backend повторно проверяет на операции.

Базовые роли: admin, manager, lead/manager-supervisor, technical admin, readonly.

## Open-editor conflict

Показать кто/когда изменил, affected fields, local vs server value. Действия: refresh/retry/apply selected changes/save copy if allowed/close.

## Multi-surface offering editor

CRM и CMS могут показывать один commercial offering editor, но transport adapters `/internal/v1` и `/admin/v1` обязаны вызывать один `OfferingEditorApplicationService` и одни domain commands. Composite read model возвращает offering/subject/pricing/editorial/public readiness, field ownership, capabilities и отдельные source versions.

Mutation changes are owner-segmented:

- operational/catalog/pricing segment uses offering/subject/price-book expected versions;
- editorial segment creates the same immutable CMS draft revision and uses node version/revision hash;
- common `operationId`, idempotency, actor, request ID and entry surface are audited;
- conflict response names the stale segment and fields instead of flattening all sources into one version;
- a combined first-launch command is available only when one backend orchestration can validate/commit all required operational eligibility and CMS publication gates; otherwise UI keeps activation and publication as explicit separate actions.

The editor read model exposes separate CAS tokens rather than one synthetic version:

- `catalog`;
- typed `subject` (`resource | program_template | event_service_template`);
- `pricing` and current draft price-book version;
- `addonAssignments`;
- editorial node/revision/content hash.

Updating one segment requires only that segment's named expected version. Price-book activation must not conflict with an unrelated CMS text draft. `entrySurface`, actor and request ID are injected by the authenticated transport adapter and are never accepted from request body.

P4.5B target paths use the same relative shape under both internal and admin namespaces: offering list/create/editor, segmented catalog/subject patch, price-book draft/replace/activate, searchable add-on library, assignment replace/custom-create-and-assign and internal quote preview. Controllers and OpenAPI paths are added only with runtime implementation; P4.5A exports contracts but does not advertise planned endpoints. Public summary/quote/availability routes remain P4.5E work and expose only allowlisted DTOs without rule IDs, bindings, draft state, margins, staff or audit data.
