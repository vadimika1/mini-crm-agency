import type { FastifyInstance } from "fastify";
import { TaskStatus } from "@prisma/client";
import type { AutomationAction, AutomationRule } from "./rules.js";
import { defaultAutomationRules } from "./rules.js";
import type { RunAutomationEventInput } from "./schemas.js";

type AutomationContext = {
  event: RunAutomationEventInput["event"];
  actorUserId: number;
  lead: {
    id: number;
    companyName: string;
    ownerUserId: number | null;
    status: "OPEN" | "WON" | "LOST";
    priority: "LOW" | "MEDIUM" | "HIGH";
    sourceCode: string | null;
    stageCode: string;
  } | null;
  deal: {
    id: number;
    ownerUserId: number | null;
    status: "OPEN" | "WON" | "LOST";
  } | null;
  payload: RunAutomationEventInput["payload"];
};

type AutomationActionResult = {
  ruleId: string;
  actionType: AutomationAction["type"];
  status: "executed" | "skipped" | "failed";
  message: string;
};

type AutomationRunResult = {
  event: RunAutomationEventInput["event"];
  matchedRules: number;
  executedActions: number;
  skippedActions: number;
  failedActions: number;
  actionResults: AutomationActionResult[];
};

function getByPath(value: unknown, path: string): string {
  const parts = path.split(".");
  let current: unknown = value;

  for (const part of parts) {
    if (!current || typeof current !== "object" || !(part in current)) {
      return "";
    }
    current = (current as Record<string, unknown>)[part];
  }

  if (current === null || current === undefined) {
    return "";
  }

  return String(current);
}

function renderTemplate(template: string, context: AutomationContext): string {
  return template.replace(/\{\{([\w.]+)\}\}/g, (_match, path) => {
    const value = getByPath(
      {
        lead: context.lead,
        deal: context.deal,
        payload: context.payload
      },
      path
    );

    return value || "";
  });
}

export class AutomationsService {
  constructor(private readonly app: FastifyInstance) {}

  listRules() {
    return defaultAutomationRules;
  }

  private matchRule(rule: AutomationRule, context: AutomationContext): boolean {
    if (!rule.isActive || rule.trigger.event !== context.event) {
      return false;
    }

    const conditions = rule.conditions;
    if (!conditions) {
      return true;
    }

    if (conditions.toStageCodeIn?.length) {
      const toStageCode = context.payload?.toStageCode ?? context.lead?.stageCode;
      if (!toStageCode || !conditions.toStageCodeIn.includes(toStageCode)) {
        return false;
      }
    }

    if (conditions.fromStageCodeIn?.length) {
      const fromStageCode = context.payload?.fromStageCode;
      if (!fromStageCode || !conditions.fromStageCodeIn.includes(fromStageCode)) {
        return false;
      }
    }

    if (conditions.leadStatusIn?.length) {
      const leadStatus = context.payload?.leadStatus ?? context.lead?.status;
      if (!leadStatus || !conditions.leadStatusIn.includes(leadStatus)) {
        return false;
      }
    }

    if (conditions.dealStatusIn?.length) {
      const dealStatus = context.payload?.dealStatus ?? context.deal?.status;
      if (!dealStatus || !conditions.dealStatusIn.includes(dealStatus)) {
        return false;
      }
    }

    if (conditions.sourceCodeIn?.length) {
      const sourceCode = context.payload?.sourceCode ?? context.lead?.sourceCode ?? null;
      if (!sourceCode || !conditions.sourceCodeIn.includes(sourceCode)) {
        return false;
      }
    }

    return true;
  }

  private resolveAssigneeUserId(action: Extract<AutomationAction, { type: "create_task" }>, context: AutomationContext): number | null {
    if (action.payload.assignee === "actor") {
      return context.actorUserId;
    }

    if (action.payload.assignee === "lead_owner") {
      return context.lead?.ownerUserId ?? null;
    }

    return context.deal?.ownerUserId ?? context.lead?.ownerUserId ?? null;
  }

  private async runCreateTaskAction(
    rule: AutomationRule,
    action: Extract<AutomationAction, { type: "create_task" }>,
    context: AutomationContext
  ): Promise<AutomationActionResult> {
    const leadId = context.lead?.id ?? null;
    const dealId = context.deal?.id ?? null;
    const assigneeUserId = this.resolveAssigneeUserId(action, context);

    if (!assigneeUserId) {
      return {
        ruleId: rule.id,
        actionType: action.type,
        status: "skipped",
        message: "Пропущено: не найден исполнитель для задачи"
      };
    }

    const automationKey = `[automation:${rule.id}:${context.event}:${leadId ?? "no-lead"}:${dealId ?? "no-deal"}]`;
    const title = renderTemplate(action.payload.title, context).trim() || action.payload.title;
    const renderedDescription = action.payload.description ? renderTemplate(action.payload.description, context).trim() : "";
    const description = renderedDescription ? `${automationKey}\n${renderedDescription}` : automationKey;

    const existing = await this.app.prisma.task.findFirst({
      where: {
        leadId: leadId ?? undefined,
        dealId: dealId ?? undefined,
        assigneeUserId,
        type: action.payload.taskType,
        status: {
          in: [TaskStatus.TODO, TaskStatus.IN_PROGRESS]
        },
        description: {
          contains: automationKey
        }
      },
      select: {
        id: true
      }
    });

    if (existing) {
      return {
        ruleId: rule.id,
        actionType: action.type,
        status: "skipped",
        message: `Пропущено: задача уже существует (#${existing.id})`
      };
    }

    const dueAt = action.payload.dueInMinutes
      ? new Date(Date.now() + action.payload.dueInMinutes * 60 * 1000)
      : null;

    const created = await this.app.prisma.task.create({
      data: {
        leadId,
        dealId,
        ownerUserId: context.actorUserId,
        assigneeUserId,
        type: action.payload.taskType,
        priority: action.payload.priority,
        title,
        description,
        dueAt,
        status: TaskStatus.TODO
      }
    });

    return {
      ruleId: rule.id,
      actionType: action.type,
      status: "executed",
      message: `Создана задача #${created.id}`
    };
  }

  private async runUpdateLeadPriorityAction(
    rule: AutomationRule,
    action: Extract<AutomationAction, { type: "update_lead_priority" }>,
    context: AutomationContext
  ): Promise<AutomationActionResult> {
    if (!context.lead) {
      return {
        ruleId: rule.id,
        actionType: action.type,
        status: "skipped",
        message: "Пропущено: лид не найден"
      };
    }

    if (context.lead.priority === action.payload.priority) {
      return {
        ruleId: rule.id,
        actionType: action.type,
        status: "skipped",
        message: "Пропущено: приоритет уже установлен"
      };
    }

    await this.app.prisma.lead.update({
      where: {
        id: context.lead.id
      },
      data: {
        priority: action.payload.priority
      }
    });

    return {
      ruleId: rule.id,
      actionType: action.type,
      status: "executed",
      message: `Приоритет лида обновлен на ${action.payload.priority}`
    };
  }

  private async runSetNextFollowUpAction(
    rule: AutomationRule,
    action: Extract<AutomationAction, { type: "set_next_follow_up" }>,
    context: AutomationContext
  ): Promise<AutomationActionResult> {
    if (!context.lead) {
      return {
        ruleId: rule.id,
        actionType: action.type,
        status: "skipped",
        message: "Пропущено: лид не найден"
      };
    }

    const nextFollowUpAt = new Date(Date.now() + action.payload.inMinutes * 60 * 1000);

    await this.app.prisma.lead.update({
      where: {
        id: context.lead.id
      },
      data: {
        nextFollowUpAt
      }
    });

    return {
      ruleId: rule.id,
      actionType: action.type,
      status: "executed",
      message: `next follow-up установлен на ${nextFollowUpAt.toISOString()}`
    };
  }

  private async resolveContext(input: RunAutomationEventInput, actorUserId: number): Promise<AutomationContext> {
    let leadId = input.leadId ?? null;
    const dealId = input.dealId ?? null;

    const deal = dealId
      ? await this.app.prisma.deal.findUnique({
          where: {
            id: dealId
          },
          select: {
            id: true,
            ownerUserId: true,
            status: true,
            leadId: true
          }
        })
      : null;

    if (!leadId && deal?.leadId) {
      leadId = deal.leadId;
    }

    const lead = leadId
      ? await this.app.prisma.lead.findUnique({
          where: {
            id: leadId
          },
          select: {
            id: true,
            companyName: true,
            ownerUserId: true,
            status: true,
            priority: true,
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
        })
      : null;

    return {
      event: input.event,
      actorUserId,
      lead: lead
        ? {
            id: lead.id,
            companyName: lead.companyName,
            ownerUserId: lead.ownerUserId,
            status: lead.status,
            priority: lead.priority,
            sourceCode: lead.source?.code ?? null,
            stageCode: lead.stage.code
          }
        : null,
      deal: deal
        ? {
            id: deal.id,
            ownerUserId: deal.ownerUserId,
            status: deal.status
          }
        : null,
      payload: input.payload
    };
  }

  async runEvent(input: RunAutomationEventInput, actorUserId: number): Promise<AutomationRunResult> {
    const context = await this.resolveContext(input, actorUserId);
    const matchedRules = this.listRules().filter((rule) => this.matchRule(rule, context));
    const actionResults: AutomationActionResult[] = [];

    for (const rule of matchedRules) {
      for (const action of rule.actions) {
        try {
          if (action.type === "create_task") {
            actionResults.push(await this.runCreateTaskAction(rule, action, context));
            continue;
          }

          if (action.type === "update_lead_priority") {
            actionResults.push(await this.runUpdateLeadPriorityAction(rule, action, context));
            continue;
          }

          actionResults.push(await this.runSetNextFollowUpAction(rule, action, context));
        } catch (error) {
          actionResults.push({
            ruleId: rule.id,
            actionType: action.type,
            status: "failed",
            message: error instanceof Error && error.message ? error.message : "Не удалось выполнить действие"
          });
        }
      }
    }

    const executedActions = actionResults.filter((item) => item.status === "executed").length;
    const skippedActions = actionResults.filter((item) => item.status === "skipped").length;
    const failedActions = actionResults.filter((item) => item.status === "failed").length;

    await this.app.prisma.auditLog.create({
      data: {
        entityType: "automation",
        entityId: input.event,
        action: "event_run",
        actorUserId,
        payload: {
          matchedRules: matchedRules.map((rule) => rule.id),
          executedActions,
          skippedActions,
          failedActions
        }
      }
    });

    return {
      event: input.event,
      matchedRules: matchedRules.length,
      executedActions,
      skippedActions,
      failedActions,
      actionResults
    };
  }
}
