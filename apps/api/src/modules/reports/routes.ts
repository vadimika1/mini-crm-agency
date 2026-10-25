import type { FastifyPluginAsync } from "fastify";
import { hasPrivilegedRole } from "../../lib/access.js";
import { AppError } from "../../lib/errors.js";
import { reportRangeQuerySchema } from "./schemas.js";
import { ReportsService } from "./service.js";

export const reportsRoutes: FastifyPluginAsync = async (fastify) => {
  const reportsService = new ReportsService(fastify);

  function ensurePrivilegedAccess(currentUser: { roles: string[] }) {
    if (!hasPrivilegedRole(currentUser.roles)) {
      throw new AppError(403, "forbidden", "Доступ к отчетам есть только у admin/head");
    }
  }

  fastify.get(
    "/api/v1/reports/funnel",
    { preHandler: [fastify.authenticate] },
    async (request) => {
      ensurePrivilegedAccess(request.user);
      const query = reportRangeQuerySchema.parse(request.query);
      const report = await reportsService.getFunnelReport(query);
      return { data: report };
    }
  );

  fastify.get(
    "/api/v1/reports/manager-performance",
    { preHandler: [fastify.authenticate] },
    async (request) => {
      ensurePrivilegedAccess(request.user);
      const query = reportRangeQuerySchema.parse(request.query);
      const report = await reportsService.getManagerPerformanceReport(query);
      return { data: report };
    }
  );

  fastify.get(
    "/api/v1/reports/lost-reasons",
    { preHandler: [fastify.authenticate] },
    async (request) => {
      ensurePrivilegedAccess(request.user);
      const query = reportRangeQuerySchema.parse(request.query);
      const report = await reportsService.getLostReasonsReport(query);
      return { data: report };
    }
  );

  fastify.get(
    "/api/v1/reports/source-performance",
    { preHandler: [fastify.authenticate] },
    async (request) => {
      ensurePrivilegedAccess(request.user);
      const query = reportRangeQuerySchema.parse(request.query);
      const report = await reportsService.getSourcePerformanceReport(query);
      return { data: report };
    }
  );

  fastify.get(
    "/api/v1/reports/proposal-conversion",
    { preHandler: [fastify.authenticate] },
    async (request) => {
      ensurePrivilegedAccess(request.user);
      const query = reportRangeQuerySchema.parse(request.query);
      const report = await reportsService.getProposalConversionReport(query);
      return { data: report };
    }
  );
};
