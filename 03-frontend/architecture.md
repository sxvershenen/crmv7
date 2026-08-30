# Frontend architecture

## Цель до backend

Собрать реальную структуру CRM и UX, но не сцепить компоненты с временными данными.

## Рекомендуемые границы

```text
apps/crm/
  src/
    app/            # router, providers, shell
    pages/          # route screens
    features/       # user actions/use-cases UI
    entities/       # presentation/model adapters
    data/           # client/repository boundary
    fixtures/       # temporary typed fixtures only

packages/ui/
  src/components/ui/       # shadcn generated
  src/components/domain/   # shared CRM compositions
```

Не обязательно следовать именам буквально; важны границы.

## Fixtures

- Только для design/frontend phase.
- Не хардкодить fixture objects в JSX.
- Один typed data-access boundary должен позволить позже заменить fixtures на `api-client`.
- Не имитировать серверные транзакции/availability/payment authority как «реальную» бизнес-логику.

## Forms

- React Hook Form + Zod presentation schema.
- После backend server contract authoritative; presentation schema может быть удобнее UI, но не переопределяет server rules.

## Shared state

- URL — источник состояния для route, view, filters/date диапазона там, где это полезно для back/share.
- Server state после интеграции — TanStack Query.
- Не делать глобальный store свалкой form state и transient UI.
