import type { FastifyPluginAsync } from "fastify";
import { AppError } from "../../lib/errors.js";
import {
  assignLeadSchema,
  createLeadSchema,
  listLeadStagesQuerySchema,
  listLeadsQuerySchema,
  transitionLeadSchema,
  updateLeadSchema
} from "./schemas.js";
import { LeadsService } from "./service.js";

function hasPrivilegedRole(roles: string[]) {
  return roles.includes("admin") || roles.includes("head");
}

function canAccessLead(leadOwnerUserId: number | null, currentUser: { userId: number; roles: string[] }) {
  if (hasPrivilegedRole(currentUser.roles)) {
    return true;
  }

  return leadOwnerUserId === currentUser.userId;
}

export const leadsRoutes: FastifyPluginAsync = async (fastify) => {
  const leadsService = new LeadsService(fastify);

  fastify.get(
    "/api/v1/leads",
    {
      preHandler: [fastify.authenticate]
    },
    async (request) => {
      const query = listLeadsQuerySchema.parse(request.query);
      const result = await leadsService.listLeads(query, request.user);
      return result;
    }
  );

  fastify.get(
    "/api/v1/leads/stages",
    {
      preHandler: [fastify.authenticate]
    },
    async (request) => {
      const query = listLeadStagesQuerySchema.parse(request.query);
      const stages = await leadsService.listLeadStages(query);
      return { data: stages };
    }
  );

  fastify.post(
    "/api/v1/leads",
    {
      preHandler: [fastify.authenticate]
    },
    async (request, reply) => {
      const payload = createLeadSchema.parse(request.body);
      const lead = await leadsService.createLead(payload, request.user);
      return reply.code(201).send({ data: lead });
    }
  );

  fastify.get(
    "/api/v1/leads/:id",
    {
      preHandler: [fastify.authenticate]
    },
    async (request) => {
      const leadId = Number((request.params as { id: string }).id);
      const lead = await leadsService.getLeadById(leadId);

      if (!canAccessLead(lead.ownerUserId, request.user)) {
        throw new AppError(403, "forbidden", "У вас нет доступа к этому лиду");
      }

      return { data: lead };
    }
  );

  fastify.patch(
    "/api/v1/leads/:id",
    {
      preHandler: [fastify.authenticate]
    },
    async (request) => {
      const leadId = Number((request.params as { id: string }).id);
      const existingLead = await leadsService.getLeadById(leadId);

      if (!canAccessLead(existingLead.ownerUserId, request.user)) {
        throw new AppError(403, "forbidden", "У вас нет доступа к этому лиду");
      }

      const payload = updateLeadSchema.parse(request.body);
      const updated = await leadsService.updateLead(leadId, payload);
      return { data: updated };
    }
  );

  fastify.post(
    "/api/v1/leads/:id/assign",
    {
      preHandler: [fastify.authenticate]
    },
    async (request) => {
      if (!hasPrivilegedRole(request.user.roles)) {
        throw new AppError(403, "forbidden", "Переназначать лиды могут только роли admin/head");
      }

      const leadId = Number((request.params as { id: string }).id);
      const payload = assignLeadSchema.parse(request.body);
      const updated = await leadsService.assignLead(leadId, payload, request.user.userId);
      return { data: updated };
    }
  );

  fastify.post(
    "/api/v1/leads/:id/stage-transitions",
    {
      preHandler: [fastify.authenticate]
    },
    async (request) => {
      const leadId = Number((request.params as { id: string }).id);
      const lead = await leadsService.getLeadById(leadId);

      if (!canAccessLead(lead.ownerUserId, request.user)) {
        throw new AppError(403, "forbidden", "У вас нет доступа к этому лиду");
      }

      const payload = transitionLeadSchema.parse(request.body);
      const updated = await leadsService.transitionLead(leadId, payload, request.user);
      return { data: updated };
    }
  );

  fastify.get(
    "/api/v1/leads/:id/history",
    {
      preHandler: [fastify.authenticate]
    },
    async (request) => {
      const leadId = Number((request.params as { id: string }).id);
      const lead = await leadsService.getLeadById(leadId);

      if (!canAccessLead(lead.ownerUserId, request.user)) {
        throw new AppError(403, "forbidden", "У вас нет доступа к этому лиду");
      }

      const history = await leadsService.getLeadHistory(leadId);
      return { data: history };
    }
  );
};
