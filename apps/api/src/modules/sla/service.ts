import type { FastifyInstance } from "fastify";
import { TaskStatus, TaskType } from "@prisma/client";

export class SlaService {
  constructor(private readonly app: FastifyInstance) {}

  async getSlaReport() {
    const now = new Date();
    const firstContactDeadline = new Date(now.getTime() - 30 * 60 * 1000);

    const [
      overdueTasksCount,
      overdueTasks,
      leadsWithoutFirstContactCount,
      leadsWithoutFirstContact,
      overdueFollowUpLeadsCount,
      overdueFollowUpLeads
    ] = await Promise.all([
      this.app.prisma.task.count({
        where: {
          dueAt: { lt: now },
          status: { in: [TaskStatus.TODO, TaskStatus.IN_PROGRESS] }
        }
      }),
      this.app.prisma.task.findMany({
        where: {
          dueAt: { lt: now },
          status: { in: [TaskStatus.TODO, TaskStatus.IN_PROGRESS] }
        },
        take: 20,
        orderBy: { dueAt: "asc" },
        include: {
          assignee: { select: { id: true, fullName: true, email: true } },
          lead: { select: { id: true, companyName: true } }
        }
      }),
      this.app.prisma.lead.count({
        where: {
          status: "OPEN",
          firstContactAt: null,
          createdAt: { lte: firstContactDeadline },
          archivedAt: null
        }
      }),
      this.app.prisma.lead.findMany({
        where: {
          status: "OPEN",
          firstContactAt: null,
          createdAt: { lte: firstContactDeadline },
          archivedAt: null
        },
        take: 20,
        orderBy: { createdAt: "asc" },
        include: {
          owner: { select: { id: true, fullName: true, email: true } },
          stage: { select: { id: true, name: true, code: true } }
        }
      }),
      this.app.prisma.lead.count({
        where: {
          status: "OPEN",
          nextFollowUpAt: { lt: now },
          archivedAt: null
        }
      }),
      this.app.prisma.lead.findMany({
        where: {
          status: "OPEN",
          nextFollowUpAt: { lt: now },
          archivedAt: null
        },
        take: 20,
        orderBy: { nextFollowUpAt: "asc" },
        include: {
          owner: { select: { id: true, fullName: true, email: true } },
          stage: { select: { id: true, name: true, code: true } }
        }
      })
    ]);

    return {
      checkedAt: now.toISOString(),
      metrics: {
        overdueTasksCount,
        leadsWithoutFirstContactCount,
        overdueFollowUpLeadsCount
      },
      samples: {
        overdueTasks,
        leadsWithoutFirstContact,
        overdueFollowUpLeads
      }
    };
  }

  async runSlaCheck(actorUserId: number) {
    const now = new Date();
    const firstContactDeadline = new Date(now.getTime() - 30 * 60 * 1000);

    const [leadsNeedFirstContact, leadsNeedFollowUp] = await Promise.all([
      this.app.prisma.lead.findMany({
        where: {
          status: "OPEN",
          firstContactAt: null,
          createdAt: { lte: firstContactDeadline },
          archivedAt: null,
          ownerUserId: { not: null }
        },
        select: {
          id: true,
          ownerUserId: true
        }
      }),
      this.app.prisma.lead.findMany({
        where: {
          status: "OPEN",
          nextFollowUpAt: { lt: now },
          archivedAt: null,
          ownerUserId: { not: null }
        },
        select: {
          id: true,
          ownerUserId: true
        }
      })
    ]);

    let createdFirstContactTasks = 0;
    let createdFollowUpTasks = 0;

    for (const lead of leadsNeedFirstContact) {
      if (!lead.ownerUserId) {
        continue;
      }

      const existing = await this.app.prisma.task.findFirst({
        where: {
          leadId: lead.id,
          type: TaskType.CALL,
          status: { in: [TaskStatus.TODO, TaskStatus.IN_PROGRESS] },
          title: { contains: "SLA" }
        }
      });

      if (!existing) {
        await this.app.prisma.task.create({
          data: {
            leadId: lead.id,
            ownerUserId: actorUserId,
            assigneeUserId: lead.ownerUserId,
            type: TaskType.CALL,
            title: "SLA: первичный контакт просрочен",
            description: "Система создала задачу автоматически: первичный контакт не выполнен в SLA.",
            status: TaskStatus.TODO,
            dueAt: new Date(now.getTime() + 10 * 60 * 1000)
          }
        });

        createdFirstContactTasks += 1;
      }
    }

    for (const lead of leadsNeedFollowUp) {
      if (!lead.ownerUserId) {
        continue;
      }

      const existing = await this.app.prisma.task.findFirst({
        where: {
          leadId: lead.id,
          type: TaskType.FOLLOW_UP,
          status: { in: [TaskStatus.TODO, TaskStatus.IN_PROGRESS] },
          title: { contains: "SLA" }
        }
      });

      if (!existing) {
        await this.app.prisma.task.create({
          data: {
            leadId: lead.id,
            ownerUserId: actorUserId,
            assigneeUserId: lead.ownerUserId,
            type: TaskType.FOLLOW_UP,
            title: "SLA: нужен follow-up",
            description: "Система создала задачу автоматически: просрочен follow-up по лиду.",
            status: TaskStatus.TODO,
            dueAt: new Date(now.getTime() + 30 * 60 * 1000)
          }
        });

        createdFollowUpTasks += 1;
      }
    }

    await this.app.prisma.auditLog.create({
      data: {
        entityType: "sla",
        entityId: "daily-check",
        action: "run_check",
        actorUserId,
        payload: {
          leadsNeedFirstContact: leadsNeedFirstContact.length,
          leadsNeedFollowUp: leadsNeedFollowUp.length,
          createdFirstContactTasks,
          createdFollowUpTasks
        }
      }
    });

    return {
      checkedAt: now.toISOString(),
      leadsNeedFirstContact: leadsNeedFirstContact.length,
      leadsNeedFollowUp: leadsNeedFollowUp.length,
      createdFirstContactTasks,
      createdFollowUpTasks
    };
  }
}
