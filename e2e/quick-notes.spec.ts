import { expect, test } from "@playwright/test";
import { fakeLogin, hashUrl } from "./helpers";

test.describe("notas rápidas", () => {
  test.beforeEach(async ({ page }) => {
    await fakeLogin(page, "e2e-quick-notes-branch");
    await page.goto(hashUrl("/"));
    await page.waitForLoadState("domcontentloaded");
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible({
      timeout: 15_000,
    });
  });

  test("crea, fija y restaura una nota después de recargar", async ({
    page,
  }) => {
    await page.getByRole("button", { name: /^Notas rápidas/ }).click();
    const panel = page.getByRole("dialog", { name: "Notas rápidas" });
    await expect(panel).toBeVisible();

    await panel.getByRole("button", { name: "Crear mi primera nota" }).click();
    await panel.getByLabel("Título").fill("Confirmar cita de Ana");
    await panel
      .getByLabel("Contenido")
      .fill("Llamar antes de las 16:00 y validar laboratorio");
    await panel.getByLabel("Mantener visible").check();
    await panel.getByRole("button", { name: "Crear nota" }).click();
    await expect(panel.getByText("Confirmar cita de Ana")).toBeVisible();

    await panel.getByRole("button", { name: "Cerrar notas rápidas" }).click();
    const floatingNote = page.locator(".qn-floating-note");
    await expect(floatingNote).toBeVisible();
    await expect(floatingNote.getByLabel("Título")).toHaveValue(
      "Confirmar cita de Ana",
    );

    const before = await floatingNote.boundingBox();
    const workspace = await page.locator(".nc-dashboard-main").boundingBox();
    const moveHandle = floatingNote.getByRole("button", { name: /Mover nota/ });
    const handleBox = await moveHandle.boundingBox();
    expect(before).not.toBeNull();
    expect(workspace).not.toBeNull();
    expect(handleBox).not.toBeNull();
    expect(before!.width).toBeCloseTo(160, 0);
    expect(before!.height).toBeCloseTo(164, 0);
    expect(before!.x).toBeGreaterThanOrEqual(8);
    expect(before!.y).toBeGreaterThanOrEqual(8);
    await page.mouse.move(
      handleBox!.x + handleBox!.width / 2,
      handleBox!.y + handleBox!.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      handleBox!.x + handleBox!.width / 2 + 80,
      handleBox!.y + handleBox!.height / 2 + 50,
      { steps: 6 },
    );
    await page.mouse.up();
    const after = await floatingNote.boundingBox();
    expect(after!.x).toBeGreaterThan(before!.x + 40);
    expect(after!.y).toBeGreaterThan(before!.y + 20);
    expect(after!.x).toBeLessThan(workspace!.x);
    expect(after!.y).toBeLessThan(workspace!.y);

    const resizeHandle = floatingNote.getByRole("button", {
      name: /Cambiar tamaño/,
    });
    const resizeHandleBox = await resizeHandle.boundingBox();
    expect(resizeHandleBox).not.toBeNull();
    await page.mouse.move(
      resizeHandleBox!.x + resizeHandleBox!.width / 2,
      resizeHandleBox!.y + resizeHandleBox!.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      resizeHandleBox!.x + resizeHandleBox!.width / 2 + 70,
      resizeHandleBox!.y + resizeHandleBox!.height / 2 + 55,
      { steps: 6 },
    );
    await page.mouse.up();
    const resized = await floatingNote.boundingBox();
    expect(resized!.width).toBeGreaterThan(after!.width + 45);
    expect(resized!.height).toBeGreaterThan(after!.height + 35);

    await expect
      .poll(() =>
        page.evaluate(() =>
          Object.keys(localStorage).some((key) =>
            key.startsWith("nutriclinica.quick-notes.v1:user:e2e-test-user"),
          ),
        ),
      )
      .toBe(true);

    await page.reload();
    const restoredNote = page.locator(".qn-floating-note");
    await expect(restoredNote.getByLabel("Título")).toHaveValue(
      "Confirmar cita de Ana",
    );
    const restoredBox = await restoredNote.boundingBox();
    expect(restoredBox!.x).toBeCloseTo(resized!.x, 0);
    expect(restoredBox!.y).toBeCloseTo(resized!.y, 0);
    expect(restoredBox!.width).toBeCloseTo(resized!.width, 0);
    expect(restoredBox!.height).toBeCloseTo(resized!.height, 0);

    await restoredNote
      .getByRole("button", { name: "Más acciones de la nota" })
      .click();
    await restoredNote
      .getByRole("menuitem", { name: "Minimizar nota" })
      .click();
    await expect(restoredNote.getByText("Confirmar cita de Ana")).toBeVisible();
    const minimizedBefore = await restoredNote.boundingBox();
    expect(minimizedBefore!.height).toBeCloseTo(40, 0);

    const minimizedResizeHandle = restoredNote.getByRole("button", {
      name: /Cambiar tamaño/,
    });
    const minimizedHandleBox = await minimizedResizeHandle.boundingBox();
    expect(minimizedHandleBox).not.toBeNull();
    await page.mouse.move(
      minimizedHandleBox!.x + minimizedHandleBox!.width / 2,
      minimizedHandleBox!.y + minimizedHandleBox!.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      minimizedHandleBox!.x + minimizedHandleBox!.width / 2 - 45,
      minimizedHandleBox!.y + minimizedHandleBox!.height / 2 + 30,
      { steps: 5 },
    );
    await page.mouse.up();
    const minimizedAfter = await restoredNote.boundingBox();
    expect(minimizedAfter!.width).toBeLessThan(minimizedBefore!.width - 25);
    expect(minimizedAfter!.height).toBeCloseTo(minimizedBefore!.height, 0);
  });

  test("usa una hoja modal dentro del viewport móvil", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: /^Notas rápidas/ }).click();

    const panel = page.getByRole("dialog", { name: "Notas rápidas" });
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute("aria-modal", "true");
    await expect(panel).toHaveCSS("transform", "none");
    const box = await panel.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(390);
    expect(box!.y + box!.height).toBeLessThanOrEqual(844);
  });
});
