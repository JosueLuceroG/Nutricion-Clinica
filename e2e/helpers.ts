/**
 * Helpers compartidos por los specs de Playwright.
 *
 * El stack usa hash routing (`#/login`, `#/pacientes`, etc.) — los `page.goto`
 * deben ir con la barra al final porque el router hace `createHashRouter`.
 */

import { expect, type Page } from "@playwright/test";

export const ADMIN_EMAIL = "admin@nutriclinica.local";
export const ADMIN_PASSWORD = "Admin123!Nutri";

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
  await page.getByLabel(/Contrase[ñn]a/i).fill(ADMIN_PASSWORD);
  // Botón "Ingresar" / "Ingresando…" — match exacto para no chocar con "Mostrar/Ocultar" de password.
  await page.getByRole("button", { name: /^Ingresar/i }).click();
  // El router redirige al Panel tras login OK
  await page.waitForURL((url) => url.hash !== "#/login", { timeout: 15_000 });
  // El Dashboard tiene un header "Panel" en el PageHeader (también es div, usamos text).
  await expect(page.getByText(/^Panel$/).first()).toBeVisible({ timeout: 10_000 });
}

/** Genera un email único para no chocar con datos existentes en la DB. */
export function uniqueEmail(prefix: string): string {
  return `e2e-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@nutriclinica.local`;
}
