import { LeadPriority } from "@prisma/client";
import { z } from "zod";

const leadPrioritySchema = z.nativeEnum(LeadPriority);

export const webhookLeadChannelParamsSchema = z.object({
  channel: z.enum(["site", "telegram"])
});

export const webhookLeadPayloadSchema = z.object({
  externalId: z.string().trim().min(1).max(191).optional(),
  companyName: z.string().trim().min(2, "Название компании должно содержать минимум 2 символа"),
  websiteUrl: z.string().url("Укажите корректный URL сайта").optional(),
  mainContactName: z.string().trim().min(2, "Имя контакта должно содержать минимум 2 символа"),
  mainContactEmail: z.string().email("Укажите корректный email").optional(),
  mainContactPhone: z.string().trim().min(5, "Телефон должен содержать минимум 5 символов").optional(),
  priority: leadPrioritySchema.optional(),
  monthlyBudgetEstimate: z.coerce.number().nonnegative("Бюджет не может быть отрицательным").optional(),
  nextFollowUpAt: z.string().datetime("Укажите дату в формате ISO-8601").optional(),
  sourceCode: z.string().trim().min(2).optional(),
  ownerUserId: z.number().int().positive().optional()
});

export const csvImportLeadRowSchema = z.object({
  rowNumber: z.number().int().positive(),
  companyName: z.string().trim().min(2, "Название компании должно содержать минимум 2 символа"),
  websiteUrl: z.string().url("Укажите корректный URL сайта").optional(),
  mainContactName: z.string().trim().min(2, "Имя контакта должно содержать минимум 2 символа"),
  mainContactEmail: z.string().email("Укажите корректный email").optional(),
  mainContactPhone: z.string().trim().min(5, "Телефон должен содержать минимум 5 символов").optional(),
  priority: leadPrioritySchema.optional(),
  nextFollowUpAt: z.string().datetime("Укажите дату в формате ISO-8601").optional(),
  sourceCode: z.string().trim().min(2).optional()
});

export const csvImportPayloadSchema = z.object({
  rows: z.array(csvImportLeadRowSchema).min(1, "Передайте минимум одну строку").max(500, "Максимум 500 строк за импорт"),
  defaultSourceCode: z.string().trim().min(2).optional(),
  skipInvalid: z.boolean().default(true)
});

export type WebhookLeadChannelParams = z.infer<typeof webhookLeadChannelParamsSchema>;
export type WebhookLeadPayload = z.infer<typeof webhookLeadPayloadSchema>;
export type CsvImportLeadRow = z.infer<typeof csvImportLeadRowSchema>;
export type CsvImportPayload = z.infer<typeof csvImportPayloadSchema>;
