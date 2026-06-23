import { test, expect } from "@playwright/test";

/**
 * Dashboard + SMAE catalog smoke tests.
 *
 * Covers:
 * - Main navigation links route to the right pages.
 * - SMAE catalog renders with at least one food group.
 */

test.describe("Dashboard & navigation", () => {
  test("main sidebar links navigate to the right pages", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toContainText("Dashboard", { timeout: 10_000 });

    // Click "Planes" in the premium dashboard sidebar.
    await page.getByRole("link", { name: /planes/i }).first().click();
    await expect(page).toHaveURL(/#\/planes$/, { timeout: 5_000 });
    await expect(page.locator("h1")).toContainText(/planes/i);
  });

  test("calculations page is reachable", async ({ page }) => {
    await page.goto("/#/calculos");
    await expect(page.locator("h1")).toContainText(/c[aá]lculos/i, { timeout: 5_000 });
  });

  test("laboratory page is reachable", async ({ page }) => {
    await page.goto("/#/laboratorio");
    await expect(page.locator("h1")).toContainText(/laboratorio/i, { timeout: 5_000 });
  });
});

test.describe("SMAE catalog", () => {
  test("loads with system food groups visible", async ({ page }) => {
    await page.goto("/#/smae");

    await expect(page.locator("h1")).toContainText(/cat[aá]logo smae/i, {
      timeout: 5_000,
    });

    // System foods are seeded from src/modules/smae/domain/SYSTEM_FOODS.ts.
    // At least one food group label should be visible.
    await expect(page.locator("body")).toContainText(
      /verduras|frutas|cereales|leguminosas|AOA|leche/i,
      { timeout: 5_000 },
    );
  });
});
