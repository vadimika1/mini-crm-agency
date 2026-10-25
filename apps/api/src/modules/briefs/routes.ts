import type { FastifyPluginAsync } from "fastify";
import { canAccessOwnedEntity } from "../../lib/access.js";
import { AppError } from "../../lib/errors.js";
import { completeBriefSchema, createBriefSchema, updateBriefSchema } from "./schemas.js";
import { BriefsService } from "./service.js";

export const briefsRoutes: FastifyPluginAsync = async (fastify) => {
  const briefsService = new BriefsService(fastify);

  async function ensureLeadAccess(leadId: number, currentUser: { userId: number; roles: string[] }) {
    const lead = await briefsService.getLeadForBrief(leadId);
    if (!canAccessOwnedEntity(lead.ownerUserId, currentUser)) {
      throw new AppError(403, "forbidden", "У вас нет доступа к этому лиду");
    }
  }

  fastify.get(
    "/api/v1/leads/:leadId/brief",
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const leadId = Number((request.params as { leadId: string }).leadId);
      await ensureLeadAccess(leadId, request.user);
      const brief = await briefsService.getBriefByLead(leadId);
      return { data: brief };
    }
  );

  fastify.post(
    "/api/v1/leads/:leadId/brief",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const leadId = Number((request.params as { leadId: string }).leadId);
      await ensureLeadAccess(leadId, request.user);
      const payload = createBriefSchema.parse(request.body);
      const brief = await briefsService.createBrief(leadId, payload, request.user.userId);
      return reply.code(201).send({ data: brief });
    }
  );

  fastify.patch(
    "/api/v1/leads/:leadId/brief",
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const leadId = Number((request.params as { leadId: string }).leadId);
      await ensureLeadAccess(leadId, request.user);
      const payload = updateBriefSchema.parse(request.body);
      const brief = await briefsService.updateBrief(leadId, payload, request.user.userId);
      return { data: brief };
    }
  );

  fastify.post(
    "/api/v1/leads/:leadId/brief/complete",
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const leadId = Number((request.params as { leadId: string }).leadId);
      await ensureLeadAccess(leadId, request.user);
      const payload = completeBriefSchema.parse(request.body);
      const brief = await briefsService.completeBrief(leadId, payload, request.user.userId);
      return { data: brief };
    }
  );
};
