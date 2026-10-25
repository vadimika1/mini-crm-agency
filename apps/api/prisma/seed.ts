import bcrypt from "bcryptjs";
import { PrismaClient, StageOutcome } from "@prisma/client";

const prisma = new PrismaClient();

async function upsertRole(code: string, name: string) {
  return prisma.role.upsert({
    where: { code },
    update: { name },
    create: { code, name }
  });
}

async function main() {
  const roles = await Promise.all([
    upsertRole("admin", "Администратор"),
    upsertRole("head", "Руководитель продаж"),
    upsertRole("manager", "Менеджер по продажам"),
    upsertRole("account", "Аккаунт-стратег"),
    upsertRole("viewer", "Наблюдатель")
  ]);

  const adminPasswordHash = await bcrypt.hash("Admin123!", 12);
  const admin = await prisma.user.upsert({
    where: { email: "admin@crm.local" },
    update: {
      fullName: "Системный администратор",
      passwordHash: adminPasswordHash,
      isActive: true
    },
    create: {
      email: "admin@crm.local",
      fullName: "Системный администратор",
      passwordHash: adminPasswordHash,
      isActive: true
    }
  });

  const adminRole = roles.find((role) => role.code === "admin");
  if (!adminRole) {
    throw new Error("Не найдена роль admin после seed.");
  }

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: admin.id,
        roleId: adminRole.id
      }
    },
    update: {},
    create: {
      userId: admin.id,
      roleId: adminRole.id
    }
  });

  const pipeline = await prisma.pipeline.upsert({
    where: { code: "agency-sales" },
    update: { name: "Воронка продаж агентства", isDefault: true, isActive: true },
    create: {
      code: "agency-sales",
      name: "Воронка продаж агентства",
      isDefault: true,
      isActive: true
    }
  });

  const stageDefinitions: Array<{
    code: string;
    name: string;
    sortOrder: number;
    outcome: StageOutcome;
    requiredFields: string[];
  }> = [
    { code: "new", name: "Новый", sortOrder: 1, outcome: "OPEN", requiredFields: [] },
    {
      code: "first-contact",
      name: "Первичный контакт",
      sortOrder: 2,
      outcome: "OPEN",
      requiredFields: ["activity.first_contact_result"]
    },
    {
      code: "brief-requested",
      name: "Запрошен бриф",
      sortOrder: 3,
      outcome: "OPEN",
      requiredFields: ["next_follow_up_at"]
    },
    {
      code: "brief-completed",
      name: "Бриф заполнен",
      sortOrder: 4,
      outcome: "OPEN",
      requiredFields: ["brief.target_audience", "brief.main_kpi"]
    },
    {
      code: "audit-estimate",
      name: "Аудит / Оценка",
      sortOrder: 5,
      outcome: "OPEN",
      requiredFields: []
    },
    {
      code: "proposal-sent",
      name: "КП отправлено",
      sortOrder: 6,
      outcome: "OPEN",
      requiredFields: ["proposal.proposal_url", "deal.amount"]
    },
    {
      code: "negotiation",
      name: "Переговоры",
      sortOrder: 7,
      outcome: "OPEN",
      requiredFields: []
    },
    {
      code: "contract-pending",
      name: "Ожидание договора",
      sortOrder: 8,
      outcome: "OPEN",
      requiredFields: ["deal.start_date_plan"]
    },
    {
      code: "won",
      name: "Успешно",
      sortOrder: 9,
      outcome: "WON",
      requiredFields: ["deal.amount", "deal.close_date_fact"]
    },
    {
      code: "lost",
      name: "Потеряно",
      sortOrder: 10,
      outcome: "LOST",
      requiredFields: ["deal.lost_reason_id", "comment"]
    }
  ];

  for (const stageDef of stageDefinitions) {
    await prisma.stage.upsert({
      where: {
        pipelineId_code: {
          pipelineId: pipeline.id,
          code: stageDef.code
        }
      },
      update: {
        name: stageDef.name,
        sortOrder: stageDef.sortOrder,
        outcome: stageDef.outcome,
        requiredFields: stageDef.requiredFields,
        isActive: true
      },
      create: {
        pipelineId: pipeline.id,
        code: stageDef.code,
        name: stageDef.name,
        sortOrder: stageDef.sortOrder,
        outcome: stageDef.outcome,
        requiredFields: stageDef.requiredFields,
        isActive: true
      }
    });
  }

  const sourceDefinitions = [
    { code: "site-form", name: "Форма на сайте" },
    { code: "telegram", name: "Telegram" },
    { code: "referral", name: "Рекомендация" },
    { code: "manual", name: "Ручной ввод" },
    { code: "meta-leads", name: "Meta лиды" }
  ];

  for (const sourceDef of sourceDefinitions) {
    await prisma.source.upsert({
      where: { code: sourceDef.code },
      update: { name: sourceDef.name, isActive: true },
      create: {
        code: sourceDef.code,
        name: sourceDef.name,
        isActive: true
      }
    });
  }

  const lostReasonDefinitions = [
    { code: "price_too_high", name: "Слишком высокая цена" },
    { code: "no_budget", name: "Нет бюджета" },
    { code: "selected_competitor", name: "Выбрали конкурента" },
    { code: "scope_mismatch", name: "Не подходит scope работ" },
    { code: "no_response", name: "Нет ответа" }
  ];

  for (const reasonDef of lostReasonDefinitions) {
    await prisma.lostReason.upsert({
      where: { code: reasonDef.code },
      update: { name: reasonDef.name, isActive: true },
      create: {
        code: reasonDef.code,
        name: reasonDef.name,
        isActive: true
      }
    });
  }

  console.log("Seed выполнен успешно.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
