import type { FastifyInstance } from "fastify";
import { DealStatus, Prisma } from "@prisma/client";
import { AppError } from "../../lib/errors.js";
import { getPagination } from "../../utils/pagination.js";
import { AutomationsService } from "../automations/service.js";
import type { RunAutomationEventInput } from "../automations/schemas.js";
import type {
  CloseLostInput,
  CloseWonInput,
  CreateDealInput,
  CreateProposalInput,
  ListDealsQuery,
  UpdateDealInput
} from "./schemas.js";

export class DealsService {
  constructor(private readonly app: FastifyInstance) {}

  private async runAutomationEventSafe(input: RunAutomationEventInput, actorUserId: number) {
    try {
      const automationsService = new AutomationsService(this.app);
      await automationsService.runEvent(input, actorUserId);
    } catch (error) {
      this.app.log.error(
        {
          err: error,
          event: input.event,
          leadId: input.leadId,
          dealId: input.dealId,
          actorUserId
        },
        "automation_event_failed"
      );
    }
  }

  async listDeals(query: ListDealsQuery, currentUser: { userId: number; roles: string[] }) {
    const { page, per_page: perPage, owner_user_id: ownerUserId, lead_id: leadId, search, status } = query;
    const pagination = getPagination(page, perPage);

    const isPrivileged = currentUser.roles.includes("admin") || currentUser.roles.includes("head");

    const where: Prisma.DealWhereInput = {
      ...(status ? { status } : {}),
      ...(leadId ? { leadId } : {}),
      ...(search
        ? {
            OR: [
              { lead: { companyName: { contains: search, mode: "insensitive" } } },
              { lead: { mainContactName: { contains: search, mode: "insensitive" } } }
            ]
          }
        : {})
    };

    if (isPrivileged) {
      if (ownerUserId) {
        where.ownerUserId = ownerUserId;
      }
    } else {
      where.OR = [
        { ownerUserId: currentUser.userId },
        { lead: { ownerUserId: currentUser.userId } }
      ];
    }

    const [rows, total] = await Promise.all([
      this.app.prisma.deal.findMany({
        where,
        include: {
          lead: {
            select: {
              id: true,
              companyName: true,
              ownerUserId: true
            }
          },
          owner: {
            select: {
              id: true,
              fullName: true,
              email: true
            }
          },
          lostReason: true
        },
        orderBy: { createdAt: "desc" },
        skip: pagination.skip,
        take: pagination.take
      }),
      this.app.prisma.deal.count({ where })
    ]);

    return {
      data: rows,
      meta: {
        page: pagination.page,
        per_page: pagination.perPage,
        total,
        total_pages: Math.ceil(total / pagination.perPage)
      }
    };
  }

  async getDealById(dealId: number) {
    const deal = await this.app.prisma.deal.findUnique({
      where: { id: dealId },
      include: {
        lead: true,
        owner: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        },
        lostReason: true,
        proposals: {
          orderBy: { version: "desc" }
        }
      }
    });

    if (!deal) {
      throw new AppError(404, "deal_not_found", "Сделка не найдена");
    }

    return deal;
  }

  async createDeal(payload: CreateDealInput, actorUserId: number) {
    const lead = await this.app.prisma.lead.findUnique({ where: { id: payload.leadId } });
    if (!lead || lead.archivedAt) {
      throw new AppError(404, "lead_not_found", "Лид не найден");
    }

    const deal = await this.app.prisma.deal.create({
      data: {
        leadId: payload.leadId,
        ownerUserId: payload.ownerUserId ?? lead.ownerUserId ?? actorUserId,
        amount: payload.amount,
        currency: payload.currency ?? "USD",
        pricingModel: payload.pricingModel,
        probability: payload.probability ?? 50,
        startDatePlan: payload.startDatePlan ? new Date(payload.startDatePlan) : null,
        closeDatePlan: payload.closeDatePlan ? new Date(payload.closeDatePlan) : null,
        status: DealStatus.OPEN
      },
      include: {
        lead: true,
        owner: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        }
      }
    });

    await this.app.prisma.auditLog.create({
      data: {
        entityType: "deal",
        entityId: String(deal.id),
        action: "created",
        actorUserId,
        payload: {
          leadId: deal.leadId,
          amount: deal.amount ? Number(deal.amount) : null
        }
      }
    });

    return deal;
  }

  async updateDeal(dealId: number, payload: UpdateDealInput, actorUserId: number) {
    const existing = await this.getDealById(dealId);

    if (payload.lostReasonId) {
      const reason = await this.app.prisma.lostReason.findUnique({ where: { id: payload.lostReasonId } });
      if (!reason || !reason.isActive) {
        throw new AppError(400, "invalid_lost_reason", "Указана невалидная причина потери");
      }
    }

    const deal = await this.app.prisma.deal.update({
      where: { id: dealId },
      data: {
        ownerUserId: payload.ownerUserId,
        amount: payload.amount,
        currency: payload.currency,
        pricingModel: payload.pricingModel,
        probability: payload.probability,
        status: payload.status,
        lostReasonId: payload.lostReasonId,
        startDatePlan: payload.startDatePlan ? new Date(payload.startDatePlan) : undefined,
        startDateFact: payload.startDateFact ? new Date(payload.startDateFact) : undefined,
        closeDatePlan: payload.closeDatePlan ? new Date(payload.closeDatePlan) : undefined,
        closeDateFact: payload.closeDateFact ? new Date(payload.closeDateFact) : undefined
      },
      include: {
        lead: true,
        owner: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        },
        lostReason: true
      }
    });

    await this.app.prisma.auditLog.create({
      data: {
        entityType: "deal",
        entityId: String(deal.id),
        action: "updated",
        actorUserId,
        payload: {
          beforeStatus: existing.status,
          afterStatus: deal.status
        }
      }
    });

    return deal;
  }

  async closeWon(dealId: number, payload: CloseWonInput, actorUserId: number) {
    await this.getDealById(dealId);

    const deal = await this.app.prisma.deal.update({
      where: { id: dealId },
      data: {
        status: DealStatus.WON,
        amount: payload.amount,
        closeDateFact: payload.closeDateFact ? new Date(payload.closeDateFact) : new Date(),
        startDateFact: payload.startDateFact ? new Date(payload.startDateFact) : undefined,
        lostReasonId: null
      },
      include: {
        lead: true,
        owner: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        }
      }
    });

    await this.app.prisma.auditLog.create({
      data: {
        entityType: "deal",
        entityId: String(deal.id),
        action: "closed_won",
        actorUserId
      }
    });

    await this.runAutomationEventSafe(
      {
        event: "deal.closed_won",
        dealId: deal.id,
        leadId: deal.leadId,
        payload: {
          dealStatus: deal.status
        }
      },
      actorUserId
    );

    return deal;
  }

  async closeLost(dealId: number, payload: CloseLostInput, actorUserId: number) {
    const reason = await this.app.prisma.lostReason.findUnique({ where: { id: payload.lostReasonId } });
    if (!reason || !reason.isActive) {
      throw new AppError(400, "invalid_lost_reason", "Указана невалидная причина потери");
    }

    const deal = await this.app.prisma.deal.update({
      where: { id: dealId },
      data: {
        status: DealStatus.LOST,
        closeDateFact: new Date(),
        lostReasonId: payload.lostReasonId
      },
      include: {
        lead: true,
        owner: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        },
        lostReason: true
      }
    });

    await this.app.prisma.auditLog.create({
      data: {
        entityType: "deal",
        entityId: String(deal.id),
        action: "closed_lost",
        actorUserId,
        payload: {
          comment: payload.comment ?? null,
          lostReasonId: payload.lostReasonId
        }
      }
    });

    await this.runAutomationEventSafe(
      {
        event: "deal.closed_lost",
        dealId: deal.id,
        leadId: deal.leadId,
        payload: {
          dealStatus: deal.status
        }
      },
      actorUserId
    );

    return deal;
  }

  async listProposals(dealId: number) {
    await this.getDealById(dealId);

    return this.app.prisma.proposal.findMany({
      where: { dealId },
      orderBy: { version: "desc" }
    });
  }

  async createProposal(dealId: number, payload: CreateProposalInput, actorUserId: number) {
    const deal = await this.getDealById(dealId);

    const latestProposal = await this.app.prisma.proposal.findFirst({
      where: { dealId },
      orderBy: { version: "desc" }
    });

    const proposal = await this.app.prisma.proposal.create({
      data: {
        dealId,
        leadId: deal.leadId,
        version: latestProposal ? latestProposal.version + 1 : 1,
        proposalUrl: payload.proposalUrl,
        totalAmount: payload.totalAmount,
        serviceBreakdown: payload.serviceBreakdown,
        validUntil: payload.validUntil ? new Date(payload.validUntil) : null,
        sentAt: new Date(),
        sentByUserId: actorUserId
      }
    });

    await this.app.prisma.auditLog.create({
      data: {
        entityType: "proposal",
        entityId: String(proposal.id),
        action: "created",
        actorUserId,
        payload: {
          dealId,
          version: proposal.version
        }
      }
    });

    return proposal;
  }
}
