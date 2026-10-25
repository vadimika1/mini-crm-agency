import type { PrismaClient } from "@prisma/client";
import type { FastifyRequest } from "fastify";
import "@fastify/jwt";

type AuthUserPayload = {
  userId: number;
  email: string;
  fullName: string;
  roles: string[];
  iat?: number;
  exp?: number;
};

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: AuthUserPayload;
    user: AuthUserPayload;
  }
}

declare module "fastify" {
  interface FastifyInstance {
    prisma: PrismaClient;
    authenticate: (request: FastifyRequest) => Promise<void>;
  }
}
