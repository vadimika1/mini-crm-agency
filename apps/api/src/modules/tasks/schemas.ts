import { TaskPriority, TaskStatus, TaskType } from "@prisma/client";
import { z } from "zod";

export const listTasksQuerySchema = z.object({
  page: z.coerce.number().int().positive("Номер страницы должен быть больше 0").default(1),
  per_page: z.coerce.number().int().positive("Размер страницы должен быть больше 0").max(100).default(20),
  assignee_user_id: z.coerce.number().int().optional(),
  lead_id: z.coerce.number().int().optional(),
  status: z.nativeEnum(TaskStatus).optional(),
  overdue: z.coerce.boolean().optional()
});

export const createTaskSchema = z.object({
  leadId: z.number().int().optional(),
  dealId: z.number().int().optional(),
  assigneeUserId: z.number().int(),
  type: z.nativeEnum(TaskType),
  title: z.string().min(3, "Заголовок задачи должен содержать минимум 3 символа"),
  description: z.string().max(2000, "Описание слишком длинное").optional(),
  priority: z.nativeEnum(TaskPriority).optional(),
  dueAt: z.string().datetime("Укажите дату в формате ISO-8601").optional()
});

export const updateTaskSchema = z.object({
  assigneeUserId: z.number().int().optional(),
  type: z.nativeEnum(TaskType).optional(),
  title: z.string().min(3, "Заголовок задачи должен содержать минимум 3 символа").optional(),
  description: z.string().max(2000, "Описание слишком длинное").optional(),
  priority: z.nativeEnum(TaskPriority).optional(),
  status: z.nativeEnum(TaskStatus).optional(),
  dueAt: z.string().datetime("Укажите дату в формате ISO-8601").optional()
});

export const completeTaskSchema = z.object({
  completedAt: z.string().datetime("Укажите дату в формате ISO-8601").optional()
});

export type ListTasksQuery = z.infer<typeof listTasksQuerySchema>;
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type CompleteTaskInput = z.infer<typeof completeTaskSchema>;
