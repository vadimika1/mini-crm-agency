import { describe, expect, it } from "vitest";
import { parseCsvImportRows } from "../app/lib/csv-import";

describe("parseCsvImportRows", () => {
  it("парсит CSV с русскими заголовками и приоритетом", () => {
    const csv = [
      "Компания;Контакт;Почта;Телефон;Сайт;Приоритет;next_follow_up_at;Источник",
      "ООО Альфа;Иван Петров;ivan@alpha.ru;+375291234567;https://alpha.ru;Высокий;2026-03-10T09:30;site-form"
    ].join("\n");

    const rows = parseCsvImportRows(csv);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      rowNumber: 2,
      companyName: "ООО Альфа",
      mainContactName: "Иван Петров",
      mainContactEmail: "ivan@alpha.ru",
      priority: "HIGH",
      sourceCode: "site-form"
    });
    expect(typeof rows[0]?.nextFollowUpAt).toBe("string");
  });

  it("бросает ошибку, если нет обязательных колонок", () => {
    const csv = ["Email,Phone", "a@example.com,+375291111111"].join("\n");
    expect(() => parseCsvImportRows(csv)).toThrow("В CSV обязательны колонки Компания и Контакт.");
  });

  it("пропускает пустые строки и возвращает только валидные записи", () => {
    const csv = ["company,contact,email", ",,", "Acme,John,john@acme.io"].join("\n");
    const rows = parseCsvImportRows(csv);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.companyName).toBe("Acme");
    expect(rows[0]?.mainContactName).toBe("John");
  });
});
