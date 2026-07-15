import { expect, test, type Page } from "@playwright/test";
import { fakeLogin, hashUrl } from "./helpers";

const BRANCH_ID = "e2e-dashboard-quick-access";

async function openDashboard(page: Page) {
  await page.goto(hashUrl("/"));
  await page.waitForLoadState("domcontentloaded");
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible({
    timeout: 15_000,
  });
}

test.describe("acceso rápido configurable del dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await fakeLogin(page, BRANCH_ID);
  });

  test("conserva Personalizar KPIs como acción directa predeterminada", async ({
    page,
  }) => {
    await openDashboard(page);

    const access = page.getByRole("button", {
      name: "Personalizar KPIs",
      exact: true,
    });
    await expect(access).toHaveAttribute("data-quick-access-mode", "direct");
    await access.click();

    await expect(page.getByText("Editando dashboard")).toBeVisible();
    await expect(access).toBeDisabled();
  });

  test("abre el menú configurado y navega a una calculadora específica", async ({
    page,
  }) => {
    await page.addInitScript(
      ({ branchId }) => {
        const key = `nutriclinica.dashboard-quick-access.v1:user:e2e-test-user:branch:id:${encodeURIComponent(branchId)}`;
        localStorage.setItem(
          key,
          JSON.stringify({
            schemaVersion: 1,
            scope: { userId: "e2e-test-user", sucursalId: branchId },
            config: {
              mode: "menu",
              buttonLabel: "Herramientas clínicas",
              buttonIconId: "stethoscope",
              primaryActionId: "dashboard.customize",
              secondaryActionIds: ["calculators.bmi.open"],
            },
            revision: 1,
            updatedAt: "2026-07-14T10:00:00.000Z",
          }),
        );
      },
      { branchId: BRANCH_ID },
    );
    await openDashboard(page);

    const access = page.getByRole("button", {
      name: "Herramientas clínicas",
      exact: true,
    });
    await expect(access).toHaveAttribute("data-quick-access-mode", "menu");
    await access.click();
    await expect(page.getByText("Principal", { exact: true })).toBeVisible();

    await page.getByRole("menuitem", { name: /Calculadora de IMC/ }).click();
    await expect(page).toHaveURL(/#\/calculos\?tool=bmi$/);
    await expect(page.locator("#calculator-bmi")).toBeFocused();
  });

  test("aplica el icono recomendado y permite reemplazarlo", async ({
    page,
  }) => {
    await page.goto(hashUrl("/configuracion"));
    await page.waitForLoadState("domcontentloaded");
    const primaryAction = page.getByRole("combobox", {
      name: "Acción principal",
    });
    await expect(primaryAction).toBeVisible({ timeout: 15_000 });
    await primaryAction.click();
    await page
      .getByRole("option", { name: "Calculadora de IMC", exact: true })
      .click();
    await expect(
      page
        .getByRole("button", { name: "Vista previa: Calculadora de IMC" })
        .locator("svg")
        .first(),
    ).toHaveClass(/lucide-calculator/);

    await page.getByText("4. Apariencia (opcional)", { exact: true }).click();
    const label = page.getByLabel("Etiqueta personalizada (opcional)");
    await label.fill("Mi acceso clínico");
    await page.getByLabel("Ícono del botón").click();
    await page.getByRole("option", { name: "Estrella", exact: true }).click();
    await expect(
      page
        .getByRole("button", { name: "Vista previa: Mi acceso clínico" })
        .locator("svg")
        .first(),
    ).toHaveClass(/lucide-star/);

    await primaryAction.click();
    await page
      .getByRole("option", { name: "Notas rápidas", exact: true })
      .click();
    await expect(
      page
        .getByRole("button", { name: "Vista previa: Mi acceso clínico" })
        .locator("svg")
        .first(),
    ).toHaveClass(/lucide-sticky-note/);

    await page.getByRole("button", { name: "Guardar acceso rápido" }).click();
    await expect(
      page.getByText("Acceso rápido del dashboard guardado"),
    ).toBeVisible();

    await openDashboard(page);
    const savedAccess = page.getByRole("button", {
      name: "Mi acceso clínico",
      exact: true,
    });
    await expect(savedAccess).toBeVisible();
    await expect(savedAccess.locator("svg").first()).toHaveClass(
      /lucide-sticky-note/,
    );
  });

  test("comparte lecturas entre el dropdown y el centro de notificaciones", async ({
    page,
  }) => {
    await openDashboard(page);
    await page.getByRole("button", { name: "Notificaciones (8)" }).click();
    await expect(page.getByText("Ana Torres").first()).toBeVisible();
    await page
      .getByRole("button", { name: "Ver todas las notificaciones" })
      .click();

    await expect(page).toHaveURL(/#\/notificaciones$/);
    await expect(page.getByText("Ana Torres").first()).toBeVisible();
    await page
      .getByRole("button", { name: /Marcar.*leídas/i })
      .first()
      .click();

    await openDashboard(page);
    await expect(
      page.getByRole("button", { name: "Notificaciones (0)" }),
    ).toBeVisible();
  });
});
