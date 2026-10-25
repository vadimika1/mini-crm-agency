# Release Checklist

## До релиза

- [ ] Обновлены секреты (`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `INTEGRATION_WEBHOOK_SECRET`).
- [ ] Проверены env-переменные production.
- [ ] Выполнены `npm run typecheck`, `npm run test`, `npm run build`.
- [ ] Проверены миграции БД и seed-данные для окружения.
- [ ] Создан актуальный backup БД (`npm run backup:db`).

## Во время релиза

- [ ] Запущены сервисы: `npm run docker:prod:up`.
- [ ] Проверен API health: `GET /health/live`, `GET /health/ready`.
- [ ] Проверен Web health: `GET /api/health`.
- [ ] Проверен логин администратора.
- [ ] Проверены критичные сценарии:
  - [ ] создание лида;
  - [ ] переход этапа;
  - [ ] создание задачи;
  - [ ] завершение брифа;
  - [ ] закрытие сделки.

## После релиза

- [ ] Проверены логи API/Web на ошибки.
- [ ] Проверено создание новых лидов и задач в UI.
- [ ] Запланирована регулярная ротация backup.
- [ ] Зафиксирована версия релиза и дата выкладки.
