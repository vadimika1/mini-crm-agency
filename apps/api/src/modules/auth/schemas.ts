import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Укажите корректный email"),
  password: z.string().min(8, "Пароль должен содержать минимум 8 символов")
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(10, "Некорректный refresh-токен")
});

export const authResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.string(),
  user: z.object({
    id: z.number().int(),
    email: z.string().email(),
    fullName: z.string(),
    roles: z.array(z.string())
  })
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
