# Этап 3 — Отчеты и автоматизация SLA (статус)

## Что добавлено

- Новый модуль `reports`:
  - `GET /api/v1/reports/funnel`
  - `GET /api/v1/reports/manager-performance`
  - `GET /api/v1/reports/lost-reasons`
  - `GET /api/v1/reports/source-performance`
  - `GET /api/v1/reports/proposal-conversion`
- Планировщик SLA (`sla/scheduler`):
  - автозапуск по интервалу,
  - опциональный запуск при старте API,
  - защита от параллельных запусков,
  - логирование результата проверки.

## Входные параметры отчетов

Все новые отчеты принимают опциональные query-параметры:

- `from` — дата начала диапазона (ISO)
- `to` — дата конца диапазона (ISO)

Если параметры не переданы, отчет строится по всему доступному периоду.

## Содержимое отчетов

- `funnel`:
  - summary по open/won/lost,
  - распределение лидов по этапам,
  - переходы между этапами,
  - среднее время до первого контакта.
- `manager-performance`:
  - лиды по менеджеру,
  - сделки по статусам,
  - сумма won/open pipeline,
  - просроченные и завершенные задачи.
- `lost-reasons`:
  - распределение потерянных сделок по причинам,
  - сумма потерь.
- `source-performance`:
  - лиды/сделки по каждому источнику,
  - win-rate,
  - сумма won/open pipeline.
- `proposal-conversion`:
  - число отправленных КП,
  - конверсия КП в выигранные сделки,
  - средняя сумма КП,
  - среднее число версий КП на сделку.

## Автозапуск SLA

Управляется env-переменными:

- `SLA_AUTORUN_ENABLED`
- `SLA_AUTORUN_INTERVAL_MINUTES`
- `SLA_AUTORUN_ACTOR_USER_ID`
- `SLA_AUTORUN_RUN_ON_START`

При включении планировщик вызывает `runSlaCheck` по расписанию.
