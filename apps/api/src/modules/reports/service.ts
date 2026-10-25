import type { FastifyInstance } from "fastify";
import { DealStatus, TaskStatus } from "@prisma/client";
import { AppError } from "../../lib/errors.js";
import type { ReportRangeQuery } from "./schemas.js";

type DateRange = {
  fromDate?: Date;
  toDate?: Date;
};

function parseDate(value: string | undefined, field: "from" | "to"): Date | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new AppError(422, "validation_error", `Некорректная дата в параметре ${field}`);
  }

  return parsed;
}

function applyDateRange<T extends Record<string, unknown>>(
  field: keyof T,
  range: DateRange
): Partial<T> {
  if (!range.fromDate && !range.toDate) {
    return {};
  }

  const dateFilter: { gte?: Date; lte?: Date } = {};
  if (range.fromDate) {
    dateFilter.gte = range.fromDate;
  }
  if (range.toDate) {
    dateFilter.lte = range.toDate;
  }

  return {
    [field]: dateFilter
  } as Partial<T>;
}

export class ReportsService {
  constructor(private readonly app: FastifyInstance) {}

  private normalizeRange(query: ReportRangeQuery): DateRange {
    const fromDate = parseDate(query.from, "from");
    const toDate = parseDate(query.to, "to");

    if (fromDate && toDate && fromDate > toDate) {
      throw new AppError(422, "validation_error", "Параметр from не может быть больше to");
    }

    return { fromDate, toDate };
  }

  async getFunnelReport(query: ReportRangeQuery) {
    const range = this.normalizeRange(query);

    const leadWhere = {
      archivedAt: null,
      ...applyDateRange<{ createdAt: { gte?: Date; lte?: Date } }>("createdAt", range)
    };

    const [stages, grouped, transitions, leadsWithResponse, totalOpen, totalWon, totalLost] = await Promise.all([
      this.app.prisma.stage.findMany({
        where: { isActive: true },
        orderBy: [{ pipelineId: "asc" }, { sortOrder: "asc" }],
        include: {
          pipeline: {
            select: {
              id: true,
              name: true,
              code: true
            }
          }
        }
      }),
      this.app.prisma.lead.groupBy({
        by: ["stageId"],
        where: leadWhere,
        _count: { _all: true }
      }),
      this.app.prisma.leadStageHistory.groupBy({
        by: ["fromStageId", "toStageId"],
        where: applyDateRange<{ changedAt: { gte?: Date; lte?: Date } }>("changedAt", range),
        _count: { _all: true }
      }),
      this.app.prisma.lead.findMany({
        where: {
          archivedAt: null,
          firstContactAt: { not: null },
          ...applyDateRange<{ createdAt: { gte?: Date; lte?: Date } }>("createdAt", range)
        },
        select: {
          createdAt: true,
          firstContactAt: true
        }
      }),
      this.app.prisma.lead.count({ where: { ...leadWhere, status: "OPEN" } }),
      this.app.prisma.lead.count({ where: { ...leadWhere, status: "WON" } }),
      this.app.prisma.lead.count({ where: { ...leadWhere, status: "LOST" } })
    ]);

    const stageCountMap = new Map<number, number>(
      grouped.map((entry) => [entry.stageId, entry._count._all])
    );

    const funnelStages = stages.map((stage) => ({
      stageId: stage.id,
      stageCode: stage.code,
      stageName: stage.name,
      pipelineId: stage.pipelineId,
      pipelineName: stage.pipeline.name,
      sortOrder: stage.sortOrder,
      count: stageCountMap.get(stage.id) ?? 0
    }));

    const transitionsDetailed = transitions.map((entry) => ({
      fromStageId: entry.fromStageId,
      toStageId: entry.toStageId,
      count: entry._count._all
    }));

    const avgFirstResponseMinutes =
      leadsWithResponse.length > 0
        ? Math.round(
            leadsWithResponse.reduce((acc, lead) => {
              const created = lead.createdAt.getTime();
              const firstContact = lead.firstContactAt?.getTime() ?? created;
              return acc + (firstContact - created) / 60000;
            }, 0) / leadsWithResponse.length
          )
        : null;

    return {
      range: {
        from: range.fromDate?.toISOString() ?? null,
        to: range.toDate?.toISOString() ?? null
      },
      summary: {
        totalOpen,
        totalWon,
        totalLost,
        avgFirstResponseMinutes
      },
      stages: funnelStages,
      transitions: transitionsDetailed
    };
  }

  async getManagerPerformanceReport(query: ReportRangeQuery) {
    const range = this.normalizeRange(query);
    const now = new Date();
    const firstContactDeadline = new Date(now.getTime() - 30 * 60 * 1000);

    const users = await this.app.prisma.user.findMany({
      where: { isActive: true },
      include: {
        userRoles: {
          include: {
            role: true
          }
        }
      }
    });

    const managers = users.filter((user) =>
      user.userRoles.some((roleEntry) => ["admin", "head", "manager", "account"].includes(roleEntry.role.code))
    );

    const rows = await Promise.all(
      managers.map(async (manager) => {
        const leadsWhere = {
          ownerUserId: manager.id,
          archivedAt: null,
          ...applyDateRange<{ createdAt: { gte?: Date; lte?: Date } }>("createdAt", range)
        };

        const dealsWhere = {
          ownerUserId: manager.id,
          ...applyDateRange<{ createdAt: { gte?: Date; lte?: Date } }>("createdAt", range)
        };

        const [
          leadsTotal,
          leadsWithoutFirstContact,
          dealsByStatus,
          wonAmountAgg,
          openPipelineAgg,
          tasksOverdue,
          tasksCompleted
        ] = await Promise.all([
          this.app.prisma.lead.count({ where: leadsWhere }),
          this.app.prisma.lead.count({
            where: {
              ...leadsWhere,
              firstContactAt: null,
              createdAt: { lte: firstContactDeadline }
            }
          }),
          this.app.prisma.deal.groupBy({
            by: ["status"],
            where: dealsWhere,
            _count: { _all: true }
          }),
          this.app.prisma.deal.aggregate({
            where: {
              ...dealsWhere,
              status: DealStatus.WON
            },
            _sum: { amount: true }
          }),
          this.app.prisma.deal.aggregate({
            where: {
              ...dealsWhere,
              status: DealStatus.OPEN
            },
            _sum: { amount: true }
          }),
          this.app.prisma.task.count({
            where: {
              assigneeUserId: manager.id,
              dueAt: { lt: now },
              status: { in: [TaskStatus.TODO, TaskStatus.IN_PROGRESS] }
            }
          }),
          this.app.prisma.task.count({
            where: {
              assigneeUserId: manager.id,
              status: TaskStatus.DONE,
              ...applyDateRange<{ completedAt: { gte?: Date; lte?: Date } }>("completedAt", range)
            }
          })
        ]);

        const openDeals = dealsByStatus.find((entry) => entry.status === DealStatus.OPEN)?._count._all ?? 0;
        const wonDeals = dealsByStatus.find((entry) => entry.status === DealStatus.WON)?._count._all ?? 0;
        const lostDeals = dealsByStatus.find((entry) => entry.status === DealStatus.LOST)?._count._all ?? 0;

        return {
          manager: {
            userId: manager.id,
            fullName: manager.fullName,
            email: manager.email,
            roles: manager.userRoles.map((roleEntry) => roleEntry.role.code)
          },
          leads: {
            total: leadsTotal,
            withoutFirstContactInSla: leadsWithoutFirstContact
          },
          deals: {
            open: openDeals,
            won: wonDeals,
            lost: lostDeals,
            wonAmount: Number(wonAmountAgg._sum.amount ?? 0),
            openPipelineAmount: Number(openPipelineAgg._sum.amount ?? 0)
          },
          tasks: {
            overdue: tasksOverdue,
            completed: tasksCompleted
          }
        };
      })
    );

    return {
      range: {
        from: range.fromDate?.toISOString() ?? null,
        to: range.toDate?.toISOString() ?? null
      },
      items: rows.sort((a, b) => b.deals.wonAmount - a.deals.wonAmount)
    };
  }

  async getLostReasonsReport(query: ReportRangeQuery) {
    const range = this.normalizeRange(query);

    const grouped = await this.app.prisma.deal.groupBy({
      by: ["lostReasonId"],
      where: {
        status: DealStatus.LOST,
        ...applyDateRange<{ closeDateFact: { gte?: Date; lte?: Date } }>("closeDateFact", range)
      },
      _count: { _all: true },
      _sum: { amount: true }
    });

    const reasonIds = grouped
      .map((entry) => entry.lostReasonId)
      .filter((id): id is number => typeof id === "number");

    const reasons = reasonIds.length
      ? await this.app.prisma.lostReason.findMany({ where: { id: { in: reasonIds } } })
      : [];

    const reasonMap = new Map(reasons.map((reason) => [reason.id, reason]));

    const items = grouped.map((entry) => {
      const reason = entry.lostReasonId ? reasonMap.get(entry.lostReasonId) : null;
      return {
        lostReasonId: entry.lostReasonId,
        code: reason?.code ?? "unknown",
        name: reason?.name ?? "Не указана",
        dealsCount: entry._count._all,
        totalAmount: Number(entry._sum.amount ?? 0)
      };
    });

    const totalLostDeals = items.reduce((acc, item) => acc + item.dealsCount, 0);

    return {
      range: {
        from: range.fromDate?.toISOString() ?? null,
        to: range.toDate?.toISOString() ?? null
      },
      summary: {
        totalLostDeals
      },
      items: items.sort((a, b) => b.dealsCount - a.dealsCount)
    };
  }

  async getSourcePerformanceReport(query: ReportRangeQuery) {
    const range = this.normalizeRange(query);

    const sources = await this.app.prisma.source.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" }
    });

    const items = await Promise.all(
      sources.map(async (source) => {
        const leadWhere = {
          sourceId: source.id,
          archivedAt: null,
          ...applyDateRange<{ createdAt: { gte?: Date; lte?: Date } }>("createdAt", range)
        };

        const [
          leadsCount,
          wonDealsCount,
          lostDealsCount,
          openDealsCount,
          wonAmountAgg,
          openAmountAgg
        ] = await Promise.all([
          this.app.prisma.lead.count({ where: leadWhere }),
          this.app.prisma.deal.count({
            where: {
              status: DealStatus.WON,
              lead: leadWhere
            }
          }),
          this.app.prisma.deal.count({
            where: {
              status: DealStatus.LOST,
              lead: leadWhere
            }
          }),
          this.app.prisma.deal.count({
            where: {
              status: DealStatus.OPEN,
              lead: leadWhere
            }
          }),
          this.app.prisma.deal.aggregate({
            where: {
              status: DealStatus.WON,
              lead: leadWhere
            },
            _sum: { amount: true }
          }),
          this.app.prisma.deal.aggregate({
            where: {
              status: DealStatus.OPEN,
              lead: leadWhere
            },
            _sum: { amount: true }
          })
        ]);

        const winRatePercent = leadsCount > 0 ? Number(((wonDealsCount / leadsCount) * 100).toFixed(2)) : 0;

        return {
          source: {
            sourceId: source.id,
            code: source.code,
            name: source.name
          },
          metrics: {
            leadsCount,
            wonDealsCount,
            lostDealsCount,
            openDealsCount,
            winRatePercent,
            wonAmount: Number(wonAmountAgg._sum.amount ?? 0),
            openPipelineAmount: Number(openAmountAgg._sum.amount ?? 0)
          }
        };
      })
    );

    return {
      range: {
        from: range.fromDate?.toISOString() ?? null,
        to: range.toDate?.toISOString() ?? null
      },
      items: items.sort((a, b) => b.metrics.leadsCount - a.metrics.leadsCount)
    };
  }

  async getProposalConversionReport(query: ReportRangeQuery) {
    const range = this.normalizeRange(query);

    const proposalWhere = applyDateRange<{ sentAt: { gte?: Date; lte?: Date } }>("sentAt", range);

    const [proposalsSent, proposalAmountAgg, proposalsByDeal] = await Promise.all([
      this.app.prisma.proposal.count({
        where: proposalWhere
      }),
      this.app.prisma.proposal.aggregate({
        where: proposalWhere,
        _sum: { totalAmount: true },
        _avg: { totalAmount: true }
      }),
      this.app.prisma.proposal.groupBy({
        by: ["dealId"],
        where: proposalWhere,
        _count: { _all: true }
      })
    ]);

    const dealIds = proposalsByDeal.map((entry) => entry.dealId);

    const [wonDealsWithProposal, lostDealsWithProposal, openDealsWithProposal] = dealIds.length
      ? await Promise.all([
          this.app.prisma.deal.count({ where: { id: { in: dealIds }, status: DealStatus.WON } }),
          this.app.prisma.deal.count({ where: { id: { in: dealIds }, status: DealStatus.LOST } }),
          this.app.prisma.deal.count({ where: { id: { in: dealIds }, status: DealStatus.OPEN } })
        ])
      : [0, 0, 0];

    const dealsWithProposal = dealIds.length;
    const proposalToWonConversionPercent =
      dealsWithProposal > 0 ? Number(((wonDealsWithProposal / dealsWithProposal) * 100).toFixed(2)) : 0;

    const averageVersionsPerDeal =
      proposalsByDeal.length > 0
        ? Number(
            (
              proposalsByDeal.reduce((acc, entry) => acc + entry._count._all, 0) / proposalsByDeal.length
            ).toFixed(2)
          )
        : 0;

    return {
      range: {
        from: range.fromDate?.toISOString() ?? null,
        to: range.toDate?.toISOString() ?? null
      },
      summary: {
        proposalsSent,
        dealsWithProposal,
        wonDealsWithProposal,
        lostDealsWithProposal,
        openDealsWithProposal,
        proposalToWonConversionPercent,
        averageVersionsPerDeal,
        totalProposalAmount: Number(proposalAmountAgg._sum.totalAmount ?? 0),
        averageProposalAmount: Number(proposalAmountAgg._avg.totalAmount ?? 0)
      }
    };
  }
}
