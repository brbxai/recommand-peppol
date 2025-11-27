import { Cron } from "croner";
import { Logger } from "@recommand/lib/logger";
import { executeCronJob } from "./index";

export function initializeIntegrationCronJobs(logger: Logger): void {
  if (process.env.RUN_CRON !== "true") {
    return;
  }

  logger.info("Initializing integration cron jobs");

  new Cron("*/5 * * * *", {
    name: "integration.cron.short",
  }, async () => {
    logger.info("Executing integration.cron.short");
    await executeCronJob("integration.cron.short");
  });

  new Cron("0 */6 * * *", {
    name: "integration.cron.medium",
  }, async () => {
    logger.info("Executing integration.cron.medium");
    await executeCronJob("integration.cron.medium");
  });

  new Cron("0 0 * * *", {
    name: "integration.cron.long",
  }, async () => {
    logger.info("Executing integration.cron.long");
    await executeCronJob("integration.cron.long");
  });

  logger.info("Integration cron jobs initialized");

  logger.info("Running integration.cron.short immediately");
  executeCronJob("integration.cron.short").catch((error) => {
    logger.error(`Failed to run integration.cron.short immediately: ${error instanceof Error ? error.message : String(error)}`);
  });
}

