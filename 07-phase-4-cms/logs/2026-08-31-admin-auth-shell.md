# 2026-08-31 — CMS authenticated shell

## Delivered

- cookie-session bootstrap/login/logout через internal API;
- auth transport без retry login/logout и без expiry-event на invalid credentials;
- обязательный re-auth dialog без размонтирования редактора и потери dirty state;
- canonical auth response contracts и HTTP 200 controller semantics;
- real user identity/logout, global `canViewContent`, granular route/nav/quick-create guards;
- отдельное capability-aware mobile menu и upload/create direct-route guards;
- local Vite `/api` proxy и идемпотентный dev seed для browser QA.

## Verification

- живой browser smoke: invalid login, successful API login, real identity shell, content tree/home routes;
- admin unit/component `22/22`, typecheck, lint и production build;
- API unit `30/30`, PostgreSQL integration `17/17`, contracts `26/26`;
- Node 24 warning remains; target is Node `>=22.16 <23`.
