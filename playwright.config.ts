import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E para la web (Vite en :1420) hablando contra el API
 * Node + Express (en :3000).
 *
 * Prereqs: el usuario debe tener levantados:
 *   - `cd apps/api && pnpm dev`     → :3000
 *   - `pnpm dev`                    → :1420
 *
 * `webServer` reusa instancias si ya están corriendo (reuseExistingServer: true)
 * para no duplicar servers durante el desarrollo. En CI se levantan desde cero.
 *
 * Base URL configurable vía env BASE_URL si en el futuro la app se sirve
 * desde otro host (e.g. Tauri preview, staging, ngrok).
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // un solo browser a la vez — la app usa localStorage/IndexedDB persistentes
  reporter: process.env.CI ? "list" : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:1420",
    trace: "on-first-retry",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // NO levantamos webServer aquí: el usuario ya tiene `pnpm dev` corriendo.
  // Si el puerto no responde, los tests fallan con un mensaje claro.
  // (Si quieres auto-start, descomenta el bloque siguiente.)
  //
  // webServer: [
  //   { command: "cd apps/api && pnpm dev", url: "http://localhost:3000/health", reuseExistingServer: true, timeout: 60_000 },
  //   { command: "pnpm dev", url: "http://localhost:1420", reuseExistingServer: true, timeout: 60_000 },
  // ],
});
