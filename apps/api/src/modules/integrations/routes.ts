import { IntegrationChannel } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";
import { env } from "../../config/env.js";
import { AppError } from "../../lib/errors.js";
import { csvImportPayloadSchema, webhookLeadChannelParamsSchema, webhookLeadPayloadSchema } from "./schemas.js";
import { IntegrationsService } from "./service.js";

function readHeaderValue(value: string | string[] | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

export const integrationsRoutes: FastifyPluginAsync = async (fastify) => {
  const integrationsService = new IntegrationsService(fastify);

  fastify.post("/api/v1/integrations/webhooks/leads/:channel", async (request, reply) => {
    const providedSecret = readHeaderValue(request.headers["x-integration-secret"]);

    if (!providedSecret || providedSecret !== env.INTEGRATION_WEBHOOK_SECRET) {
      throw new AppError(401, "integration_secret_invalid", "Неверный ключ интеграции");
    }

    const params = webhookLeadChannelParamsSchema.parse(request.params);
    const payload = webhookLeadPayloadSchema.parse(request.body);

    const channel = params.channel === "site" ? IntegrationChannel.SITE : IntegrationChannel.TELEGRAM;
    const lead = await integrationsService.ingestLeadWebhook(channel, payload);
    return reply.code(201).send({ data: lead });
  });

  fastify.post(
    "/api/v1/integrations/import/leads-csv",
    {
      preHandler: [fastify.authenticate]
    },
    async (request) => {
      const payload = csvImportPayloadSchema.parse(request.body);
      const result = await integrationsService.importLeadsFromCsvRows(payload, request.user);
      return { data: result };
    }
  );
};
