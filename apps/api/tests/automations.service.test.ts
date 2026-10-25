import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { AutomationsService } from "../src/modules/automations/service.ts";

type MockFn = ReturnType<typeof vi.fn>;

type FakePrisma = {
  lead: {
    findUnique: MockFn;
    update: MockFn;
  };
  deal: {
    findUnique: MockFn;
  };
  task: {
    findFirst: MockFn;
    create: MockFn;
  };
  auditLog: {
    create: MockFn;
  };
};

function makeFakeApp(): { app: FastifyInstance; prisma: FakePrisma } {
  const prisma: FakePrisma = {
    lead: {
      findUnique: vi.fn(),
      update: vi.fn()
    },
    deal: {
      findUnique: vi.fn()
    },
    task: {
      findFirst: vi.fn(),
      create: vi.fn()
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({})
    }
  };

  const app = {
    prisma,
    log: {
      error: vi.fn()
    }
  } as unknown as FastifyInstance;

  return { app, prisma };
}

describe("AutomationsService", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("создает срочный первичный контакт для входящего лида", async () => {
    const { app, prisma } = makeFakeApp();
    prisma.deal.findUnique.mockResolvedValue(null);
    prisma.lead.findUnique.mockResolvedValue({
      id: 3,
      companyName: "ООО Входящий",
      ownerUserId: 21,
      status: "OPEN",
      priority: "MEDIUM",
      stage: { code: "new" },
      source: { code: "site-form" }
    });
    prisma.task.findFirst.mockResolvedValue(null);
    prisma.task.create.mockResolvedValue({ id: 301 });
    prisma.lead.update.mockResolvedValue({});

    const service = new AutomationsService(app);
    const result = await service.runEvent(
      {
        event: "lead.created",
        leadId: 3,
        payload: {
          sourceCode: "site-form"
        }
      },
      1
    );

    expect(result.matchedRules).toBe(1);
    expect(result.executedActions).toBe(2);
    expect(prisma.task.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          leadId: 3,
          assigneeUserId: 21,
          type: "CALL",
          priority: "HIGH",
          title: "Авто: первичный контакт (ООО Входящий)",
          dueAt: expect.any(Date)
        })
      })
    );
    expect(prisma.lead.update).toHaveBeenCalledWith({
      where: {
        id: 3
      },
      data: {
        nextFollowUpAt: expect.any(Date)
      }
    });
  });

  it("повышает приоритет лида при переходе на этап negotiation", async () => {
    const { app, prisma } = makeFakeApp();
    prisma.deal.findUnique.mockResolvedValue(null);
    prisma.lead.findUnique.mockResolvedValue({
      id: 1,
      companyName: "ООО Альфа",
      ownerUserId: 11,
      status: "OPEN",
      priority: "MEDIUM",
      stage: { code: "lead-in" },
      source: { code: "manual" }
    });
    prisma.lead.update.mockResolvedValue({});

    const service = new AutomationsService(app);
    const result = await service.runEvent(
      {
        event: "lead.stage_changed",
        leadId: 1,
        payload: {
          fromStageCode: "lead-in",
          toStageCode: "negotiation"
        }
      },
      1
    );

    expect(result.matchedRules).toBe(1);
    expect(result.executedActions).toBe(1);
    expect(prisma.lead.update).toHaveBeenCalledWith({
      where: {
        id: 1
      },
      data: {
        priority: "HIGH"
      }
    });
    expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
  });

  it("ставит follow-up и задачу после отправки КП", async () => {
    const { app, prisma } = makeFakeApp();
    prisma.deal.findUnique.mockResolvedValue(null);
    prisma.lead.findUnique.mockResolvedValue({
      id: 9,
      companyName: "ООО КП Тест",
      ownerUserId: 15,
      status: "OPEN",
      priority: "HIGH",
      stage: { code: "proposal-sent" },
      source: { code: "manual" }
    });
    prisma.task.findFirst.mockResolvedValue(null);
    prisma.task.create.mockResolvedValue({ id: 901 });
    prisma.lead.update.mockResolvedValue({});

    const service = new AutomationsService(app);
    const result = await service.runEvent(
      {
        event: "lead.stage_changed",
        leadId: 9,
        payload: {
          fromStageCode: "audit-estimate",
          toStageCode: "proposal-sent"
        }
      },
      1
    );

    expect(result.matchedRules).toBe(1);
    expect(result.executedActions).toBe(2);
    expect(prisma.lead.update).toHaveBeenCalledWith({
      where: {
        id: 9
      },
      data: {
        nextFollowUpAt: expect.any(Date)
      }
    });
    expect(prisma.task.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          leadId: 9,
          assigneeUserId: 15,
          type: "FOLLOW_UP",
          priority: "HIGH",
          title: "Авто: follow-up по КП (ООО КП Тест)",
          dueAt: expect.any(Date)
        })
      })
    );
  });

  it("не создает дублирующую задачу follow-up при повторном событии", async () => {
    const { app, prisma } = makeFakeApp();
    prisma.deal.findUnique.mockResolvedValue(null);
    prisma.lead.findUnique.mockResolvedValue({
      id: 7,
      companyName: "ООО Ромашка",
      ownerUserId: 21,
      status: "OPEN",
      priority: "MEDIUM",
      stage: { code: "briefing" },
      source: { code: "site-form" }
    });
    prisma.task.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 701 });
    prisma.task.create.mockResolvedValue({ id: 701 });

    const service = new AutomationsService(app);
    const firstRun = await service.runEvent(
      {
        event: "lead.brief_completed",
        leadId: 7
      },
      1
    );
    const secondRun = await service.runEvent(
      {
        event: "lead.brief_completed",
        leadId: 7
      },
      1
    );

    expect(firstRun.executedActions).toBe(1);
    expect(secondRun.skippedActions).toBe(1);
    expect(secondRun.actionResults[0]?.message).toContain("уже существует");
    expect(prisma.task.create).toHaveBeenCalledTimes(1);
  });
});
