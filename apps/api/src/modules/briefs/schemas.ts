import { z } from "zod";

const briefPayloadSchema = z.object({
  businessModel: z.string().max(500, "Слишком длинное значение (максимум 500 символов)").optional(),
  targetAudience: z.string().max(500, "Слишком длинное значение (максимум 500 символов)").optional(),
  currentChannels: z.array(z.string()).optional(),
  mainKpi: z.string().max(200, "Слишком длинное значение (максимум 200 символов)").optional(),
  kpiTarget: z.string().max(200, "Слишком длинное значение (максимум 200 символов)").optional(),
  currentMetrics: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
  competitors: z.string().max(1000, "Слишком длинное значение (максимум 1000 символов)").optional(),
  decisionProcess: z.string().max(1000, "Слишком длинное значение (максимум 1000 символов)").optional(),
  expectedStartDate: z.string().datetime("Укажите дату в формате ISO-8601").optional(),
  notes: z.string().max(2000, "Слишком длинное значение (максимум 2000 символов)").optional()
});

export const createBriefSchema = briefPayloadSchema;
export const updateBriefSchema = briefPayloadSchema;

export const completeBriefSchema = z.object({
  note: z.string().max(500, "Комментарий не должен превышать 500 символов").optional()
});

export type CreateBriefInput = z.infer<typeof createBriefSchema>;
export type UpdateBriefInput = z.infer<typeof updateBriefSchema>;
export type CompleteBriefInput = z.infer<typeof completeBriefSchema>;
