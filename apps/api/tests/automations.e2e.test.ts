import type { FastifyInstance } from "fastify";
import { describe, expect, it, vi } from "vitest";
import { AutomationsService } from "../src/modules/automations/service.ts";

type TaskRecord = {
  id: number;
  leadId: number | null;
  dealId: number | null;
  assigneeUserId: number;
  ownerUserId: number;
  type: string;
  priority: string;
  title: string;
  description: string;
  dueAt: Date | null;
  status: "TODO" | "IN_PROGRESS" | "DONE" | "CANCELED";
};

function makeInMemoryApp() {
  const lead = {
    id: 1,
    companyName: "ООО Орбита",
    ownerUserId: 42,
    status: "OPEN" as "OPEN" | "WON" | "LOST",
    priority: "MEDIUM" as "LOW" | "MEDIUM" | "HIGH",
    stageCode: "new",
    sourceCode: "site-form",
    nextFollowUpAt: null as Date | null
  };

  const deal = {
    id: 100,
    leadId: 1,
    ownerUserId: 42,
    status: "WON" as "OPEN" | "WON" | "LOST"
  };

  const tasks: TaskRecord[] = [];
  const auditEntries: Array<{ entityId: string; action: string }> = [];
  let taskIdSeq = 1;

  const prisma = {
    lead: {
      findUnique: vi.fn(async ({ where }: any) => {
        if (where.id !== lead.id) {
          return null;
        }

        return {
          id: lead.id,
          companyName: lead.companyName,
          ownerUserId: lead.ownerUserId,
          status: lead.status,
          priority: lead.priority,
          stage: {
            code: lead.stageCode
          },
          source: lead.sourceCode
            ? {
                code: lead.sourceCode
              }
            : null
        };
      }),
      update: vi.fn(async ({ where, data }: any) => {
        if (where.id !== lead.id) {
          return null;
        }

        if (data.priority) {
          lead.priority = data.priority;
        }

        if ("nextFollowUpAt" in data && data.nextFollowUpAt !== undefined) {
          lead.nextFollowUpAt = data.nextFollowUpAt;
        }

        return {
          id: lead.id,
          priority: lead.priority,
          nextFollowUpAt: lead.nextFollowUpAt
        };
      })
    },
    deal: {
      findUnique: vi.fn(async ({ where }: any) => {
        if (where.id !== deal.id) {
          return null;
        }

        return {
          id: deal.id,
          ownerUserId: deal.ownerUserId,
          status: deal.status,
          leadId: deal.leadId
        };
      })
    },
    task: {
      findFirst: vi.fn(async ({ where }: any) => {
        return (
          tasks.find((task) => {
            if (where.leadId !== undefined && task.leadId !== where.leadId) {
              return false;
            }

            if (where.dealId !== undefined && task.dealId !== where.dealId) {
              return false;
            }

            if (where.assigneeUserId !== undefined && task.assigneeUserId !== where.assigneeUserId) {
              return false;
            }

            if (where.type !== undefined && task.type !== where.type) {
              return false;
            }

            const allowedStatuses = where.status?.in as string[] | undefined;
            if (allowedStatuses?.length && !allowedStatuses.includes(task.status)) {
              return false;
            }

            const descriptionContains = where.description?.contains as string | undefined;
            if (descriptionContains && !task.description.includes(descriptionContains)) {
              return false;
            }

            return true;
          }) ?? null
        );
      }),
      create: vi.fn(async ({ data }: any) => {
        const task: TaskRecord = {
          id: taskIdSeq++,
          leadId: data.leadId ?? null,
          dealId: data.dealId ?? null,
          assigneeUserId: data.assigneeUserId,
          ownerUserId: data.ownerUserId,
          type: data.type,
          priority: data.priority,
          title: data.title,
          description: data.description,
          dueAt: data.dueAt ?? null,
          status: data.status
        };
        tasks.push(task);
        return task;
      })
    },
    auditLog: {
      create: vi.fn(async ({ data }: any) => {
        auditEntries.push({
          entityId: data.entityId,
          action: data.action
        });
        return {};
      })
    }
  };

  const app = {
    prisma,
    log: {
      error: vi.fn()
    }
  } as unknown as FastifyInstance;

  return { app, state: { lead, deal, tasks, auditEntries } };
}

describe("AutomationsService e2e flows", () => {
  it("сквозной сценарий: входящий лид -> этап КП -> закрытие сделки в WON", async () => {
    const { app, state } = makeInMemoryApp();
    const service = new AutomationsService(app);

    const createdRun = await service.runEvent(
      {
        event: "lead.created",
        leadId: state.lead.id,
        payload: {
          sourceCode: state.lead.sourceCode
        }
      },
      1
    );

    expect(createdRun.matchedRules).toBe(1);
    expect(createdRun.executedActions).toBe(2);
    expect(state.tasks).toHaveLength(1);
    expect(state.tasks[0]?.type).toBe("CALL");
    expect(state.lead.nextFollowUpAt).toBeInstanceOf(Date);

    state.lead.stageCode = "proposal-sent";
    const proposalRun = await service.runEvent(
      {
        event: "lead.stage_changed",
        leadId: state.lead.id,
        payload: {
          fromStageCode: "audit-estimate",
          toStageCode: "proposal-sent"
        }
      },
      1
    );

    expect(proposalRun.matchedRules).toBe(1);
    expect(proposalRun.executedActions).toBe(2);
    expect(state.tasks).toHaveLength(2);
    expect(state.tasks[1]?.type).toBe("FOLLOW_UP");

    const duplicateProposalRun = await service.runEvent(
      {
        event: "lead.stage_changed",
        leadId: state.lead.id,
        payload: {
          fromStageCode: "audit-estimate",
          toStageCode: "proposal-sent"
        }
      },
      1
    );

    expect(duplicateProposalRun.executedActions).toBe(1);
    expect(duplicateProposalRun.skippedActions).toBe(1);
    expect(state.tasks).toHaveLength(2);

    const wonRun = await service.runEvent(
      {
        event: "deal.closed_won",
        dealId: state.deal.id,
        leadId: state.lead.id,
        payload: {
          dealStatus: "WON"
        }
      },
      1
    );

    expect(wonRun.matchedRules).toBe(1);
    expect(wonRun.executedActions).toBe(1);
    expect(state.tasks).toHaveLength(3);
    expect(state.tasks[2]?.type).toBe("CUSTOM");
    expect(state.auditEntries).toHaveLength(4);
  });
});
