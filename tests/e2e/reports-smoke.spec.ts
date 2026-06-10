import { test, expect } from "@playwright/test";

/**
 * Reports page smoke tests.
 *
 * Covers:
 * - Reports page renders with title.
 * - KPI cards render (even when data is empty).
 * - Indicator table renders the empty state.
 * - New indicator button is present.
 * - Generate report dialog can be opened.
 */

test.describe("Reports page", () => {
  test("renders the reports page title and KPI grid", async ({ page }) => {
    await page.goto("/#/reportes");
    await expect(page.locator("h1")).toContainText(/reportes|reports/i, {
      timeout: 10_000,
    });

    const kpiCards = page.locator("h3");
    await expect(kpiCards.first()).toBeVisible({ timeout: 5_000 });
  });

  test("indicators section shows empty state when no indicators exist", async ({ page }) => {
    await page.goto("/#/reportes");
    await expect(page.locator("h1")).toContainText(/reportes|reports/i, {
      timeout: 10_000,
    });

    await expect(page.getByText(/sin indicadores|no hay.*reporte|no hay.*indicador/i)).toBeVisible({
      timeout: 5_000,
    });
  });

  test("new indicator button is present on the reports page", async ({ page }) => {
    await page.goto("/#/reportes");
    await expect(page.getByRole("button", { name: /nuevo.*indicador|new.*indicator/i })).toBeVisible({
      timeout: 5_000,
    });
  });

  test("generate report dialog can be opened", async ({ page }) => {
    await page.goto("/#/reportes");
    await page.getByRole("button", { name: /generar|generate/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5_000 });
  });
});
