import type { FastifyInstance } from "fastify";
import { TaskStatus, Prisma } from "@prisma/client";
import { AppError } from "../../lib/errors.js";
import { getPagination } from "../../utils/pagination.js";
import type { CompleteTaskInput, CreateTaskInput, ListTasksQuery, UpdateTaskInput } from "./schemas.js";

export class TasksService {
  constructor(private readonly app: FastifyInstance) {}

  async listTasks(query: ListTasksQuery, currentUser: { userId: number; roles: string[] }) {
    const { page, per_page: perPage, assignee_user_id: assigneeUserId, lead_id: leadId, overdue, status } = query;
    const pagination = getPagination(page, perPage);

    const isPrivileged = currentUser.roles.includes("admin") || currentUser.roles.includes("head");

    const where: Prisma.TaskWhereInput = {
      ...(leadId ? { leadId } : {}),
      ...(status ? { status } : {}),
      ...(overdue
        ? {
            dueAt: { lt: new Date() },
            status: { in: [TaskStatus.TODO, TaskStatus.IN_PROGRESS] }
          }
        : {})
    };

    if (isPrivileged) {
      if (assigneeUserId) {
        where.assigneeUserId = assigneeUserId;
      }
    } else {
      where.OR = [{ assigneeUserId: currentUser.userId }, { ownerUserId: currentUser.userId }];
    }

    const [rows, total] = await Promise.all([
      this.app.prisma.task.findMany({
        where,
        include: {
          assignee: {
            select: {
              id: true,
              fullName: true,
              email: true
            }
          },
          owner: {
            select: {
              id: true,
              fullName: true,
              email: true
            }
          },
          lead: {
            select: {
              id: true,
              companyName: true,
              ownerUserId: true
            }
          },
          deal: {
            select: {
              id: true,
              ownerUserId: true
            }
          }
        },
        orderBy: [{ status: "asc" }, { dueAt: "asc" }, { createdAt: "desc" }],
        skip: pagination.skip,
        take: pagination.take
      }),
      this.app.prisma.task.count({ where })
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

  async getTaskById(taskId: number) {
    const task = await this.app.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        assignee: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        },
        owner: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        },
        lead: {
          select: {
            id: true,
            companyName: true,
            ownerUserId: true
          }
        },
        deal: {
          select: {
            id: true,
            ownerUserId: true
          }
        }
      }
    });

    if (!task) {
      throw new AppError(404, "task_not_found", "Задача не найдена");
    }

    return task;
  }

  async createTask(payload: CreateTaskInput, actorUserId: number) {
    if (!payload.leadId && !payload.dealId) {
      throw new AppError(422, "validation_error", "Нужно указать leadId или dealId");
    }

    if (payload.leadId) {
      const lead = await this.app.prisma.lead.findUnique({ where: { id: payload.leadId } });
      if (!lead || lead.archivedAt) {
        throw new AppError(404, "lead_not_found", "Лид не найден");
      }
    }

    if (payload.dealId) {
      const deal = await this.app.prisma.deal.findUnique({ where: { id: payload.dealId } });
      if (!deal) {
        throw new AppError(404, "deal_not_found", "Сделка не найдена");
      }
    }

    const task = await this.app.prisma.task.create({
      data: {
        leadId: payload.leadId,
        dealId: payload.dealId,
        ownerUserId: actorUserId,
        assigneeUserId: payload.assigneeUserId,
        type: payload.type,
        title: payload.title,
        description: payload.description,
        priority: payload.priority,
        dueAt: payload.dueAt ? new Date(payload.dueAt) : null
      },
      include: {
        assignee: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        },
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
        entityType: "task",
        entityId: String(task.id),
        action: "created",
        actorUserId,
        payload: {
          assigneeUserId: task.assigneeUserId,
          leadId: task.leadId,
          dealId: task.dealId
        }
      }
    });

    return task;
  }

  async updateTask(taskId: number, payload: UpdateTaskInput, actorUserId: number) {
    await this.getTaskById(taskId);

    const task = await this.app.prisma.task.update({
      where: { id: taskId },
      data: {
        assigneeUserId: payload.assigneeUserId,
        type: payload.type,
        title: payload.title,
        description: payload.description,
        priority: payload.priority,
        status: payload.status,
        dueAt: payload.dueAt ? new Date(payload.dueAt) : undefined,
        completedAt:
          payload.status === TaskStatus.DONE
            ? new Date()
            : payload.status === TaskStatus.CANCELED
              ? null
              : undefined
      },
      include: {
        assignee: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        },
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
        entityType: "task",
        entityId: String(task.id),
        action: "updated",
        actorUserId
      }
    });

    return task;
  }

  async completeTask(taskId: number, payload: CompleteTaskInput, actorUserId: number) {
    await this.getTaskById(taskId);

    const task = await this.app.prisma.task.update({
      where: { id: taskId },
      data: {
        status: TaskStatus.DONE,
        completedAt: payload.completedAt ? new Date(payload.completedAt) : new Date()
      },
      include: {
        assignee: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        },
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
        entityType: "task",
        entityId: String(task.id),
        action: "completed",
        actorUserId
      }
    });

    return task;
  }
}
