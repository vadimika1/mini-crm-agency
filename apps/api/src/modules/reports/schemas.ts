import { z } from "zod";

export const reportRangeQuerySchema = z.object({
  from: z.string().trim().min(1, "Дата from не должна быть пустой").optional(),
  to: z.string().trim().min(1, "Дата to не должна быть пустой").optional()
});

export type ReportRangeQuery = z.infer<typeof reportRangeQuerySchema>;
