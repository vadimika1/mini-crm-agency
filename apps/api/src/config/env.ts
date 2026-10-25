import { z } from "zod";

const booleanFromString = z
  .enum(["true", "false", "1", "0"])
  .transform((value) => value === "true" || value === "1");

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_TTL: z.string().default("15m"),
  JWT_REFRESH_TTL: z.string().default("7d"),
  CORS_ORIGIN: z.string().default("http://localhost:3000,http://127.0.0.1:3000"),
  INTEGRATION_WEBHOOK_SECRET: z.string().min(12).default("change-me-webhook-secret"),
  INTEGRATION_DEFAULT_OWNER_USER_ID: z.coerce.number().int().positive().default(1),
  SLA_AUTORUN_ENABLED: booleanFromString.default("false"),
  SLA_AUTORUN_INTERVAL_MINUTES: z.coerce.number().int().positive().default(15),
  SLA_AUTORUN_ACTOR_USER_ID: z.coerce.number().int().positive().default(1),
  SLA_AUTORUN_RUN_ON_START: booleanFromString.default("false")
});

export type Env = z.infer<typeof envSchema>;

export const env: Env = envSchema.parse(process.env);
