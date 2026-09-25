import { expect, test, type Page } from "@playwright/test";
import { fakeLogin, hashUrl } from "./helpers";

async function storedDashboard(page: Page) {
  return page.evaluate(() => {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key?.startsWith("nutriclinica.dashboard.v1:")) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      try {
        const value = JSON.parse(raw);
        if (value.userId === "e2e-test-user" && value.sucursalId === "e2e-dashboard-branch") return value;
      } catch {
        // Ignore unrelated invalid storage entries.
      }
    }
    return null;
  });
}

test.describe("personalización del dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await fakeLogin(page, "e2e-dashboard-branch");
    await page.goto(hashUrl("/"));
    await page.waitForLoadState("domcontentloaded");
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: "Reordenar / ocultar métricas" })).toBeVisible();
  });

  test("agrega un widget, guarda y restaura la configuración al recargar", async ({ page }) => {
    await page.getByRole("button", { name: "Personalizar KPIs", exact: true }).click();
    await expect(page.getByText("Editando dashboard")).toBeVisible();
    await expect(page.getByText("Editando dashboard")).toHaveCSS("font-weight", "700");
    await expect(page.getByRole("region", { name: "Biblioteca de widgets" })).toBeHidden();
    const saveButton = page.getByRole("button", { name: /^Guardar$/ });
    await saveButton.hover();
    await expect(saveButton).toHaveCSS("background-color", "rgb(29, 78, 216)");
    await expect(saveButton).toHaveCSS("color", "rgb(255, 255, 255)");
    await expect(saveButton).toHaveCSS("box-shadow", "none");
    await page.getByRole("button", { name: "Agregar widgets" }).click();
    const library = page.getByRole("region", { name: "Biblioteca de widgets" });
    await expect(library).toBeVisible();
    await expect(library).toHaveCSS("opacity", "1");
    await expect(library.getByText("Panel de inserción")).toHaveCSS("color", "rgb(109, 40, 217)");
    await expect(library.getByRole("button", { name: "Todos" })).toHaveCSS("background-color", "rgb(109, 93, 252)");
    const libraryPosition = await library.evaluate((element) => {
      const box = element.getBoundingClientRect();
      const grid = document.querySelector(".nc-dashboard-editable-grid-shell");
      const gridBox = grid?.getBoundingClientRect();
      return {
        position: getComputedStyle(element).position,
        insideDashboard: Boolean(element.closest("main")),
        fitsViewport: box.left >= 8 && box.right <= window.innerWidth - 8,
        followsGrid: Boolean(grid && (grid.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING)),
        bottomGap: window.innerHeight - box.bottom,
        overlapsGrid: Boolean(gridBox
          && box.left < gridBox.right
          && box.right > gridBox.left
          && box.top < gridBox.bottom
          && box.bottom > gridBox.top),
      };
    });
    expect(libraryPosition.position).toBe("fixed");
    expect(libraryPosition.insideDashboard).toBe(false);
    expect(libraryPosition.fitsViewport).toBe(true);
    expect(libraryPosition.followsGrid).toBe(true);
    expect(libraryPosition.bottomGap).toBeGreaterThanOrEqual(28);
    expect(libraryPosition.bottomGap).toBeLessThanOrEqual(52);
    expect(libraryPosition.overlapsGrid).toBe(true);
    await expect(page.locator(".nc-dashboard-widget-library__overlay")).toHaveCount(0);
    await expect(library.getByRole("button", { name: "Crear KPI" })).toHaveCSS("box-shadow", "none");
    await expect(page.getByRole("button", { name: "Agregar widgets" })).toHaveCSS("font-weight", "500");
    const moveHandle = library.getByRole("button", { name: "Mover biblioteca de widgets" });
    const initialLibraryBox = await library.boundingBox();
    const moveHandleBox = await moveHandle.boundingBox();
    expect(initialLibraryBox).not.toBeNull();
    expect(moveHandleBox).not.toBeNull();
    await page.mouse.move(moveHandleBox!.x + moveHandleBox!.width / 2, moveHandleBox!.y + moveHandleBox!.height / 2);
    await page.mouse.down();
    await page.mouse.move(moveHandleBox!.x + moveHandleBox!.width / 2 - 70, moveHandleBox!.y + moveHandleBox!.height / 2 - 50, { steps: 8 });
    await page.mouse.up();
    const movedLibraryBox = await library.boundingBox();
    expect(movedLibraryBox).not.toBeNull();
    expect(movedLibraryBox!.x).toBeLessThan(initialLibraryBox!.x - 40);
    expect(movedLibraryBox!.y).toBeLessThan(initialLibraryBox!.y - 30);
    const resizeHandle = library.getByRole("separator", { name: "Cambiar tamaño de biblioteca desde esquina inferior derecha" });
    const resizeHandleBox = await resizeHandle.boundingBox();
    expect(resizeHandleBox).not.toBeNull();
    await page.mouse.move(resizeHandleBox!.x + resizeHandleBox!.width / 2, resizeHandleBox!.y + resizeHandleBox!.height / 2);
    await page.mouse.down();
    await page.mouse.move(resizeHandleBox!.x + resizeHandleBox!.width / 2 - 180, resizeHandleBox!.y + resizeHandleBox!.height / 2 - 80, { steps: 8 });
    await page.mouse.up();
    const resizedLibraryBox = await library.boundingBox();
    expect(resizedLibraryBox).not.toBeNull();
    expect(resizedLibraryBox!.width).toBeLessThan(movedLibraryBox!.width - 120);
    expect(resizedLibraryBox!.height).toBeLessThan(movedLibraryBox!.height - 50);
    const responsiveColumns = await library.locator(".nc-dashboard-widget-library__grid").evaluate((element) =>
      getComputedStyle(element).gridTemplateColumns.trim().split(/\s+/).length,
    );
    expect(responsiveColumns).toBe(3);
    const moreCategories = library.getByRole("button", { name: "Ver más categorías" });
    for (let attempt = 0; attempt < 6 && await moreCategories.isEnabled(); attempt += 1) {
      await moreCategories.evaluate((button: HTMLButtonElement) => button.click());
      await page.waitForTimeout(120);
    }
    await expect(library.getByRole("button", { name: "Creados" })).toBeVisible();
    const addNewPatients = library.getByRole("button", { name: "Agregar Nuevos pacientes del mes" });
    const scrollBeforeAdd = await page.locator(".nc-dashboard-main").evaluate((element) => element.scrollTop);
    await addNewPatients.click();
    await expect(library).toBeVisible();
    await expect(addNewPatients).toBeDisabled();
    const addedWidget = page.locator('[data-dashboard-widget-id="newPatientsThisMonth"]');
    await expect(addedWidget).toHaveAttribute("data-highlighted", "true");
    await expect(addedWidget.locator(".nc-dashboard-widget-frame__name")).toHaveCSS("font-weight", "400");
    await expect.poll(() => page.locator(".nc-dashboard-main").evaluate((element) => element.scrollTop)).toBeGreaterThan(scrollBeforeAdd + 80);
    await library.getByRole("button", { name: "Cerrar" }).click();
    await page.getByRole("button", { name: "Agregar widgets" }).click();
    await expect(library).toHaveCSS("opacity", "1");
    const reopenedLibraryBox = await library.boundingBox();
    expect(reopenedLibraryBox).not.toBeNull();
    expect(reopenedLibraryBox!.x).toBeCloseTo(initialLibraryBox!.x, 0);
    expect(reopenedLibraryBox!.y).toBeCloseTo(initialLibraryBox!.y, 0);
    expect(reopenedLibraryBox!.width).toBeCloseTo(initialLibraryBox!.width, 0);
    expect(reopenedLibraryBox!.height).toBeCloseTo(initialLibraryBox!.height, 0);
    await library.getByRole("button", { name: "Cerrar" }).click();

    await expect(page.getByText("Editando dashboard")).toBeVisible();
    await page.getByRole("button", { name: /^Guardar$/ }).click();
    await expect(page.getByText("Nuevos pacientes del mes").first()).toBeVisible();

    await page.reload();
    await expect(page.getByText("Nuevos pacientes del mes").first()).toBeVisible();
    const stored = await storedDashboard(page);
    expect(stored?.widgets.some((widget: { definitionId: string }) => widget.definitionId === "newPatientsThisMonth")).toBe(true);
  });

  test("crea un KPI personalizado declarativo", async ({ page }) => {
    await page.getByRole("button", { name: "Personalizar KPIs", exact: true }).click();
    await page.getByRole("button", { name: "Agregar widgets" }).click();
    const library = page.getByRole("region", { name: "Biblioteca de widgets" });
    await library.getByRole("button", { name: "Crear KPI" }).click();

    const builder = page.getByRole("dialog", { name: "Crear KPI personalizado" });
    await builder.getByLabel("Nombre del KPI").fill("Cobranza personalizada");
    await builder.getByLabel("Descripción").fill("Cobros acumulados del mes");
    await builder.getByLabel("Fuente de datos").selectOption("payments");
    await builder.getByLabel("Indicador").selectOption("payments.incomeThisMonth");
    await builder.getByRole("button", { name: "Crear y agregar" }).click();

    await expect(page.getByText("Cobranza personalizada").first()).toBeVisible();
    await page.getByRole("button", { name: /^Guardar$/ }).click();
    await page.reload();
    await expect(page.getByText("Cobranza personalizada").first()).toBeVisible();

    await page.getByRole("button", { name: "Personalizar KPIs", exact: true }).click();
    await page.getByRole("button", { name: "Agregar widgets" }).click();
    await page.getByRole("region", { name: "Biblioteca de widgets" }).getByRole("button", { name: "Eliminar Cobranza personalizada" }).click();
    await page.getByRole("dialog", { name: "¿Eliminar este KPI personalizado?" }).getByRole("button", { name: "Eliminar KPI" }).click();
    await page.getByRole("button", { name: /^Guardar$/ }).click();
    await page.reload();
    await expect(page.getByText("Cobranza personalizada")).toBeHidden();
  });

  test("ofrece creación asistida por IA con revisión previa", async ({ page }) => {
    await page.getByRole("button", { name: "Personalizar KPIs", exact: true }).click();
    await page.getByRole("button", { name: "Agregar widgets" }).click();
    await page.getByRole("region", { name: "Biblioteca de widgets" }).getByRole("button", { name: "Crear KPI" }).click();

    const builder = page.getByRole("dialog", { name: "Crear KPI personalizado" });
    await builder.getByRole("tab", { name: /Crear con IA/ }).click();
    await expect(builder.getByLabel("¿Cómo quieres tu KPI?")).toBeVisible();
    await builder.getByLabel("¿Cómo quieres tu KPI?").fill("Quiero ver el porcentaje de citas sin confirmar");
    const generateButton = builder.getByRole("button", { name: "Generar propuesta" });
    if (await generateButton.isDisabled()) {
      await expect(builder.getByText(/La IA no está disponible|La IA está desactivada/)).toBeVisible();
    } else {
      await expect(generateButton).toBeEnabled();
    }

    await builder.getByRole("tab", { name: /Configurar manualmente/ }).click();
    await expect(builder.getByLabel("Nombre del KPI")).toBeVisible();
  });

  test("genera, valida y confirma un KPI mediante el contrato de IA", async ({ page }) => {
    await page.evaluate(() => {
      const stored = JSON.parse(localStorage.getItem("preferences-store") ?? '{"state":{},"version":0}');
      stored.state = { ...stored.state, aiEnabled: true, aiProvider: "ollama" };
      localStorage.setItem("preferences-store", JSON.stringify(stored));
    });
    await page.route("**/ai/complete", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          content: JSON.stringify({
            name: "Citas por confirmar",
            description: "Porcentaje de citas próximas que requieren confirmación.",
            source: "agenda",
            valueField: "agenda.unconfirmed",
            metric: "percentage",
            comparison: "none",
            visualization: "progress",
            tone: "blue",
            iconKey: "calendar",
            category: "agenda",
            size: "wide",
            precision: 1,
            notation: "standard",
            prefix: "",
            suffix: "",
            trendDirection: "decreaseIsPositive",
            reasoning: "Una barra permite identificar rápidamente las citas pendientes.",
          }),
          model: "llama3.2:latest",
          provider: "ollama",
          finishReason: "stop",
          usage: { promptTokens: 120, completionTokens: 90, totalTokens: 210 },
        }),
      });
    });
    await page.reload();
    await page.getByRole("button", { name: "Personalizar KPIs", exact: true }).click();
    await page.getByRole("button", { name: "Agregar widgets" }).click();
    await page.getByRole("region", { name: "Biblioteca de widgets" }).getByRole("button", { name: "Crear KPI" }).click();

    const builder = page.getByRole("dialog", { name: "Crear KPI personalizado" });
    await builder.getByRole("tab", { name: /Crear con IA/ }).click();
    await builder.getByLabel("¿Cómo quieres tu KPI?").fill("Quiero el porcentaje de citas sin confirmar en una barra azul");
    await builder.getByRole("button", { name: "Generar propuesta" }).click();

    await expect(builder.getByRole("article", { name: "Propuesta de KPI generada" })).toContainText("Citas por confirmar");
    await expect(builder.getByText("Conexión y respuesta verificadas")).toBeVisible();
    await builder.getByRole("button", { name: "Aplicar y revisar campos" }).click();
    await expect(builder.getByLabel("Nombre del KPI")).toHaveValue("Citas por confirmar");
    await builder.getByRole("button", { name: "Crear y agregar" }).click();
    await page.getByRole("button", { name: /^Guardar$/ }).click();

    const stored = await storedDashboard(page);
    expect(stored.customKpis.find((item: { name: string }) => item.name === "Citas por confirmar")).toMatchObject({
      source: "agenda",
      valueField: "agenda.unconfirmed",
      metric: "percentage",
      visualization: "progress",
      trendDirection: "decreaseIsPositive",
    });
  });

  test("actualiza la vista previa para cada presentación del KPI", async ({ page }) => {
    await page.getByRole("button", { name: "Personalizar KPIs", exact: true }).click();
    await page.getByRole("button", { name: "Agregar widgets" }).click();
    await page.getByRole("region", { name: "Biblioteca de widgets" }).getByRole("button", { name: "Crear KPI" }).click();

    const builder = page.getByRole("dialog", { name: "Crear KPI personalizado" });
    const preview = builder.locator(".nc-dashboard-custom-kpi__preview-card");
    await expect(preview).toHaveAttribute("data-visualization", "largeNumber");

    await builder.getByRole("button", { name: /^Tarjeta simple/ }).click();
    await expect(preview).toHaveAttribute("data-visualization", "simpleCard");
    await expect(preview).toHaveCSS("border-style", "solid");

    await builder.getByRole("button", { name: /^Porcentaje/ }).click();
    await expect(preview).toHaveAttribute("data-visualization", "percentage");
    await expect(preview.locator(".nc-dashboard-custom-kpi__preview-percentage")).toBeVisible();

    await builder.getByRole("button", { name: /^Barra de progreso/ }).click();
    await expect(preview).toHaveAttribute("data-visualization", "progress");
    await expect(preview.locator(".nc-dashboard-custom-kpi__preview-progress")).toBeVisible();
  });

  test("aplica opciones avanzadas de formato a la vista previa", async ({ page }) => {
    await page.getByRole("button", { name: "Personalizar KPIs", exact: true }).click();
    await page.getByRole("button", { name: "Agregar widgets" }).click();
    await page.getByRole("region", { name: "Biblioteca de widgets" }).getByRole("button", { name: "Crear KPI" }).click();

    const builder = page.getByRole("dialog", { name: "Crear KPI personalizado" });
    await builder.getByLabel("Fuente de datos").selectOption("payments");
    await builder.getByLabel("Indicador").selectOption("payments.incomeThisMonth");
    await builder.getByText("Opciones avanzadas de valor").click();
    await builder.getByLabel("Precisión decimal").selectOption("1");
    await builder.getByLabel("Notación numérica").selectOption("compact");
    await builder.getByLabel("Prefijo opcional").fill("≈");
    await builder.getByLabel("Sufijo opcional").fill(" MXN");
    await builder.getByLabel("Interpretación de tendencia").selectOption("decreaseIsPositive");

    const preview = builder.locator(".nc-dashboard-custom-kpi__preview");
    await expect(preview).toContainText("Notación compacta");
    const previewValue = await preview.locator(".nc-dashboard-custom-kpi__preview-copy > b").textContent();
    expect(previewValue?.startsWith("≈")).toBe(true);
    expect(previewValue?.endsWith("MXN")).toBe(true);

    await builder.getByLabel("Nombre del KPI").fill("Ingreso compacto avanzado");
    await builder.getByRole("button", { name: "Crear y agregar" }).click();
    await page.getByRole("button", { name: /^Guardar$/ }).click();
    const stored = await storedDashboard(page);
    const advanced = stored.customKpis.find((item: { name: string }) => item.name === "Ingreso compacto avanzado");
    expect(advanced).toMatchObject({
      precision: 1,
      notation: "compact",
      prefix: "≈",
      suffix: "MXN",
      trendDirection: "decreaseIsPositive",
    });
  });

  test("permite cancelar una plantilla sin alterar el dashboard guardado", async ({ page }) => {
    await page.getByRole("button", { name: "Personalizar KPIs", exact: true }).click();
    await page.getByRole("button", { name: "Plantillas" }).click();
    await page.getByRole("dialog", { name: "Elegir plantilla" }).getByRole("button", { name: /Vacío/ }).click();
    await expect(page.getByText("Tu dashboard está vacío")).toBeVisible();
    await page.getByRole("button", { name: "Agregar widgets" }).click();
    const library = page.getByRole("region", { name: "Biblioteca de widgets" });
    await expect(library).toBeVisible();

    await page.getByRole("button", { name: /^Cancelar$/ }).click();
    await expect(library).toBeHidden();
    const confirmation = page.getByRole("dialog", { name: "¿Descartar los cambios?" });
    await confirmation.getByRole("button", { name: "Descartar cambios" }).click();
    await expect(page.getByText("Pacientes activos").first()).toBeVisible();
    await expect(page.getByText("Editando dashboard")).toBeHidden();
  });

  test("cancela la edición con Escape", async ({ page }) => {
    await page.getByRole("button", { name: "Personalizar KPIs", exact: true }).click();
    await expect(page.getByText("Editando dashboard")).toBeVisible();

    await page.keyboard.press("Escape");

    await expect(page.getByText("Editando dashboard")).toBeHidden();
    await expect(page.getByRole("button", { name: "Personalizar KPIs", exact: true })).toBeEnabled();
  });

  test("descarta el modo edición al salir del dashboard", async ({ page }) => {
    await page.getByRole("button", { name: "Personalizar KPIs", exact: true }).click();
    await expect(page.getByText("Editando dashboard")).toBeVisible();
    await page.getByRole("button", { name: "Ocultar Pacientes activos" }).click();
    await expect(page.getByText("Tienes cambios sin guardar")).toBeVisible();

    await page.locator('a[href="#/pacientes"]').first().click();
    const leaveConfirmation = page.getByRole("dialog", { name: "¿Salir sin guardar?" });
    await expect(leaveConfirmation).toBeVisible();
    await expect(leaveConfirmation).toContainText("Los cambios de personalización no guardados se descartarán.");
    await leaveConfirmation.getByRole("button", { name: "Cancelar" }).click();
    await expect(page.getByText("Editando dashboard")).toBeVisible();

    await page.locator('a[href="#/pacientes"]').first().click();
    await page.getByRole("dialog", { name: "¿Salir sin guardar?" })
      .getByRole("button", { name: "Salir y descartar" }).click();
    await expect(page.getByRole("heading", { name: "Pacientes", exact: true })).toBeVisible();
    await page.locator('a[href="#/"]').first().click();

    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByText("Editando dashboard")).toBeHidden();
    await expect(page.getByText("Pacientes activos").first()).toBeVisible();
  });

  test("ofrece reordenación simple y mantiene el viewport móvil", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await page.getByRole("button", { name: "Personalizar KPIs", exact: true }).click();

    await page.getByRole("button", { name: "Agregar widgets" }).click();
    const mobileLibrary = page.getByRole("region", { name: "Biblioteca de widgets" });
    const mobileLibraryPosition = await mobileLibrary.evaluate((element) => {
      const box = element.getBoundingClientRect();
      return {
        left: box.left,
        right: box.right,
        position: getComputedStyle(element).position,
        viewportWidth: window.innerWidth,
      };
    });
    expect(mobileLibraryPosition.position).toBe("fixed");
    expect(mobileLibraryPosition.left).toBeGreaterThanOrEqual(-1);
    expect(mobileLibraryPosition.right).toBeLessThanOrEqual(mobileLibraryPosition.viewportWidth + 1);
    await mobileLibrary.getByRole("button", { name: "Cerrar" }).click();

    await expect(page.getByRole("button", { name: "Subir Consultas de hoy" })).toBeVisible();
    await page.getByRole("button", { name: "Subir Consultas de hoy" }).click();
    await page.getByRole("button", { name: /^Guardar$/ }).click();

    const viewport = await page.evaluate(() => ({
      innerWidth: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.innerWidth + 1);
  });

  test("reordena y cambia el tamaño de widgets desde los controles accesibles", async ({ page }) => {
    await page.getByRole("button", { name: "Personalizar KPIs", exact: true }).click();

    await page.getByRole("button", { name: "Bajar Pacientes activos" }).click();
    await page.getByRole("button", { name: "Configurar Pacientes activos" }).click();
    const config = page.getByRole("dialog", { name: "Configurar widget" });
    await config.getByRole("button", { name: "Ancho" }).click();
    await config.getByRole("button", { name: "Aplicar cambios" }).click();

    await page.getByRole("button", { name: /^Guardar$/ }).click();
    const stored = await storedDashboard(page);
    const patients = stored.layout.find((item: { i: string }) => item.i === "activePatients");
    expect(patients.w).toBe(6);
    expect(stored.smallScreenOrder[0]).toBe("consultationsToday");
  });

  test("abre el editor mediante enlace y respeta los temas aprobados", async ({ page }) => {
    for (const theme of ["light", "dark", "alternative"] as const) {
      await page.evaluate((nextTheme) => {
        localStorage.setItem("ui-store", JSON.stringify({ state: { theme: nextTheme }, version: 0 }));
        localStorage.setItem("theme", nextTheme);
      }, theme);
      await page.goto(hashUrl("/"));
      await page.reload();
      await expect(page.locator("html")).toHaveClass(new RegExp(`(^|\\s)${theme}(\\s|$)`), { timeout: 15_000 });
      await page.goto(hashUrl("/?customize=1"));
      await expect(page.getByText("Editando dashboard")).toBeVisible({ timeout: 15_000 });
      await page.getByRole("button", { name: "Agregar widgets" }).click();
      const library = page.getByRole("region", { name: "Biblioteca de widgets" });
      await expect(library).toBeVisible();
      await page.getByRole("button", { name: /^Cancelar$/ }).click();
      await expect(library).toBeHidden();
    }
  });

  test("oculta, elimina y recupera widgets desde la biblioteca", async ({ page }) => {
    await page.getByRole("button", { name: "Personalizar KPIs", exact: true }).click();

    await page.getByRole("button", { name: "Ocultar Pacientes activos" }).click();
    await expect(page.getByRole("button", { name: "Configurar Pacientes activos" })).toBeHidden();

    await page.getByRole("button", { name: "Eliminar Accesos rápidos" }).click();
    await page.getByRole("dialog", { name: "¿Eliminar este widget?" }).getByRole("button", { name: "Eliminar widget" }).click();
    await expect(page.getByRole("heading", { name: "Accesos rápidos" })).toBeHidden();

    await page.getByRole("button", { name: /Agregar widgets/ }).click();
    const library = page.getByRole("region", { name: "Biblioteca de widgets" });
    await library.getByRole("button", { name: "Agregar Pacientes activos" }).click();
    await library.getByRole("button", { name: "Agregar Accesos rápidos" }).click();
    await library.getByRole("button", { name: "Cerrar" }).click();

    await expect(page.getByRole("button", { name: "Configurar Pacientes activos" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Accesos rápidos" })).toBeVisible();
    await page.getByRole("button", { name: /^Guardar$/ }).click();
  });

  test("permite arrastrar y redimensionar widgets con controles dedicados", async ({ page }) => {
    await page.getByRole("button", { name: "Personalizar KPIs", exact: true }).click();

    const sourceHandle = page.getByRole("button", { name: "Configurar Pacientes activos" })
      .locator("xpath=ancestor::*[contains(concat(' ', normalize-space(@class), ' '), ' nc-dashboard-widget-frame ')]");
    const target = page.getByRole("button", { name: "Configurar Ingresos del mes" });
    const sourceBox = await sourceHandle.boundingBox();
    const targetBox = await target.boundingBox();
    expect(sourceBox).not.toBeNull();
    expect(targetBox).not.toBeNull();
    await page.mouse.move(sourceBox!.x + sourceBox!.width / 2, sourceBox!.y + sourceBox!.height * 0.72);
    await page.mouse.down();
    await page.mouse.move(targetBox!.x + targetBox!.width / 2, targetBox!.y + targetBox!.height / 2, { steps: 12 });
    await page.mouse.up();
    await expect(page.getByText("Tienes cambios sin guardar")).toBeVisible();
    const gridShell = page.locator(".nc-dashboard-editable-grid-shell");
    await expect(gridShell).not.toHaveAttribute("data-dragging", "true");

    const consultationItem = page
      .getByRole("button", { name: "Configurar Consultas de hoy" })
      .locator("xpath=ancestor::*[contains(concat(' ', normalize-space(@class), ' '), ' nc-dashboard-widget-frame ')]");
    const resizeHandle = consultationItem.getByRole("separator", { name: "Redimensionar Consultas de hoy desde esquina inferior derecha", exact: true });
    await resizeHandle.hover();
    const resizeBox = await resizeHandle.boundingBox();
    expect(resizeBox).not.toBeNull();
    await page.mouse.down();
    await expect(gridShell).toHaveAttribute("data-resizing", "true");
    await page.mouse.move(resizeBox!.x + resizeBox!.width / 2 + 85, resizeBox!.y + resizeBox!.height / 2 + 55, { steps: 8 });
    await page.mouse.up();

    await page.getByRole("button", { name: /^Guardar$/ }).click();

    const positions = (await storedDashboard(page))?.layout ?? [];
    const position = positions.find((item: { i: string }) => item.i === "activePatients");
    const consultationPosition = positions.find((item: { i: string }) => item.i === "consultationsToday");
    expect(position.x !== 0 || position.y !== 0).toBeTruthy();
    expect(consultationPosition.w !== 3 || consultationPosition.h !== 3).toBeTruthy();
  });

  test("compacta el resumen financiero y avisa al alcanzar su mínimo", async ({ page }) => {
    await page.getByRole("button", { name: "Personalizar KPIs", exact: true }).click();
    const financialFrame = page.getByRole("button", { name: "Configurar Resumen financiero" })
      .locator("xpath=ancestor::*[contains(concat(' ', normalize-space(@class), ' '), ' nc-dashboard-widget-frame ')]");
    const eastHandle = financialFrame.getByRole("separator", { name: "Redimensionar Resumen financiero desde derecha", exact: true });

    await eastHandle.press("ArrowLeft");
    await eastHandle.press("ArrowLeft");
    const overview = financialFrame.locator(".nc-dashboard-financial-overview");
    await expect(overview).toBeVisible();
    const compactState = await overview.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        columns: style.gridTemplateColumns.trim().split(/\s+/).length,
        fitsWidth: element.scrollWidth <= element.clientWidth + 1,
        fitsHeight: element.scrollHeight <= element.clientHeight + 1,
      };
    });
    expect(compactState.columns).toBe(1);
    expect(compactState.fitsWidth).toBe(true);
    expect(compactState.fitsHeight).toBe(true);

    await eastHandle.press("ArrowLeft");
    await eastHandle.press("ArrowLeft");
    await eastHandle.press("ArrowLeft");
    const constraintToasts = page.locator("[data-sonner-toast][data-type='error']");
    await expect(constraintToasts).toHaveCount(1);
    await expect(constraintToasts).toContainText("Resumen financiero no puede continuar en esa dirección.");
    await expect(constraintToasts).toHaveCSS("background-color", "rgb(255, 241, 242)");
  });

  test("mantiene todos los widgets dentro de sus tarjetas al tamaño mínimo", async ({ page }) => {
    await page.getByRole("button", { name: "Personalizar KPIs", exact: true }).click();

    const resize = async (title: string, edge: "derecha" | "abajo", key: "ArrowLeft" | "ArrowUp", steps: number) => {
      const frame = page.getByRole("button", { name: `Configurar ${title}` })
        .locator("xpath=ancestor::*[contains(concat(' ', normalize-space(@class), ' '), ' nc-dashboard-widget-frame ')]");
      const handle = frame.getByRole("separator", { name: `Redimensionar ${title} desde ${edge}`, exact: true });
      for (let step = 0; step < steps; step += 1) await handle.press(key);
    };

    await resize("Próximas consultas", "derecha", "ArrowLeft", 1);
    await resize("Próximas consultas", "abajo", "ArrowUp", 1);
    await resize("Actividad semanal", "derecha", "ArrowLeft", 2);
    await resize("Actividad semanal", "abajo", "ArrowUp", 1);
    await resize("Alertas y pendientes", "abajo", "ArrowUp", 1);
    await resize("Resumen financiero", "derecha", "ArrowLeft", 2);
    await resize("Pagos recientes", "derecha", "ArrowLeft", 1);
    await resize("Pagos recientes", "abajo", "ArrowUp", 1);

    const cards = page.locator(".nc-dashboard-widget-frame__content > .nc-dashboard-section-card, .nc-dashboard-widget-frame__content > .nc-dashboard-kpi-card");
    const fitStates = await cards.evaluateAll((elements) => elements.map((element) => ({
      label: element.getAttribute("aria-label") ?? element.querySelector("h2")?.textContent ?? "widget",
      fitsWidth: element.scrollWidth <= element.clientWidth + 1,
      fitsHeight: element.scrollHeight <= element.clientHeight + 1,
    })));
    expect(fitStates.filter((state) => !state.fitsWidth || !state.fitsHeight)).toEqual([]);

    const activity = page.getByRole("button", { name: "Configurar Actividad semanal" })
      .locator("xpath=ancestor::*[contains(concat(' ', normalize-space(@class), ' '), ' nc-dashboard-widget-frame ')]");
    const activityBounds = await activity.evaluate((frame) => {
      const card = frame.querySelector(".nc-dashboard-section-card")!.getBoundingClientRect();
      const summary = frame.querySelector(".nc-dashboard-weekly-summary")!.getBoundingClientRect();
      return { summaryInside: summary.bottom <= card.bottom + 1, chartHeight: frame.querySelector(".nc-dashboard-weekly-chart")!.clientHeight };
    });
    expect(activityBounds.summaryInside).toBe(true);
    expect(activityBounds.chartHeight).toBeGreaterThanOrEqual(84);
  });
});
