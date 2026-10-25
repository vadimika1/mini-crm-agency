export type CsvImportRowPayload = {
  rowNumber: number;
  companyName: string;
  mainContactName: string;
  mainContactEmail?: string;
  mainContactPhone?: string;
  websiteUrl?: string;
  priority?: "LOW" | "MEDIUM" | "HIGH";
  nextFollowUpAt?: string;
  sourceCode?: string;
};

const csvHeaderAliases = {
  companyName: ["company", "companyname", "компания", "названиекомпании"],
  mainContactName: ["contact", "maincontactname", "контакт", "контактноелицо", "имяконтакта"],
  mainContactEmail: ["email", "maincontactemail", "почта", "элпочта"],
  mainContactPhone: ["phone", "maincontactphone", "телефон"],
  websiteUrl: ["website", "site", "websiteurl", "сайт", "url"],
  priority: ["priority", "приоритет"],
  nextFollowUpAt: ["nextfollowupat", "next_follow_up_at", "followup", "следующийконтакт", "nextcontact"],
  sourceCode: ["source", "sourcecode", "источник", "кодисточника"]
} as const;

function normalizeCsvHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

function parseCsvLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === "\"") {
      const next = line[index + 1];
      if (inQuotes && next === "\"") {
        current += "\"";
        index += 1;
        continue;
      }

      inQuotes = !inQuotes;
      continue;
    }

    if (char === delimiter && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}

function parsePriorityValue(value: string | undefined): "LOW" | "MEDIUM" | "HIGH" | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().toUpperCase();
  if (normalized === "LOW" || normalized === "MEDIUM" || normalized === "HIGH") {
    return normalized;
  }

  if (normalized === "НИЗКИЙ") {
    return "LOW";
  }

  if (normalized === "СРЕДНИЙ") {
    return "MEDIUM";
  }

  if (normalized === "ВЫСОКИЙ") {
    return "HIGH";
  }

  return undefined;
}

function toIsoFromCsvDateTime(value: string): string | undefined {
  const normalized = value.trim();
  if (!normalized) {
    return undefined;
  }

  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return date.toISOString();
}

export function parseCsvImportRows(text: string): CsvImportRowPayload[] {
  const normalizedText = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  if (!normalizedText) {
    throw new Error("CSV-файл пуст.");
  }

  const lines = normalizedText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length < 2) {
    throw new Error("CSV должен содержать заголовок и минимум одну строку данных.");
  }

  const headerLine = lines[0];
  const semicolonCount = (headerLine.match(/;/g) ?? []).length;
  const commaCount = (headerLine.match(/,/g) ?? []).length;
  const delimiter = semicolonCount > commaCount ? ";" : ",";

  const rawHeaders = parseCsvLine(headerLine, delimiter);
  const normalizedHeaders = rawHeaders.map((header) => normalizeCsvHeader(header));
  const headerIndex = new Map<string, number>(normalizedHeaders.map((value, index) => [value, index]));

  const findColumnIndex = (aliases: readonly string[]) => {
    for (const alias of aliases) {
      const index = headerIndex.get(normalizeCsvHeader(alias));
      if (index !== undefined) {
        return index;
      }
    }
    return -1;
  };

  const companyIndex = findColumnIndex(csvHeaderAliases.companyName);
  const contactIndex = findColumnIndex(csvHeaderAliases.mainContactName);
  if (companyIndex < 0 || contactIndex < 0) {
    throw new Error("В CSV обязательны колонки Компания и Контакт.");
  }

  const emailIndex = findColumnIndex(csvHeaderAliases.mainContactEmail);
  const phoneIndex = findColumnIndex(csvHeaderAliases.mainContactPhone);
  const websiteIndex = findColumnIndex(csvHeaderAliases.websiteUrl);
  const priorityIndex = findColumnIndex(csvHeaderAliases.priority);
  const followUpIndex = findColumnIndex(csvHeaderAliases.nextFollowUpAt);
  const sourceCodeIndex = findColumnIndex(csvHeaderAliases.sourceCode);

  const rows: CsvImportRowPayload[] = [];

  for (let lineIndex = 1; lineIndex < lines.length; lineIndex += 1) {
    const values = parseCsvLine(lines[lineIndex], delimiter);
    const valueAt = (index: number) => (index >= 0 ? values[index]?.trim() ?? "" : "");

    const companyName = valueAt(companyIndex);
    const mainContactName = valueAt(contactIndex);

    if (!companyName && !mainContactName) {
      continue;
    }

    const nextFollowUpRaw = valueAt(followUpIndex);
    const nextFollowUpAt = nextFollowUpRaw ? toIsoFromCsvDateTime(nextFollowUpRaw) : undefined;

    rows.push({
      rowNumber: lineIndex + 1,
      companyName,
      mainContactName,
      mainContactEmail: valueAt(emailIndex) || undefined,
      mainContactPhone: valueAt(phoneIndex) || undefined,
      websiteUrl: valueAt(websiteIndex) || undefined,
      priority: parsePriorityValue(valueAt(priorityIndex)),
      nextFollowUpAt,
      sourceCode: valueAt(sourceCodeIndex) || undefined
    });
  }

  if (rows.length === 0) {
    throw new Error("В CSV не найдено строк для импорта.");
  }

  return rows;
}
