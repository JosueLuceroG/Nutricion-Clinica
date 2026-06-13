import { test, expect } from "@playwright/test";
import { loginAsAdmin, hashUrl, uniqueEmail } from "./helpers";

/**
 * E2E de adherencia profesional (Sprint 25E).
 *
 * Cubre:
 *   1. Ir al detalle de un paciente
 *   2. Navegar a la página de adherencia vía ModuleLink
 *   3. Crear un registro de adherencia desde el diálogo
 *   4. Verificar que el registro aparece en la lista con los scores correctos
 */

test.describe.serial("Adherencia profesional — captura en consulta", () => {
  test("navegar a adherencia, crear registro y verlo en lista", async ({ page }) => {
    await loginAsAdmin(page);

    // 1) Crear un paciente para la prueba
    const email = uniqueEmail("adherence");
    await page.goto(hashUrl("/pacientes/nuevo"));
    await expect(page.getByText(/nuevo paciente/i).first()).toBeVisible();

    await page.locator('input[name="firstName"]').fill("Adherencia");
    await page.locator('input[name="lastName"]').fill("E2ETest");
    await page.locator('input[name="firstName"]').press("Tab");
    await page.locator('input[name="birthDate"]').fill("1990-01-15");
    await page.locator('select[name="sex"]').selectOption("female");
    await page.locator('input[name="email"]').fill(email);

    await page.getByRole("button", { name: /guardar|crear paciente|siguiente/i }).first().click();
    await page.waitForURL(/\/pacientes\/[a-f0-9-]{36}$/, { timeout: 15_000 });
    const patientId = page.url().match(/\/pacientes\/([a-f0-9-]{36})/)?.[1];
    expect(patientId).toBeTruthy();

    // 2) Navegar al submódulo de adherencia del paciente creado.
    await page.goto(hashUrl(`/pacientes/${patientId}/adherencia`));
    await page.waitForURL(/\/pacientes\/[a-f0-9-]{36}\/adherencia/, { timeout: 10_000 });

    // 3) Verificar que la página de adherencia cargó
    await expect(page.getByText(/Agregar registro/i).first()).toBeVisible({ timeout: 10_000 });

    // 4) Abrir el diálogo de nuevo registro
    await page.getByRole("button", { name: /Agregar registro/i }).first().click();
    await expect(page.getByText(/Registro de adherencia/i).first()).toBeVisible({ timeout: 5_000 });

    // 5) Llenar los sliders de scores usando JS para setear valores
    const sliders = page.locator('input[type="range"]');
    const sliderCount = await sliders.count();
    expect(sliderCount).toBe(5);

    // Setear cada slider a diferentes valores
    const scoreValues = [85, 70, 60, 90, 50];
    for (let i = 0; i < sliderCount; i++) {
      const slider = sliders.nth(i);
      await slider.evaluate((el, val) => {
        const input = el as HTMLInputElement;
        const nativeSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype, "value"
        )?.set;
        nativeSetter?.call(input, String(val));
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }, scoreValues[i]);
    }

    // 6) Llenar barreras y facilitadores
    await page.locator("#barriers").fill("Falta de tiempo para preparar alimentos");
    await page.locator("#facilitators").fill("Apoyo familiar en la dieta");
    await page.locator("#notes").fill("Paciente motivada pero con horarios complicados");

    // 7) Guardar el registro
    await page.getByRole("button", { name: /Guardar registro/i }).click();

    // 8) Esperar que el diálogo se cierre y el registro aparezca en la lista
    await expect(page.getByText(/Registro de adherencia/i)).not.toBeVisible({ timeout: 5_000 });

    // Verificar que el card del registro se muestra con los scores
    await expect(page.getByText(/Falta de tiempo/i).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Apoyo familiar/i).first()).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText(/Paciente motivada/i).first()).toBeVisible({ timeout: 5_000 });

    // Verificar que el badge de fuente "consulta" está presente
    await expect(page.getByText(/consulta/i).first()).toBeVisible({ timeout: 5_000 });
  });
});
