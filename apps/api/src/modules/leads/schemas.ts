import { LeadPriority } from "@prisma/client";
import { z } from "zod";

const leadPrioritySchema = z.nativeEnum(LeadPriority);

export const listLeadsQuerySchema = z.object({
  page: z.coerce.number().int().positive("Номер страницы должен быть больше 0").default(1),
  per_page: z.coerce
    .number()
    .int()
    .positive("Размер страницы должен быть больше 0")
    .max(100, "Максимальный размер страницы — 100")
    .default(20),
  owner_user_id: z.coerce.number().int().optional(),
  stage_id: z.coerce.number().int().optional(),
  search: z.string().trim().min(1, "Поисковый запрос не должен быть пустым").optional()
});

export const listLeadStagesQuerySchema = z.object({
  pipeline_id: z.coerce.number().int().positive("Некорректный pipeline_id").optional()
});

export const createLeadSchema = z.object({
  companyName: z.string().min(2, "Название компании должно содержать минимум 2 символа"),
  websiteUrl: z.string().url("Укажите корректный URL сайта").optional(),
  mainContactName: z.string().min(2, "Имя контакта должно содержать минимум 2 символа"),
  mainContactEmail: z.string().email("Укажите корректный email").optional(),
  mainContactPhone: z.string().min(5, "Телефон должен содержать минимум 5 символов").optional(),
  sourceId: z.number().int().optional(),
  ownerUserId: z.number().int().optional(),
  pipelineId: z.number().int().optional(),
  stageId: z.number().int().optional(),
  priority: leadPrioritySchema.optional(),
  monthlyBudgetEstimate: z.number().nonnegative("Бюджет не может быть отрицательным").optional(),
  nextFollowUpAt: z.string().datetime("Укажите дату в формате ISO-8601").optional()
});

export const updateLeadSchema = createLeadSchema.partial();

export const assignLeadSchema = z.object({
  ownerUserId: z.number().int()
});

export const transitionLeadSchema = z.object({
  toStageId: z.number().int(),
  comment: z.string().max(500, "Комментарий не должен превышать 500 символов").optional()
});

export type ListLeadsQuery = z.infer<typeof listLeadsQuerySchema>;
export type ListLeadStagesQuery = z.infer<typeof listLeadStagesQuerySchema>;
export type CreateLeadInput = z.infer<typeof createLeadSchema>;
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>;
export type AssignLeadInput = z.infer<typeof assignLeadSchema>;
export type TransitionLeadInput = z.infer<typeof transitionLeadSchema>;
