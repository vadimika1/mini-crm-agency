import type { FastifyInstance } from "fastify";
import { AppError } from "../../lib/errors.js";
import { AutomationsService } from "../automations/service.js";
import type { RunAutomationEventInput } from "../automations/schemas.js";
import type { CompleteBriefInput, CreateBriefInput, UpdateBriefInput } from "./schemas.js";

export class BriefsService {
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

  async getLeadForBrief(leadId: number) {
    const lead = await this.app.prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead || lead.archivedAt) {
      throw new AppError(404, "lead_not_found", "Лид не найден");
    }

    return lead;
  }

  async getBriefByLead(leadId: number) {
    const brief = await this.app.prisma.brief.findFirst({
      where: { leadId },
      orderBy: { createdAt: "desc" }
    });

    if (!brief) {
      throw new AppError(404, "brief_not_found", "Бриф для лида не найден");
    }

    return brief;
  }

  async createBrief(leadId: number, payload: CreateBriefInput, actorUserId: number) {
    await this.getLeadForBrief(leadId);

    const existing = await this.app.prisma.brief.findFirst({ where: { leadId } });
    if (existing) {
      throw new AppError(409, "brief_already_exists", "Бриф для этого лида уже создан");
    }

    const brief = await this.app.prisma.brief.create({
      data: {
        leadId,
        businessModel: payload.businessModel,
        targetAudience: payload.targetAudience,
        currentChannels: payload.currentChannels,
        mainKpi: payload.mainKpi,
        kpiTarget: payload.kpiTarget,
        currentMetrics: payload.currentMetrics,
        competitors: payload.competitors,
        decisionProcess: payload.decisionProcess,
        expectedStartDate: payload.expectedStartDate ? new Date(payload.expectedStartDate) : null,
        notes: payload.notes
      }
    });

    await this.app.prisma.auditLog.create({
      data: {
        entityType: "brief",
        entityId: String(brief.id),
        action: "created",
        actorUserId,
        payload: {
          leadId
        }
      }
    });

    return brief;
  }

  async updateBrief(leadId: number, payload: UpdateBriefInput, actorUserId: number) {
    await this.getLeadForBrief(leadId);

    const existing = await this.app.prisma.brief.findFirst({
      where: { leadId },
      orderBy: { createdAt: "desc" }
    });

    if (!existing) {
      throw new AppError(404, "brief_not_found", "Бриф для лида не найден");
    }

    const brief = await this.app.prisma.brief.update({
      where: { id: existing.id },
      data: {
        businessModel: payload.businessModel,
        targetAudience: payload.targetAudience,
        currentChannels: payload.currentChannels,
        mainKpi: payload.mainKpi,
        kpiTarget: payload.kpiTarget,
        currentMetrics: payload.currentMetrics,
        competitors: payload.competitors,
        decisionProcess: payload.decisionProcess,
        expectedStartDate: payload.expectedStartDate ? new Date(payload.expectedStartDate) : undefined,
        notes: payload.notes
      }
    });

    await this.app.prisma.auditLog.create({
      data: {
        entityType: "brief",
        entityId: String(brief.id),
        action: "updated",
        actorUserId,
        payload: {
          leadId
        }
      }
    });

    return brief;
  }

  async completeBrief(leadId: number, payload: CompleteBriefInput, actorUserId: number) {
    await this.getLeadForBrief(leadId);

    const existing = await this.app.prisma.brief.findFirst({
      where: { leadId },
      orderBy: { createdAt: "desc" }
    });

    if (!existing) {
      throw new AppError(404, "brief_not_found", "Бриф для лида не найден");
    }

    const brief = await this.app.prisma.brief.update({
      where: { id: existing.id },
      data: {
        completedAt: new Date(),
        completedByUserId: actorUserId,
        notes: payload.note ? `${existing.notes ? `${existing.notes}\n` : ""}${payload.note}` : existing.notes
      }
    });

    await this.app.prisma.auditLog.create({
      data: {
        entityType: "brief",
        entityId: String(brief.id),
        action: "completed",
        actorUserId,
        payload: {
          leadId
        }
      }
    });

    await this.runAutomationEventSafe(
      {
        event: "lead.brief_completed",
        leadId
      },
      actorUserId
    );

    return brief;
  }
}
