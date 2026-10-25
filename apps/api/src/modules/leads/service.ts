import type { FastifyInstance } from "fastify";
import { LeadStatus, Prisma, StageOutcome } from "@prisma/client";
import { AppError } from "../../lib/errors.js";
import { getPagination } from "../../utils/pagination.js";
import { AutomationsService } from "../automations/service.js";
import type { RunAutomationEventInput } from "../automations/schemas.js";
import type {
  AssignLeadInput,
  CreateLeadInput,
  ListLeadStagesQuery,
  ListLeadsQuery,
  TransitionLeadInput,
  UpdateLeadInput
} from "./schemas.js";

function mapStageOutcomeToLeadStatus(outcome: StageOutcome): LeadStatus {
  switch (outcome) {
    case "WON":
      return "WON";
    case "LOST":
      return "LOST";
    default:
      return "OPEN";
  }
}

function extractRequiredFields(requiredFieldsJson: Prisma.JsonValue): string[] {
  if (!Array.isArray(requiredFieldsJson)) {
    return [];
  }

  return requiredFieldsJson.filter((item): item is string => typeof item === "string");
}

export class LeadsService {
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

  async listLeadStages(query: ListLeadStagesQuery) {
    let pipelineId = query.pipeline_id;

    if (!pipelineId) {
      const defaultPipeline = await this.app.prisma.pipeline.findFirst({
        where: { isDefault: true, isActive: true },
        select: { id: true }
      });
      pipelineId = defaultPipeline?.id;
    }

    return this.app.prisma.stage.findMany({
      where: {
        isActive: true,
        ...(pipelineId ? { pipelineId } : {})
      },
      include: {
        pipeline: {
          select: {
            id: true,
            code: true,
            name: true,
            isDefault: true
          }
        }
      },
      orderBy: [{ pipelineId: "asc" }, { sortOrder: "asc" }]
    });
  }

  async listLeads(query: ListLeadsQuery, currentUser: { userId: number; roles: string[] }) {
    const { page, per_page: perPage, owner_user_id: ownerUserId, search, stage_id: stageId } = query;
    const pagination = getPagination(page, perPage);

    const isPrivileged = currentUser.roles.includes("admin") || currentUser.roles.includes("head");

    const where: Prisma.LeadWhereInput = {
      archivedAt: null,
      ...(stageId ? { stageId } : {}),
      ...(search
        ? {
            OR: [
              { companyName: { contains: search, mode: "insensitive" } },
              { mainContactName: { contains: search, mode: "insensitive" } },
              { mainContactEmail: { contains: search, mode: "insensitive" } },
              { mainContactPhone: { contains: search, mode: "insensitive" } }
            ]
          }
        : {})
    };

    if (isPrivileged) {
      if (ownerUserId) {
        where.ownerUserId = ownerUserId;
      }
    } else {
      where.ownerUserId = currentUser.userId;
    }

    const [rows, total] = await Promise.all([
      this.app.prisma.lead.findMany({
        where,
        include: {
          source: true,
          stage: true,
          owner: {
            select: {
              id: true,
              fullName: true,
              email: true
            }
          }
        },
        orderBy: {
          createdAt: "desc"
        },
        skip: pagination.skip,
        take: pagination.take
      }),
      this.app.prisma.lead.count({ where })
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

  async getLeadById(leadId: number) {
    const lead = await this.app.prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        source: true,
        owner: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        },
        stage: true,
        pipeline: true,
        stageHistory: {
          include: {
            fromStage: true,
            toStage: true,
            changedByUser: {
              select: {
                id: true,
                fullName: true
              }
            }
          },
          orderBy: {
            changedAt: "desc"
          }
        }
      }
    });

    if (!lead || lead.archivedAt) {
      throw new AppError(404, "lead_not_found", "Лид не найден");
    }

    return lead;
  }

  async createLead(payload: CreateLeadInput, currentUser: { userId: number }) {
    let pipelineId = payload.pipelineId;
    let stageId = payload.stageId;

    if (!pipelineId) {
      const defaultPipeline = await this.app.prisma.pipeline.findFirst({
        where: { isDefault: true, isActive: true }
      });

      if (!defaultPipeline) {
        throw new AppError(400, "pipeline_not_configured", "Воронка по умолчанию не настроена");
      }

      pipelineId = defaultPipeline.id;
    }

    if (!stageId) {
      const firstStage = await this.app.prisma.stage.findFirst({
        where: {
          pipelineId,
          isActive: true
        },
        orderBy: {
          sortOrder: "asc"
        }
      });

      if (!firstStage) {
        throw new AppError(400, "stage_not_configured", "Для воронки не настроен активный этап");
      }

      stageId = firstStage.id;
    }

    const stage = await this.app.prisma.stage.findUnique({
      where: { id: stageId }
    });

    if (!stage || stage.pipelineId !== pipelineId) {
      throw new AppError(400, "invalid_stage", "Этап не принадлежит выбранной воронке");
    }

    const lead = await this.app.prisma.lead.create({
      data: {
        companyName: payload.companyName,
        websiteUrl: payload.websiteUrl,
        mainContactName: payload.mainContactName,
        mainContactEmail: payload.mainContactEmail,
        mainContactPhone: payload.mainContactPhone,
        sourceId: payload.sourceId,
        ownerUserId: payload.ownerUserId ?? currentUser.userId,
        pipelineId,
        stageId,
        status: mapStageOutcomeToLeadStatus(stage.outcome),
        priority: payload.priority,
        monthlyBudgetEstimate: payload.monthlyBudgetEstimate,
        nextFollowUpAt: payload.nextFollowUpAt ? new Date(payload.nextFollowUpAt) : null
      },
      include: {
        source: true,
        stage: true,
        owner: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        }
      }
    });

    await this.app.prisma.leadStageHistory.create({
      data: {
        leadId: lead.id,
        fromStageId: null,
        toStageId: lead.stageId,
        changedByUserId: currentUser.userId,
        comment: "Лид создан"
      }
    });

    await this.runAutomationEventSafe(
      {
        event: "lead.created",
        leadId: lead.id,
        payload: {
          toStageCode: lead.stage.code,
          leadStatus: lead.status,
          sourceCode: lead.source?.code
        }
      },
      currentUser.userId
    );

    return lead;
  }

  async updateLead(leadId: number, payload: UpdateLeadInput) {
    const existingLead = await this.app.prisma.lead.findUnique({
      where: { id: leadId }
    });

    if (!existingLead || existingLead.archivedAt) {
      throw new AppError(404, "lead_not_found", "Лид не найден");
    }

    const updatedLead = await this.app.prisma.lead.update({
      where: { id: leadId },
      data: {
        companyName: payload.companyName,
        websiteUrl: payload.websiteUrl,
        mainContactName: payload.mainContactName,
        mainContactEmail: payload.mainContactEmail,
        mainContactPhone: payload.mainContactPhone,
        sourceId: payload.sourceId,
        ownerUserId: payload.ownerUserId,
        priority: payload.priority,
        monthlyBudgetEstimate: payload.monthlyBudgetEstimate,
        nextFollowUpAt: payload.nextFollowUpAt ? new Date(payload.nextFollowUpAt) : undefined
      },
      include: {
        source: true,
        stage: true,
        owner: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        }
      }
    });

    return updatedLead;
  }

  async assignLead(leadId: number, payload: AssignLeadInput, actorUserId: number) {
    const lead = await this.app.prisma.lead.findUnique({ where: { id: leadId } });

    if (!lead || lead.archivedAt) {
      throw new AppError(404, "lead_not_found", "Лид не найден");
    }

    const assignedLead = await this.app.prisma.lead.update({
      where: { id: leadId },
      data: {
        ownerUserId: payload.ownerUserId
      }
    });

    await this.app.prisma.auditLog.create({
      data: {
        entityType: "lead",
        entityId: String(leadId),
        action: "assigned",
        actorUserId,
        payload: {
          ownerUserId: payload.ownerUserId
        }
      }
    });

    return assignedLead;
  }

  private async validateStageRequirements(
    lead: { id: number; nextFollowUpAt: Date | null; firstContactAt: Date | null },
    targetStage: { requiredFields: Prisma.JsonValue },
    transitionComment?: string
  ) {
    const requiredFields = extractRequiredFields(targetStage.requiredFields);

    if (requiredFields.length === 0) {
      return;
    }

    const needBrief = requiredFields.some((field) => field.startsWith("brief."));
    const needDeal = requiredFields.some((field) => field.startsWith("deal."));
    const needProposal = requiredFields.some((field) => field.startsWith("proposal."));

    const [latestBrief, latestDeal, latestProposal] = await Promise.all([
      needBrief
        ? this.app.prisma.brief.findFirst({ where: { leadId: lead.id }, orderBy: { createdAt: "desc" } })
        : Promise.resolve(null),
      needDeal
        ? this.app.prisma.deal.findFirst({ where: { leadId: lead.id }, orderBy: { createdAt: "desc" } })
        : Promise.resolve(null),
      needProposal
        ? this.app.prisma.proposal.findFirst({ where: { leadId: lead.id }, orderBy: { createdAt: "desc" } })
        : Promise.resolve(null)
    ]);

    const missingDetails: Array<Record<string, string>> = [];

    for (const field of requiredFields) {
      switch (field) {
        case "next_follow_up_at": {
          if (!lead.nextFollowUpAt) {
            missingDetails.push({ field, message: "Заполните дату следующего follow-up" });
          }
          break;
        }
        case "activity.first_contact_result": {
          if (!lead.firstContactAt && !transitionComment?.trim()) {
            missingDetails.push({ field, message: "Добавьте комментарий с результатом первого контакта" });
          }
          break;
        }
        case "brief.target_audience": {
          if (!latestBrief?.targetAudience) {
            missingDetails.push({ field, message: "Заполните целевую аудиторию в брифе" });
          }
          break;
        }
        case "brief.main_kpi": {
          if (!latestBrief?.mainKpi) {
            missingDetails.push({ field, message: "Заполните основной KPI в брифе" });
          }
          break;
        }
        case "proposal.proposal_url": {
          if (!latestProposal?.proposalUrl) {
            missingDetails.push({ field, message: "Добавьте коммерческое предложение" });
          }
          break;
        }
        case "deal.amount": {
          if (latestDeal?.amount == null) {
            missingDetails.push({ field, message: "Укажите сумму сделки" });
          }
          break;
        }
        case "deal.start_date_plan": {
          if (!latestDeal?.startDatePlan) {
            missingDetails.push({ field, message: "Укажите плановую дату старта по сделке" });
          }
          break;
        }
        case "deal.close_date_fact": {
          if (!latestDeal?.closeDateFact) {
            missingDetails.push({ field, message: "Укажите фактическую дату закрытия сделки" });
          }
          break;
        }
        case "deal.lost_reason_id": {
          if (!latestDeal?.lostReasonId) {
            missingDetails.push({ field, message: "Укажите причину потери сделки" });
          }
          break;
        }
        case "comment": {
          if (!transitionComment?.trim()) {
            missingDetails.push({ field, message: "Добавьте комментарий к переходу этапа" });
          }
          break;
        }
        default: {
          // Unknown rule is ignored until a dedicated validator is implemented.
          break;
        }
      }
    }

    if (missingDetails.length > 0) {
      throw new AppError(
        422,
        "stage_required_fields_missing",
        "Не заполнены обязательные поля для перехода на этап",
        missingDetails
      );
    }
  }

  async transitionLead(
    leadId: number,
    payload: TransitionLeadInput,
    currentUser: { userId: number }
  ) {
    const lead = await this.app.prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        stage: {
          select: {
            code: true
          }
        },
        source: {
          select: {
            code: true
          }
        }
      }
    });

    if (!lead || lead.archivedAt) {
      throw new AppError(404, "lead_not_found", "Лид не найден");
    }

    const targetStage = await this.app.prisma.stage.findUnique({
      where: { id: payload.toStageId }
    });

    if (!targetStage || targetStage.pipelineId !== lead.pipelineId) {
      throw new AppError(400, "invalid_stage", "Целевой этап недоступен для этого лида");
    }

    await this.validateStageRequirements(lead, targetStage, payload.comment);

    const updatedLead = await this.app.prisma.lead.update({
      where: { id: leadId },
      data: {
        stageId: targetStage.id,
        status: mapStageOutcomeToLeadStatus(targetStage.outcome),
        firstContactAt: targetStage.code === "first-contact" && !lead.firstContactAt ? new Date() : undefined
      },
      include: {
        stage: true,
        owner: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        }
      }
    });

    await this.app.prisma.leadStageHistory.create({
      data: {
        leadId,
        fromStageId: lead.stageId,
        toStageId: targetStage.id,
        changedByUserId: currentUser.userId,
        comment: payload.comment
      }
    });

    await this.app.prisma.auditLog.create({
      data: {
        entityType: "lead",
        entityId: String(leadId),
        action: "stage_transition",
        actorUserId: currentUser.userId,
        payload: {
          fromStageId: lead.stageId,
          toStageId: targetStage.id,
          comment: payload.comment ?? null
        }
      }
    });

    await this.runAutomationEventSafe(
      {
        event: "lead.stage_changed",
        leadId,
        payload: {
          fromStageCode: lead.stage.code,
          toStageCode: targetStage.code,
          leadStatus: updatedLead.status,
          sourceCode: lead.source?.code
        }
      },
      currentUser.userId
    );

    return updatedLead;
  }

  async getLeadHistory(leadId: number) {
    const lead = await this.app.prisma.lead.findUnique({
      where: { id: leadId }
    });

    if (!lead || lead.archivedAt) {
      throw new AppError(404, "lead_not_found", "Лид не найден");
    }

    return this.app.prisma.leadStageHistory.findMany({
      where: { leadId },
      include: {
        fromStage: true,
        toStage: true,
        changedByUser: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        }
      },
      orderBy: {
        changedAt: "desc"
      }
    });
  }
}
