import { DealStatus } from "@prisma/client";
import { z } from "zod";

const dealStatusSchema = z.nativeEnum(DealStatus);

export const listDealsQuerySchema = z.object({
  page: z.coerce.number().int().positive("Номер страницы должен быть больше 0").default(1),
  per_page: z.coerce.number().int().positive("Размер страницы должен быть больше 0").max(100).default(20),
  owner_user_id: z.coerce.number().int().optional(),
  lead_id: z.coerce.number().int().optional(),
  status: dealStatusSchema.optional(),
  search: z.string().trim().min(1, "Поисковый запрос не должен быть пустым").optional()
});

export const createDealSchema = z.object({
  leadId: z.number().int(),
  ownerUserId: z.number().int().optional(),
  amount: z.number().nonnegative("Сумма не может быть отрицательной").optional(),
  currency: z.string().length(3, "Валюта должна состоять из 3 символов").optional(),
  pricingModel: z.enum(["project", "retainer", "hybrid"]).optional(),
  probability: z.number().int().min(0).max(100).optional(),
  startDatePlan: z.string().datetime("Укажите дату в формате ISO-8601").optional(),
  closeDatePlan: z.string().datetime("Укажите дату в формате ISO-8601").optional()
});

export const updateDealSchema = createDealSchema.partial().omit({
  leadId: true
}).extend({
  status: dealStatusSchema.optional(),
  lostReasonId: z.number().int().optional(),
  startDateFact: z.string().datetime("Укажите дату в формате ISO-8601").optional(),
  closeDateFact: z.string().datetime("Укажите дату в формате ISO-8601").optional()
});

export const closeWonSchema = z.object({
  amount: z.number().nonnegative("Сумма не может быть отрицательной").optional(),
  closeDateFact: z.string().datetime("Укажите дату в формате ISO-8601").optional(),
  startDateFact: z.string().datetime("Укажите дату в формате ISO-8601").optional()
});

export const closeLostSchema = z.object({
  lostReasonId: z.number().int(),
  comment: z.string().max(500, "Комментарий не должен превышать 500 символов").optional()
});

export const createProposalSchema = z.object({
  proposalUrl: z.string().url("Укажите корректную ссылку на КП"),
  totalAmount: z.number().nonnegative("Сумма не может быть отрицательной").optional(),
  validUntil: z.string().datetime("Укажите дату в формате ISO-8601").optional(),
  serviceBreakdown: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional()
});

export type ListDealsQuery = z.infer<typeof listDealsQuerySchema>;
export type CreateDealInput = z.infer<typeof createDealSchema>;
export type UpdateDealInput = z.infer<typeof updateDealSchema>;
export type CloseWonInput = z.infer<typeof closeWonSchema>;
export type CloseLostInput = z.infer<typeof closeLostSchema>;
export type CreateProposalInput = z.infer<typeof createProposalSchema>;
