import { test, expect } from "@playwright/test";

/**
 * Patient CRUD happy-path E2E.
 *
 * Covers:
 * - Dashboard rendering.
 * - Patient list empty state.
 * - New patient form: render, fill, submit.
 * - Form validation (required fields, future birth date).
 * - Persistence to IndexedDB and re-render in list.
 *
 * Regression target: T1-T4 (form validation, save button, error messages).
 * See docs/decisions/0008-bug-t1-zod-preprocess.md and
 * docs/decisions/0009-bug-t2-no-type-submit.md.
 */

test.describe("Patient CRUD", () => {
  test("dashboard renders the main menu", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toContainText("Panel", { timeout: 10_000 });
    await expect(page.getByRole("link", { name: /pacientes/i }).first()).toBeVisible();
  });

  test("patient list shows the empty state when there are no patients", async ({ page }) => {
    await page.goto("/#/pacientes");
    await expect(page.locator("h1")).toContainText("Pacientes", { timeout: 5_000 });
    await expect(page.getByText(/sin pacientes registrados/i)).toBeVisible({
      timeout: 5_000,
    });
  });

  test("can create a new patient and see it in the list", async ({ page }) => {
    await page.goto("/#/pacientes/nuevo");
    await expect(page.locator("h1")).toContainText("Nuevo paciente");

    await page.locator('input[name="firstName"]').fill("María Fernanda");
    await page.locator('input[name="lastName"]').fill("García López");
    await page.locator('input[name="birthDate"]').fill("1990-05-15");
    await page.locator('select[name="sex"]').selectOption("female");
    await page.locator('input[name="email"]').fill("maria.garcia@example.com");
    await page.locator('input[name="phone"]').fill("+52 55 1234 5678");

    await page.getByRole("button", { name: /crear paciente/i }).click();

    // After save, navigate to detail page. A toast also shows the patient
    // name, so we look at the heading area (h2 typically) for the full name.
    await expect(page).toHaveURL(/#\/pacientes\/[a-f0-9-]+$/, { timeout: 10_000 });
    await expect(page.getByText("María Fernanda García López").first()).toBeVisible();

    // Go back to the list and verify it appears
    await page.goto("/#/pacientes");
    await expect(page.getByText("María Fernanda García López").first()).toBeVisible({
      timeout: 5_000,
    });
  });

  test("shows validation errors for empty required fields", async ({ page }) => {
    await page.goto("/#/pacientes/nuevo");
    await expect(page.locator("h1")).toContainText("Nuevo paciente");

    // Submit without filling anything
    await page.getByRole("button", { name: /crear paciente/i }).click();

    // Per-field error messages from Zod (per ADR-0004)
    await expect(page.getByText(/mínimo 2 caracteres/i).first()).toBeVisible({
      timeout: 5_000,
    });
    await expect(page.getByText(/requerido/i).first()).toBeVisible();

    // We should still be on the new patient page
    await expect(page).toHaveURL(/#\/pacientes\/nuevo$/);
  });

  test("rejects future birth date", async ({ page }) => {
    await page.goto("/#/pacientes/nuevo");

    await page.locator('input[name="firstName"]').fill("Test");
    await page.locator('input[name="lastName"]').fill("User");
    await page.locator('input[name="birthDate"]').fill("2999-01-01");
    await page.locator('select[name="sex"]').selectOption("undisclosed");

    await page.getByRole("button", { name: /crear paciente/i }).click();

    await expect(page.getByText(/futuro/i).first()).toBeVisible({ timeout: 5_000 });
    await expect(page).toHaveURL(/#\/pacientes\/nuevo$/);
  });
});
