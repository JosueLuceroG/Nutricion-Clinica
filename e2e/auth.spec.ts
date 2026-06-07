import { test, expect } from "@playwright/test";
import { loginAsAdmin, hashUrl, ADMIN_EMAIL } from "./helpers";

test.describe("Auth", () => {
  test("flujo de login con credenciales válidas redirige al Panel", async ({ page }) => {
    await loginAsAdmin(page);
    // El Sidebar tiene el link "Panel" y el PageHeader del Dashboard dice "Panel"
    await expect(page.getByText(/^Panel$/).first()).toBeVisible();
    // La URL debe cambiar a #
    expect(page.url()).toContain("#/");
    expect(page.url()).not.toContain("#/login");
  });

  test("login con credenciales inválidas muestra error y NO redirige", async ({ page }) => {
    await page.goto(hashUrl("/login"));
    await expect(page.getByText(/Iniciar sesi[oó]n/i).first()).toBeVisible({
      timeout: 15_000,
    });
    await page.getByLabel(/Correo electr[oó]nico/i).fill(ADMIN_EMAIL);
    await page.getByLabel(/Contrase[ñn]a/i).fill("WRONG-PASSWORD-1234!");
    await page.getByRole("button", { name: /^Ingresar/i }).click();
    // El alert de error aparece (role=alert) y la URL sigue siendo /login.
    await expect(page.getByRole("alert")).toBeVisible({ timeout: 5_000 });
    expect(page.url()).toContain("#/login");
  });

  test("cerrar sesión desde el menú de usuario redirige a /login", async ({ page }) => {
    await loginAsAdmin(page);
    // Header: botón con icono de usuario (rounded-full, aria-label="Menú de usuario")
    await page.getByRole("button", { name: /men[úu] de usuario/i }).click();
    await page.getByRole("menuitem", { name: /cerrar sesi[oó]n/i }).click();
    await page.waitForURL(/login/, { timeout: 10_000 });
    await expect(page.getByText(/Iniciar sesi[oó]n/i).first()).toBeVisible({
      timeout: 10_000,
    });
  });
});
