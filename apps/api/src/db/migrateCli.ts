import "dotenv/config";
import { closePool } from "./connection.js";
import { applyMigrations } from "./migrate.js";
import { readEnvironmentClass } from "../modules/deployment/environmentIdentity.js";

async function main(): Promise<void> {
  const force = process.argv.slice(2).includes("--force");
  console.log("=== nutriclinica: migraciones SQL Server ===");
  try {
    const results = await applyMigrations({ force });
    const errors = results.filter((result) => result.status === "error");
    console.log(
      `\nresultado: ${results.length} archivos, ${errors.length} errores`,
    );
    if (errors.length > 0) process.exitCode = 1;
  } catch (error) {
    const environmentClass = readEnvironmentClass(process.env);
    console.error(
      "error fatal:",
      environmentClass === "LOCAL" || environmentClass === "TEST"
        ? error instanceof Error
          ? error.message
          : String(error)
        : error instanceof Error
          ? error.name
          : "UnknownMigrationError",
    );
    process.exitCode = 1;
  } finally {
    await closePool();
  }
}

void main();
