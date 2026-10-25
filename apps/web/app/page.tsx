"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { parseCsvImportRows } from "./lib/csv-import";
import type { CsvImportRowPayload } from "./lib/csv-import";

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000").replace(/\/$/, "");
const SESSION_STORAGE_KEY = "mini-crm.session.v1";

const taskStatusLabels: Record<string, string> = {
  TODO: "К выполнению",
  IN_PROGRESS: "В работе",
  DONE: "Готово",
  CANCELED: "Отменено"
};

const taskPriorityLabels: Record<string, string> = {
  LOW: "Низкий",
  MEDIUM: "Средний",
  HIGH: "Высокий"
};

const leadPriorityLabels: Record<string, string> = {
  LOW: "Низкий",
  MEDIUM: "Средний",
  HIGH: "Высокий"
};

const roleLabels: Record<string, string> = {
  admin: "Администратор",
  head: "Руководитель продаж",
  manager: "Менеджер",
  account: "Аккаунт",
  viewer: "Наблюдатель"
};

type ApiErrorShape = {
  error?: {
    code?: string;
    message?: string;
    details?: Array<Record<string, unknown>>;
  };
};

type ApiEnvelope<T> = {
  data: T;
};

type ApiPaginated<T> = {
  data: T[];
  meta: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
};

type AuthUser = {
  id: number;
  email: string;
  fullName: string;
  roles: string[];
};

type LoginResponse = {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
  user: AuthUser;
};

type SessionState = {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
};

type LeadStage = {
  id: number;
  pipelineId: number;
  name: string;
  code: string;
  sortOrder: number;
  outcome: "OPEN" | "WON" | "LOST";
  pipeline: {
    id: number;
    code: string;
    name: string;
    isDefault: boolean;
  };
};

type LeadListItem = {
  id: number;
  companyName: string;
  mainContactName: string;
  mainContactEmail: string | null;
  mainContactPhone: string | null;
  priority: "LOW" | "MEDIUM" | "HIGH";
  status: "OPEN" | "WON" | "LOST";
  nextFollowUpAt: string | null;
  stage: {
    id: number;
    code: string;
    name: string;
  };
  owner: {
    id: number;
    fullName: string;
    email: string;
  } | null;
};

type LeadDetails = {
  id: number;
  companyName: string;
  websiteUrl: string | null;
  mainContactName: string;
  mainContactEmail: string | null;
  mainContactPhone: string | null;
  priority: "LOW" | "MEDIUM" | "HIGH";
  status: "OPEN" | "WON" | "LOST";
  firstContactAt: string | null;
  nextFollowUpAt: string | null;
  createdAt: string;
  source: {
    id: number;
    code: string;
    name: string;
  } | null;
  owner: {
    id: number;
    fullName: string;
    email: string;
  } | null;
  stage: {
    id: number;
    code: string;
    name: string;
  };
  pipeline: {
    id: number;
    code: string;
    name: string;
  };
};

type LeadHistoryItem = {
  id: number;
  changedAt: string;
  comment: string | null;
  fromStage: {
    id: number;
    code: string;
    name: string;
  } | null;
  toStage: {
    id: number;
    code: string;
    name: string;
  };
  changedByUser: {
    id: number;
    fullName: string;
    email: string;
  };
};

type LeadBrief = {
  id: number;
  businessModel: string | null;
  targetAudience: string | null;
  mainKpi: string | null;
  kpiTarget: string | null;
  competitors: string | null;
  decisionProcess: string | null;
  notes: string | null;
  expectedStartDate: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type DealListItem = {
  id: number;
  leadId: number;
  status: "OPEN" | "WON" | "LOST";
  amount: number | string | null;
  currency: string;
  pricingModel: string | null;
  probability: number;
  startDatePlan: string | null;
  startDateFact: string | null;
  closeDatePlan: string | null;
  closeDateFact: string | null;
  createdAt: string;
  owner: {
    id: number;
    fullName: string;
    email: string;
  } | null;
  lostReason: {
    id: number;
    name: string;
  } | null;
};

type ProposalItem = {
  id: number;
  dealId: number;
  version: number;
  proposalUrl: string;
  totalAmount: number | string | null;
  validUntil: string | null;
  sentAt: string | null;
  createdAt: string;
};

type LeadDealWithProposals = DealListItem & {
  proposals: ProposalItem[];
};

type TaskListItem = {
  id: number;
  title: string;
  description: string | null;
  status: "TODO" | "IN_PROGRESS" | "DONE" | "CANCELED";
  priority: "LOW" | "MEDIUM" | "HIGH";
  dueAt: string | null;
  completedAt: string | null;
  createdAt: string;
  type: "CALL" | "EMAIL" | "MEETING" | "FOLLOW_UP" | "CUSTOM";
  assignee: {
    id: number;
    fullName: string;
    email: string;
  };
  lead: {
    id: number;
    companyName: string;
  } | null;
};

type LeadActivityItem = {
  id: string;
  type: "stage" | "brief" | "deal" | "proposal" | "task";
  title: string;
  description: string;
  at: string;
};

type LeadTab = "overview" | "brief" | "deals" | "activities";

type BriefFormState = {
  businessModel: string;
  targetAudience: string;
  mainKpi: string;
  kpiTarget: string;
  competitors: string;
  decisionProcess: string;
  notes: string;
  expectedStartDate: string;
};

type LeadQuickFormState = {
  nextFollowUpAt: string;
  priority: "LOW" | "MEDIUM" | "HIGH";
};

type LeadProfileFormState = {
  companyName: string;
  websiteUrl: string;
  mainContactName: string;
  mainContactEmail: string;
  mainContactPhone: string;
};

type LeadCreateFormState = LeadProfileFormState & {
  priority: "LOW" | "MEDIUM" | "HIGH";
  nextFollowUpAt: string;
};

type TaskCreateFormState = {
  leadId: string;
  title: string;
  description: string;
  type: TaskListItem["type"];
  priority: TaskListItem["priority"];
  dueAt: string;
};

type TaskEditFormState = {
  id: number;
  title: string;
  description: string;
  type: TaskListItem["type"];
  priority: TaskListItem["priority"];
  status: TaskListItem["status"];
  dueAt: string;
};

type CsvImportResult = {
  total: number;
  created: number;
  failed: number;
  stoppedEarly: boolean;
  leadIds: number[];
  failures: Array<{
    rowNumber: number;
    message: string;
  }>;
};

type FunnelReport = {
  summary: {
    totalOpen: number;
    totalWon: number;
    totalLost: number;
    avgFirstResponseMinutes: number | null;
  };
  stages: Array<{
    stageId: number;
    stageCode: string;
    stageName: string;
    count: number;
  }>;
};

type ManagerPerformanceReport = {
  items: Array<{
    manager: {
      userId: number;
      fullName: string;
      roles: string[];
    };
    deals: {
      wonAmount: number;
      openPipelineAmount: number;
      won: number;
    };
    tasks: {
      overdue: number;
      completed: number;
    };
  }>;
};

type ProposalConversionReport = {
  summary: {
    proposalsSent: number;
    proposalToWonConversionPercent: number;
  };
};

type AutomationEventCode =
  | "lead.stage_changed"
  | "lead.brief_completed"
  | "deal.closed_won"
  | "deal.closed_lost"
  | "lead.created";

type AutomationActionType = "create_task" | "update_lead_priority" | "set_next_follow_up";

type AutomationRule = {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  trigger: {
    event: AutomationEventCode;
  };
  conditions?: {
    fromStageCodeIn?: string[];
    toStageCodeIn?: string[];
    leadStatusIn?: Array<"OPEN" | "WON" | "LOST">;
    dealStatusIn?: Array<"OPEN" | "WON" | "LOST">;
    sourceCodeIn?: string[];
  };
  actions: Array<{
    type: AutomationActionType;
    payload: Record<string, unknown>;
  }>;
};

type AutomationRunResult = {
  event: AutomationEventCode;
  matchedRules: number;
  executedActions: number;
  skippedActions: number;
  failedActions: number;
  actionResults: Array<{
    ruleId: string;
    actionType: AutomationActionType;
    status: "executed" | "skipped" | "failed";
    message: string;
  }>;
};

type DashboardData = {
  me: AuthUser;
  leadStages: LeadStage[];
  leads: LeadListItem[];
  leadsMeta: ApiPaginated<LeadListItem>["meta"];
  tasks: TaskListItem[];
  overdueTasksTotal: number;
  funnelReport: FunnelReport | null;
  managerReport: ManagerPerformanceReport | null;
  proposalReport: ProposalConversionReport | null;
  automationRules: AutomationRule[];
};

class ApiRequestError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: Array<Record<string, unknown>>;

  constructor(status: number, message: string, code?: string, details?: Array<Record<string, unknown>>) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function emptyBriefForm(): BriefFormState {
  return {
    businessModel: "",
    targetAudience: "",
    mainKpi: "",
    kpiTarget: "",
    competitors: "",
    decisionProcess: "",
    notes: "",
    expectedStartDate: ""
  };
}

function leadToQuickForm(lead: LeadDetails | null): LeadQuickFormState {
  return {
    nextFollowUpAt: toDateTimeInputValue(lead?.nextFollowUpAt ?? null),
    priority: lead?.priority ?? "MEDIUM"
  };
}

function leadToProfileForm(lead: LeadDetails | null): LeadProfileFormState {
  return {
    companyName: lead?.companyName ?? "",
    websiteUrl: lead?.websiteUrl ?? "",
    mainContactName: lead?.mainContactName ?? "",
    mainContactEmail: lead?.mainContactEmail ?? "",
    mainContactPhone: lead?.mainContactPhone ?? ""
  };
}

function emptyLeadCreateForm(): LeadCreateFormState {
  return {
    companyName: "",
    websiteUrl: "",
    mainContactName: "",
    mainContactEmail: "",
    mainContactPhone: "",
    priority: "MEDIUM",
    nextFollowUpAt: ""
  };
}

function emptyTaskCreateForm(defaultLeadId: number | null = null): TaskCreateFormState {
  return {
    leadId: defaultLeadId ? String(defaultLeadId) : "",
    title: "",
    description: "",
    type: "FOLLOW_UP",
    priority: "MEDIUM",
    dueAt: ""
  };
}

function taskToEditForm(task: TaskListItem): TaskEditFormState {
  return {
    id: task.id,
    title: task.title,
    description: task.description ?? "",
    type: task.type,
    priority: task.priority,
    status: task.status,
    dueAt: toDateTimeInputValue(task.dueAt)
  };
}

function briefToForm(brief: LeadBrief | null): BriefFormState {
  if (!brief) {
    return emptyBriefForm();
  }

  return {
    businessModel: brief.businessModel ?? "",
    targetAudience: brief.targetAudience ?? "",
    mainKpi: brief.mainKpi ?? "",
    kpiTarget: brief.kpiTarget ?? "",
    competitors: brief.competitors ?? "",
    decisionProcess: brief.decisionProcess ?? "",
    notes: brief.notes ?? "",
    expectedStartDate: toDateTimeInputValue(brief.expectedStartDate)
  };
}

function toOptionalText(value: string): string | undefined {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function parseDateMs(value: string | null | undefined): number {
  if (!value) {
    return 0;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 0;
  }

  return date.getTime();
}

function toDateTimeInputValue(value: string | null): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const pad = (number: number) => String(number).padStart(2, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hour = pad(date.getHours());
  const minute = pad(date.getMinutes());

  return `${year}-${month}-${day}T${hour}:${minute}`;
}

function toIsoFromInputDateTime(value: string): string | undefined {
  const normalized = value.trim();
  if (!normalized) {
    return undefined;
  }

  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return date.toISOString();
}

function buildActivityFeed(params: {
  history: LeadHistoryItem[];
  brief: LeadBrief | null;
  deals: LeadDealWithProposals[];
  tasks: TaskListItem[];
}): LeadActivityItem[] {
  const { history, brief, deals, tasks } = params;
  const feed: LeadActivityItem[] = [];

  for (const item of history) {
    feed.push({
      id: `stage-${item.id}`,
      type: "stage",
      title: `${item.fromStage?.name ?? "Создание"} → ${item.toStage.name}`,
      description: item.comment
        ? `${item.changedByUser.fullName}. Комментарий: ${item.comment}`
        : `${item.changedByUser.fullName}`,
      at: item.changedAt
    });
  }

  if (brief) {
    feed.push({
      id: `brief-created-${brief.id}`,
      type: "brief",
      title: "Бриф создан",
      description: `Версия брифа #${brief.id}`,
      at: brief.createdAt
    });

    if (brief.updatedAt && brief.updatedAt !== brief.createdAt) {
      feed.push({
        id: `brief-updated-${brief.id}`,
        type: "brief",
        title: "Бриф обновлен",
        description: "Поля брифа изменены",
        at: brief.updatedAt
      });
    }

    if (brief.completedAt) {
      feed.push({
        id: `brief-completed-${brief.id}`,
        type: "brief",
        title: "Бриф завершен",
        description: "Бриф отмечен как завершенный",
        at: brief.completedAt
      });
    }
  }

  for (const deal of deals) {
    feed.push({
      id: `deal-created-${deal.id}`,
      type: "deal",
      title: `Сделка #${deal.id} создана`,
      description: `Статус: ${formatDealStatus(deal.status)}`,
      at: deal.createdAt
    });

    if (deal.closeDateFact) {
      feed.push({
        id: `deal-closed-${deal.id}`,
        type: "deal",
        title: `Сделка #${deal.id} закрыта`,
        description: `Финальный статус: ${formatDealStatus(deal.status)}`,
        at: deal.closeDateFact
      });
    }

    for (const proposal of deal.proposals) {
      feed.push({
        id: `proposal-${proposal.id}`,
        type: "proposal",
        title: `КП v${proposal.version} для сделки #${deal.id}`,
        description: proposal.proposalUrl,
        at: proposal.sentAt ?? proposal.createdAt
      });
    }
  }

  for (const task of tasks) {
    feed.push({
      id: `task-created-${task.id}`,
      type: "task",
      title: `Задача #${task.id} создана`,
      description: task.title,
      at: task.createdAt
    });

    if (task.completedAt) {
      feed.push({
        id: `task-completed-${task.id}`,
        type: "task",
        title: `Задача #${task.id} завершена`,
        description: task.title,
        at: task.completedAt
      });
    }
  }

  return feed.sort((a, b) => parseDateMs(b.at) - parseDateMs(a.at));
}

function isSessionState(value: unknown): value is SessionState {
  if (!value || typeof value !== "object") {
    return false;
  }

  const session = value as Partial<SessionState>;
  return (
    typeof session.accessToken === "string" &&
    typeof session.refreshToken === "string" &&
    typeof session.user?.id === "number" &&
    typeof session.user?.email === "string" &&
    typeof session.user?.fullName === "string" &&
    Array.isArray(session.user?.roles)
  );
}

function readStoredSession(): SessionState | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    return isSessionState(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function persistSession(session: SessionState | null) {
  if (typeof window === "undefined") {
    return;
  }

  if (session) {
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    return;
  }

  window.localStorage.removeItem(SESSION_STORAGE_KEY);
}

function normalizeError(error: unknown, fallback = "Не удалось выполнить запрос"): string {
  if (error instanceof TypeError && error.message.includes("Failed to fetch")) {
    return `Нет подключения к API (${API_BASE_URL}). Проверьте, что backend запущен и доступен.`;
  }

  if (error instanceof ApiRequestError) {
    return error.message;
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

function formatTransitionError(error: unknown): string {
  if (error instanceof ApiRequestError && error.code === "stage_required_fields_missing" && error.details?.length) {
    const detailMessages = error.details
      .map((detail) => {
        const message = detail.message;
        return typeof message === "string" ? message : null;
      })
      .filter((message): message is string => Boolean(message));

    if (detailMessages.length > 0) {
      return `${error.message}: ${detailMessages.join("; ")}`;
    }
  }

  return normalizeError(error, "Не удалось выполнить переход этапа");
}

function isPrivileged(roles: string[]) {
  return roles.includes("admin") || roles.includes("head");
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return "Не назначено";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Некорректная дата";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function formatAmount(value: number): string {
  return `${new Intl.NumberFormat("ru-RU").format(Math.round(value))} USD`;
}

function formatMoneyValue(value: number | string | null | undefined, currency = "USD"): string {
  if (value === null || value === undefined) {
    return "Не указана";
  }

  const numeric = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(numeric)) {
    return `${value} ${currency}`;
  }

  return `${new Intl.NumberFormat("ru-RU").format(Math.round(numeric))} ${currency}`;
}

function buildReportRangeQuery(daysBack: number): string {
  const to = new Date();
  const from = new Date(to.getTime() - daysBack * 24 * 60 * 60 * 1000);
  const query = new URLSearchParams({
    from: from.toISOString(),
    to: to.toISOString()
  });
  return query.toString();
}

function formatLeadStatus(status: LeadListItem["status"] | LeadDetails["status"]): string {
  if (status === "OPEN") {
    return "Открыт";
  }

  if (status === "WON") {
    return "Выигран";
  }

  return "Потерян";
}

function formatDealStatus(status: DealListItem["status"]): string {
  if (status === "OPEN") {
    return "Открыта";
  }

  if (status === "WON") {
    return "Выиграна";
  }

  return "Потеряна";
}

function formatAutomationEvent(event: AutomationEventCode): string {
  if (event === "lead.stage_changed") {
    return "Лид: переход этапа";
  }

  if (event === "lead.brief_completed") {
    return "Лид: бриф завершен";
  }

  if (event === "deal.closed_won") {
    return "Сделка: закрыта как выиграна";
  }

  if (event === "deal.closed_lost") {
    return "Сделка: закрыта как потеряна";
  }

  return "Лид: создан";
}

function formatAutomationAction(action: AutomationActionType): string {
  if (action === "create_task") {
    return "Создать задачу";
  }

  if (action === "update_lead_priority") {
    return "Обновить приоритет лида";
  }

  return "Установить дату следующего follow-up";
}

function formatAutomationResultStatus(status: AutomationRunResult["actionResults"][number]["status"]): string {
  if (status === "executed") {
    return "Выполнено";
  }

  if (status === "skipped") {
    return "Пропущено";
  }

  return "Ошибка";
}

async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("accept", "application/json");

  if (init.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    cache: "no-store"
  });

  const raw = await response.text();
  let parsed: ApiErrorShape | T | null = null;

  if (raw) {
    try {
      parsed = JSON.parse(raw) as ApiErrorShape | T;
    } catch {
      if (!response.ok) {
        throw new ApiRequestError(response.status, `Ошибка API (${response.status})`);
      }
    }
  }

  if (!response.ok) {
    const apiError = parsed as ApiErrorShape | null;
    throw new ApiRequestError(
      response.status,
      apiError?.error?.message ?? `Ошибка API (${response.status})`,
      apiError?.error?.code,
      apiError?.error?.details
    );
  }

  return parsed as T;
}

async function authorizeSession(session: SessionState): Promise<SessionState> {
  try {
    const meResponse = await apiRequest<ApiEnvelope<AuthUser>>("/api/v1/auth/me", {
      headers: {
        authorization: `Bearer ${session.accessToken}`
      }
    });

    return {
      ...session,
      user: meResponse.data
    };
  } catch (error) {
    if (!(error instanceof ApiRequestError) || error.status !== 401) {
      throw error;
    }

    const refreshResponse = await apiRequest<ApiEnvelope<LoginResponse>>("/api/v1/auth/refresh", {
      method: "POST",
      body: JSON.stringify({
        refreshToken: session.refreshToken
      })
    });

    const refreshed = refreshResponse.data;

    const meResponse = await apiRequest<ApiEnvelope<AuthUser>>("/api/v1/auth/me", {
      headers: {
        authorization: `Bearer ${refreshed.accessToken}`
      }
    });

    return {
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken,
      user: meResponse.data
    };
  }
}

async function loadDashboardData(session: SessionState): Promise<{ session: SessionState; data: DashboardData }> {
  const authorizedSession = await authorizeSession(session);
  const authHeaders = {
    authorization: `Bearer ${authorizedSession.accessToken}`
  };

  const [stagesResponse, leadsResponse, tasksResponse, overdueTasksResponse] = await Promise.all([
    apiRequest<ApiEnvelope<LeadStage[]>>("/api/v1/leads/stages", { headers: authHeaders }),
    apiRequest<ApiPaginated<LeadListItem>>("/api/v1/leads?page=1&per_page=100", { headers: authHeaders }),
    apiRequest<ApiPaginated<TaskListItem>>("/api/v1/tasks?page=1&per_page=12", { headers: authHeaders }),
    apiRequest<ApiPaginated<TaskListItem>>("/api/v1/tasks?page=1&per_page=1&overdue=true", { headers: authHeaders })
  ]);

  let funnelReport: FunnelReport | null = null;
  let managerReport: ManagerPerformanceReport | null = null;
  let proposalReport: ProposalConversionReport | null = null;
  let automationRules: AutomationRule[] = [];

  if (isPrivileged(authorizedSession.user.roles)) {
    const reportQuery = buildReportRangeQuery(30);

    const [funnelResponse, managerResponse, proposalResponse, automationRulesResponse] = await Promise.all([
      apiRequest<ApiEnvelope<FunnelReport>>(`/api/v1/reports/funnel?${reportQuery}`, { headers: authHeaders }),
      apiRequest<ApiEnvelope<ManagerPerformanceReport>>(`/api/v1/reports/manager-performance?${reportQuery}`, {
        headers: authHeaders
      }),
      apiRequest<ApiEnvelope<ProposalConversionReport>>(`/api/v1/reports/proposal-conversion?${reportQuery}`, {
        headers: authHeaders
      }),
      apiRequest<ApiEnvelope<AutomationRule[]>>("/api/v1/automations/rules", {
        headers: authHeaders
      })
    ]);

    funnelReport = funnelResponse.data;
    managerReport = managerResponse.data;
    proposalReport = proposalResponse.data;
    automationRules = automationRulesResponse.data;
  }

  return {
    session: authorizedSession,
    data: {
      me: authorizedSession.user,
      leadStages: stagesResponse.data,
      leads: leadsResponse.data,
      leadsMeta: leadsResponse.meta,
      tasks: tasksResponse.data,
      overdueTasksTotal: overdueTasksResponse.meta.total,
      funnelReport,
      managerReport,
      proposalReport,
      automationRules
    }
  };
}

export default function HomePage() {
  const [session, setSession] = useState<SessionState | null>(null);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [isBootstrapLoading, setIsBootstrapLoading] = useState(true);
  const [isLoginLoading, setIsLoginLoading] = useState(false);
  const [isDashboardLoading, setIsDashboardLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [transitionError, setTransitionError] = useState<string | null>(null);

  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);
  const [leadDetails, setLeadDetails] = useState<LeadDetails | null>(null);
  const [leadHistory, setLeadHistory] = useState<LeadHistoryItem[]>([]);
  const [leadBrief, setLeadBrief] = useState<LeadBrief | null>(null);
  const [leadDeals, setLeadDeals] = useState<LeadDealWithProposals[]>([]);
  const [leadTasks, setLeadTasks] = useState<TaskListItem[]>([]);
  const [leadActivity, setLeadActivity] = useState<LeadActivityItem[]>([]);

  const [leadPanelError, setLeadPanelError] = useState<string | null>(null);
  const [isLeadPanelLoading, setIsLeadPanelLoading] = useState(false);
  const [activeLeadTab, setActiveLeadTab] = useState<LeadTab>("overview");

  const [briefForm, setBriefForm] = useState<BriefFormState>(emptyBriefForm());
  const [briefSaveError, setBriefSaveError] = useState<string | null>(null);
  const [isBriefSaving, setIsBriefSaving] = useState(false);
  const [briefCompleteNote, setBriefCompleteNote] = useState("");
  const [quickLeadForm, setQuickLeadForm] = useState<LeadQuickFormState>(leadToQuickForm(null));
  const [leadSaveError, setLeadSaveError] = useState<string | null>(null);
  const [isLeadSaving, setIsLeadSaving] = useState(false);
  const [leadProfileForm, setLeadProfileForm] = useState<LeadProfileFormState>(leadToProfileForm(null));
  const [leadProfileError, setLeadProfileError] = useState<string | null>(null);
  const [isLeadProfileSaving, setIsLeadProfileSaving] = useState(false);

  const [isLeadCreateOpen, setIsLeadCreateOpen] = useState(false);
  const [leadCreateForm, setLeadCreateForm] = useState<LeadCreateFormState>(emptyLeadCreateForm());
  const [leadCreateError, setLeadCreateError] = useState<string | null>(null);
  const [isLeadCreating, setIsLeadCreating] = useState(false);

  const [isTaskCreateOpen, setIsTaskCreateOpen] = useState(false);
  const [taskCreateForm, setTaskCreateForm] = useState<TaskCreateFormState>(emptyTaskCreateForm());
  const [taskCreateError, setTaskCreateError] = useState<string | null>(null);
  const [isTaskCreating, setIsTaskCreating] = useState(false);

  const [taskEditForm, setTaskEditForm] = useState<TaskEditFormState | null>(null);
  const [taskEditError, setTaskEditError] = useState<string | null>(null);
  const [isTaskEditing, setIsTaskEditing] = useState(false);

  const [kanbanSearch, setKanbanSearch] = useState("");
  const [kanbanPriorityFilter, setKanbanPriorityFilter] = useState<"ALL" | LeadListItem["priority"]>("ALL");
  const [kanbanOwnerFilter, setKanbanOwnerFilter] = useState<string>("ALL");
  const [kanbanStageFilter, setKanbanStageFilter] = useState<string>("ALL");
  const [selectedLeadIds, setSelectedLeadIds] = useState<number[]>([]);
  const [bulkOwnerUserId, setBulkOwnerUserId] = useState<string>("CURRENT");
  const [bulkPriority, setBulkPriority] = useState<LeadListItem["priority"]>("MEDIUM");
  const [bulkStageId, setBulkStageId] = useState<string>("");
  const [bulkActionError, setBulkActionError] = useState<string | null>(null);
  const [bulkActionSuccess, setBulkActionSuccess] = useState<string | null>(null);
  const [isBulkApplying, setIsBulkApplying] = useState(false);

  const [csvFileName, setCsvFileName] = useState("");
  const [csvImportRows, setCsvImportRows] = useState<CsvImportRowPayload[]>([]);
  const [csvDefaultSourceCode, setCsvDefaultSourceCode] = useState("manual");
  const [csvImportError, setCsvImportError] = useState<string | null>(null);
  const [csvImportResult, setCsvImportResult] = useState<CsvImportResult | null>(null);
  const [isCsvImporting, setIsCsvImporting] = useState(false);
  const [automationEvent, setAutomationEvent] = useState<AutomationEventCode>("lead.stage_changed");
  const [automationLeadId, setAutomationLeadId] = useState("");
  const [automationDealId, setAutomationDealId] = useState("");
  const [automationFromStageCode, setAutomationFromStageCode] = useState("");
  const [automationToStageCode, setAutomationToStageCode] = useState("");
  const [automationSourceCode, setAutomationSourceCode] = useState("");
  const [automationRunError, setAutomationRunError] = useState<string | null>(null);
  const [automationRunResult, setAutomationRunResult] = useState<AutomationRunResult | null>(null);
  const [isAutomationRunning, setIsAutomationRunning] = useState(false);

  const [transitionLeadId, setTransitionLeadId] = useState<number | null>(null);
  const [draggingLeadId, setDraggingLeadId] = useState<number | null>(null);
  const [email, setEmail] = useState("admin@crm.local");
  const [password, setPassword] = useState("Admin123!");

  const roleTitle = useMemo(() => {
    const roles = dashboardData?.me.roles ?? session?.user.roles ?? [];
    return roles.map((role) => roleLabels[role] ?? role).join(", ");
  }, [dashboardData, session]);

  const kanbanOwners = useMemo(() => {
    const map = new Map<number, { id: number; fullName: string }>();

    for (const lead of dashboardData?.leads ?? []) {
      if (lead.owner) {
        map.set(lead.owner.id, {
          id: lead.owner.id,
          fullName: lead.owner.fullName
        });
      }
    }

    return Array.from(map.values()).sort((a, b) => a.fullName.localeCompare(b.fullName, "ru"));
  }, [dashboardData]);

  const filteredLeads = useMemo(() => {
    const query = kanbanSearch.trim().toLowerCase();
    const stageFilterId = Number(kanbanStageFilter);
    const ownerFilterId = Number(kanbanOwnerFilter);

    return (dashboardData?.leads ?? []).filter((lead) => {
      if (kanbanStageFilter !== "ALL" && (!Number.isInteger(stageFilterId) || lead.stage.id !== stageFilterId)) {
        return false;
      }

      if (kanbanPriorityFilter !== "ALL" && lead.priority !== kanbanPriorityFilter) {
        return false;
      }

      if (kanbanOwnerFilter === "UNASSIGNED" && lead.owner) {
        return false;
      }

      if (
        kanbanOwnerFilter !== "ALL" &&
        kanbanOwnerFilter !== "UNASSIGNED" &&
        (!Number.isInteger(ownerFilterId) || lead.owner?.id !== ownerFilterId)
      ) {
        return false;
      }

      if (!query) {
        return true;
      }

      const haystack = [lead.companyName, lead.mainContactName, lead.mainContactEmail ?? "", lead.mainContactPhone ?? ""]
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [dashboardData, kanbanSearch, kanbanPriorityFilter, kanbanOwnerFilter, kanbanStageFilter]);

  const selectedLeadIdsSet = useMemo(() => new Set(selectedLeadIds), [selectedLeadIds]);

  const filteredLeadIds = useMemo(() => filteredLeads.map((lead) => lead.id), [filteredLeads]);

  const selectedLeads = useMemo(() => {
    return (dashboardData?.leads ?? []).filter((lead) => selectedLeadIdsSet.has(lead.id));
  }, [dashboardData, selectedLeadIdsSet]);

  const bulkOwnerOptions = useMemo(() => {
    const map = new Map<number, { id: number; fullName: string }>();

    for (const owner of kanbanOwners) {
      map.set(owner.id, owner);
    }

    const currentUser = dashboardData?.me ?? session?.user;
    if (currentUser) {
      map.set(currentUser.id, {
        id: currentUser.id,
        fullName: currentUser.fullName
      });
    }

    return Array.from(map.values()).sort((a, b) => a.fullName.localeCompare(b.fullName, "ru"));
  }, [kanbanOwners, dashboardData, session]);

  const leadsByStageId = useMemo(() => {
    const grouped = new Map<number, LeadListItem[]>();

    for (const stage of dashboardData?.leadStages ?? []) {
      grouped.set(stage.id, []);
    }

    for (const lead of filteredLeads) {
      const bucket = grouped.get(lead.stage.id) ?? [];
      bucket.push(lead);
      grouped.set(lead.stage.id, bucket);
    }

    return grouped;
  }, [dashboardData, filteredLeads]);

  const draggingLeadStageId = useMemo(() => {
    if (!draggingLeadId) {
      return null;
    }

    return filteredLeads.find((lead) => lead.id === draggingLeadId)?.stage.id ?? null;
  }, [filteredLeads, draggingLeadId]);

  const applySession = useCallback((nextSession: SessionState | null) => {
    setSession(nextSession);
    persistSession(nextSession);
  }, []);

  const clearLeadPanel = useCallback(() => {
    setSelectedLeadId(null);
    setLeadDetails(null);
    setLeadHistory([]);
    setLeadBrief(null);
    setLeadDeals([]);
    setLeadTasks([]);
    setLeadActivity([]);
    setLeadPanelError(null);
    setLeadSaveError(null);
    setLeadProfileError(null);
    setBriefSaveError(null);
    setBriefCompleteNote("");
    setBriefForm(emptyBriefForm());
    setQuickLeadForm(leadToQuickForm(null));
    setLeadProfileForm(leadToProfileForm(null));
    setTaskCreateForm((prev) => ({ ...prev, leadId: "" }));
    setTaskEditForm(null);
    setTaskEditError(null);
    setActiveLeadTab("overview");
  }, []);

  const refreshDashboard = useCallback(
    async (activeSession: SessionState) => {
      setDashboardError(null);
      setTransitionError(null);
      setIsDashboardLoading(true);

      try {
        const result = await loadDashboardData(activeSession);
        applySession(result.session);
        setDashboardData(result.data);
      } catch (error) {
        const message = normalizeError(error, "Не удалось загрузить дашборд");
        setDashboardError(message);

        if (error instanceof ApiRequestError && error.status === 401) {
          applySession(null);
          setDashboardData(null);
        }
      } finally {
        setIsDashboardLoading(false);
        setIsBootstrapLoading(false);
      }
    },
    [applySession]
  );

  const openLeadPanel = useCallback(
    async (leadId: number) => {
      if (!session) {
        return;
      }

      setSelectedLeadId(leadId);
      setLeadPanelError(null);
      setLeadSaveError(null);
      setLeadProfileError(null);
      setBriefSaveError(null);
      setActiveLeadTab("overview");
      setIsLeadPanelLoading(true);

      try {
        const authorizedSession = await authorizeSession(session);
        applySession(authorizedSession);

        const authHeaders = {
          authorization: `Bearer ${authorizedSession.accessToken}`
        };

        const [detailsResponse, historyResponse, dealsResponse, tasksResponse] = await Promise.all([
          apiRequest<ApiEnvelope<LeadDetails>>(`/api/v1/leads/${leadId}`, { headers: authHeaders }),
          apiRequest<ApiEnvelope<LeadHistoryItem[]>>(`/api/v1/leads/${leadId}/history`, { headers: authHeaders }),
          apiRequest<ApiPaginated<DealListItem>>(`/api/v1/deals?lead_id=${leadId}&page=1&per_page=100`, {
            headers: authHeaders
          }),
          apiRequest<ApiPaginated<TaskListItem>>(`/api/v1/tasks?lead_id=${leadId}&page=1&per_page=100`, {
            headers: authHeaders
          })
        ]);

        let briefData: LeadBrief | null = null;
        try {
          const briefResponse = await apiRequest<ApiEnvelope<LeadBrief>>(`/api/v1/leads/${leadId}/brief`, {
            headers: authHeaders
          });
          briefData = briefResponse.data;
        } catch (error) {
          if (!(error instanceof ApiRequestError && error.status === 404 && error.code === "brief_not_found")) {
            throw error;
          }
        }

        const proposalsByDeal = new Map<number, ProposalItem[]>();
        await Promise.all(
          dealsResponse.data.map(async (deal) => {
            try {
              const proposalsResponse = await apiRequest<ApiEnvelope<ProposalItem[]>>(
                `/api/v1/deals/${deal.id}/proposals`,
                {
                  headers: authHeaders
                }
              );
              proposalsByDeal.set(deal.id, proposalsResponse.data);
            } catch {
              proposalsByDeal.set(deal.id, []);
            }
          })
        );

        const dealsWithProposals: LeadDealWithProposals[] = dealsResponse.data.map((deal) => ({
          ...deal,
          proposals: proposalsByDeal.get(deal.id) ?? []
        }));

        const activityFeed = buildActivityFeed({
          history: historyResponse.data,
          brief: briefData,
          deals: dealsWithProposals,
          tasks: tasksResponse.data
        });

        setLeadDetails(detailsResponse.data);
        setQuickLeadForm(leadToQuickForm(detailsResponse.data));
        setLeadProfileForm(leadToProfileForm(detailsResponse.data));
        setTaskCreateForm((prev) => ({ ...prev, leadId: String(detailsResponse.data.id) }));
        setLeadHistory(historyResponse.data);
        setLeadBrief(briefData);
        setLeadDeals(dealsWithProposals);
        setLeadTasks(tasksResponse.data);
        setLeadActivity(activityFeed);
        setBriefForm(briefToForm(briefData));
      } catch (error) {
        setLeadDetails(null);
        setLeadHistory([]);
        setLeadBrief(null);
        setLeadDeals([]);
        setLeadTasks([]);
        setLeadActivity([]);
        setBriefForm(emptyBriefForm());
        setQuickLeadForm(leadToQuickForm(null));
        setLeadProfileForm(leadToProfileForm(null));
        setLeadPanelError(normalizeError(error, "Не удалось загрузить карточку лида"));
      } finally {
        setIsLeadPanelLoading(false);
      }
    },
    [session, applySession]
  );

  const handleSaveBrief = useCallback(async () => {
    if (!session || !selectedLeadId) {
      return;
    }

    setBriefSaveError(null);
    setIsBriefSaving(true);

    try {
      const authorizedSession = await authorizeSession(session);
      applySession(authorizedSession);

      const payload = {
        businessModel: toOptionalText(briefForm.businessModel),
        targetAudience: toOptionalText(briefForm.targetAudience),
        mainKpi: toOptionalText(briefForm.mainKpi),
        kpiTarget: toOptionalText(briefForm.kpiTarget),
        competitors: toOptionalText(briefForm.competitors),
        decisionProcess: toOptionalText(briefForm.decisionProcess),
        notes: toOptionalText(briefForm.notes),
        expectedStartDate: toIsoFromInputDateTime(briefForm.expectedStartDate)
      };

      const method = leadBrief ? "PATCH" : "POST";
      await apiRequest<ApiEnvelope<LeadBrief>>(`/api/v1/leads/${selectedLeadId}/brief`, {
        method,
        headers: {
          authorization: `Bearer ${authorizedSession.accessToken}`
        },
        body: JSON.stringify(payload)
      });

      await openLeadPanel(selectedLeadId);
    } catch (error) {
      setBriefSaveError(normalizeError(error, "Не удалось сохранить бриф"));
    } finally {
      setIsBriefSaving(false);
    }
  }, [session, selectedLeadId, briefForm, leadBrief, applySession, openLeadPanel]);

  const handleSaveLeadQuickFields = useCallback(async () => {
    if (!session || !selectedLeadId) {
      return;
    }

    setLeadSaveError(null);
    setIsLeadSaving(true);

    try {
      const authorizedSession = await authorizeSession(session);
      applySession(authorizedSession);

      const payload: Record<string, unknown> = {
        priority: quickLeadForm.priority
      };

      const nextFollowUpAt = toIsoFromInputDateTime(quickLeadForm.nextFollowUpAt);
      if (nextFollowUpAt) {
        payload.nextFollowUpAt = nextFollowUpAt;
      }

      await apiRequest<ApiEnvelope<LeadDetails>>(`/api/v1/leads/${selectedLeadId}`, {
        method: "PATCH",
        headers: {
          authorization: `Bearer ${authorizedSession.accessToken}`
        },
        body: JSON.stringify(payload)
      });

      await refreshDashboard(authorizedSession);
      await openLeadPanel(selectedLeadId);
    } catch (error) {
      setLeadSaveError(normalizeError(error, "Не удалось обновить лид"));
    } finally {
      setIsLeadSaving(false);
    }
  }, [session, selectedLeadId, quickLeadForm, applySession, refreshDashboard, openLeadPanel]);

  const handleSaveLeadProfile = useCallback(async () => {
    if (!session || !selectedLeadId) {
      return;
    }

    const companyName = leadProfileForm.companyName.trim();
    const mainContactName = leadProfileForm.mainContactName.trim();

    if (companyName.length < 2 || mainContactName.length < 2) {
      setLeadProfileError("Поля Компания и Контакт должны содержать минимум 2 символа.");
      return;
    }

    setLeadProfileError(null);
    setIsLeadProfileSaving(true);

    try {
      const authorizedSession = await authorizeSession(session);
      applySession(authorizedSession);

      const payload: Record<string, unknown> = {
        companyName,
        mainContactName
      };

      const websiteUrl = toOptionalText(leadProfileForm.websiteUrl);
      const mainContactEmail = toOptionalText(leadProfileForm.mainContactEmail);
      const mainContactPhone = toOptionalText(leadProfileForm.mainContactPhone);

      if (websiteUrl) {
        payload.websiteUrl = websiteUrl;
      }
      if (mainContactEmail) {
        payload.mainContactEmail = mainContactEmail;
      }
      if (mainContactPhone) {
        payload.mainContactPhone = mainContactPhone;
      }

      await apiRequest<ApiEnvelope<LeadDetails>>(`/api/v1/leads/${selectedLeadId}`, {
        method: "PATCH",
        headers: {
          authorization: `Bearer ${authorizedSession.accessToken}`
        },
        body: JSON.stringify(payload)
      });

      await refreshDashboard(authorizedSession);
      await openLeadPanel(selectedLeadId);
    } catch (error) {
      setLeadProfileError(normalizeError(error, "Не удалось сохранить данные лида"));
    } finally {
      setIsLeadProfileSaving(false);
    }
  }, [session, selectedLeadId, leadProfileForm, applySession, refreshDashboard, openLeadPanel]);

  const handleCreateLead = useCallback(async () => {
    if (!session) {
      return;
    }

    const companyName = leadCreateForm.companyName.trim();
    const mainContactName = leadCreateForm.mainContactName.trim();

    if (companyName.length < 2 || mainContactName.length < 2) {
      setLeadCreateError("Поля Компания и Контакт должны содержать минимум 2 символа.");
      return;
    }

    setLeadCreateError(null);
    setIsLeadCreating(true);

    try {
      const authorizedSession = await authorizeSession(session);
      applySession(authorizedSession);

      const payload: Record<string, unknown> = {
        companyName,
        mainContactName,
        priority: leadCreateForm.priority
      };

      const websiteUrl = toOptionalText(leadCreateForm.websiteUrl);
      const mainContactEmail = toOptionalText(leadCreateForm.mainContactEmail);
      const mainContactPhone = toOptionalText(leadCreateForm.mainContactPhone);
      const nextFollowUpAt = toIsoFromInputDateTime(leadCreateForm.nextFollowUpAt);

      if (websiteUrl) {
        payload.websiteUrl = websiteUrl;
      }
      if (mainContactEmail) {
        payload.mainContactEmail = mainContactEmail;
      }
      if (mainContactPhone) {
        payload.mainContactPhone = mainContactPhone;
      }
      if (nextFollowUpAt) {
        payload.nextFollowUpAt = nextFollowUpAt;
      }

      const created = await apiRequest<ApiEnvelope<{ id: number }>>("/api/v1/leads", {
        method: "POST",
        headers: {
          authorization: `Bearer ${authorizedSession.accessToken}`
        },
        body: JSON.stringify(payload)
      });

      setLeadCreateForm(emptyLeadCreateForm());
      setIsLeadCreateOpen(false);
      await refreshDashboard(authorizedSession);
      await openLeadPanel(created.data.id);
    } catch (error) {
      setLeadCreateError(normalizeError(error, "Не удалось создать лид"));
    } finally {
      setIsLeadCreating(false);
    }
  }, [session, leadCreateForm, applySession, refreshDashboard, openLeadPanel]);

  const handleCreateTask = useCallback(async () => {
    if (!session) {
      return;
    }

    const title = taskCreateForm.title.trim();
    const leadId = Number(taskCreateForm.leadId);

    if (!Number.isInteger(leadId) || leadId <= 0) {
      setTaskCreateError("Выберите лид для новой задачи.");
      return;
    }

    if (title.length < 3) {
      setTaskCreateError("Название задачи должно содержать минимум 3 символа.");
      return;
    }

    setTaskCreateError(null);
    setIsTaskCreating(true);

    try {
      const authorizedSession = await authorizeSession(session);
      applySession(authorizedSession);

      const payload: Record<string, unknown> = {
        leadId,
        assigneeUserId: authorizedSession.user.id,
        type: taskCreateForm.type,
        title,
        priority: taskCreateForm.priority
      };

      const description = toOptionalText(taskCreateForm.description);
      const dueAt = toIsoFromInputDateTime(taskCreateForm.dueAt);

      if (description) {
        payload.description = description;
      }
      if (dueAt) {
        payload.dueAt = dueAt;
      }

      await apiRequest<ApiEnvelope<TaskListItem>>("/api/v1/tasks", {
        method: "POST",
        headers: {
          authorization: `Bearer ${authorizedSession.accessToken}`
        },
        body: JSON.stringify(payload)
      });

      setTaskCreateForm(emptyTaskCreateForm(selectedLeadId));
      setIsTaskCreateOpen(false);
      await refreshDashboard(authorizedSession);

      if (selectedLeadId === leadId) {
        await openLeadPanel(leadId);
      }
    } catch (error) {
      setTaskCreateError(normalizeError(error, "Не удалось создать задачу"));
    } finally {
      setIsTaskCreating(false);
    }
  }, [session, taskCreateForm, selectedLeadId, applySession, refreshDashboard, openLeadPanel]);

  const handleOpenTaskEdit = useCallback((task: TaskListItem) => {
    setTaskEditError(null);
    setTaskEditForm(taskToEditForm(task));
  }, []);

  const handleSaveTaskEdit = useCallback(async () => {
    if (!session || !taskEditForm) {
      return;
    }

    const title = taskEditForm.title.trim();
    if (title.length < 3) {
      setTaskEditError("Название задачи должно содержать минимум 3 символа.");
      return;
    }

    setTaskEditError(null);
    setIsTaskEditing(true);

    try {
      const authorizedSession = await authorizeSession(session);
      applySession(authorizedSession);

      const payload: Record<string, unknown> = {
        title,
        type: taskEditForm.type,
        priority: taskEditForm.priority,
        status: taskEditForm.status
      };

      const description = toOptionalText(taskEditForm.description);
      const dueAt = toIsoFromInputDateTime(taskEditForm.dueAt);
      if (description) {
        payload.description = description;
      }
      if (dueAt) {
        payload.dueAt = dueAt;
      }

      await apiRequest<ApiEnvelope<TaskListItem>>(`/api/v1/tasks/${taskEditForm.id}`, {
        method: "PATCH",
        headers: {
          authorization: `Bearer ${authorizedSession.accessToken}`
        },
        body: JSON.stringify(payload)
      });

      setTaskEditForm(null);
      await refreshDashboard(authorizedSession);
      if (selectedLeadId) {
        await openLeadPanel(selectedLeadId);
      }
    } catch (error) {
      setTaskEditError(normalizeError(error, "Не удалось обновить задачу"));
    } finally {
      setIsTaskEditing(false);
    }
  }, [session, taskEditForm, selectedLeadId, applySession, refreshDashboard, openLeadPanel]);

  const handleCompleteTask = useCallback(
    async (taskId: number, leadId: number | null) => {
      if (!session) {
        return;
      }

      setTaskEditError(null);
      setIsTaskEditing(true);

      try {
        const authorizedSession = await authorizeSession(session);
        applySession(authorizedSession);

        await apiRequest<ApiEnvelope<TaskListItem>>(`/api/v1/tasks/${taskId}/complete`, {
          method: "POST",
          headers: {
            authorization: `Bearer ${authorizedSession.accessToken}`
          },
          body: JSON.stringify({})
        });

        if (taskEditForm?.id === taskId) {
          setTaskEditForm(null);
        }

        await refreshDashboard(authorizedSession);
        if (leadId && selectedLeadId === leadId) {
          await openLeadPanel(leadId);
        } else if (selectedLeadId) {
          await openLeadPanel(selectedLeadId);
        }
      } catch (error) {
        setTaskEditError(normalizeError(error, "Не удалось завершить задачу"));
      } finally {
        setIsTaskEditing(false);
      }
    },
    [session, taskEditForm, selectedLeadId, applySession, refreshDashboard, openLeadPanel]
  );

  const handleCompleteBrief = useCallback(async () => {
    if (!session || !selectedLeadId || !leadBrief) {
      return;
    }

    setBriefSaveError(null);
    setIsBriefSaving(true);

    try {
      const authorizedSession = await authorizeSession(session);
      applySession(authorizedSession);

      await apiRequest<ApiEnvelope<LeadBrief>>(`/api/v1/leads/${selectedLeadId}/brief/complete`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${authorizedSession.accessToken}`
        },
        body: JSON.stringify({
          note: toOptionalText(briefCompleteNote)
        })
      });

      setBriefCompleteNote("");
      await openLeadPanel(selectedLeadId);
    } catch (error) {
      setBriefSaveError(normalizeError(error, "Не удалось завершить бриф"));
    } finally {
      setIsBriefSaving(false);
    }
  }, [session, selectedLeadId, leadBrief, briefCompleteNote, applySession, openLeadPanel]);

  const handleLeadStageDrop = useCallback(
    async (leadId: number, toStageId: number) => {
      if (!session || !dashboardData) {
        return;
      }

      const lead = dashboardData.leads.find((item) => item.id === leadId);
      if (!lead || lead.stage.id === toStageId) {
        return;
      }

      setTransitionError(null);
      setTransitionLeadId(leadId);

      try {
        const authorizedSession = await authorizeSession(session);
        applySession(authorizedSession);

        await apiRequest<ApiEnvelope<LeadListItem>>(`/api/v1/leads/${leadId}/stage-transitions`, {
          method: "POST",
          headers: {
            authorization: `Bearer ${authorizedSession.accessToken}`
          },
          body: JSON.stringify({
            toStageId,
            comment: `Перемещено на канбан-доске ${new Date().toISOString()}`
          })
        });

        await refreshDashboard(authorizedSession);

        if (selectedLeadId === leadId) {
          await openLeadPanel(leadId);
        }
      } catch (error) {
        setTransitionError(formatTransitionError(error));
      } finally {
        setTransitionLeadId(null);
        setDraggingLeadId(null);
      }
    },
    [session, dashboardData, applySession, refreshDashboard, selectedLeadId, openLeadPanel]
  );

  const toggleLeadSelection = useCallback((leadId: number) => {
    setSelectedLeadIds((prev) => (prev.includes(leadId) ? prev.filter((id) => id !== leadId) : [...prev, leadId]));
    setBulkActionError(null);
    setBulkActionSuccess(null);
  }, []);

  const clearSelectedLeads = useCallback(() => {
    setSelectedLeadIds([]);
    setBulkActionError(null);
    setBulkActionSuccess(null);
  }, []);

  const selectAllFilteredLeads = useCallback(() => {
    setSelectedLeadIds((prev) => Array.from(new Set([...prev, ...filteredLeadIds])));
    setBulkActionError(null);
    setBulkActionSuccess(null);
  }, [filteredLeadIds]);

  const handleBulkAction = useCallback(
    async (action: "assign" | "priority" | "stage") => {
      if (!session) {
        return;
      }

      if (selectedLeadIds.length === 0) {
        setBulkActionError("Выберите хотя бы один лид для массового действия.");
        setBulkActionSuccess(null);
        return;
      }

      const ownerUserId =
        bulkOwnerUserId === "CURRENT"
          ? (dashboardData?.me.id ?? session.user.id)
          : Number.parseInt(bulkOwnerUserId, 10);

      const toStageId = Number.parseInt(bulkStageId, 10);

      if (action === "assign" && !Number.isInteger(ownerUserId)) {
        setBulkActionError("Выберите корректного ответственного.");
        setBulkActionSuccess(null);
        return;
      }

      if (action === "stage" && !Number.isInteger(toStageId)) {
        setBulkActionError("Выберите этап для массового переноса.");
        setBulkActionSuccess(null);
        return;
      }

      setBulkActionError(null);
      setBulkActionSuccess(null);
      setIsBulkApplying(true);

      try {
        const authorizedSession = await authorizeSession(session);
        applySession(authorizedSession);

        const results = await Promise.all(
          selectedLeadIds.map(async (leadId) => {
            try {
              if (action === "assign") {
                await apiRequest<ApiEnvelope<LeadListItem>>(`/api/v1/leads/${leadId}/assign`, {
                  method: "POST",
                  headers: {
                    authorization: `Bearer ${authorizedSession.accessToken}`
                  },
                  body: JSON.stringify({ ownerUserId })
                });
              } else if (action === "priority") {
                await apiRequest<ApiEnvelope<LeadListItem>>(`/api/v1/leads/${leadId}`, {
                  method: "PATCH",
                  headers: {
                    authorization: `Bearer ${authorizedSession.accessToken}`
                  },
                  body: JSON.stringify({ priority: bulkPriority })
                });
              } else {
                await apiRequest<ApiEnvelope<LeadListItem>>(`/api/v1/leads/${leadId}/stage-transitions`, {
                  method: "POST",
                  headers: {
                    authorization: `Bearer ${authorizedSession.accessToken}`
                  },
                  body: JSON.stringify({
                    toStageId,
                    comment: `Массовый перенос ${new Date().toISOString()}`
                  })
                });
              }

              return { leadId, ok: true as const, message: "" };
            } catch (error) {
              return {
                leadId,
                ok: false as const,
                message: action === "stage" ? formatTransitionError(error) : normalizeError(error)
              };
            }
          })
        );

        const failed = results.filter((item) => !item.ok);
        const successCount = results.length - failed.length;

        await refreshDashboard(authorizedSession);

        if (selectedLeadId && selectedLeadIdsSet.has(selectedLeadId)) {
          await openLeadPanel(selectedLeadId);
        }

        if (failed.length > 0) {
          const details = failed
            .slice(0, 2)
            .map((item) => `#${item.leadId}: ${item.message}`)
            .join(" | ");

          setBulkActionError(
            `Выполнено частично: ${successCount} из ${results.length}. Ошибки (${failed.length}): ${details}${
              failed.length > 2 ? " ..." : ""
            }`
          );
          setSelectedLeadIds(failed.map((item) => item.leadId));
          return;
        }

        if (action === "assign") {
          setBulkActionSuccess(`Ответственный обновлен для ${results.length} лидов.`);
        } else if (action === "priority") {
          setBulkActionSuccess(`Приоритет обновлен для ${results.length} лидов.`);
        } else {
          setBulkActionSuccess(`Этап обновлен для ${results.length} лидов.`);
        }

        setSelectedLeadIds([]);
      } catch (error) {
        setBulkActionError(normalizeError(error, "Не удалось выполнить массовое действие"));
      } finally {
        setIsBulkApplying(false);
      }
    },
    [
      session,
      selectedLeadIds,
      bulkOwnerUserId,
      bulkStageId,
      bulkPriority,
      dashboardData,
      applySession,
      refreshDashboard,
      selectedLeadId,
      selectedLeadIdsSet,
      openLeadPanel
    ]
  );

  const handleCsvFileChange = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    setCsvImportError(null);
    setCsvImportResult(null);

    try {
      const text = await file.text();
      const rows = parseCsvImportRows(text);
      setCsvFileName(file.name);
      setCsvImportRows(rows);
    } catch (error) {
      setCsvFileName(file.name);
      setCsvImportRows([]);
      setCsvImportError(normalizeError(error, "Не удалось прочитать CSV-файл"));
    }
  }, []);

  const handleImportCsvRows = useCallback(async () => {
    if (!session) {
      return;
    }

    if (csvImportRows.length === 0) {
      setCsvImportError("Сначала выберите CSV-файл с корректными данными.");
      setCsvImportResult(null);
      return;
    }

    setCsvImportError(null);
    setCsvImportResult(null);
    setIsCsvImporting(true);

    try {
      const authorizedSession = await authorizeSession(session);
      applySession(authorizedSession);

      const response = await apiRequest<ApiEnvelope<CsvImportResult>>("/api/v1/integrations/import/leads-csv", {
        method: "POST",
        headers: {
          authorization: `Bearer ${authorizedSession.accessToken}`
        },
        body: JSON.stringify({
          rows: csvImportRows,
          defaultSourceCode: toOptionalText(csvDefaultSourceCode) ?? "manual",
          skipInvalid: true
        })
      });

      setCsvImportResult(response.data);
      await refreshDashboard(authorizedSession);

      if (selectedLeadId) {
        await openLeadPanel(selectedLeadId);
      }
    } catch (error) {
      setCsvImportError(normalizeError(error, "Не удалось импортировать CSV"));
    } finally {
      setIsCsvImporting(false);
    }
  }, [session, csvImportRows, csvDefaultSourceCode, applySession, refreshDashboard, selectedLeadId, openLeadPanel]);

  const handleRunAutomation = useCallback(async () => {
    if (!session) {
      return;
    }

    const parsedLeadId = Number.parseInt(automationLeadId.trim(), 10);
    const parsedDealId = Number.parseInt(automationDealId.trim(), 10);
    const hasLeadId = Number.isInteger(parsedLeadId) && parsedLeadId > 0;
    const hasDealId = Number.isInteger(parsedDealId) && parsedDealId > 0;
    const isLeadEvent =
      automationEvent === "lead.stage_changed" || automationEvent === "lead.brief_completed" || automationEvent === "lead.created";
    const isDealEvent = automationEvent === "deal.closed_won" || automationEvent === "deal.closed_lost";

    if (isLeadEvent && !hasLeadId && !hasDealId) {
      setAutomationRunError("Для событий лида укажите ID лида или ID сделки.");
      setAutomationRunResult(null);
      return;
    }

    if (isDealEvent && !hasDealId) {
      setAutomationRunError("Для событий сделки укажите ID сделки.");
      setAutomationRunResult(null);
      return;
    }

    setAutomationRunError(null);
    setAutomationRunResult(null);
    setIsAutomationRunning(true);

    try {
      const authorizedSession = await authorizeSession(session);
      applySession(authorizedSession);

      const requestPayload: Record<string, unknown> = {
        event: automationEvent
      };

      if (hasLeadId) {
        requestPayload.leadId = parsedLeadId;
      }

      if (hasDealId) {
        requestPayload.dealId = parsedDealId;
      }

      const payload: Record<string, string> = {};
      const fromStageCode = toOptionalText(automationFromStageCode);
      const toStageCode = toOptionalText(automationToStageCode);
      const sourceCode = toOptionalText(automationSourceCode);

      if (fromStageCode) {
        payload.fromStageCode = fromStageCode;
      }

      if (toStageCode) {
        payload.toStageCode = toStageCode;
      }

      if (sourceCode) {
        payload.sourceCode = sourceCode;
      }

      if (Object.keys(payload).length > 0) {
        requestPayload.payload = payload;
      }

      const response = await apiRequest<ApiEnvelope<AutomationRunResult>>("/api/v1/automations/run", {
        method: "POST",
        headers: {
          authorization: `Bearer ${authorizedSession.accessToken}`
        },
        body: JSON.stringify(requestPayload)
      });

      setAutomationRunResult(response.data);
      await refreshDashboard(authorizedSession);

      if (selectedLeadId) {
        await openLeadPanel(selectedLeadId);
      }
    } catch (error) {
      setAutomationRunError(normalizeError(error, "Не удалось запустить автоматизацию"));
    } finally {
      setIsAutomationRunning(false);
    }
  }, [
    session,
    automationEvent,
    automationLeadId,
    automationDealId,
    automationFromStageCode,
    automationToStageCode,
    automationSourceCode,
    applySession,
    refreshDashboard,
    selectedLeadId,
    openLeadPanel
  ]);

  useEffect(() => {
    const storedSession = readStoredSession();

    if (!storedSession) {
      setIsBootstrapLoading(false);
      return;
    }

    applySession(storedSession);
    void refreshDashboard(storedSession);
  }, [applySession, refreshDashboard]);

  useEffect(() => {
    if (!selectedLeadId) {
      return;
    }

    const isStillVisible = dashboardData?.leads.some((lead) => lead.id === selectedLeadId);
    if (isStillVisible === false) {
      clearLeadPanel();
    }
  }, [dashboardData, selectedLeadId, clearLeadPanel]);

  useEffect(() => {
    if (!dashboardData) {
      setSelectedLeadIds([]);
      return;
    }

    const availableLeadIds = new Set(dashboardData.leads.map((lead) => lead.id));
    setSelectedLeadIds((prev) => prev.filter((id) => availableLeadIds.has(id)));
  }, [dashboardData]);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthError(null);
    setDashboardError(null);
    setIsLoginLoading(true);

    try {
      const loginResponse = await apiRequest<ApiEnvelope<LoginResponse>>("/api/v1/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: email.trim(),
          password
        })
      });

      const nextSession: SessionState = {
        accessToken: loginResponse.data.accessToken,
        refreshToken: loginResponse.data.refreshToken,
        user: loginResponse.data.user
      };

      applySession(nextSession);
      await refreshDashboard(nextSession);
    } catch (error) {
      setAuthError(normalizeError(error, "Не удалось войти в систему"));
    } finally {
      setIsLoginLoading(false);
      setPassword("");
    }
  };

  const handleLogout = async () => {
    if (session) {
      try {
        await apiRequest<ApiEnvelope<{ success: boolean }>>("/api/v1/auth/logout", {
          method: "POST",
          headers: {
            authorization: `Bearer ${session.accessToken}`
          },
          body: JSON.stringify({
            refreshToken: session.refreshToken
          })
        });
      } catch {
        // Keep logout idempotent on the client as well.
      }
    }

    applySession(null);
    setDashboardData(null);
    setAuthError(null);
    setDashboardError(null);
    setTransitionError(null);
    clearLeadPanel();
    setIsLeadCreateOpen(false);
    setLeadCreateForm(emptyLeadCreateForm());
    setLeadCreateError(null);
    setIsTaskCreateOpen(false);
    setTaskCreateForm(emptyTaskCreateForm());
    setTaskCreateError(null);
    setTaskEditForm(null);
    setTaskEditError(null);
    setKanbanSearch("");
    setKanbanStageFilter("ALL");
    setKanbanPriorityFilter("ALL");
    setKanbanOwnerFilter("ALL");
    setSelectedLeadIds([]);
    setBulkOwnerUserId("CURRENT");
    setBulkPriority("MEDIUM");
    setBulkStageId("");
    setBulkActionError(null);
    setBulkActionSuccess(null);
    setCsvFileName("");
    setCsvImportRows([]);
    setCsvDefaultSourceCode("manual");
    setCsvImportError(null);
    setCsvImportResult(null);
    setAutomationEvent("lead.stage_changed");
    setAutomationLeadId("");
    setAutomationDealId("");
    setAutomationFromStageCode("");
    setAutomationToStageCode("");
    setAutomationSourceCode("");
    setAutomationRunError(null);
    setAutomationRunResult(null);
    setIsAutomationRunning(false);
    setPassword("");
  };

  if (isBootstrapLoading) {
    return (
      <main className="page centered">
        <section className="panel">
          <h1>Мини-CRM агентства</h1>
          <p>Проверяем текущую сессию и загружаем рабочий стол.</p>
        </section>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="page centered">
        <section className="auth-card">
          <h1>Вход в CRM</h1>
          <p className="muted">Введите рабочий email и пароль. Интерфейс полностью подключен к API.</p>

          <form className="auth-form" onSubmit={handleLogin}>
            <label className="field">
              <span>Email</span>
              <input
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>

            <label className="field">
              <span>Пароль</span>
              <input
                type="password"
                autoComplete="current-password"
                required
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>

            {authError ? <p className="error">{authError}</p> : null}

            <button className="button primary" type="submit" disabled={isLoginLoading}>
              {isLoginLoading ? "Входим..." : "Войти"}
            </button>
          </form>

          <p className="hint">
            Тестовый доступ после seed:
            <br />
            <strong>admin@crm.local / Admin123!</strong>
          </p>
        </section>
      </main>
    );
  }

  const hasReportsAccess = Boolean(dashboardData?.funnelReport && dashboardData?.proposalReport);
  const hasAutomationAccess = isPrivileged(dashboardData?.me.roles ?? session.user.roles);
  const activeAutomationRulesTotal = (dashboardData?.automationRules ?? []).filter((rule) => rule.isActive).length;
  const totalLeads = dashboardData?.leadsMeta.total ?? 0;
  const filteredLeadsTotal = filteredLeads.length;
  const selectedLeadsTotal = selectedLeads.length;
  const totalStages = dashboardData?.leadStages.length ?? 0;
  const kpiWonLeads = dashboardData?.funnelReport?.summary.totalWon ?? 0;
  const kpiOverdueTasks = dashboardData?.overdueTasksTotal ?? 0;
  const kpiProposalConversion = dashboardData?.proposalReport?.summary.proposalToWonConversionPercent ?? 0;

  return (
    <main className="page">
      <header className="hero">
        <div>
          <h1>Панель продаж маркетингового агентства</h1>
          <p className="muted">
            Пользователь: <strong>{dashboardData?.me.fullName ?? session.user.fullName}</strong>
            {" · "}
            {roleTitle || "Роль не назначена"}
          </p>
        </div>

        <div className="actions">
          <button
            className="button secondary"
            type="button"
            onClick={() => {
              if (session) {
                void refreshDashboard(session);
              }
            }}
            disabled={isDashboardLoading}
          >
            {isDashboardLoading ? "Обновляем..." : "Обновить данные"}
          </button>
          <button className="button ghost" type="button" onClick={handleLogout}>
            Выйти
          </button>
        </div>
      </header>

      {dashboardError ? (
        <section className="panel error-panel">
          <strong>Ошибка загрузки:</strong> {dashboardError}
        </section>
      ) : null}

      <section className="kpi-grid">
        <article className="kpi-card">
          <p>Всего лидов</p>
          <h3>{totalLeads}</h3>
          <span>Активных этапов воронки: {totalStages}</span>
        </article>

        <article className="kpi-card">
          <p>Выиграно лидов</p>
          <h3>{hasReportsAccess ? kpiWonLeads : "н/д"}</h3>
          <span>{hasReportsAccess ? "По воронке за 30 дней" : "Только для admin/head"}</span>
        </article>

        <article className="kpi-card">
          <p>Просроченных задач</p>
          <h3>{kpiOverdueTasks}</h3>
          <span>Контроль SLA в реальном времени</span>
        </article>

        <article className="kpi-card">
          <p>Конверсия КП в победу</p>
          <h3>{hasReportsAccess ? `${kpiProposalConversion.toFixed(2)}%` : "н/д"}</h3>
          <span>{hasReportsAccess ? "За последние 30 дней" : "Только для admin/head"}</span>
        </article>
      </section>

      <section className="panel kanban-panel">
        <div className="panel-head panel-head-wrap">
          <div>
            <h2>Канбан лидов</h2>
            <p className="muted compact-muted">Перетаскивай карточки между этапами</p>
          </div>
          <button className="button secondary" type="button" onClick={() => setIsLeadCreateOpen((prev) => !prev)}>
            {isLeadCreateOpen ? "Скрыть форму лида" : "Новый лид"}
          </button>
        </div>

        {transitionError ? <p className="error">{transitionError}</p> : null}
        {leadCreateError ? <p className="error">{leadCreateError}</p> : null}

        <div className="kanban-filters">
          <label className="field">
            <span>Поиск</span>
            <input
              type="text"
              value={kanbanSearch}
              placeholder="Компания, контакт, email, телефон"
              onChange={(event) => setKanbanSearch(event.target.value)}
            />
          </label>

          <label className="field">
            <span>Этап</span>
            <select value={kanbanStageFilter} onChange={(event) => setKanbanStageFilter(event.target.value)}>
              <option value="ALL">Все этапы</option>
              {(dashboardData?.leadStages ?? []).map((stage) => (
                <option key={stage.id} value={String(stage.id)}>
                  {stage.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Приоритет</span>
            <select
              value={kanbanPriorityFilter}
              onChange={(event) => setKanbanPriorityFilter(event.target.value as "ALL" | LeadListItem["priority"])}
            >
              <option value="ALL">Любой приоритет</option>
              <option value="LOW">Низкий</option>
              <option value="MEDIUM">Средний</option>
              <option value="HIGH">Высокий</option>
            </select>
          </label>

          <label className="field">
            <span>Ответственный</span>
            <select value={kanbanOwnerFilter} onChange={(event) => setKanbanOwnerFilter(event.target.value)}>
              <option value="ALL">Все ответственные</option>
              <option value="UNASSIGNED">Без ответственного</option>
              {kanbanOwners.map((owner) => (
                <option key={owner.id} value={String(owner.id)}>
                  {owner.fullName}
                </option>
              ))}
            </select>
          </label>

          <div className="kanban-filter-actions">
            <button
              className="button ghost button-compact"
              type="button"
              onClick={() => {
                setKanbanSearch("");
                setKanbanStageFilter("ALL");
                setKanbanPriorityFilter("ALL");
                setKanbanOwnerFilter("ALL");
              }}
            >
              Сбросить
            </button>
            <span className="muted small">
              Показано: {filteredLeadsTotal} из {totalLeads}
            </span>
          </div>
        </div>

        <div className="bulk-actions-box">
          <div className="bulk-head">
            <div>
              <h3 className="subheading">Массовые действия</h3>
              <p className="muted compact-muted">Выберите лиды чекбоксами и примените действие ко всем сразу.</p>
            </div>
            <span className={`bulk-count-badge ${selectedLeadsTotal > 0 ? "active" : ""}`}>Выбрано: {selectedLeadsTotal}</span>
          </div>

          <div className="bulk-selection-toolbar">
            <button className="button ghost button-compact" type="button" onClick={selectAllFilteredLeads}>
              Выделить все по фильтру ({filteredLeadsTotal})
            </button>
            <button className="button ghost button-compact" type="button" onClick={clearSelectedLeads}>
              Снять выделение
            </button>
          </div>

          {bulkActionError ? <p className="bulk-alert error">{bulkActionError}</p> : null}
          {bulkActionSuccess ? <p className="bulk-alert success">{bulkActionSuccess}</p> : null}

          <div className="bulk-actions-cards">
            <div className="bulk-action-card">
              <h4 className="bulk-action-title">Назначить ответственного</h4>
              <p className="muted small bulk-action-note">Все выбранные лиды будут закреплены за одним сотрудником.</p>
              <div className="bulk-action-controls">
                <label className="field">
                  <span>Сотрудник</span>
                  <select value={bulkOwnerUserId} onChange={(event) => setBulkOwnerUserId(event.target.value)}>
                    <option value="CURRENT">Я ({dashboardData?.me.fullName ?? session.user.fullName})</option>
                    {bulkOwnerOptions
                      .filter((owner) => owner.id !== (dashboardData?.me.id ?? session.user.id))
                      .map((owner) => (
                        <option key={owner.id} value={String(owner.id)}>
                          {owner.fullName}
                        </option>
                      ))}
                  </select>
                </label>
                <button
                  className="button secondary"
                  type="button"
                  disabled={isBulkApplying || selectedLeadsTotal === 0}
                  onClick={() => void handleBulkAction("assign")}
                >
                  {isBulkApplying ? "Применяем..." : "Применить"}
                </button>
              </div>
            </div>

            <div className="bulk-action-card">
              <h4 className="bulk-action-title">Сменить приоритет</h4>
              <p className="muted small bulk-action-note">Приоритет будет обновлен у всех выбранных лидов.</p>
              <div className="bulk-action-controls">
                <label className="field">
                  <span>Новый приоритет</span>
                  <select
                    value={bulkPriority}
                    onChange={(event) => setBulkPriority(event.target.value as LeadListItem["priority"])}
                  >
                    <option value="LOW">Низкий</option>
                    <option value="MEDIUM">Средний</option>
                    <option value="HIGH">Высокий</option>
                  </select>
                </label>
                <button
                  className="button secondary"
                  type="button"
                  disabled={isBulkApplying || selectedLeadsTotal === 0}
                  onClick={() => void handleBulkAction("priority")}
                >
                  {isBulkApplying ? "Применяем..." : "Применить"}
                </button>
              </div>
            </div>

            <div className="bulk-action-card">
              <h4 className="bulk-action-title">Перенести этап</h4>
              <p className="muted small bulk-action-note">Для этапов с обязательными полями валидация сохранится.</p>
              <div className="bulk-action-controls">
                <label className="field">
                  <span>Целевой этап</span>
                  <select value={bulkStageId} onChange={(event) => setBulkStageId(event.target.value)}>
                    <option value="">Выберите этап</option>
                    {(dashboardData?.leadStages ?? []).map((stage) => (
                      <option key={stage.id} value={String(stage.id)}>
                        {stage.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className="button secondary"
                  type="button"
                  disabled={isBulkApplying || selectedLeadsTotal === 0 || bulkStageId === ""}
                  onClick={() => void handleBulkAction("stage")}
                >
                  {isBulkApplying ? "Применяем..." : "Применить"}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="csv-import-box">
          <div className="panel-head">
            <h3 className="subheading">Импорт лидов из CSV</h3>
            <span className="muted">Максимум 500 строк за один импорт</span>
          </div>

          <p className="muted small">
            Поддерживаемые колонки: <code>company/contact/email/phone/website/priority/next_follow_up_at/source</code> или их
            русские аналоги.
          </p>

          <div className="csv-import-controls">
            <label className="field">
              <span>Файл CSV</span>
              <input type="file" accept=".csv,text/csv" onChange={handleCsvFileChange} />
            </label>

            <label className="field">
              <span>Источник по умолчанию</span>
              <input
                type="text"
                value={csvDefaultSourceCode}
                placeholder="manual"
                onChange={(event) => setCsvDefaultSourceCode(event.target.value)}
              />
            </label>

            <div className="csv-import-actions">
              <button className="button primary" type="button" disabled={isCsvImporting} onClick={() => void handleImportCsvRows()}>
                {isCsvImporting ? "Импортируем..." : "Импортировать в CRM"}
              </button>
              <span className="muted small">
                {csvFileName ? `Файл: ${csvFileName}` : "Файл не выбран"}
                {csvImportRows.length ? ` · строк: ${csvImportRows.length}` : ""}
              </span>
            </div>
          </div>

          {csvImportError ? <p className="error">{csvImportError}</p> : null}

          {csvImportResult ? (
            <div className="csv-import-result">
              <p className="success">
                Импорт завершен: создано {csvImportResult.created} из {csvImportResult.total}, ошибок {csvImportResult.failed}.
                {csvImportResult.stoppedEarly ? " Импорт остановлен досрочно." : ""}
              </p>
              {csvImportResult.failures.length > 0 ? (
                <ul className="history-list">
                  {csvImportResult.failures.slice(0, 5).map((failure) => (
                    <li key={`${failure.rowNumber}-${failure.message}`} className="history-item">
                      <strong>Строка {failure.rowNumber}</strong>
                      <p className="muted">{failure.message}</p>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>

        {isLeadCreateOpen ? (
          <div className="inline-form-box">
            <div className="quick-form-grid">
              <label className="field">
                <span>Компания</span>
                <input
                  type="text"
                  required
                  value={leadCreateForm.companyName}
                  onChange={(event) =>
                    setLeadCreateForm((prev) => ({
                      ...prev,
                      companyName: event.target.value
                    }))
                  }
                />
              </label>
              <label className="field">
                <span>Контакт</span>
                <input
                  type="text"
                  required
                  value={leadCreateForm.mainContactName}
                  onChange={(event) =>
                    setLeadCreateForm((prev) => ({
                      ...prev,
                      mainContactName: event.target.value
                    }))
                  }
                />
              </label>
              <label className="field">
                <span>Email</span>
                <input
                  type="email"
                  value={leadCreateForm.mainContactEmail}
                  onChange={(event) =>
                    setLeadCreateForm((prev) => ({
                      ...prev,
                      mainContactEmail: event.target.value
                    }))
                  }
                />
              </label>
              <label className="field">
                <span>Телефон</span>
                <input
                  type="text"
                  value={leadCreateForm.mainContactPhone}
                  onChange={(event) =>
                    setLeadCreateForm((prev) => ({
                      ...prev,
                      mainContactPhone: event.target.value
                    }))
                  }
                />
              </label>
              <label className="field">
                <span>Сайт</span>
                <input
                  type="url"
                  value={leadCreateForm.websiteUrl}
                  onChange={(event) =>
                    setLeadCreateForm((prev) => ({
                      ...prev,
                      websiteUrl: event.target.value
                    }))
                  }
                />
              </label>
              <label className="field">
                <span>Приоритет</span>
                <select
                  value={leadCreateForm.priority}
                  onChange={(event) =>
                    setLeadCreateForm((prev) => ({
                      ...prev,
                      priority: event.target.value as LeadCreateFormState["priority"]
                    }))
                  }
                >
                  <option value="LOW">Низкий</option>
                  <option value="MEDIUM">Средний</option>
                  <option value="HIGH">Высокий</option>
                </select>
              </label>
              <label className="field">
                <span>Дата следующего follow-up</span>
                <input
                  type="datetime-local"
                  value={leadCreateForm.nextFollowUpAt}
                  onChange={(event) =>
                    setLeadCreateForm((prev) => ({
                      ...prev,
                      nextFollowUpAt: event.target.value
                    }))
                  }
                />
              </label>
            </div>
            <div className="inline-actions">
              <button className="button primary" type="button" onClick={() => void handleCreateLead()} disabled={isLeadCreating}>
                {isLeadCreating ? "Создаем..." : "Создать лид"}
              </button>
            </div>
          </div>
        ) : null}

        <div className="kanban-board">
          {(dashboardData?.leadStages ?? []).map((stage) => {
            const stageLeads = leadsByStageId.get(stage.id) ?? [];
            const isOriginColumn = draggingLeadStageId === stage.id;

            return (
              <article
                key={stage.id}
                className={`kanban-column ${draggingLeadId ? "is-drop-zone" : ""} ${isOriginColumn ? "is-origin" : ""}`}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  const leadId = Number(event.dataTransfer.getData("text/plain"));
                  if (!Number.isInteger(leadId)) {
                    return;
                  }

                  void handleLeadStageDrop(leadId, stage.id);
                }}
              >
                <header className="kanban-column-head">
                  <h3>{stage.name}</h3>
                  <span className="badge neutral">{stageLeads.length}</span>
                </header>

                <div className="kanban-list">
                  {stageLeads.map((lead) => (
                    <div key={lead.id} className={`kanban-card-shell ${selectedLeadIdsSet.has(lead.id) ? "selected" : ""}`}>
                      <label className="kanban-card-select">
                        <input
                          type="checkbox"
                          checked={selectedLeadIdsSet.has(lead.id)}
                          onChange={() => toggleLeadSelection(lead.id)}
                        />
                        <span className="small">Выбрать</span>
                      </label>

                      <button
                        type="button"
                        className={`kanban-card ${selectedLeadId === lead.id ? "active" : ""}`}
                        draggable={transitionLeadId !== lead.id}
                        onDragStart={(event) => {
                          setDraggingLeadId(lead.id);
                          event.dataTransfer.setData("text/plain", String(lead.id));
                          event.dataTransfer.effectAllowed = "move";
                        }}
                        onDragEnd={() => setDraggingLeadId(null)}
                        onClick={() => {
                          void openLeadPanel(lead.id);
                        }}
                      >
                        <strong>{lead.companyName}</strong>
                        <p className="muted">{lead.mainContactName}</p>
                        <p className="muted small">{lead.mainContactEmail ?? "Email не указан"}</p>
                        <div className="kanban-card-meta">
                          <span className="badge neutral">{leadPriorityLabels[lead.priority]}</span>
                          <span className={`badge lead-${lead.status.toLowerCase()}`}>{formatLeadStatus(lead.status)}</span>
                        </div>
                        {transitionLeadId === lead.id ? <p className="muted small">Сохраняем переход...</p> : null}
                      </button>
                    </div>
                  ))}

                  {stageLeads.length === 0 ? <p className="empty">Нет лидов на этапе.</p> : null}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="panel lead-panel">
        <div className="panel-head">
          <h2>Карточка лида 360</h2>
          {selectedLeadId ? (
            <button className="button ghost" type="button" onClick={clearLeadPanel}>
              Скрыть
            </button>
          ) : null}
        </div>

        {!selectedLeadId ? <p className="empty">Нажмите на карточку лида в канбане, чтобы открыть детали.</p> : null}

        {selectedLeadId && isLeadPanelLoading ? <p className="muted">Загружаем карточку лида...</p> : null}

        {selectedLeadId && !isLeadPanelLoading && leadPanelError ? <p className="error">{leadPanelError}</p> : null}

        {selectedLeadId && !isLeadPanelLoading && !leadPanelError && leadDetails ? (
          <>
            <div className="lead-tabs" role="tablist" aria-label="Карточка лида">
              <button
                type="button"
                className={`tab-button ${activeLeadTab === "overview" ? "active" : ""}`}
                onClick={() => setActiveLeadTab("overview")}
              >
                Обзор
              </button>
              <button
                type="button"
                className={`tab-button ${activeLeadTab === "brief" ? "active" : ""}`}
                onClick={() => setActiveLeadTab("brief")}
              >
                Бриф
              </button>
              <button
                type="button"
                className={`tab-button ${activeLeadTab === "deals" ? "active" : ""}`}
                onClick={() => setActiveLeadTab("deals")}
              >
                Сделки и КП
              </button>
              <button
                type="button"
                className={`tab-button ${activeLeadTab === "activities" ? "active" : ""}`}
                onClick={() => setActiveLeadTab("activities")}
              >
                Активности
              </button>
            </div>

            {activeLeadTab === "overview" ? (
              <>
                <div className="overview-edit-box">
                  <div className="panel-head">
                    <h3 className="subheading">Быстрое редактирование лида</h3>
                    <span className="muted">Заполните follow-up и сохраните</span>
                  </div>

                  {leadSaveError ? <p className="error">{leadSaveError}</p> : null}

                  <div className="quick-form-grid">
                    <label className="field">
                      <span>Дата следующего follow-up</span>
                      <input
                        type="datetime-local"
                        value={quickLeadForm.nextFollowUpAt}
                        onChange={(event) =>
                          setQuickLeadForm((prev) => ({
                            ...prev,
                            nextFollowUpAt: event.target.value
                          }))
                        }
                      />
                    </label>

                    <label className="field">
                      <span>Приоритет</span>
                      <select
                        value={quickLeadForm.priority}
                        onChange={(event) =>
                          setQuickLeadForm((prev) => ({
                            ...prev,
                            priority: event.target.value as LeadQuickFormState["priority"]
                          }))
                        }
                      >
                        <option value="LOW">Низкий</option>
                        <option value="MEDIUM">Средний</option>
                        <option value="HIGH">Высокий</option>
                      </select>
                    </label>
                  </div>

                  <div className="inline-actions">
                    <button
                      className="button primary"
                      type="button"
                      onClick={() => void handleSaveLeadQuickFields()}
                      disabled={isLeadSaving}
                    >
                      {isLeadSaving ? "Сохраняем..." : "Сохранить поля лида"}
                    </button>
                  </div>
                </div>

                <div className="overview-edit-box">
                  <div className="panel-head">
                    <h3 className="subheading">Основные данные лида</h3>
                    <span className="muted">Компания и контактная информация</span>
                  </div>

                  {leadProfileError ? <p className="error">{leadProfileError}</p> : null}

                  <div className="lead-profile-grid">
                    <label className="field">
                      <span>Компания</span>
                      <input
                        type="text"
                        value={leadProfileForm.companyName}
                        onChange={(event) =>
                          setLeadProfileForm((prev) => ({
                            ...prev,
                            companyName: event.target.value
                          }))
                        }
                      />
                    </label>
                    <label className="field">
                      <span>Контакт</span>
                      <input
                        type="text"
                        value={leadProfileForm.mainContactName}
                        onChange={(event) =>
                          setLeadProfileForm((prev) => ({
                            ...prev,
                            mainContactName: event.target.value
                          }))
                        }
                      />
                    </label>
                    <label className="field">
                      <span>Email</span>
                      <input
                        type="email"
                        value={leadProfileForm.mainContactEmail}
                        onChange={(event) =>
                          setLeadProfileForm((prev) => ({
                            ...prev,
                            mainContactEmail: event.target.value
                          }))
                        }
                      />
                    </label>
                    <label className="field">
                      <span>Телефон</span>
                      <input
                        type="text"
                        value={leadProfileForm.mainContactPhone}
                        onChange={(event) =>
                          setLeadProfileForm((prev) => ({
                            ...prev,
                            mainContactPhone: event.target.value
                          }))
                        }
                      />
                    </label>
                    <label className="field field-wide">
                      <span>Сайт</span>
                      <input
                        type="url"
                        value={leadProfileForm.websiteUrl}
                        onChange={(event) =>
                          setLeadProfileForm((prev) => ({
                            ...prev,
                            websiteUrl: event.target.value
                          }))
                        }
                      />
                    </label>
                  </div>

                  <div className="inline-actions">
                    <button
                      className="button secondary"
                      type="button"
                      onClick={() => void handleSaveLeadProfile()}
                      disabled={isLeadProfileSaving}
                    >
                      {isLeadProfileSaving ? "Сохраняем..." : "Сохранить основные данные"}
                    </button>
                  </div>
                </div>

                <div className="lead-info-grid">
                  <div className="info-item">
                    <span>Компания</span>
                    <strong>{leadDetails.companyName}</strong>
                  </div>
                  <div className="info-item">
                    <span>Этап</span>
                    <strong>{leadDetails.stage.name}</strong>
                  </div>
                  <div className="info-item">
                    <span>Ответственный</span>
                    <strong>{leadDetails.owner?.fullName ?? "Не назначен"}</strong>
                  </div>
                  <div className="info-item">
                    <span>Контакт</span>
                    <strong>{leadDetails.mainContactName}</strong>
                  </div>
                  <div className="info-item">
                    <span>Email</span>
                    <strong>{leadDetails.mainContactEmail ?? "Не указан"}</strong>
                  </div>
                  <div className="info-item">
                    <span>Телефон</span>
                    <strong>{leadDetails.mainContactPhone ?? "Не указан"}</strong>
                  </div>
                  <div className="info-item">
                    <span>Источник</span>
                    <strong>{leadDetails.source?.name ?? "Не указан"}</strong>
                  </div>
                  <div className="info-item">
                    <span>Сайт</span>
                    <strong>{leadDetails.websiteUrl ?? "Не указан"}</strong>
                  </div>
                  <div className="info-item">
                    <span>Следующий follow-up</span>
                    <strong>{formatDateTime(leadDetails.nextFollowUpAt)}</strong>
                  </div>
                  <div className="info-item">
                    <span>Первый контакт</span>
                    <strong>{formatDateTime(leadDetails.firstContactAt)}</strong>
                  </div>
                  <div className="info-item">
                    <span>Приоритет</span>
                    <strong>{leadPriorityLabels[leadDetails.priority]}</strong>
                  </div>
                  <div className="info-item">
                    <span>Статус</span>
                    <strong>{formatLeadStatus(leadDetails.status)}</strong>
                  </div>
                  <div className="info-item">
                    <span>Создан</span>
                    <strong>{formatDateTime(leadDetails.createdAt)}</strong>
                  </div>
                </div>

                <h3 className="subheading">История этапов</h3>

                <ul className="history-list">
                  {leadHistory.map((entry) => (
                    <li key={entry.id} className="history-item">
                      <div>
                        <strong>
                          {entry.fromStage?.name ?? "Создание"} → {entry.toStage.name}
                        </strong>
                        <p className="muted">
                          {entry.changedByUser.fullName} · {formatDateTime(entry.changedAt)}
                        </p>
                        {entry.comment ? <p className="muted">Комментарий: {entry.comment}</p> : null}
                      </div>
                    </li>
                  ))}
                  {leadHistory.length === 0 ? <li className="empty">История этапов пока пустая.</li> : null}
                </ul>
              </>
            ) : null}

            {activeLeadTab === "brief" ? (
              <>
                <div className="tab-header-row">
                  <p className="muted">
                    {leadBrief?.completedAt
                      ? `Бриф завершен: ${formatDateTime(leadBrief.completedAt)}`
                      : "Заполните или обновите бриф прямо в карточке лида."}
                  </p>
                </div>

                {briefSaveError ? <p className="error">{briefSaveError}</p> : null}

                <div className="brief-form-grid">
                  <label className="field">
                    <span>Бизнес-модель</span>
                    <input
                      type="text"
                      value={briefForm.businessModel}
                      onChange={(event) =>
                        setBriefForm((prev) => ({
                          ...prev,
                          businessModel: event.target.value
                        }))
                      }
                    />
                  </label>

                  <label className="field">
                    <span>Целевая аудитория</span>
                    <input
                      type="text"
                      value={briefForm.targetAudience}
                      onChange={(event) =>
                        setBriefForm((prev) => ({
                          ...prev,
                          targetAudience: event.target.value
                        }))
                      }
                    />
                  </label>

                  <label className="field">
                    <span>Основной KPI</span>
                    <input
                      type="text"
                      value={briefForm.mainKpi}
                      onChange={(event) =>
                        setBriefForm((prev) => ({
                          ...prev,
                          mainKpi: event.target.value
                        }))
                      }
                    />
                  </label>

                  <label className="field">
                    <span>Целевое значение KPI</span>
                    <input
                      type="text"
                      value={briefForm.kpiTarget}
                      onChange={(event) =>
                        setBriefForm((prev) => ({
                          ...prev,
                          kpiTarget: event.target.value
                        }))
                      }
                    />
                  </label>

                  <label className="field">
                    <span>Ожидаемая дата старта</span>
                    <input
                      type="datetime-local"
                      value={briefForm.expectedStartDate}
                      onChange={(event) =>
                        setBriefForm((prev) => ({
                          ...prev,
                          expectedStartDate: event.target.value
                        }))
                      }
                    />
                  </label>

                  <label className="field">
                    <span>Конкуренты</span>
                    <input
                      type="text"
                      value={briefForm.competitors}
                      onChange={(event) =>
                        setBriefForm((prev) => ({
                          ...prev,
                          competitors: event.target.value
                        }))
                      }
                    />
                  </label>

                  <label className="field field-wide">
                    <span>Процесс принятия решения</span>
                    <textarea
                      rows={3}
                      value={briefForm.decisionProcess}
                      onChange={(event) =>
                        setBriefForm((prev) => ({
                          ...prev,
                          decisionProcess: event.target.value
                        }))
                      }
                    />
                  </label>

                  <label className="field field-wide">
                    <span>Примечания</span>
                    <textarea
                      rows={4}
                      value={briefForm.notes}
                      onChange={(event) =>
                        setBriefForm((prev) => ({
                          ...prev,
                          notes: event.target.value
                        }))
                      }
                    />
                  </label>
                </div>

                <div className="inline-actions">
                  <button className="button primary" type="button" onClick={() => void handleSaveBrief()} disabled={isBriefSaving}>
                    {isBriefSaving ? "Сохраняем..." : leadBrief ? "Сохранить изменения" : "Создать бриф"}
                  </button>
                </div>

                {leadBrief ? (
                  <div className="complete-brief-box">
                    <label className="field field-wide">
                      <span>Комментарий при завершении брифа</span>
                      <textarea
                        rows={2}
                        value={briefCompleteNote}
                        onChange={(event) => setBriefCompleteNote(event.target.value)}
                        placeholder="Например: согласован с клиентом"
                      />
                    </label>
                    <button
                      className="button secondary"
                      type="button"
                      onClick={() => void handleCompleteBrief()}
                      disabled={isBriefSaving || Boolean(leadBrief.completedAt)}
                    >
                      {leadBrief.completedAt ? "Бриф уже завершен" : "Завершить бриф"}
                    </button>
                  </div>
                ) : null}
              </>
            ) : null}

            {activeLeadTab === "deals" ? (
              <>
                {leadDeals.length === 0 ? <p className="empty">По этому лиду пока нет сделок.</p> : null}
                <ul className="stack">
                  {leadDeals.map((deal) => (
                    <li key={deal.id} className="row-item deal-row">
                      <div>
                        <strong>Сделка #{deal.id}</strong>
                        <p className="muted">
                          Статус: {formatDealStatus(deal.status)} · Вероятность: {deal.probability}% · Владелец:{" "}
                          {deal.owner?.fullName ?? "Не назначен"}
                        </p>
                        <p className="muted">
                          Сумма: {formatMoneyValue(deal.amount, deal.currency)} · План закрытия: {formatDateTime(deal.closeDatePlan)}
                        </p>
                        {deal.lostReason ? <p className="muted">Причина потери: {deal.lostReason.name}</p> : null}

                        <div className="proposal-stack">
                          <strong>Коммерческие предложения</strong>
                          {deal.proposals.length === 0 ? <p className="muted small">КП еще не отправлялись.</p> : null}
                          {deal.proposals.map((proposal) => (
                            <div key={proposal.id} className="proposal-item">
                              <a href={proposal.proposalUrl} target="_blank" rel="noreferrer">
                                КП v{proposal.version}
                              </a>
                              <span className="muted small">{formatMoneyValue(proposal.totalAmount, deal.currency)}</span>
                              <span className="muted small">Отправлено: {formatDateTime(proposal.sentAt ?? proposal.createdAt)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="row-side">
                        <span className={`badge ${deal.status === "WON" ? "lead-won" : deal.status === "LOST" ? "lead-lost" : "lead-open"}`}>
                          {formatDealStatus(deal.status)}
                        </span>
                        <span className="muted small">Создана: {formatDateTime(deal.createdAt)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}

            {activeLeadTab === "activities" ? (
              <>
                {leadActivity.length === 0 ? <p className="empty">Активности по лиду пока отсутствуют.</p> : null}
                <ul className="history-list">
                  {leadActivity.map((activity) => (
                    <li key={activity.id} className="history-item">
                      <div className="activity-head">
                        <span className={`badge neutral`}>{activity.type}</span>
                        <span className="muted small">{formatDateTime(activity.at)}</span>
                      </div>
                      <strong>{activity.title}</strong>
                      <p className="muted">{activity.description}</p>
                    </li>
                  ))}
                </ul>

                <h3 className="subheading">Задачи по лиду</h3>
                <ul className="stack">
                  {leadTasks.map((task) => (
                    <li key={task.id} className="row-item">
                      <div>
                        <strong>{task.title}</strong>
                        <p className="muted">
                          Тип: {task.type} · Приоритет: {taskPriorityLabels[task.priority]} · Исполнитель: {task.assignee.fullName}
                        </p>
                        {task.description ? <p className="muted">{task.description}</p> : null}
                      </div>
                      <div className="row-side">
                        <span className={`badge task-${task.status.toLowerCase()}`}>{taskStatusLabels[task.status]}</span>
                        <span className="muted small">Срок: {formatDateTime(task.dueAt)}</span>
                        <div className="row-actions">
                          <button className="button ghost button-compact" type="button" onClick={() => handleOpenTaskEdit(task)}>
                            Изменить
                          </button>
                          {task.status !== "DONE" ? (
                            <button
                              className="button secondary button-compact"
                              type="button"
                              disabled={isTaskEditing}
                              onClick={() => void handleCompleteTask(task.id, task.lead?.id ?? null)}
                            >
                              Завершить
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </li>
                  ))}
                  {leadTasks.length === 0 ? <li className="empty">По лиду нет задач.</li> : null}
                </ul>
              </>
            ) : null}
          </>
        ) : null}
      </section>

      <section className="content-grid">
        <article className="panel">
          <div className="panel-head panel-head-wrap">
            <div>
              <h2>Задачи</h2>
              <p className="muted compact-muted">На странице: {dashboardData?.tasks.length ?? 0}</p>
            </div>
            <button className="button secondary" type="button" onClick={() => setIsTaskCreateOpen((prev) => !prev)}>
              {isTaskCreateOpen ? "Скрыть форму задачи" : "Новая задача"}
            </button>
          </div>

          {taskCreateError ? <p className="error">{taskCreateError}</p> : null}

          {isTaskCreateOpen ? (
            <div className="inline-form-box">
              <div className="quick-form-grid">
                <label className="field">
                  <span>Лид</span>
                  <select
                    value={taskCreateForm.leadId}
                    onChange={(event) =>
                      setTaskCreateForm((prev) => ({
                        ...prev,
                        leadId: event.target.value
                      }))
                    }
                  >
                    <option value="">Выберите лид</option>
                    {(dashboardData?.leads ?? []).map((lead) => (
                      <option key={lead.id} value={String(lead.id)}>
                        #{lead.id} · {lead.companyName}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Название задачи</span>
                  <input
                    type="text"
                    value={taskCreateForm.title}
                    onChange={(event) =>
                      setTaskCreateForm((prev) => ({
                        ...prev,
                        title: event.target.value
                      }))
                    }
                  />
                </label>
                <label className="field">
                  <span>Тип</span>
                  <select
                    value={taskCreateForm.type}
                    onChange={(event) =>
                      setTaskCreateForm((prev) => ({
                        ...prev,
                        type: event.target.value as TaskCreateFormState["type"]
                      }))
                    }
                  >
                    <option value="FOLLOW_UP">Follow-up</option>
                    <option value="CALL">Звонок</option>
                    <option value="EMAIL">Email</option>
                    <option value="MEETING">Встреча</option>
                    <option value="CUSTOM">Другое</option>
                  </select>
                </label>
                <label className="field">
                  <span>Приоритет</span>
                  <select
                    value={taskCreateForm.priority}
                    onChange={(event) =>
                      setTaskCreateForm((prev) => ({
                        ...prev,
                        priority: event.target.value as TaskCreateFormState["priority"]
                      }))
                    }
                  >
                    <option value="LOW">Низкий</option>
                    <option value="MEDIUM">Средний</option>
                    <option value="HIGH">Высокий</option>
                  </select>
                </label>
                <label className="field">
                  <span>Срок</span>
                  <input
                    type="datetime-local"
                    value={taskCreateForm.dueAt}
                    onChange={(event) =>
                      setTaskCreateForm((prev) => ({
                        ...prev,
                        dueAt: event.target.value
                      }))
                    }
                  />
                </label>
                <label className="field field-wide">
                  <span>Описание</span>
                  <textarea
                    rows={3}
                    value={taskCreateForm.description}
                    onChange={(event) =>
                      setTaskCreateForm((prev) => ({
                        ...prev,
                        description: event.target.value
                      }))
                    }
                  />
                </label>
              </div>
              <div className="inline-actions">
                <button className="button primary" type="button" onClick={() => void handleCreateTask()} disabled={isTaskCreating}>
                  {isTaskCreating ? "Создаем..." : "Создать задачу"}
                </button>
              </div>
            </div>
          ) : null}

          {taskEditForm ? (
            <div className="inline-form-box">
              <div className="panel-head">
                <h3 className="subheading">Редактирование задачи #{taskEditForm.id}</h3>
                <button className="button ghost button-compact" type="button" onClick={() => setTaskEditForm(null)}>
                  Закрыть
                </button>
              </div>
              {taskEditError ? <p className="error">{taskEditError}</p> : null}
              <div className="quick-form-grid">
                <label className="field">
                  <span>Название</span>
                  <input
                    type="text"
                    value={taskEditForm.title}
                    onChange={(event) =>
                      setTaskEditForm((prev) =>
                        prev
                          ? {
                              ...prev,
                              title: event.target.value
                            }
                          : prev
                      )
                    }
                  />
                </label>
                <label className="field">
                  <span>Статус</span>
                  <select
                    value={taskEditForm.status}
                    onChange={(event) =>
                      setTaskEditForm((prev) =>
                        prev
                          ? {
                              ...prev,
                              status: event.target.value as TaskEditFormState["status"]
                            }
                          : prev
                      )
                    }
                  >
                    <option value="TODO">К выполнению</option>
                    <option value="IN_PROGRESS">В работе</option>
                    <option value="DONE">Готово</option>
                    <option value="CANCELED">Отменено</option>
                  </select>
                </label>
                <label className="field">
                  <span>Тип</span>
                  <select
                    value={taskEditForm.type}
                    onChange={(event) =>
                      setTaskEditForm((prev) =>
                        prev
                          ? {
                              ...prev,
                              type: event.target.value as TaskEditFormState["type"]
                            }
                          : prev
                      )
                    }
                  >
                    <option value="FOLLOW_UP">Follow-up</option>
                    <option value="CALL">Звонок</option>
                    <option value="EMAIL">Email</option>
                    <option value="MEETING">Встреча</option>
                    <option value="CUSTOM">Другое</option>
                  </select>
                </label>
                <label className="field">
                  <span>Приоритет</span>
                  <select
                    value={taskEditForm.priority}
                    onChange={(event) =>
                      setTaskEditForm((prev) =>
                        prev
                          ? {
                              ...prev,
                              priority: event.target.value as TaskEditFormState["priority"]
                            }
                          : prev
                      )
                    }
                  >
                    <option value="LOW">Низкий</option>
                    <option value="MEDIUM">Средний</option>
                    <option value="HIGH">Высокий</option>
                  </select>
                </label>
                <label className="field">
                  <span>Срок</span>
                  <input
                    type="datetime-local"
                    value={taskEditForm.dueAt}
                    onChange={(event) =>
                      setTaskEditForm((prev) =>
                        prev
                          ? {
                              ...prev,
                              dueAt: event.target.value
                            }
                          : prev
                      )
                    }
                  />
                </label>
                <label className="field field-wide">
                  <span>Описание</span>
                  <textarea
                    rows={3}
                    value={taskEditForm.description}
                    onChange={(event) =>
                      setTaskEditForm((prev) =>
                        prev
                          ? {
                              ...prev,
                              description: event.target.value
                            }
                          : prev
                      )
                    }
                  />
                </label>
              </div>
              <div className="inline-actions">
                <button className="button primary" type="button" onClick={() => void handleSaveTaskEdit()} disabled={isTaskEditing}>
                  {isTaskEditing ? "Сохраняем..." : "Сохранить задачу"}
                </button>
                {taskEditForm.status !== "DONE" ? (
                  <button
                    className="button secondary"
                    type="button"
                    onClick={() => void handleCompleteTask(taskEditForm.id, null)}
                    disabled={isTaskEditing}
                  >
                    Завершить задачу
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          <ul className="stack">
            {dashboardData?.tasks.map((task) => (
              <li key={task.id} className="row-item">
                <div>
                  <strong>{task.title}</strong>
                  <p className="muted">
                    Тип: {task.type} · Приоритет: {taskPriorityLabels[task.priority]}
                  </p>
                  <p className="muted">Лид: {task.lead?.companyName ?? "Без лида"}</p>
                  {task.description ? <p className="muted">{task.description}</p> : null}
                </div>
                <div className="row-side">
                  <span className={`badge task-${task.status.toLowerCase()}`}>{taskStatusLabels[task.status]}</span>
                  <span className="muted small">{formatDateTime(task.dueAt)}</span>
                  <div className="row-actions">
                    <button className="button ghost button-compact" type="button" onClick={() => handleOpenTaskEdit(task)}>
                      Изменить
                    </button>
                    {task.status !== "DONE" ? (
                      <button
                        className="button secondary button-compact"
                        type="button"
                        disabled={isTaskEditing}
                        onClick={() => void handleCompleteTask(task.id, task.lead?.id ?? null)}
                      >
                        Завершить
                      </button>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
            {!dashboardData?.tasks.length ? <li className="empty">Задач пока нет.</li> : null}
          </ul>
        </article>

        <article className="panel">
          <div className="panel-head">
            <h2>Эффективность менеджеров</h2>
            <span className="muted">Топ по сумме выигранных сделок</span>
          </div>

          {dashboardData?.managerReport ? (
            <ul className="stack">
              {dashboardData.managerReport.items.slice(0, 5).map((item) => (
                <li key={item.manager.userId} className="row-item">
                  <div>
                    <strong>{item.manager.fullName}</strong>
                    <p className="muted">Просрочено задач: {item.tasks.overdue}</p>
                  </div>
                  <div className="row-side">
                    <span className="badge neutral">{item.deals.won} побед</span>
                    <span className="muted small">{formatAmount(item.deals.wonAmount)}</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty">Для вашей роли этот отчет недоступен.</p>
          )}
        </article>
      </section>

      <section className="content-grid">
        <article className="panel">
          <div className="panel-head">
            <h2>Воронка (30 дней)</h2>
            <span className="muted">
              Средний первый ответ:{" "}
              {dashboardData?.funnelReport?.summary.avgFirstResponseMinutes != null
                ? `${dashboardData.funnelReport.summary.avgFirstResponseMinutes} мин`
                : "нет данных"}
            </span>
          </div>

          {dashboardData?.funnelReport ? (
            <ul className="stack">
              {dashboardData.funnelReport.stages.map((stage) => (
                <li key={stage.stageId} className="row-item">
                  <strong>{stage.stageName}</strong>
                  <span className="badge neutral">{stage.count}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty">Отчеты доступны только ролям admin/head.</p>
          )}
        </article>

        <article className="panel automation-panel">
          <div className="panel-head">
            <h2>Автоматизации</h2>
            <span className="muted">Активных правил: {activeAutomationRulesTotal}</span>
          </div>

          {hasAutomationAccess ? (
            <>
              <ul className="automation-rules-list">
                {(dashboardData?.automationRules ?? []).map((rule) => (
                  <li key={rule.id} className="automation-rule-item">
                    <div className="automation-rule-head">
                      <strong>{rule.name}</strong>
                      <span className={`badge ${rule.isActive ? "auto-executed" : "auto-skipped"}`}>
                        {rule.isActive ? "Активно" : "Отключено"}
                      </span>
                    </div>
                    <p className="muted small">{rule.description}</p>
                    <p className="muted small">
                      Событие: {formatAutomationEvent(rule.trigger.event)} · Действий: {rule.actions.length}
                    </p>
                  </li>
                ))}
                {(dashboardData?.automationRules ?? []).length === 0 ? <li className="empty">Правила пока не настроены.</li> : null}
              </ul>

              <h3 className="subheading">Ручной запуск события</h3>

              <div className="automation-runner">
                <div className="quick-form-grid">
                  <label className="field">
                    <span>Событие</span>
                    <select
                      value={automationEvent}
                      onChange={(event) => {
                        setAutomationEvent(event.target.value as AutomationEventCode);
                        setAutomationRunError(null);
                        setAutomationRunResult(null);
                      }}
                    >
                      <option value="lead.stage_changed">{formatAutomationEvent("lead.stage_changed")}</option>
                      <option value="lead.brief_completed">{formatAutomationEvent("lead.brief_completed")}</option>
                      <option value="deal.closed_won">{formatAutomationEvent("deal.closed_won")}</option>
                      <option value="deal.closed_lost">{formatAutomationEvent("deal.closed_lost")}</option>
                      <option value="lead.created">{formatAutomationEvent("lead.created")}</option>
                    </select>
                  </label>

                  <label className="field">
                    <span>ID лида</span>
                    <input
                      type="number"
                      min={1}
                      value={automationLeadId}
                      onChange={(event) => setAutomationLeadId(event.target.value)}
                      placeholder="например, 1"
                    />
                  </label>

                  <label className="field">
                    <span>ID сделки</span>
                    <input
                      type="number"
                      min={1}
                      value={automationDealId}
                      onChange={(event) => setAutomationDealId(event.target.value)}
                      placeholder="например, 3"
                    />
                  </label>

                  {automationEvent === "lead.stage_changed" ? (
                    <>
                      <label className="field">
                        <span>Код этапа до</span>
                        <input
                          type="text"
                          value={automationFromStageCode}
                          onChange={(event) => setAutomationFromStageCode(event.target.value)}
                          placeholder="lead-in"
                        />
                      </label>
                      <label className="field">
                        <span>Код этапа после</span>
                        <input
                          type="text"
                          value={automationToStageCode}
                          onChange={(event) => setAutomationToStageCode(event.target.value)}
                          placeholder="negotiation"
                        />
                      </label>
                    </>
                  ) : null}

                  <label className="field">
                    <span>Код источника (опционально)</span>
                    <input
                      type="text"
                      value={automationSourceCode}
                      onChange={(event) => setAutomationSourceCode(event.target.value)}
                      placeholder="manual"
                    />
                  </label>
                </div>

                <div className="inline-actions">
                  <button
                    className="button secondary"
                    type="button"
                    onClick={() => void handleRunAutomation()}
                    disabled={isAutomationRunning}
                  >
                    {isAutomationRunning ? "Запускаем..." : "Запустить событие"}
                  </button>
                </div>

                {automationRunError ? <p className="error">{automationRunError}</p> : null}

                {automationRunResult ? (
                  <div className="automation-run-result">
                    <p className="success">
                      Событие "{formatAutomationEvent(automationRunResult.event)}": правил {automationRunResult.matchedRules}, выполнено{" "}
                      {automationRunResult.executedActions}, пропущено {automationRunResult.skippedActions}, ошибок{" "}
                      {automationRunResult.failedActions}.
                    </p>
                    <ul className="history-list">
                      {automationRunResult.actionResults.map((result, index) => (
                        <li key={`${result.ruleId}-${result.actionType}-${index}`} className="history-item">
                          <div className="automation-result-head">
                            <span
                              className={`badge ${
                                result.status === "executed"
                                  ? "auto-executed"
                                  : result.status === "skipped"
                                    ? "auto-skipped"
                                    : "auto-failed"
                              }`}
                            >
                              {formatAutomationResultStatus(result.status)}
                            </span>
                            <span className="muted small">{result.ruleId}</span>
                          </div>
                          <strong>{formatAutomationAction(result.actionType)}</strong>
                          <p className="muted">{result.message}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </>
          ) : (
            <p className="empty">Этот блок доступен только ролям admin/head.</p>
          )}
        </article>

        <article className="panel">
          <div className="panel-head">
            <h2>Быстрые подсказки</h2>
            <span className="muted">Работа с канбаном и карточкой 360</span>
          </div>

          <ul className="stack">
            <li className="row-item">
              <div>
                <strong>Перетаскивание лида</strong>
                <p className="muted">Зажмите карточку и перенесите ее в колонку нужного этапа.</p>
              </div>
            </li>
            <li className="row-item">
              <div>
                <strong>Валидация этапа</strong>
                <p className="muted">Если не заполнены обязательные поля, CRM покажет причину прямо над доской.</p>
              </div>
            </li>
            <li className="row-item">
              <div>
                <strong>Карточка 360</strong>
                <p className="muted">Во вкладках карточки собраны бриф, сделки, КП и активности по лиду.</p>
              </div>
            </li>
          </ul>
        </article>
      </section>
    </main>
  );
}
