import { test, expect } from "@playwright/test";

/**
 * Meal Planner + Chef AI dialog E2E.
 *
 * Covers:
 * - Meal planner page renders with empty state.
 * - Chef AI dialog opens/closes.
 * - Chef AI dialog form fields are present.
 * - Apply button is disabled until generation completes.
 */

test.describe("Meal Planner & Chef AI", () => {
  test("meal planner page shows the empty state when no plans exist", async ({ page }) => {
    await page.goto("/#/planes");
    await expect(page.locator("h1")).toContainText(/planes/i, { timeout: 10_000 });
    await expect(page.getByText(/sin planes|no hay|no weekly plans/i)).toBeVisible({
      timeout: 5_000,
    });
  });

  test("chef dialog opens and shows the form", async ({ page }) => {
    await page.goto("/#/planes");
    await expect(page.locator("h1")).toContainText(/planes/i, { timeout: 10_000 });

    await page.getByRole("button", { name: /chef|ai|asistente/i }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5_000 });

    await expect(page.getByText(/kcal|calorías|calorias/i).first()).toBeVisible();
    await expect(page.getByText(/comidas|meals/i).first()).toBeVisible();
    await expect(page.getByText(/días|dias/i).first()).toBeVisible();
  });

  test("chef dialog shows macro breakdown when kcal changes", async ({ page }) => {
    await page.goto("/#/planes");
    await page.getByRole("button", { name: /chef|ai|asistente/i }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5_000 });

    const kcalInput = page.locator('input[type="number"]').first();
    await kcalInput.fill("2200");
    await expect(page.getByText(/2200 kcal|proteína.*110|grasa.*61|carbs.*302/i)).toBeVisible({
      timeout: 3_000,
    });
  });

  test("apply button is disabled until generation completes", async ({ page }) => {
    await page.goto("/#/planes");
    await page.getByRole("button", { name: /chef|ai|asistente/i }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5_000 });

    await expect(page.getByRole("button", { name: /aplicar|apply/i })).toBeDisabled();
  });

  test("chef dialog can be closed via cancel button", async ({ page }) => {
    await page.goto("/#/planes");
    await page.getByRole("button", { name: /chef|ai|asistente/i }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5_000 });

    await page.getByRole("button", { name: /cancelar|cancel/i }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
  });
});
