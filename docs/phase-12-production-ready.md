# Этап 12. Production-ready подготовка

## Цель этапа

Подготовить проект к стабильному запуску в production: контейнеризация, CI-проверки, операционные скрипты и базовый релизный контур.

## Что реализовано

- Контейнеризация:
  - добавлен multi-stage Dockerfile для API: `Dockerfile.api`;
  - добавлен multi-stage Dockerfile для Web: `Dockerfile.web`;
  - добавлен production compose: `docker-compose.prod.yml`;
  - при старте API-контейнера автоматически выполняются `prisma migrate deploy` и `npm run prisma:seed -w @mini-crm/api` (если `AUTO_SEED=true`).
- Надежность runtime:
  - API корректно завершается по `SIGINT`/`SIGTERM` (graceful shutdown);
  - добавлен параметр `LOG_LEVEL` для настройки уровня логов;
  - добавлен health endpoint фронтенда: `GET /api/health`.
- CI:
  - добавлен pipeline `.github/workflows/ci.yml`;
  - шаги: `npm ci` -> `npm run typecheck` -> `npm run test` -> `npm run build`.
- Операционные скрипты:
  - `scripts/db-backup.sh` — backup PostgreSQL в формате dump;
  - `scripts/db-restore.sh` — восстановление PostgreSQL из dump.
- Команды в `package.json`:
  - `npm run docker:prod:up`
  - `npm run docker:prod:down`
  - `npm run backup:db`
  - `npm run restore:db`

## Измененные файлы

- `Dockerfile.api`
- `Dockerfile.web`
- `docker-compose.prod.yml`
- `.dockerignore`
- `.github/workflows/ci.yml`
- `scripts/db-backup.sh`
- `scripts/db-restore.sh`
- `apps/api/src/config/env.ts`
- `apps/api/src/server.ts`
- `apps/api/src/index.ts`
- `apps/api/.env.example`
- `.env.example`
- `apps/web/app/api/health/route.ts`
- `.gitignore`
- `package.json`
- `README.md`

## Проверки этапа

- typecheck API/Web;
- тесты API/Web;
- build API/Web.

## Что дальше (этап 13)

- Уведомления по событиям (email/telegram/slack).
- E2E сценарии ключевых бизнес-потоков.
- Расширение правил автоматизаций и шаблонов действий.
