import type { FastifyPluginAsync } from "fastify";
import { canAccessOwnedEntity, hasPrivilegedRole } from "../../lib/access.js";
import { AppError } from "../../lib/errors.js";
import { completeTaskSchema, createTaskSchema, listTasksQuerySchema, updateTaskSchema } from "./schemas.js";
import { TasksService } from "./service.js";

export const tasksRoutes: FastifyPluginAsync = async (fastify) => {
  const tasksService = new TasksService(fastify);

  function canAccessTask(task: { ownerUserId: number; assigneeUserId: number }, currentUser: { userId: number; roles: string[] }) {
    if (hasPrivilegedRole(currentUser.roles)) {
      return true;
    }

    return task.ownerUserId === currentUser.userId || task.assigneeUserId === currentUser.userId;
  }

  fastify.get(
    "/api/v1/tasks",
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const query = listTasksQuerySchema.parse(request.query);
      const result = await tasksService.listTasks(query, request.user);
      return result;
    }
  );

  fastify.post(
    "/api/v1/tasks",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const payload = createTaskSchema.parse(request.body);

      if (!hasPrivilegedRole(request.user.roles) && payload.assigneeUserId !== request.user.userId) {
        throw new AppError(403, "forbidden", "Можно назначать задачи только себе");
      }

      if (payload.leadId) {
        const lead = await fastify.prisma.lead.findUnique({ where: { id: payload.leadId } });
        if (!lead || lead.archivedAt) {
          throw new AppError(404, "lead_not_found", "Лид не найден");
        }

        if (!canAccessOwnedEntity(lead.ownerUserId, request.user)) {
          throw new AppError(403, "forbidden", "У вас нет доступа к этому лиду");
        }
      }

      const task = await tasksService.createTask(payload, request.user.userId);
      return reply.code(201).send({ data: task });
    }
  );

  fastify.patch(
    "/api/v1/tasks/:id",
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const taskId = Number((request.params as { id: string }).id);
      const task = await tasksService.getTaskById(taskId);

      if (!canAccessTask(task, request.user)) {
        throw new AppError(403, "forbidden", "У вас нет доступа к этой задаче");
      }

      const payload = updateTaskSchema.parse(request.body);

      if (!hasPrivilegedRole(request.user.roles) && payload.assigneeUserId && payload.assigneeUserId !== request.user.userId) {
        throw new AppError(403, "forbidden", "Можно назначать задачи только себе");
      }

      const updated = await tasksService.updateTask(taskId, payload, request.user.userId);
      return { data: updated };
    }
  );

  fastify.post(
    "/api/v1/tasks/:id/complete",
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const taskId = Number((request.params as { id: string }).id);
      const task = await tasksService.getTaskById(taskId);

      if (!canAccessTask(task, request.user)) {
        throw new AppError(403, "forbidden", "У вас нет доступа к этой задаче");
      }

      const payload = completeTaskSchema.parse(request.body);
      const completed = await tasksService.completeTask(taskId, payload, request.user.userId);
      return { data: completed };
    }
  );
};
