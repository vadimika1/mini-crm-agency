# Этап 1 — Foundation (статус)

## Принятые решения по стеку

- Backend: Fastify + Prisma + PostgreSQL
- Frontend: Next.js App Router
- Auth: JWT access token + refresh token с хранением в БД
- Модель данных: агентская воронка с историей этапов и audit log

## Реализованные группы API

- `GET /health/live`
- `GET /health/ready`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`
- `GET /api/v1/leads`
- `POST /api/v1/leads`
- `GET /api/v1/leads/:id`
- `PATCH /api/v1/leads/:id`
- `POST /api/v1/leads/:id/assign`
- `POST /api/v1/leads/:id/stage-transitions`
- `GET /api/v1/leads/:id/history`

## Безопасность и доступ

- Роли включаются в JWT payload.
- Привилегированные роли: `admin`, `head`.
- Непривилегированные пользователи работают только со своими лидами.
- Ошибки API приведены к единому формату ответа.

## Состояние БД после seed

- Роли: admin/head/manager/account/viewer
- Администратор: `admin@crm.local`
- Воронка: `agency-sales`
- Этапы: `new -> ... -> won/lost`
- Источники: site-form, telegram, referral, manual, meta-leads
- Причины потерь: price/budget/competitor/scope/no-response

## Ограничения текущего инкремента

- Валидация `required_fields` по этапам пока хранится как metadata.
- Нет API для задач/брифов/сделок/КП.
- Нет фоновых воркеров SLA.
- Frontend пока без auth и интеграции с API.
