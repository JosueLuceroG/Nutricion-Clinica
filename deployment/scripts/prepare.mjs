import { spawnSync } from "node:child_process";

const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const result = spawnSync(command, ["exec", "husky"], {
  stdio: "inherit",
});

if (result.error || result.status !== 0) {
  console.warn("[prepare] husky hooks unavailable; continuing without hooks");
}
