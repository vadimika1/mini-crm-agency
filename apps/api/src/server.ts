import Fastify from "fastify";
import cors from "@fastify/cors";
import { env } from "./config/env.js";
import { mapToAppError } from "./lib/errors.js";
import { prismaPlugin } from "./plugins/prisma.js";
import { authPlugin } from "./plugins/auth.js";
import { healthRoutes } from "./modules/health/routes.js";
import { authRoutes } from "./modules/auth/routes.js";
import { leadsRoutes } from "./modules/leads/routes.js";
import { briefsRoutes } from "./modules/briefs/routes.js";
import { dealsRoutes } from "./modules/deals/routes.js";
import { tasksRoutes } from "./modules/tasks/routes.js";
import { slaRoutes } from "./modules/sla/routes.js";
import { reportsRoutes } from "./modules/reports/routes.js";
import { integrationsRoutes } from "./modules/integrations/routes.js";
import { automationsRoutes } from "./modules/automations/routes.js";

export async function buildServer() {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL
    }
  });

  const allowedOrigins = env.CORS_ORIGIN.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  await app.register(cors, {
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("CORS origin denied"), false);
    },
    credentials: true
  });

  await app.register(prismaPlugin);
  await app.register(authPlugin);

  app.setErrorHandler((error, _request, reply) => {
    const appError = mapToAppError(error);

    return reply.status(appError.statusCode).send({
      error: {
        code: appError.code,
        message: appError.message,
        details: appError.details
      }
    });
  });

  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(leadsRoutes);
  await app.register(briefsRoutes);
  await app.register(dealsRoutes);
  await app.register(tasksRoutes);
  await app.register(slaRoutes);
  await app.register(reportsRoutes);
  await app.register(integrationsRoutes);
  await app.register(automationsRoutes);

  return app;
}
