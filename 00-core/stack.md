# Технологический стек

## CRM frontend

- React;
- TypeScript strict;
- Vite;
- React Router;
- Tailwind CSS;
- CSS custom properties;
- Roboto;
- **Tabler Icons** для пользовательской иконографии;
- shadcn/ui через официальный CLI;
- preset `bIkezqK` как база UI-примитивов/темы;
- TanStack Query — при подключении API;
- React Hook Form + Zod;
- dnd-kit либо специализированный scheduler engine;
- Vitest;
- Playwright.

Минимальный основной текст: `12px`.

## Backend — позже

- Node.js 22 LTS, baseline `22.16.0`, engines `>=22.16.0 <23`;
- NestJS + Express adapter;
- TypeScript strict;
- TypeORM Data Mapper + `@nestjs/typeorm`;
- PostgreSQL через `pg` во всех окружениях;
- Zod contracts + OpenAPI;
- Pino structured logging;
- cookie-based internal session;
- SSE для простых live updates;
- Jest/integration tests против PostgreSQL.

## Public site — позже

- Astro;
- TypeScript;
- Tailwind CSS;
- только public NestJS API, без прямого доступа к БД.

## Monorepo

`pnpm workspaces`, единый lockfile.
Рекомендуемые workspace: `apps/crm`, `apps/api`, позже `apps/site`, `apps/admin`; packages: `ui`, `contracts`, `domain`, `db`, `api-client`, `config`, `testing`.
