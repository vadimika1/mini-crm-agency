# Этап 2 — Sales Workflow (статус)

## Что добавлено в этом инкременте

- Модуль `briefs` (карточка брифа по лиду)
- Модуль `deals` + `proposals`
- Модуль `tasks`
- Модуль `sla` (отчет + ручной запуск SLA-проверки)
- Required-fields в переходах этапов (`lead stage transition`)

## Проверки required-fields при переходах

Сервис перехода лида теперь проверяет поля из `stages.required_fields` и блокирует переход с `422`, если данные не заполнены.

Примеры правил:

- `brief.target_audience`
- `brief.main_kpi`
- `proposal.proposal_url`
- `deal.amount`
- `deal.start_date_plan`
- `deal.close_date_fact`
- `deal.lost_reason_id`
- `next_follow_up_at`
- `comment`

## SLA-логика (базовая версия)

- Отчет `GET /api/v1/reports/sla` показывает:
  - просроченные задачи,
  - лиды без первичного контакта в SLA,
  - лиды с просроченным follow-up.
- Ручная проверка `POST /api/v1/sla/run-check`:
  - создает SLA-задачи по лидам, где срок нарушен,
  - пишет аудит запуска.

## Дальше (этап 3)

- Расширенные отчеты (`funnel`, `managers`, `sources`, `lost reasons`)
- Планировщик фоновых SLA-джобов по расписанию
- Frontend-интеграция с backend (авторизация и рабочие экраны)
