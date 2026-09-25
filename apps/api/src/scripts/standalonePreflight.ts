import "dotenv/config";
import { closePool } from "../db/connection.js";
import { closeDwhPool } from "../modules/dwh/dwhConnection.js";
import {
  formatStandalonePreflightReport,
  runStandalonePreflight,
  type StandalonePreflightPhase,
} from "../modules/standalone/preflight.js";

function phaseFromArgs(args: string[]): StandalonePreflightPhase {
  const value = args
    .find((arg) => arg.startsWith("--phase="))
    ?.split("=", 2)[1];
  if (!value || value === "runtime") return "runtime";
  if (value === "install") return "install";
  throw new Error("--phase must be install or runtime");
}

async function main(): Promise<void> {
  try {
    const report = await runStandalonePreflight(
      process.env,
      phaseFromArgs(process.argv.slice(2)),
    );
    console.log(formatStandalonePreflightReport(report));
    if (!report.ok) process.exitCode = 1;
  } catch (error) {
    console.error(
      "standalone-preflight: FAIL",
      error instanceof Error ? error.name : "UnknownPreflightError",
    );
    process.exitCode = 1;
  } finally {
    await Promise.allSettled([closePool(), closeDwhPool()]);
  }
}

void main();
