# Этап 8. Интеграции и импорт CSV

## Цель этапа

Добавить внешний прием лидов через webhook и удобный импорт лидов из CSV в интерфейсе CRM.

## Что реализовано

- Backend:
  - добавлен модуль `integrations`;
  - webhook endpoint для приема лидов:
    - `POST /api/v1/integrations/webhooks/leads/site`
    - `POST /api/v1/integrations/webhooks/leads/telegram`
  - endpoint импорта CSV-строк:
    - `POST /api/v1/integrations/import/leads-csv`
  - логирование интеграционных событий в `integration_event_log`:
    - каналы `SITE`, `TELEGRAM`, `CSV`,
    - статусы `processed/partial/failed`,
    - сохранение краткого результата и ошибок.
- Frontend:
  - добавлен блок `Импорт лидов из CSV` в канбан-панели;
  - чтение `.csv` файла в браузере;
  - парсинг колонок (англ/рус алиасы заголовков);
  - отправка строк на backend-импорт;
  - отображение результата импорта (создано/ошибки, первые проблемные строки).

## Новые переменные окружения

- `INTEGRATION_WEBHOOK_SECRET` — секрет для `x-integration-secret` в webhook.
- `INTEGRATION_DEFAULT_OWNER_USER_ID` — владелец лида по умолчанию при webhook-импорте.

## Измененные файлы

- `apps/api/src/config/env.ts`
- `apps/api/src/server.ts`
- `apps/api/src/modules/integrations/routes.ts`
- `apps/api/src/modules/integrations/schemas.ts`
- `apps/api/src/modules/integrations/service.ts`
- `apps/api/.env.example`
- `.env.example`
- `apps/web/app/page.tsx`
- `apps/web/app/globals.css`
- `README.md`

## Что дальше (этап 9)

- Расширение автоматизаций: триггеры и действия по событиям.
- Тесты backend/frontend для webhook, CSV-импорта и массовых операций.
