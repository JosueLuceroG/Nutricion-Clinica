import cron from "node-cron";
import type { ScheduledTask } from "node-cron";
import { readDwhConfig } from "./config.js";
import { runAllPipelines } from "./etl/engine.js";

/**
 * Scheduler ETL DWH (Build 08): node-cron, sin Airflow.
 * Activado solo con DWH_SCHEDULED_LOAD_ENABLED=true.
 * El lock por pipeline evita solapamientos; el reinicio es seguro.
 */

let scheduledTask: ScheduledTask | null = null;
let activeLoad: Promise<void> | null = null;

export function startDwhScheduler(): ScheduledTask | null {
  if (scheduledTask) return scheduledTask;
  const config = readDwhConfig();
  if (
    !config.enabled ||
    config.store !== "sql" ||
    !config.scheduledLoadEnabled
  ) {
    console.log(
      "[dwh] scheduler disabled (requires DWH_ENABLED=true, DWH_STORE=sql and DWH_SCHEDULED_LOAD_ENABLED=true)",
    );
    return null;
  }
  if (!cron.validate(config.cronSchedule)) {
    throw new Error(`DWH_CRON_SCHEDULE invalido: '${config.cronSchedule}'`);
  }
  console.log(`[dwh] scheduling ETL cron: "${config.cronSchedule}"`);
  scheduledTask = cron.schedule(
    config.cronSchedule,
    async () => {
      const run = (async () => {
        try {
          const results = await runAllPipelines();
          const failed = results.filter((r) => r.status !== "succeeded");
          console.log(
            `[dwh] scheduled load done: ${results.length} pipelines, ${failed.length} failed`,
          );
          for (const f of failed) {
            console.error(
              `[dwh] pipeline failed: ${f.pipelineId} (${f.status})`,
            );
          }
        } catch (err) {
          console.error(
            "[dwh] scheduled load error:",
            err instanceof Error ? err.name : "UnknownEtlError",
          );
        }
      })();
      activeLoad = run;
      try {
        await run;
      } finally {
        if (activeLoad === run) activeLoad = null;
      }
    },
    { noOverlap: true, timezone: config.cronTimezone },
  );
  return scheduledTask;
}

export async function stopDwhScheduler(): Promise<void> {
  scheduledTask?.destroy();
  scheduledTask = null;
  await (activeLoad ?? Promise.resolve());
}
