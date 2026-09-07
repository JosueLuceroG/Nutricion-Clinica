import { defineConfig, devices } from "@playwright/test";

const configuredBaseUrl = process.env.BASE_URL?.trim();
const baseURL = configuredBaseUrl || "http://localhost:1420";

/**
 * Playwright E2E para la web (Vite en :1420) hablando contra el API
 * Node + Express (en :3000).
 *
 * El servidor Vite se levanta automáticamente. El suite E2E completo también
 * requiere que el operador levante una API/SQL local autorizada en :3000.
 *
 * CI ejecuta `e2e:portable`, que usa fixtures offline/fake login y no afirma
 * integración SQL. El E2E completo pertenece a staging/local SQL controlado.
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
    baseURL,
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
  webServer: configuredBaseUrl
    ? undefined
    : {
        command: "pnpm dev",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
