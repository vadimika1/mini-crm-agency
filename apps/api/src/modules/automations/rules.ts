import { LeadPriority, TaskPriority, TaskType } from "@prisma/client";

export type AutomationAction =
  | {
      type: "create_task";
      payload: {
        assignee: "lead_owner" | "deal_owner" | "actor";
        taskType: TaskType;
        priority: TaskPriority;
        title: string;
        description?: string;
        dueInMinutes?: number;
      };
    }
  | {
      type: "update_lead_priority";
      payload: {
        priority: LeadPriority;
      };
    }
  | {
      type: "set_next_follow_up";
      payload: {
        inMinutes: number;
      };
    };

export type AutomationRule = {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  trigger: {
    event:
      | "lead.stage_changed"
      | "lead.brief_completed"
      | "deal.closed_won"
      | "deal.closed_lost"
      | "lead.created";
  };
  conditions?: {
    fromStageCodeIn?: string[];
    toStageCodeIn?: string[];
    leadStatusIn?: Array<"OPEN" | "WON" | "LOST">;
    dealStatusIn?: Array<"OPEN" | "WON" | "LOST">;
    sourceCodeIn?: string[];
  };
  actions: AutomationAction[];
};

export const defaultAutomationRules: AutomationRule[] = [
  {
    id: "first-touch-for-inbound-lead",
    name: "Первичный контакт для входящего лида",
    description: "Для лидов с сайта/Telegram/Meta ставит срочную задачу первичного контакта и follow-up.",
    isActive: true,
    trigger: {
      event: "lead.created"
    },
    conditions: {
      sourceCodeIn: ["site-form", "telegram", "meta-leads"]
    },
    actions: [
      {
        type: "create_task",
        payload: {
          assignee: "lead_owner",
          taskType: "CALL",
          priority: "HIGH",
          title: "Авто: первичный контакт ({{lead.companyName}})",
          description: "Свяжитесь с лидом в течение 30 минут после входящей заявки.",
          dueInMinutes: 30
        }
      },
      {
        type: "set_next_follow_up",
        payload: {
          inMinutes: 1440
        }
      }
    ]
  },
  {
    id: "priority-up-on-negotiation",
    name: "Повысить приоритет на этапе переговоров",
    description: "Если лид переходит в этап negotiation, приоритет повышается до HIGH.",
    isActive: true,
    trigger: {
      event: "lead.stage_changed"
    },
    conditions: {
      toStageCodeIn: ["negotiation"]
    },
    actions: [
      {
        type: "update_lead_priority",
        payload: {
          priority: "HIGH"
        }
      }
    ]
  },
  {
    id: "follow-up-after-proposal-sent",
    name: "Follow-up после отправки КП",
    description: "При переходе на этап proposal-sent ставит follow-up на 24 часа и задачу связаться с клиентом.",
    isActive: true,
    trigger: {
      event: "lead.stage_changed"
    },
    conditions: {
      toStageCodeIn: ["proposal-sent"]
    },
    actions: [
      {
        type: "set_next_follow_up",
        payload: {
          inMinutes: 1440
        }
      },
      {
        type: "create_task",
        payload: {
          assignee: "lead_owner",
          taskType: "FOLLOW_UP",
          priority: "HIGH",
          title: "Авто: follow-up по КП ({{lead.companyName}})",
          description: "Свяжитесь с клиентом и уточните обратную связь по отправленному КП.",
          dueInMinutes: 1440
        }
      }
    ]
  },
  {
    id: "contract-check-after-stage-change",
    name: "Контроль договора на этапе ожидания",
    description: "На этапе contract-pending создает задачу контроля подписания и ставит ближайший follow-up.",
    isActive: true,
    trigger: {
      event: "lead.stage_changed"
    },
    conditions: {
      toStageCodeIn: ["contract-pending"]
    },
    actions: [
      {
        type: "set_next_follow_up",
        payload: {
          inMinutes: 720
        }
      },
      {
        type: "create_task",
        payload: {
          assignee: "lead_owner",
          taskType: "CUSTOM",
          priority: "HIGH",
          title: "Авто: контроль договора ({{lead.companyName}})",
          description: "Проверьте статус подписания договора и согласуйте дату старта работ.",
          dueInMinutes: 720
        }
      }
    ]
  },
  {
    id: "follow-up-after-brief-complete",
    name: "Follow-up после завершения брифа",
    description: "Создает задачу follow-up на владельца лида после завершения брифа.",
    isActive: true,
    trigger: {
      event: "lead.brief_completed"
    },
    actions: [
      {
        type: "create_task",
        payload: {
          assignee: "lead_owner",
          taskType: "FOLLOW_UP",
          priority: "MEDIUM",
          title: "Авто: follow-up после брифа ({{lead.companyName}})",
          description: "Провести follow-up с клиентом после завершения брифа.",
          dueInMinutes: 120
        }
      }
    ]
  },
  {
    id: "handoff-after-deal-won",
    name: "Передача клиента после выигрыша сделки",
    description: "Создает задачу передачи клиента в аккаунтинг при закрытии сделки в WON.",
    isActive: true,
    trigger: {
      event: "deal.closed_won"
    },
    conditions: {
      dealStatusIn: ["WON"]
    },
    actions: [
      {
        type: "create_task",
        payload: {
          assignee: "lead_owner",
          taskType: "CUSTOM",
          priority: "HIGH",
          title: "Авто: передача в аккаунтинг (сделка #{{deal.id}})",
          description: "Передайте клиента в реализацию и согласуйте старт работ.",
          dueInMinutes: 240
        }
      }
    ]
  },
  {
    id: "winback-after-deal-lost",
    name: "Win-back задача после потери сделки",
    description: "Создает задачу анализа потери и потенциального возврата клиента.",
    isActive: true,
    trigger: {
      event: "deal.closed_lost"
    },
    conditions: {
      dealStatusIn: ["LOST"]
    },
    actions: [
      {
        type: "create_task",
        payload: {
          assignee: "lead_owner",
          taskType: "CUSTOM",
          priority: "MEDIUM",
          title: "Авто: win-back план ({{lead.companyName}})",
          description: "Подготовьте план повторного касания и предложения для возврата клиента.",
          dueInMinutes: 1440
        }
      }
    ]
  }
];
