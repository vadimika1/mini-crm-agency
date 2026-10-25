import type { FastifyPluginAsync } from "fastify";
import { hasPrivilegedRole } from "../../lib/access.js";
import { AppError } from "../../lib/errors.js";
import { runAutomationEventSchema } from "./schemas.js";
import { AutomationsService } from "./service.js";

export const automationsRoutes: FastifyPluginAsync = async (fastify) => {
  const automationsService = new AutomationsService(fastify);

  function ensurePrivilegedAccess(currentUser: { roles: string[] }) {
    if (!hasPrivilegedRole(currentUser.roles)) {
      throw new AppError(403, "forbidden", "Управление автоматизациями доступно только для admin/head");
    }
  }

  fastify.get(
    "/api/v1/automations/rules",
    {
      preHandler: [fastify.authenticate]
    },
    async (request) => {
      ensurePrivilegedAccess(request.user);
      return { data: automationsService.listRules() };
    }
  );

  fastify.post(
    "/api/v1/automations/run",
    {
      preHandler: [fastify.authenticate]
    },
    async (request) => {
      ensurePrivilegedAccess(request.user);
      const payload = runAutomationEventSchema.parse(request.body);
      const actorUserId = payload.actorUserId ?? request.user.userId;
      const result = await automationsService.runEvent(payload, actorUserId);
      return { data: result };
    }
  );
};
