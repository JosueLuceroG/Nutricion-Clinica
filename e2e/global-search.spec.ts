import { expect, test } from "@playwright/test";
import { fakeLogin, hashUrl } from "./helpers";

test.describe("búsqueda inteligente global", () => {
  test.beforeEach(async ({ page }) => {
    await fakeLogin(page, "e2e-branch");
    await page.goto(hashUrl("/"));
    await page.waitForLoadState("domcontentloaded");
  });

  test("abre desde el dashboard y expone la estructura premium", async ({
    page,
  }) => {
    await page
      .getByRole("button", { name: /Buscar pacientes, consultas, recetas/i })
      .click();

    const dialog = page.getByRole("dialog", { name: /Búsqueda inteligente/i });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("combobox", { name: /Paleta de comandos/i }),
    ).toBeFocused();
    await expect(dialog.getByRole("tab", { name: "Todo" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(dialog.getByText("Sugerencias")).toBeVisible();
    await expect(dialog.getByText("Búsqueda privada").first()).toBeVisible();
    await expect(dialog.getByText("Accesos rápidos")).toBeVisible();
    await expect(dialog.getByText("Recientes")).toBeVisible();
  });

  test("abre con Ctrl+K, interpreta comandos y cierra con Escape", async ({
    page,
  }) => {
    await expect(
      page.getByRole("button", {
        name: /Buscar pacientes, consultas, recetas/i,
      }),
    ).toBeVisible();
    await page.keyboard.press("Control+K");
    const dialog = page.getByRole("dialog", { name: /Búsqueda inteligente/i });
    await expect(dialog).toBeVisible();

    const input = dialog.getByRole("combobox", { name: /Paleta de comandos/i });
    await input.fill("crear nuevo paciente");
    await expect(
      dialog.getByText("Comando local: se ejecuta solo al seleccionarlo"),
    ).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test("explica la búsqueda privada y diferencia el Asistente IA", async ({
    page,
  }) => {
    await expect(
      page.getByRole("button", {
        name: /Buscar pacientes, consultas, recetas/i,
      }),
    ).toBeVisible();
    await page.keyboard.press("Control+K");
    const dialog = page.getByRole("dialog", { name: /Búsqueda inteligente/i });
    await dialog.getByRole("button", { name: "Cómo funciona" }).first().click();

    await expect(dialog.getByText("Búsqueda privada").last()).toBeVisible();
    await expect(dialog.getByText("El Asistente IA es otra función")).toBeVisible();
    await expect(dialog.getByText("Filtros fáciles")).toBeVisible();
    await expect(
      dialog.getByText("Ver filtros avanzados"),
    ).toBeVisible();
    await expect(
      dialog.getByText(/texto y los resultados no se envían/i),
    ).toBeVisible();
  });

  test("permite aplicar filtros rápidos sin escribir la sintaxis", async ({
    page,
  }) => {
    await expect(
      page.getByRole("button", {
        name: /Buscar pacientes, consultas, recetas/i,
      }),
    ).toBeVisible();
    await page.keyboard.press("Control+K");
    const dialog = page.getByRole("dialog", { name: /Búsqueda inteligente/i });

    await dialog.getByRole("button", { name: "Pacientes activos" }).click();
    await expect(dialog.getByRole("combobox")).toHaveValue(
      "tipo:paciente estado:activo",
    );
    await expect(dialog.getByRole("tab", { name: "Pacientes" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  test("interpreta consultas de hoy y recetas por calorías como búsquedas", async ({
    page,
  }) => {
    await expect(
      page.getByRole("button", {
        name: /Buscar pacientes, consultas, recetas/i,
      }),
    ).toBeVisible();
    await page.keyboard.press("Control+K");
    const dialog = page.getByRole("dialog", { name: /Búsqueda inteligente/i });
    const input = dialog.getByRole("combobox");

    await input.fill("consultas de hoy");
    await expect(
      dialog.getByRole("tab", { name: "Consultas" }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(dialog.getByText("Abrir agenda de hoy")).toHaveCount(0);

    await input.fill("recetas de 2000 calorías");
    await expect(dialog.getByRole("tab", { name: "Recetas" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  test("permite filtrar por categoría", async ({ page }) => {
    await expect(
      page.getByRole("button", {
        name: /Buscar pacientes, consultas, recetas/i,
      }),
    ).toBeVisible();
    await page.keyboard.press("Control+K");
    const dialog = page.getByRole("dialog", { name: /Búsqueda inteligente/i });
    const patientsTab = dialog.getByRole("tab", { name: "Pacientes" });
    await patientsTab.click();
    await expect(patientsTab).toHaveAttribute("aria-selected", "true");
    await expect(dialog.getByText("Sin coincidencias")).toBeVisible();
  });

  test("se mantiene dentro del viewport móvil", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: /Buscar pacientes, consultas, recetas/i }).click();
    const dialog = page.getByRole("dialog", { name: /Búsqueda inteligente/i });
    await expect(dialog).toBeVisible();

    const box = await dialog.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(390);
    expect(box!.y + box!.height).toBeLessThanOrEqual(844);
  });
});
