# Мини-CRM для маркетингового агентства

MVP: лиды с этапами и обязательными полями, брифы, сделки, версии КП, задачи, контроль сроков ответа и отчёты по воронке. Роли от админа до наблюдателя, импорт лидов из CSV.

An MVP CRM for a marketing agency: staged leads with required fields, briefs, deals, proposal versions, tasks, response-time control and funnel reports. Next.js + Fastify + Prisma + PostgreSQL + Redis, Docker.

Автор: [Вадим Антонович](https://vadim.tabletools.ru). Данные в сидах и примерах вымышленные.

## Что уже реализовано

- Backend: Fastify + Prisma + PostgreSQL
- Авторизация + RBAC (`admin`, `head`, `manager`, `account`, `viewer`)
- Лиды:
  - создание/список/детали/обновление
  - назначение ответственного
  - переходы по этапам
  - история этапов
- Валидация обязательных полей при переходе этапа (`required_fields` из таблицы `stages`)
- Брифы по лидам:
  - создание/обновление/просмотр
  - отметка о завершении
- Сделки:
  - создание/список/детали/обновление
  - закрытие в `won/lost`
- КП (proposals):
  - версии КП внутри сделки
  - отправка и хранение ссылки/суммы
- Задачи:
  - создание/список/обновление
  - завершение задачи
- SLA:
  - отчет `reports/sla`
  - ручной запуск проверки `sla/run-check`
  - автосоздание SLA-задач по просрочкам
  - автозапуск SLA-проверки по расписанию (через env)
- Отчеты:
  - `reports/funnel`
  - `reports/manager-performance`
  - `reports/lost-reasons`
  - `reports/source-performance`
  - `reports/proposal-conversion`
- Локальная инфраструктура: Docker Compose (PostgreSQL + Redis)
- Frontend (Next.js, русский интерфейс):
  - вход/выход через API (`login/refresh/me/logout`)
  - хранение сессии в браузере
  - дашборд с реальными данными лидов и задач
  - KPI по воронке и конверсии КП (для ролей `admin/head`)
  - канбан лидов с drag-and-drop переходами этапов
  - создание лида прямо из канбана
  - фильтры и быстрый поиск по канбану (этап/приоритет/ответственный/текст)
  - массовые действия по лидам (назначение/приоритет/перенос этапа) + шорткаты выделения
  - импорт лидов из CSV через UI
  - карточка лида 360: обзор, бриф, сделки+КП, активности
  - редактирование основных полей лида (контакты + follow-up + приоритет)
  - создание/редактирование/завершение задач из UI
  - редактирование и завершение брифа прямо из карточки
  - блок автоматизаций: список правил и ручной запуск события
- Автоматизации:
  - движок правил по событиям (`lead.created`, `lead.stage_changed`, `lead.brief_completed`, `deal.closed_won`, `deal.closed_lost`)
  - действия: создание задачи, смена приоритета лида, установка `nextFollowUpAt`
  - автоматический запуск из бизнес-процессов (переход этапа, завершение брифа, закрытие сделки)
  - ручной запуск автоматизации через API и UI (для ролей `admin/head`)
  - расширенные правила:
    - первичный контакт для входящих лидов (`site-form`/`telegram`/`meta-leads`);
    - follow-up после отправки КП (`proposal-sent`);
    - контроль подписания договора (`contract-pending`)
- Тесты и стабилизация:
  - настроен `vitest` для backend и frontend;
  - backend unit-тесты для automation-движка (исполнение правил и дедупликация задач);
  - backend e2e-сценарий критичного потока автоматизаций: входящий лид -> КП -> победа сделки;
  - frontend тесты CSV-парсера и smoke-тест экрана входа;
  - добавлена единая команда `npm run test`.
- Production-ready:
  - Dockerfile для API и Web (`Dockerfile.api`, `Dockerfile.web`);
  - `docker-compose.prod.yml` для production-окружения;
  - CI pipeline (`.github/workflows/ci.yml`) с шагами typecheck/test/build;
  - скрипты резервного копирования и восстановления PostgreSQL (`scripts/db-backup.sh`, `scripts/db-restore.sh`);
  - graceful shutdown API (`SIGINT`/`SIGTERM`) и настраиваемый `LOG_LEVEL`;
  - health endpoint для frontend: `GET /api/health`.

## Структура проекта

- `apps/api` — backend API
- `apps/web` — frontend
- `docs` — технические заметки по этапам
- `scripts` — инфраструктурные скрипты (backup/restore)
- `docker-compose.yml` — локальная инфраструктура
- `docker-compose.prod.yml` — production compose
- `.github/workflows/ci.yml` — CI pipeline

## Локальный запуск

1. Установить зависимости:

```bash
npm install
```

2. Поднять инфраструктуру:

```bash
docker compose up -d
```

3. Подготовить env-файлы:

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

4. Применить миграцию и seed:

```bash
npm run prisma:migrate -w @mini-crm/api -- --name init
npm run prisma:seed -w @mini-crm/api
```

5. Запустить backend:

```bash
npm run dev:api
```

Если `dev:api` падает (например, ошибка `EPERM` в `tsx watch`), используйте запуск без watch:

```bash
npm run dev:api:plain
```

6. Запустить frontend:

```bash
npm run dev:web
```

Откройте в браузере: `http://localhost:3000`

Если dev-сборка Next.js когда-либо упадет с ошибками вида
`private-next-instrumentation-client` или `fallback-build-manifest.json`,
очистите кэш frontend и запустите заново:

```bash
npm run clean -w @mini-crm/web
npm run dev:web
```

## Данные администратора (seed)

- Email: `admin@crm.local`
- Пароль: `Admin123!`

После первого входа пароль нужно заменить.

Для первого входа можно использовать эти тестовые данные на странице авторизации.

## Порты

- API: `4000`
- Web: `3000`
- PostgreSQL (docker): `5433`
- Redis (docker): `6380`

## Быстрые проверки API

```bash
curl http://localhost:4000/health/live

curl -X POST http://localhost:4000/api/v1/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"admin@crm.local","password":"Admin123!"}'

curl -X POST http://localhost:4000/api/v1/integrations/webhooks/leads/site \
  -H 'content-type: application/json' \
  -H 'x-integration-secret: change-me-webhook-secret' \
  -d '{"companyName":"ООО Тест","mainContactName":"Иван Петров","mainContactEmail":"ivan@example.com"}'
```

## Реализованные endpoint-группы

- Auth:
  - `POST /api/v1/auth/login`
  - `POST /api/v1/auth/refresh`
  - `POST /api/v1/auth/logout`
  - `GET /api/v1/auth/me`
- Leads:
  - `GET /api/v1/leads`
  - `GET /api/v1/leads/stages`
  - `POST /api/v1/leads`
  - `GET /api/v1/leads/:id`
  - `PATCH /api/v1/leads/:id`
  - `POST /api/v1/leads/:id/assign`
  - `POST /api/v1/leads/:id/stage-transitions`
  - `GET /api/v1/leads/:id/history`
- Briefs:
  - `GET /api/v1/leads/:leadId/brief`
  - `POST /api/v1/leads/:leadId/brief`
  - `PATCH /api/v1/leads/:leadId/brief`
  - `POST /api/v1/leads/:leadId/brief/complete`
- Deals + Proposals:
  - `GET /api/v1/deals` (поддерживает фильтр `lead_id`)
  - `POST /api/v1/deals`
  - `GET /api/v1/deals/:id`
  - `PATCH /api/v1/deals/:id`
  - `POST /api/v1/deals/:id/close-won`
  - `POST /api/v1/deals/:id/close-lost`
  - `GET /api/v1/deals/:id/proposals`
  - `POST /api/v1/deals/:id/proposals`
- Tasks:
  - `GET /api/v1/tasks` (поддерживает фильтр `lead_id`)
  - `POST /api/v1/tasks`
  - `PATCH /api/v1/tasks/:id`
  - `POST /api/v1/tasks/:id/complete`
- SLA:
  - `GET /api/v1/reports/sla`
  - `POST /api/v1/sla/run-check`
- Reports:
  - `GET /api/v1/reports/funnel`
  - `GET /api/v1/reports/manager-performance`
  - `GET /api/v1/reports/lost-reasons`
  - `GET /api/v1/reports/source-performance`
  - `GET /api/v1/reports/proposal-conversion`
- Integrations:
  - `POST /api/v1/integrations/webhooks/leads/site` (header `x-integration-secret`)
  - `POST /api/v1/integrations/webhooks/leads/telegram` (header `x-integration-secret`)
  - `POST /api/v1/integrations/import/leads-csv` (требует авторизацию)
- Automations:
  - `GET /api/v1/automations/rules` (требует роль `admin/head`)
  - `POST /api/v1/automations/run` (требует роль `admin/head`)

## Команды тестирования

```bash
npm run test
npm run test:api
npm run test:web
```

## Production запуск (Docker)

```bash
npm run docker:prod:up
```

Остановить:

```bash
npm run docker:prod:down
```

Сервисы:

- Web: `http://localhost:3001`
- API: `http://localhost:4000`
- API health: `http://localhost:4000/health/live`
- Web health: `http://localhost:3001/api/health`

При старте API-контейнера автоматически выполняются:

- `prisma migrate deploy`
- `npm run prisma:seed -w @mini-crm/api` (если `AUTO_SEED=true`)

Перед запуском в production обязательно смените секреты:

- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `INTEGRATION_WEBHOOK_SECRET`

## Резервные копии БД

Создать backup:

```bash
npm run backup:db
```

Восстановить из backup:

```bash
npm run restore:db -- ./backups/<file>.dump
```

## Настройки автозапуска SLA

В `apps/api/.env`:

```env
LOG_LEVEL=info
SLA_AUTORUN_ENABLED=false
SLA_AUTORUN_INTERVAL_MINUTES=15
SLA_AUTORUN_ACTOR_USER_ID=1
SLA_AUTORUN_RUN_ON_START=false
```

- `SLA_AUTORUN_ENABLED=true` — включить планировщик.
- `SLA_AUTORUN_INTERVAL_MINUTES` — интервал в минутах.
- `SLA_AUTORUN_ACTOR_USER_ID` — пользователь, от имени которого создаются SLA-задачи.
- `SLA_AUTORUN_RUN_ON_START=true` — выполнить одну проверку сразу после старта API.

## Настройки интеграций

В `apps/api/.env`:

```env
INTEGRATION_WEBHOOK_SECRET=change-me-webhook-secret
INTEGRATION_DEFAULT_OWNER_USER_ID=1
LOG_LEVEL=info
```

- `INTEGRATION_WEBHOOK_SECRET` — ключ для webhook (`x-integration-secret`).
- `INTEGRATION_DEFAULT_OWNER_USER_ID` — пользователь-владелец лида по умолчанию для webhook.

## Следующий этап разработки

- Этап 14: уведомления по событиям (email/telegram/slack) и развитие интеграционного контура.
