import cron, { type ScheduledTask } from "node-cron";
import {
  startDwhScheduler,
  stopDwhScheduler,
} from "../../modules/dwh/scheduler.js";
import { RETENTION_CONFIG, runRetentionCleanup } from "../retention/index.js";

export interface RuntimeJobsHandle {
  scheduledJobs: number;
  stop(): Promise<void>;
}

export function startRuntimeJobs(): RuntimeJobsHandle {
  let retentionTask: ScheduledTask | null = null;
  let activeRetention: Promise<void> | null = null;

  if (RETENTION_CONFIG.cleanupEnabled) {
    if (!cron.validate(RETENTION_CONFIG.cronSchedule)) {
      throw new Error(
        `RETENTION_CRON_SCHEDULE invalido: '${RETENTION_CONFIG.cronSchedule}'`,
      );
    }
    console.log(
      `[retention] scheduling cleanup cron: "${RETENTION_CONFIG.cronSchedule}"`,
    );
    retentionTask = cron.schedule(
      RETENTION_CONFIG.cronSchedule,
      async () => {
        const run = runRetentionCleanup().then((result) => {
          const message = `[retention] cleanup done: ${result.eligibleCount} eligible, ${result.deletedCount} deleted, dryRun=${result.dryRun}, ${result.errors.length} errors`;
          if (result.errors.length > 0) console.error(message);
          else console.log(message);
        });
        activeRetention = run;
        try {
          await run;
        } finally {
          if (activeRetention === run) activeRetention = null;
        }
      },
      { noOverlap: true, timezone: RETENTION_CONFIG.cronTimezone },
    );
  } else {
    console.log("[retention] cleanup disabled");
  }

  let dwhTask: ReturnType<typeof startDwhScheduler>;
  try {
    dwhTask = startDwhScheduler();
  } catch (error) {
    retentionTask?.destroy();
    retentionTask = null;
    throw error;
  }
  return {
    scheduledJobs: Number(retentionTask !== null) + Number(dwhTask !== null),
    async stop() {
      retentionTask?.destroy();
      retentionTask = null;
      await Promise.allSettled([
        activeRetention ?? Promise.resolve(),
        stopDwhScheduler(),
      ]);
    },
  };
}
