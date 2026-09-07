import "dotenv/config";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assertTargetSafe } from "../../deployment/targetGuard.js";
import { readEnvironmentClass } from "../../deployment/environmentIdentity.js";
import { readDwhConfig } from "../config.js";
import { closeDwhPool, getDwhPool } from "../dwhConnection.js";
import {
  applyDwhSchema,
  dwhSchemaChecksum,
  DWH_SCHEMA_VERSION,
} from "./dwhSchema.js";

async function main(): Promise<void> {
  try {
    assertTargetSafe("dwh_schema", process.env);
    const config = readDwhConfig();
    if (!config.enabled || config.store !== "sql") {
      throw new Error(
        "DWH schema apply requires DWH_ENABLED=true and DWH_STORE=sql",
      );
    }
    const pool = await getDwhPool();
    await applyDwhSchema(pool);
    console.log(
      `dwh-schema: applied version=${DWH_SCHEMA_VERSION} checksum=${dwhSchemaChecksum()}`,
    );
  } catch (error) {
    const environmentClass = readEnvironmentClass(process.env);
    const detailedErrors =
      environmentClass === "LOCAL" || environmentClass === "TEST";
    console.error(
      "dwh-schema: failed:",
      error instanceof Error
        ? detailedErrors
          ? error.message
          : error.name
        : "UnknownDwhSchemaError",
    );
    process.exitCode = 1;
  } finally {
    await closeDwhPool();
  }
}

const invokedDirectly = process.argv[1]
  ? resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))
  : false;
if (invokedDirectly) void main();
