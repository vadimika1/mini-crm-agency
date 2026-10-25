import type { FastifyPluginAsync } from "fastify";
import { AppError } from "../../lib/errors.js";
import { loginSchema, refreshSchema } from "./schemas.js";
import { AuthService } from "./service.js";

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  const authService = new AuthService(fastify);

  fastify.post("/api/v1/auth/login", async (request) => {
    const payload = loginSchema.parse(request.body);
    const result = await authService.login(payload.email, payload.password);
    return { data: result };
  });

  fastify.post("/api/v1/auth/refresh", async (request) => {
    const payload = refreshSchema.parse(request.body);
    const result = await authService.refresh(payload.refreshToken);
    return { data: result };
  });

  fastify.post(
    "/api/v1/auth/logout",
    {
      preHandler: [fastify.authenticate]
    },
    async (request) => {
      const payload = refreshSchema.parse(request.body);
      const result = await authService.logout(request.user.userId, payload.refreshToken);
      return { data: result };
    }
  );

  fastify.get(
    "/api/v1/auth/me",
    {
      preHandler: [fastify.authenticate]
    },
    async (request) => {
      if (!request.user?.userId) {
        throw new AppError(401, "unauthorized", "Требуется авторизация");
      }

      const user = await authService.me(request.user.userId);
      return { data: user };
    }
  );
};
