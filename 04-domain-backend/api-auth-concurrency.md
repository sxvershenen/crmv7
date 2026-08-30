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
