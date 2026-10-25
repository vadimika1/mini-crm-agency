import type { FastifyPluginAsync } from "fastify";

export const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/health/live", async () => ({ status: "ok" }));

  fastify.get("/health/ready", async () => {
    await fastify.prisma.$queryRaw`SELECT 1`;
    return { status: "ready" };
  });
};
