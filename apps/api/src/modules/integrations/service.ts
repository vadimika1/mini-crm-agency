import type { FastifyInstance } from "fastify";
import { IntegrationChannel } from "@prisma/client";
import { env } from "../../config/env.js";
import { AppError } from "../../lib/errors.js";
import { LeadsService } from "../leads/service.js";
import type { CsvImportPayload, WebhookLeadPayload } from "./schemas.js";

function toOptionalText(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

type CsvImportFailure = {
  rowNumber: number;
  message: string;
};

type CsvImportResult = {
  total: number;
  created: number;
  failed: number;
  stoppedEarly: boolean;
  leadIds: number[];
  failures: CsvImportFailure[];
};

export class IntegrationsService {
  constructor(private readonly app: FastifyInstance) {}

  private getErrorMessage(error: unknown): string {
    if (error instanceof AppError) {
      return error.message;
    }

    if (error instanceof Error && error.message.trim()) {
      return error.message;
    }

    return "Не удалось обработать запись";
  }

  private async resolveSourceIdByCode(sourceCode: string): Promise<number> {
    const source = await this.app.prisma.source.findFirst({
      where: {
        code: sourceCode,
        isActive: true
      },
      select: {
        id: true
      }
    });

    if (!source) {
      throw new AppError(422, "source_not_found", `Источник '${sourceCode}' не найден или отключен`);
    }

    return source.id;
  }

  async ingestLeadWebhook(channel: "SITE" | "TELEGRAM", payload: WebhookLeadPayload) {
    const leadsService = new LeadsService(this.app);
    const sourceCode = payload.sourceCode ?? (channel === IntegrationChannel.SITE ? "site-form" : "telegram");
    const ownerUserId = payload.ownerUserId ?? env.INTEGRATION_DEFAULT_OWNER_USER_ID;

    let status = "processed";
    let errorMessage: string | null = null;
    let leadId: number | null = null;

    try {
      const sourceId = await this.resolveSourceIdByCode(sourceCode);

      const lead = await leadsService.createLead(
        {
          companyName: payload.companyName,
          websiteUrl: toOptionalText(payload.websiteUrl),
          mainContactName: payload.mainContactName,
          mainContactEmail: toOptionalText(payload.mainContactEmail),
          mainContactPhone: toOptionalText(payload.mainContactPhone),
          sourceId,
          ownerUserId,
          priority: payload.priority,
          monthlyBudgetEstimate: payload.monthlyBudgetEstimate,
          nextFollowUpAt: payload.nextFollowUpAt
        },
        {
          userId: ownerUserId
        }
      );

      leadId = lead.id;
      return lead;
    } catch (error) {
      status = "failed";
      errorMessage = this.getErrorMessage(error);
      throw error;
    } finally {
      await this.app.prisma.integrationEventLog.create({
        data: {
          channel,
          externalId: payload.externalId,
          payload: {
            sourceCode,
            ownerUserId,
            companyName: payload.companyName,
            mainContactName: payload.mainContactName,
            leadId
          },
          status,
          errorMessage
        }
      });
    }
  }

  async importLeadsFromCsvRows(payload: CsvImportPayload, currentUser: { userId: number }) {
    const leadsService = new LeadsService(this.app);
    const defaultSourceCode = payload.defaultSourceCode ?? "manual";
    const failures: CsvImportFailure[] = [];
    const leadIds: number[] = [];
    let stoppedEarly = false;

    const sourceCodeSet = new Set<string>([defaultSourceCode]);
    for (const row of payload.rows) {
      if (row.sourceCode) {
        sourceCodeSet.add(row.sourceCode);
      }
    }

    const sources = await this.app.prisma.source.findMany({
      where: {
        code: {
          in: Array.from(sourceCodeSet)
        },
        isActive: true
      },
      select: {
        id: true,
        code: true
      }
    });

    const sourceIdByCode = new Map<string, number>(sources.map((source) => [source.code, source.id]));

    for (const row of payload.rows) {
      const sourceCode = row.sourceCode ?? defaultSourceCode;
      const sourceId = sourceIdByCode.get(sourceCode);

      if (!sourceId) {
        failures.push({
          rowNumber: row.rowNumber,
          message: `Источник '${sourceCode}' не найден или отключен`
        });

        if (!payload.skipInvalid) {
          stoppedEarly = true;
          break;
        }
        continue;
      }

      try {
        const lead = await leadsService.createLead(
          {
            companyName: row.companyName,
            websiteUrl: toOptionalText(row.websiteUrl),
            mainContactName: row.mainContactName,
            mainContactEmail: toOptionalText(row.mainContactEmail),
            mainContactPhone: toOptionalText(row.mainContactPhone),
            sourceId,
            ownerUserId: currentUser.userId,
            priority: row.priority,
            nextFollowUpAt: row.nextFollowUpAt
          },
          currentUser
        );

        leadIds.push(lead.id);
      } catch (error) {
        failures.push({
          rowNumber: row.rowNumber,
          message: this.getErrorMessage(error)
        });

        if (!payload.skipInvalid) {
          stoppedEarly = true;
          break;
        }
      }
    }

    const result: CsvImportResult = {
      total: payload.rows.length,
      created: leadIds.length,
      failed: failures.length,
      stoppedEarly,
      leadIds,
      failures
    };

    await this.app.prisma.integrationEventLog.create({
      data: {
        channel: IntegrationChannel.CSV,
        payload: {
          total: result.total,
          created: result.created,
          failed: result.failed,
          stoppedEarly: result.stoppedEarly,
          defaultSourceCode,
          failedRows: result.failures.slice(0, 20)
        },
        status: result.failed === 0 ? "processed" : result.created === 0 ? "failed" : "partial"
      }
    });

    return result;
  }
}
