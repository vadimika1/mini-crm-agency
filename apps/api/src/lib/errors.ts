import { ZodError } from "zod";

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: Array<Record<string, unknown>>
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function mapToAppError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof ZodError) {
    return new AppError(422, "validation_error", "Ошибка валидации запроса", [
      ...error.errors.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
        code: issue.code
      }))
    ]);
  }

  return new AppError(500, "internal_error", "Внутренняя ошибка сервера");
}
