import "dotenv/config";
import { unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { closePool, getPool } from "./db/connection.js";
import { readDwhConfig } from "./modules/dwh/config.js";
import { closeDwhPool, getDwhPool } from "./modules/dwh/dwhConnection.js";
import { assertDwhSchemaCompatible } from "./modules/dwh/schema/dwhSchema.js";
import { readEnvironmentClass } from "./modules/deployment/environmentIdentity.js";
import { readServerRuntimeConfig } from "./modules/deployment/runtimeConfig.js";
import { assertStartupConfigValid } from "./modules/deployment/startupValidation.js";
import { RETENTION_CONFIG } from "./services/retention/retentionConfig.js";
import {
  startRuntimeJobs,
  type RuntimeJobsHandle,
} from "./services/jobs/runtimeJobs.js";
import { runStandalonePreflight } from "./modules/standalone/preflight.js";

const readyMarker = join(tmpdir(), "nutriclinica-jobs-ready");
let runtime: ReturnType<typeof readServerRuntimeConfig> | null = null;
let jobs: RuntimeJobsHandle | null = null;
let shuttingDown = false;

async function preflightDependencies(): Promise<void> {
  const environmentClass = readEnvironmentClass(process.env);
  if (process.env.STANDALONE_MODE === "true") {
    const report = await runStandalonePreflight(process.env, "runtime");
    if (!report.ok) {
      const failed = report.checks
        .filter((check) => check.status === "fail")
        .map((check) => check.id)
        .join(",");
      throw new Error(`standalone preflight failed: ${failed || "unknown"}`);
    }
    return;
  }
  if (environmentClass !== "STAGING" && environmentClass !== "PRODUCTION")
    return;

  if (RETENTION_CONFIG.cleanupEnabled) {
    const pool = await getPool();
    await pool.request().query("SELECT 1 AS ok");
  }

  const dwhConfig = readDwhConfig();
  if (
    dwhConfig.enabled &&
    dwhConfig.store === "sql" &&
    dwhConfig.scheduledLoadEnabled
  ) {
    const dwh = await getDwhPool();
    await dwh.request().query("SELECT 1 AS ok");
    await assertDwhSchemaCompatible(dwh);
  }
}

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  await unlink(readyMarker).catch(() => undefined);
  console.log(`[nutriclinica-jobs] shutdown ${signal}`);
  let timeout: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([
    jobs?.stop() ?? Promise.resolve(),
    new Promise<void>((resolve) => {
      timeout = setTimeout(resolve, runtime?.shutdownTimeoutMs ?? 15_000);
      timeout.unref();
    }),
  ]);
  if (timeout) clearTimeout(timeout);
  await Promise.allSettled([closePool(), closeDwhPool()]);
}

async function main(): Promise<void> {
  // A restarted container may retain /tmp; never advertise stale readiness.
  await unlink(readyMarker).catch(() => undefined);
  assertStartupConfigValid(process.env, { role: "jobs" });
  runtime = readServerRuntimeConfig(process.env);
  if (!runtime.backgroundJobsEnabled) {
    throw new Error(
      "jobs runner requiere BACKGROUND_JOBS_ENABLED=true de forma explicita",
    );
  }
  if (shuttingDown) return;
  await preflightDependencies();
  if (shuttingDown) return;

  jobs = startRuntimeJobs();
  if (jobs.scheduledJobs === 0) {
    throw new Error("jobs runner sin jobs habilitados: arranque abortado");
  }
  await writeFile(readyMarker, `${process.pid}\n`, { encoding: "utf8" });
  if (shuttingDown) {
    await unlink(readyMarker).catch(() => undefined);
    return;
  }
  console.log(`[nutriclinica-jobs] started (${jobs.scheduledJobs} scheduled)`);
}

process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));

void main().catch(async (error: unknown) => {
  if (shuttingDown) return;
  console.error(
    "[nutriclinica-jobs] startup failed:",
    error instanceof Error ? error.name : "UnknownStartupError",
  );
  process.exitCode = 1;
  await shutdown("STARTUP_FAILURE");
});
