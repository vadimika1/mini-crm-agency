import type { FastifyInstance } from "fastify";
import { SlaService } from "./service.js";

type SlaSchedulerOptions = {
  enabled: boolean;
  intervalMinutes: number;
  actorUserId: number;
  runOnStart: boolean;
};

export function startSlaScheduler(app: FastifyInstance, options: SlaSchedulerOptions) {
  if (!options.enabled) {
    app.log.info("SLA-планировщик отключен (SLA_AUTORUN_ENABLED=false)");
    return;
  }

  const service = new SlaService(app);
  let inProgress = false;

  const run = async (trigger: "startup" | "interval") => {
    if (inProgress) {
      app.log.warn({ trigger }, "SLA-проверка пропущена: предыдущий запуск еще выполняется");
      return;
    }

    inProgress = true;
    try {
      const result = await service.runSlaCheck(options.actorUserId);
      app.log.info({ trigger, result }, "SLA-проверка выполнена");
    } catch (error) {
      app.log.error(error, "Ошибка SLA-проверки по расписанию");
    } finally {
      inProgress = false;
    }
  };

  if (options.runOnStart) {
    void run("startup");
  }

  const intervalMs = options.intervalMinutes * 60 * 1000;
  const timer = setInterval(() => {
    void run("interval");
  }, intervalMs);

  app.addHook("onClose", (_instance, done) => {
    clearInterval(timer);
    done();
  });

  app.log.info(
    {
      intervalMinutes: options.intervalMinutes,
      actorUserId: options.actorUserId,
      runOnStart: options.runOnStart
    },
    "SLA-планировщик запущен"
  );
}
