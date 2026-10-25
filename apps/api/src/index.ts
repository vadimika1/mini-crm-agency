import { env } from "./config/env.js";
import { startSlaScheduler } from "./modules/sla/scheduler.js";
import { buildServer } from "./server.js";

async function start() {
  const app = await buildServer();

  startSlaScheduler(app, {
    enabled: env.SLA_AUTORUN_ENABLED,
    intervalMinutes: env.SLA_AUTORUN_INTERVAL_MINUTES,
    actorUserId: env.SLA_AUTORUN_ACTOR_USER_ID,
    runOnStart: env.SLA_AUTORUN_RUN_ON_START
  });

  try {
    await app.listen({
      port: env.PORT,
      host: "0.0.0.0"
    });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }

  const shutdown = async (signal: NodeJS.Signals) => {
    app.log.info({ signal }, "Получен сигнал завершения, останавливаем API");

    try {
      await app.close();
      process.exit(0);
    } catch (error) {
      app.log.error(error, "Ошибка при остановке API");
      process.exit(1);
    }
  };

  process.once("SIGINT", () => {
    void shutdown("SIGINT");
  });

  process.once("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
}

void start();
