/**
 * Helpers compartidos por los specs de Playwright.
 *
 * El stack usa hash routing (`#/login`, `#/pacientes`, etc.) — los `page.goto`
 * deben ir con la barra al final porque el router hace `createHashRouter`.
 */

import { expect, type Page } from "@playwright/test";

export const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "admin@nutriclinica.local";
export const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "admin123!";

/**
 * Fake login: inyecta un estado de auth en localStorage ANTES de que
 * la app cargue, para que zustand persist lo recoja en `isAuthenticated=true`.
 * Útil para tests que necesitan navegar páginas protegidas sin API server.
 */
export async function fakeLogin(
  page: Page,
  sucursalActivaId: string | null = null,
): Promise<void> {
  await page.addInitScript(({ email, sucursalActivaId }) => {
    localStorage.setItem(
      "auth-store",
      JSON.stringify({
        state: {
          token: "e2e-test-token",
          user: {
            id: "e2e-test-user",
            email,
            nombre: "Admin",
            apellido: "Test",
            nombreCompleto: "Admin Test",
            rol: "admin",
          },
          sucursales: [],
          sucursalActivaId,
          isAuthenticated: true,
        },
        version: 0,
      }),
    );
  }, { email: ADMIN_EMAIL, sucursalActivaId });
}

/** URL base + hash. El router es `createHashRouter`. */
export function hashUrl(path: string): string {
  return `/#${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Login: llena el form de LoginPage y espera a llegar al Panel (Dashboard).
 * Asume que el usuario está en la pantalla de login (o redirigido ahí).
 *
 * Esta función está pensada para ser idempotente: si ya está logueado,
 * simplemente navega al destino.
 */
export async function loginAsAdmin(page: Page): Promise<void> {
  await page.goto(hashUrl("/login"));
  // CardTitle es un div, no un heading — usamos getByText.
  // Esperamos a que la red se calme (la app puede tardar en montar React).
  await page.waitForLoadState("domcontentloaded");
  await expect(page.getByText(/Iniciar sesi[oó]n/i).first()).toBeVisible({
    timeout: 15_000,
  });
  await page.getByLabel(/Correo electr[oó]nico/i).fill(ADMIN_EMAIL);
  await page.getByRole("textbox", { name: /Contrase[ñn]a/i }).fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: /^(Iniciar sesión|Log in)$/i }).click();
  // El router redirige al Panel tras login OK
  await page.waitForURL((url) => url.hash !== "#/login", { timeout: 15_000 });
  await expect(page.getByRole("heading", { name: /^(Dashboard|Panel)$/i })).toBeVisible({ timeout: 10_000 });
}

/** Genera un email único para no chocar con datos existentes en la DB. */
export function uniqueEmail(prefix: string): string {
  return `e2e-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@nutriclinica.local`;
}
