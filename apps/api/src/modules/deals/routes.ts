import type { FastifyPluginAsync } from "fastify";
import { canAccessOwnedEntity, hasPrivilegedRole } from "../../lib/access.js";
import { AppError } from "../../lib/errors.js";
import {
  closeLostSchema,
  closeWonSchema,
  createDealSchema,
  createProposalSchema,
  listDealsQuerySchema,
  updateDealSchema
} from "./schemas.js";
import { DealsService } from "./service.js";

export const dealsRoutes: FastifyPluginAsync = async (fastify) => {
  const dealsService = new DealsService(fastify);

  function canAccessDeal(
    dealOwnerUserId: number | null,
    leadOwnerUserId: number | null,
    currentUser: { userId: number; roles: string[] }
  ) {
    if (hasPrivilegedRole(currentUser.roles)) {
      return true;
    }

    return dealOwnerUserId === currentUser.userId || leadOwnerUserId === currentUser.userId;
  }

  fastify.get(
    "/api/v1/deals",
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const query = listDealsQuerySchema.parse(request.query);
      const result = await dealsService.listDeals(query, request.user);
      return result;
    }
  );

  fastify.post(
    "/api/v1/deals",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const payload = createDealSchema.parse(request.body);

      if (!hasPrivilegedRole(request.user.roles) && payload.ownerUserId && payload.ownerUserId !== request.user.userId) {
        throw new AppError(403, "forbidden", "Нельзя назначить владельцем другого пользователя");
      }

      const deal = await dealsService.createDeal(payload, request.user.userId);
      return reply.code(201).send({ data: deal });
    }
  );

  fastify.get(
    "/api/v1/deals/:id",
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const dealId = Number((request.params as { id: string }).id);
      const deal = await dealsService.getDealById(dealId);

      if (!canAccessDeal(deal.ownerUserId, deal.lead.ownerUserId, request.user)) {
        throw new AppError(403, "forbidden", "У вас нет доступа к этой сделке");
      }

      return { data: deal };
    }
  );

  fastify.patch(
    "/api/v1/deals/:id",
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const dealId = Number((request.params as { id: string }).id);
      const existing = await dealsService.getDealById(dealId);

      if (!canAccessDeal(existing.ownerUserId, existing.lead.ownerUserId, request.user)) {
        throw new AppError(403, "forbidden", "У вас нет доступа к этой сделке");
      }

      const payload = updateDealSchema.parse(request.body);
      if (!hasPrivilegedRole(request.user.roles) && payload.ownerUserId && payload.ownerUserId !== request.user.userId) {
        throw new AppError(403, "forbidden", "Нельзя назначить владельцем другого пользователя");
      }

      const deal = await dealsService.updateDeal(dealId, payload, request.user.userId);
      return { data: deal };
    }
  );

  fastify.post(
    "/api/v1/deals/:id/close-won",
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const dealId = Number((request.params as { id: string }).id);
      const existing = await dealsService.getDealById(dealId);

      if (!canAccessDeal(existing.ownerUserId, existing.lead.ownerUserId, request.user)) {
        throw new AppError(403, "forbidden", "У вас нет доступа к этой сделке");
      }

      const payload = closeWonSchema.parse(request.body);
      const deal = await dealsService.closeWon(dealId, payload, request.user.userId);
      return { data: deal };
    }
  );

  fastify.post(
    "/api/v1/deals/:id/close-lost",
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const dealId = Number((request.params as { id: string }).id);
      const existing = await dealsService.getDealById(dealId);

      if (!canAccessDeal(existing.ownerUserId, existing.lead.ownerUserId, request.user)) {
        throw new AppError(403, "forbidden", "У вас нет доступа к этой сделке");
      }

      const payload = closeLostSchema.parse(request.body);
      const deal = await dealsService.closeLost(dealId, payload, request.user.userId);
      return { data: deal };
    }
  );

  fastify.get(
    "/api/v1/deals/:id/proposals",
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const dealId = Number((request.params as { id: string }).id);
      const existing = await dealsService.getDealById(dealId);

      if (!canAccessDeal(existing.ownerUserId, existing.lead.ownerUserId, request.user)) {
        throw new AppError(403, "forbidden", "У вас нет доступа к этой сделке");
      }

      const proposals = await dealsService.listProposals(dealId);
      return { data: proposals };
    }
  );

  fastify.post(
    "/api/v1/deals/:id/proposals",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const dealId = Number((request.params as { id: string }).id);
      const existing = await dealsService.getDealById(dealId);

      if (!canAccessDeal(existing.ownerUserId, existing.lead.ownerUserId, request.user)) {
        throw new AppError(403, "forbidden", "У вас нет доступа к этой сделке");
      }

      const payload = createProposalSchema.parse(request.body);
      const proposal = await dealsService.createProposal(dealId, payload, request.user.userId);
      return reply.code(201).send({ data: proposal });
    }
  );
};
