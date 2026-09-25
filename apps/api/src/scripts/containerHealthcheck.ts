import { access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

async function main(): Promise<void> {
  const role = process.env.WORKLOAD_ROLE?.trim() ?? "api";
  if (role === "jobs") {
    await access(join(tmpdir(), "nutriclinica-jobs-ready"));
    return;
  }
  if (role === "migration" || role === "dwh-schema") return;
  if (role !== "api") throw new Error("unknown workload role");

  const port = Number(process.env.PORT ?? "3000");
  const response = await fetch(`http://127.0.0.1:${port}/health/live`);
  if (!response.ok) throw new Error(`health status ${response.status}`);
}

void main().catch(() => {
  process.exitCode = 1;
});
