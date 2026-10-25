import type { FastifyPluginAsync } from "fastify";
import { hasPrivilegedRole } from "../../lib/access.js";
import { AppError } from "../../lib/errors.js";
import { SlaService } from "./service.js";

export const slaRoutes: FastifyPluginAsync = async (fastify) => {
  const slaService = new SlaService(fastify);

  fastify.get(
    "/api/v1/reports/sla",
    { preHandler: [fastify.authenticate] },
    async (request) => {
      if (!hasPrivilegedRole(request.user.roles)) {
        throw new AppError(403, "forbidden", "Доступ к SLA-отчету есть только у admin/head");
      }

      const report = await slaService.getSlaReport();
      return { data: report };
    }
  );

  fastify.post(
    "/api/v1/sla/run-check",
    { preHandler: [fastify.authenticate] },
    async (request) => {
      if (!hasPrivilegedRole(request.user.roles)) {
        throw new AppError(403, "forbidden", "Запуск SLA-проверки доступен только у admin/head");
      }

      const result = await slaService.runSlaCheck(request.user.userId);
      return { data: result };
    }
  );
};
