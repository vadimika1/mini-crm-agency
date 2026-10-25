# Этап 11. Тесты и стабилизация

## Цель этапа

Создать базовый контур автотестов для критичных сценариев и зафиксировать единый процесс проверки качества перед следующими этапами.

## Что реализовано

- Инфраструктура тестов:
  - подключен `vitest` в `apps/api` и `apps/web`;
  - добавлены команды:
    - root: `npm run test`, `npm run test:api`, `npm run test:web`;
    - workspace: `npm run test`, `npm run test:watch`.
- Backend тесты:
  - файл `apps/api/tests/automations.service.test.ts`;
  - покрыты сценарии:
    - повышение приоритета лида на событии `lead.stage_changed -> negotiation`;
    - дедупликация follow-up задачи при повторном `lead.brief_completed`.
- Frontend тесты:
  - вынесен CSV-парсер в отдельный util `apps/web/app/lib/csv-import.ts`;
  - файл `apps/web/tests/csv-import.test.ts`:
    - корректный парсинг русских/английских заголовков;
    - ошибка при отсутствии обязательных колонок;
    - пропуск пустых строк.
  - файл `apps/web/tests/home-page.test.tsx`:
    - smoke-тест рендера формы входа при отсутствии сессии.

## Проверки, выполненные на этапе

- `npm run test -w @mini-crm/api` ✅
- `npm run test -w @mini-crm/web` ✅
- `npm run typecheck -w @mini-crm/api` ✅
- `npm run typecheck -w @mini-crm/web` ✅
- `npm run build -w @mini-crm/api` ✅
- `npm run build -w @mini-crm/web` ✅

## Измененные файлы

- `package.json`
- `apps/api/package.json`
- `apps/web/package.json`
- `apps/api/vitest.config.ts`
- `apps/web/vitest.config.ts`
- `apps/api/tests/automations.service.test.ts`
- `apps/web/app/lib/csv-import.ts`
- `apps/web/tests/csv-import.test.ts`
- `apps/web/tests/home-page.test.tsx`
- `apps/web/app/page.tsx`
- `README.md`

## Что дальше (этап 12)

- Подготовка к production:
  - контейнеризация и оптимизация образов;
  - CI-пайплайн (typecheck + test + build);
  - мониторинг, логирование, алерты;
  - бэкапы БД и релизный чеклист.
