# Этап 9. Автоматизации событий

## Цель этапа

Добавить единый слой автоматизаций, который реагирует на ключевые события CRM и выполняет полезные действия без ручных операций.

## Что реализовано

- Backend:
  - добавлен модуль `automations`:
    - каталог правил (`defaultAutomationRules`);
    - входная схема события;
    - сервис выполнения правил и действий;
    - роуты:
      - `GET /api/v1/automations/rules`
      - `POST /api/v1/automations/run`
  - добавлены базовые правила:
    - повышение приоритета лида при переходе в `negotiation`;
    - авто follow-up после завершения брифа;
    - задача передачи клиента после `deal.closed_won`;
    - win-back задача после `deal.closed_lost`;
  - подключены автоматические триггеры из бизнес-логики:
    - создание лида (`lead.created`);
    - переход этапа лида (`lead.stage_changed`);
    - завершение брифа (`lead.brief_completed`);
    - закрытие сделки в `WON/LOST`.
- Frontend:
  - добавлен блок `Автоматизации` на дашборд (для `admin/head`);
  - отображается список правил и их статус;
  - добавлена форма ручного запуска события (event + leadId/dealId + payload);
  - выводится подробный результат выполнения (executed/skipped/failed по каждому действию).

## Особенности реализации

- Автоматизации запускаются безопасно:
  - бизнес-операция (например, закрытие сделки) не падает, если отдельное automation-действие завершилось ошибкой;
  - ошибки автоматизаций пишутся в лог сервера;
  - каждый запуск события логируется в `audit_log` с `entityType = "automation"`.
- Для `create_task` добавлена защита от дублей:
  - в описание добавляется automation-ключ;
  - повторный запуск не создает дубли активных задач.

## Измененные файлы

- `apps/api/src/server.ts`
- `apps/api/src/modules/automations/routes.ts`
- `apps/api/src/modules/automations/rules.ts`
- `apps/api/src/modules/automations/schemas.ts`
- `apps/api/src/modules/automations/service.ts`
- `apps/api/src/modules/leads/service.ts`
- `apps/api/src/modules/briefs/service.ts`
- `apps/api/src/modules/deals/service.ts`
- `apps/web/app/page.tsx`
- `apps/web/app/globals.css`
- `README.md`

## Что дальше (этап 10)

- Нотификации по событиям CRM (email/telegram/slack).
- Набор автотестов для критичных automation-сценариев.
