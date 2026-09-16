import { expect, test, type Page } from "@playwright/test";
import { fakeLogin, hashUrl } from "./helpers";

const BRANCH_ID = "e2e-patient-directory";

async function seedDirectory(page: Page) {
  await page.evaluate(
    ({ branchId }) =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open("nutriclinica");
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction("patients", "readwrite");
          const patients = transaction.objectStore("patients");
          transaction.onerror = () => reject(transaction.error);
          transaction.oncomplete = () => resolve();

          const makePatient = (
            index: number,
            overrides: Record<string, unknown> = {},
          ) => ({
            id: `018f0000-0000-7000-8000-${String(index).padStart(12, "0")}`,
            sucursal_id: branchId,
            first_name: `Paciente ${String(index).padStart(2, "0")}`,
            last_name: "Directorio",
            second_last_name: null,
            birth_date: "1990-01-15T12:00:00.000Z",
            sex: index % 2 === 0 ? "male" : "female",
            gender: null,
            marital_status: null,
            occupation: null,
            education: null,
            email: `paciente${index}@example.com`,
            phone: `555000${String(index).padStart(4, "0")}`,
            secondary_phone: null,
            emergency_contact_name: null,
            emergency_contact_relationship: null,
            emergency_contact_phone: null,
            record_status: "active",
            record_opened_at: "2025-01-01T12:00:00.000Z",
            general_notes: null,
            consentimiento_informado_id: null,
            fecha_firma_consentimiento: null,
            version_politica_privacidad: null,
            clinical_tags: "[]",
            clave_interna: `DIR-${String(index).padStart(3, "0")}`,
            birth_place: null,
            address: null,
            nationality: null,
            id_type: null,
            id_number: null,
            discharge_reason: null,
            responsible_professional_id: null,
            external_record_number: null,
            photo_url: null,
            status: "active",
            created_at: "2025-01-01T12:00:00.000Z",
            updated_at: "2025-01-01T12:00:00.000Z",
            deleted_at: null,
            ...overrides,
          });

          for (let index = 1; index <= 12; index += 1) {
            patients.put(
              makePatient(
                index,
                index === 1
                  ? {
                      first_name: "María",
                      phone: "+52 55 5123 4567",
                      clave_interna: "EXP-UNICO",
                    }
                  : {},
              ),
            );
          }
          patients.put(makePatient(13, { id: "legacy-directory" }));
          patients.put(
            makePatient(14, {
              id: "deleted-directory",
              first_name: "Eliminado",
              status: "inactive",
              deleted_at: "2026-01-10T12:00:00.000Z",
            }),
          );
          patients.put(
            makePatient(15, {
              id: "other-directory",
              first_name: "Otra sucursal",
              sucursal_id: "other-branch",
            }),
          );
        };
      }),
    { branchId: BRANCH_ID },
  );
}

async function seedClinicalDrawerData(page: Page) {
  await page.evaluate(
    ({ patientId, branchId }) =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open("nutriclinica");
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction(
            [
              "anthropometry",
              "appointments",
              "consultations",
              "goals",
              "meal_plans",
            ],
            "readwrite",
          );
          transaction.onerror = () => reject(transaction.error);
          transaction.oncomplete = () => resolve();

          const measuredWeights = [88, 87.4, 88.1, 88.5, 88.2, 88.6];
          measuredWeights.forEach((weight, index) => {
            transaction.objectStore("anthropometry").put({
              id: `directory-measurement-${index}`,
              sucursal_id: branchId,
              patient_id: patientId,
              measured_at: `2026-0${index + 2}-01T12:00:00.000Z`,
              weight_kg: weight,
              height_m: 1.766,
              circumferences: { waist: index === 5 ? 98 : 99 },
              skinfolds: null,
              bia_json: JSON.stringify({
                bodyFatPct: index === 5 ? 29.6 : 30.2,
              }),
              notes: null,
              created_at: "2026-08-01T12:00:00.000Z",
              updated_at: "2026-08-01T12:00:00.000Z",
              deleted_at: null,
            });
          });

          Array.from({ length: 7 }, (_, index) => index).forEach((index) => {
            transaction.objectStore("appointments").put({
              id: `directory-appointment-${index}`,
              patient_id: patientId,
              professional_id: "directory-professional",
              office_id: branchId,
              date: `2026-0${index + 1}-15`,
              start_time: "10:00",
              end_time: "11:00",
              duration_min: 60,
              type: "seguimiento",
              status: index < 4 ? "completed" : "no_show",
              reason: "Seguimiento",
              notes: "",
              consultation_id:
                index < 4 ? `directory-consultation-${index}` : null,
              reminder_sent: 1,
              confirmed_at: null,
              cancelled_reason: "",
              rescheduled_from_id: null,
              cost: 0,
              paid: 0,
              payment_method: "",
              created_at: Date.now(),
              updated_at: Date.now(),
            });
          });

          transaction.objectStore("meal_plans").put({
            id: "directory-active-plan",
            sucursal_id: branchId,
            patient_id: patientId,
            consultation_id: null,
            name: "Déficit moderado",
            description: null,
            start_date: "2026-07-01T12:00:00.000Z",
            end_date: "2026-09-23T12:00:00.000Z",
            kcal_target: 2100,
            protein_target_g: 157.5,
            carbs_target_g: 220.5,
            fat_target_g: 65.333,
            meals_json: JSON.stringify([
              {
                slot: "breakfast",
                exchanges: [{ foodId: "food-1", count: 1 }],
              },
              {
                slot: "morning-snack",
                exchanges: [{ foodId: "food-2", count: 1 }],
              },
              {
                slot: "lunch",
                exchanges: [{ foodId: "food-3", count: 1 }],
              },
              {
                slot: "afternoon-snack",
                exchanges: [{ foodId: "food-4", count: 1 }],
              },
              {
                slot: "dinner",
                exchanges: [{ foodId: "food-5", count: 1 }],
              },
            ]),
            notes: null,
            status: "active",
            created_at: "2026-07-01T12:00:00.000Z",
            updated_at: "2026-08-01T12:00:00.000Z",
            deleted_at: null,
          });

          transaction.objectStore("goals").put({
            id: "directory-weight-goal",
            patient_id: patientId,
            consultation_origin_id: null,
            type: "antropometrica",
            variable: "Peso",
            initial_value: 90,
            initial_value_date: "2026-02-01",
            target_value: 88,
            unit: "kg",
            start_date: "2026-02-01",
            target_date: "2026-09-01",
            close_date: null,
            status: "activo",
            criterion: "menor_igual",
            criterion_detail: "",
            priority: "alta",
            source: "consulta",
            reason: "Meta de peso",
            action_plan: "",
            tracking_metrics: "[]",
            alerts: "[]",
            professional_id: "directory-professional",
            notes: "",
            created_at: Date.now(),
            updated_at: Date.now(),
          });

          transaction.objectStore("consultations").put({
            id: "directory-latest-consultation",
            sucursal_id: branchId,
            patient_id: patientId,
            consultation_date: "2026-07-30T12:00:00.000Z",
            consultation_number: 4,
            reason: "Seguimiento nutricional",
            subjective: null,
            objective: null,
            vitals_json: null,
            assessment: null,
            plan: "Mantener hidratación y registrar comidas.",
            anthropometry_id: "directory-measurement-5",
            lab_panel_id: null,
            next_visit_date: null,
            status: "completed",
            cost: 0,
            paid: true,
            payment_status: "paid",
            payment_concept: "consulta",
            payment_method: null,
            paid_at: null,
            reference: null,
            invoice_number: null,
            billing_notes: null,
            amount_paid: null,
            created_at: "2026-07-30T12:00:00.000Z",
            updated_at: "2026-07-30T12:00:00.000Z",
            deleted_at: null,
          });
        };
      }),
    {
      patientId: "018f0000-0000-7000-8000-000000000001",
      branchId: BRANCH_ID,
    },
  );
}

async function openDirectory(page: Page) {
  await page.goto(hashUrl("/"));
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible({
    timeout: 30_000,
  });
  await seedDirectory(page);
  await page.goto(hashUrl("/pacientes"));
  await expect(
    page.getByRole("heading", { name: "Pacientes", exact: true }),
  ).toBeVisible();
}

test.describe("directorio de pacientes", () => {
  test.beforeEach(async ({ page }) => {
    await fakeLogin(page, BRANCH_ID);
  });

  test("busca por teléfono y separa la papelera", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await openDirectory(page);
    await expect(
      page.getByText("13 pacientes activos", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText(/Expedientes al día \d+%/)).toBeVisible();
    await expect(page.locator(".nc-patients-insights article")).toHaveCount(5);
    await expect(
      page.getByText("Requieren contacto", { exact: true }).first(),
    ).toBeVisible();
    await expect(page.locator(".nc-patients-tableWrap")).toBeVisible();
    await expect(
      page.getByRole("columnheader", { name: "Objetivo y plan activo" }),
    ).toBeVisible();
    await expect(
      page.getByRole("columnheader", { name: "Progreso vs. meta" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Importar CSV" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Agregar paciente" }),
    ).toHaveCount(0);
    await expect(
      page
        .locator(".nc-dashboard-header")
        .getByRole("button", { name: "Agregar paciente" }),
    ).toBeVisible();

    await expect(page.getByRole("button", { name: "Tabla" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(
      page.getByRole("heading", { name: "Acciones de hoy" }),
    ).toBeVisible();
    await expect(
      page.locator(".nc-patients-tabs").getByRole("tab", { name: /Todos 13/ }),
    ).toBeVisible();
    await expect(
      page
        .locator(".nc-patients-tabs")
        .getByRole("tab", { name: /En riesgo 13/ }),
    ).toBeVisible();

    const referenceLayout = await page.evaluate(() => {
      const pageContent =
        document.querySelector<HTMLElement>(".nc-patients-page")!;
      const hero = document.querySelector<HTMLElement>(".nc-patients-hero")!;
      const today = document.querySelector<HTMLElement>(".nc-patients-today")!;
      const directory = document.querySelector<HTMLElement>(
        ".nc-patients-directory",
      )!;
      const importButton = document.querySelector<HTMLElement>(
        ".nc-patients-importButton",
      )!;
      const search = document.querySelector<HTMLElement>(
        ".nc-patients-search",
      )!;
      const filter = document.querySelector<HTMLElement>(
        ".nc-patients-filterButton",
      )!;
      const toolbar = document.querySelector<HTMLElement>(
        ".nc-patients-toolbar",
      )!;
      const sidebar = document.querySelector<HTMLElement>(
        ".nc-dashboard-sidebar",
      )!;
      const results = document.querySelector<HTMLElement>(
        ".nc-patients-results",
      )!;
      const firstRow = document.querySelector<HTMLElement>(
        ".nc-patients-tableWrap tbody tr",
      )!;
      const firstAvatar =
        firstRow.querySelector<HTMLElement>(".nc-patient-avatar")!;
      const firstAction = firstRow.querySelector<HTMLElement>(
        ".nc-patient-actions",
      )!;
      const heroRect = hero.getBoundingClientRect();
      const todayRect = today.getBoundingClientRect();
      const directoryRect = directory.getBoundingClientRect();
      const toolbarRect = toolbar.getBoundingClientRect();
      const searchRect = search.getBoundingClientRect();
      const resultsRect = results.getBoundingClientRect();
      const importRect = importButton.getBoundingClientRect();
      const filterRect = filter.getBoundingClientRect();
      const toolbarStyle = getComputedStyle(toolbar);
      const resultsStyle = getComputedStyle(results);

      return {
        pageWidth: pageContent.getBoundingClientRect().width,
        contentFlow:
          heroRect.bottom <= todayRect.top &&
          todayRect.bottom <= toolbarRect.top &&
          toolbarRect.bottom <= resultsRect.top,
        sidebarWidth: sidebar.getBoundingClientRect().width,
        heroHeight: heroRect.height,
        todayHeight: todayRect.height,
        toolbarHeight: toolbarRect.height,
        toolbarRadius: toolbarStyle.borderTopLeftRadius,
        importHeight: importRect.height,
        filterImportGap: importRect.left - filterRect.right,
        filterBeforeImport: filterRect.right <= importRect.left,
        searchWidth: searchRect.width,
        searchHeight: search.querySelector("input")!.getBoundingClientRect()
          .height,
        filterHeight: filter.getBoundingClientRect().height,
        resultsInset: Math.round(resultsRect.left - directoryRect.left),
        resultsBorder: resultsStyle.borderTopWidth,
        resultsRadius: resultsStyle.borderTopLeftRadius,
        rowHeight: firstRow.getBoundingClientRect().height,
        avatarWidth: firstAvatar.getBoundingClientRect().width,
        actionWidth: firstAction.getBoundingClientRect().width,
        noHorizontalOverflow:
          document.documentElement.scrollWidth <= window.innerWidth,
      };
    });
    expect(referenceLayout.pageWidth).toBeGreaterThan(1200);
    expect(referenceLayout.contentFlow).toBe(true);
    expect(referenceLayout.sidebarWidth).toBe(244);
    expect(referenceLayout.heroHeight).toBeCloseTo(97.5, 0);
    expect(referenceLayout.todayHeight).toBe(60);
    expect(referenceLayout.toolbarHeight).toBe(52);
    expect(referenceLayout.toolbarRadius).toBe("15px");
    expect(referenceLayout.importHeight).toBe(32);
    expect(referenceLayout.filterImportGap).toBe(8);
    expect(referenceLayout.filterBeforeImport).toBe(true);
    expect(referenceLayout.searchWidth).toBe(210);
    expect(referenceLayout.searchHeight).toBe(32);
    expect(referenceLayout.filterHeight).toBe(32);
    expect(referenceLayout.resultsInset).toBe(0);
    expect(referenceLayout.resultsBorder).toBe("1px");
    expect(referenceLayout.resultsRadius).toBe("15px");
    expect(referenceLayout.rowHeight).toBeCloseTo(62, 1);
    expect(referenceLayout.avatarWidth).toBe(30);
    expect(referenceLayout.actionWidth).toBe(22);
    expect(referenceLayout.noHorizontalOverflow).toBe(true);

    const mariaRow = page
      .locator(".nc-patients-tableWrap tbody tr")
      .filter({ hasText: "María Directorio" })
      .first();
    await expect(
      page.getByRole("checkbox", { name: "Seleccionar a María Directorio" }),
    ).toHaveCount(0);
    await mariaRow.hover();
    await expect
      .poll(() =>
        mariaRow.evaluate(
          (element) => getComputedStyle(element).backgroundColor,
        ),
      )
      .toBe("rgb(242, 247, 255)");
    await mariaRow.locator("td").nth(2).click();
    await expect(mariaRow).toHaveAttribute("aria-selected", "true");
    await expect
      .poll(() =>
        mariaRow.evaluate(
          (element) => getComputedStyle(element).backgroundColor,
        ),
      )
      .toBe("rgb(234, 242, 255)");
    const clinicalDrawer = page.getByRole("dialog", {
      name: "María Directorio",
    });
    await expect(clinicalDrawer).toBeVisible();
    await expect(clinicalDrawer).toContainText("Cumplimiento de citas");
    await expect(clinicalDrawer).toContainText("Evolución antropométrica");
    await expect(clinicalDrawer).toContainText("Plan activo");
    await expect(clinicalDrawer).toContainText("Nota de la última consulta");
    await expect(
      clinicalDrawer.getByRole("link", { name: "Abrir expediente" }),
    ).toBeVisible();
    await expect(
      clinicalDrawer.getByRole("link", { name: "Nueva consulta" }),
    ).toBeVisible();
    await expect(
      page.getByLabel("Acciones para pacientes seleccionados"),
    ).toBeHidden();
    await clinicalDrawer.getByRole("button", { name: "Cerrar" }).click();
    await expect(clinicalDrawer).toBeHidden();
    const bulkBar = page.getByLabel("Acciones para pacientes seleccionados");
    await expect(bulkBar).toContainText("1 seleccionados");
    await expect(
      bulkBar.getByRole("button", { name: "Exportar" }),
    ).toBeVisible();
    await bulkBar.getByRole("button", { name: "Enviar mensaje" }).click();
    const messageDialog = page.getByRole("dialog", { name: "Enviar mensaje" });
    await expect(messageDialog).toBeVisible();
    await expect(messageDialog).toContainText("María Directorio");
    await messageDialog.getByRole("button", { name: "Cancelar" }).click();
    await bulkBar.getByRole("button", { name: "Limpiar selección" }).click();
    await expect(bulkBar).toBeHidden();

    await page.getByRole("button", { name: "Tarjetas" }).click();
    await expect(page.locator(".nc-patient-card").first()).toBeVisible();
    await expect(page.locator(".nc-patients-tableWrap")).toBeHidden();
    await page.getByRole("button", { name: "Tabla" }).click();
    await expect(page.locator(".nc-patients-tableWrap")).toBeVisible();
    await page
      .getByRole("button", { name: "Acciones para María Directorio" })
      .click();
    for (const action of [
      "Resumen clínico",
      "Ver perfil",
      "Editar paciente",
      "Nueva consulta",
      "Enviar mensaje",
      "Agendar cita",
      "Ver historial",
      "Crear plan",
      "Archivar",
      "Eliminar / desactivar",
    ]) {
      await expect(page.getByRole("menuitem", { name: action })).toBeVisible();
    }
    await expect(
      page.getByRole("menuitem", { name: "Agendar cita" }),
    ).toHaveAttribute("href", /patientId=.*&create=1$/);
    await page.getByRole("menuitem", { name: "Resumen clínico" }).click();
    const summaryDrawer = page.getByRole("dialog", {
      name: "María Directorio",
    });
    await expect(summaryDrawer).toBeVisible();
    await expect(summaryDrawer).toContainText("Evolución antropométrica");
    await summaryDrawer.getByRole("button", { name: "Cerrar" }).click();

    const search = page.getByRole("textbox", { name: "Buscar pacientes" });
    await expect(search).toHaveAttribute(
      "placeholder",
      "Nombre, folio, teléfono o diagnóstico...",
    );
    await search.fill("555123");
    await expect(
      page.getByRole("link", { name: "María Directorio", exact: true }),
    ).toBeVisible();
    await expect(
      page
        .locator(".nc-patients-pagination")
        .getByText(/Mostrando 1–1 de 1 pacientes/),
    ).toBeVisible();

    await page.getByRole("button", { name: "Limpiar búsqueda" }).click();
    await page.getByRole("button", { name: "Filtros" }).click();
    await page.getByRole("combobox", { name: "Sexo" }).click();
    await page.getByRole("option", { name: "Masculino" }).click();
    await page.getByRole("button", { name: "Aplicar filtros" }).click();
    await expect(
      page.getByRole("link", { name: "María Directorio", exact: true }),
    ).toBeHidden();

    await page.getByRole("button", { name: /Filtros/ }).click();
    await page.getByRole("button", { name: "Limpiar filtros" }).click();
    await page.getByRole("button", { name: "Aplicar filtros" }).click();
    await page.getByRole("tab", { name: /Papelera/ }).click();
    await expect(
      page.locator("strong:visible", { hasText: "Eliminado Directorio" }),
    ).toBeVisible();
    await expect(page.getByText("María Directorio")).toBeHidden();
  });

  test("mantiene todas las acciones visibles en el ancho intermedio", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1536, height: 960 });
    await openDirectory(page);

    const todayActions = page.locator(
      ".nc-patients-today__list article button",
    );
    await expect(todayActions).toHaveCount(3);
    await expect(todayActions.last()).toBeVisible();
    await expect(page.locator(".nc-patients-statusTabs")).toBeVisible();
    await expect(page.locator(".nc-patients-importButton")).toBeVisible();

    const layout = await page.evaluate(() => {
      const pageContent =
        document.querySelector<HTMLElement>(".nc-patients-page")!;
      const pageRect = pageContent.getBoundingClientRect();
      const tableWrap = document.querySelector<HTMLElement>(
        ".nc-patients-tableWrap",
      )!;
      const insightRows = new Set(
        Array.from(
          document.querySelectorAll<HTMLElement>(
            ".nc-patients-insights article",
          ),
        ).map((element) => Math.round(element.getBoundingClientRect().top)),
      ).size;
      const rightmostSelectors = [
        ".nc-patients-hero__controls",
        ".nc-patients-today__list article:last-child button",
        ".nc-patients-statusTabs",
        ".nc-patients-toolbar__actions",
        ".nc-patients-results",
        ".nc-patients-tableWrap th:last-child",
      ];
      const rightmostElements = rightmostSelectors.map((selector) => ({
        selector,
        rect: document
          .querySelector<HTMLElement>(selector)!
          .getBoundingClientRect(),
      }));

      return {
        insightRows,
        toolbarHeight: Math.round(
          document
            .querySelector<HTMLElement>(".nc-patients-toolbar")!
            .getBoundingClientRect().height,
        ),
        pageFits:
          pageContent.scrollWidth <= pageContent.clientWidth + 1 &&
          pageRect.right <= window.innerWidth + 1,
        controlOverflows: rightmostElements
          .filter(({ rect }) => rect.right > pageRect.right + 1)
          .map(({ selector, rect }) => ({
            selector,
            overflow: Math.round((rect.right - pageRect.right) * 10) / 10,
          })),
        tableFits: tableWrap.scrollWidth <= tableWrap.clientWidth + 1,
      };
    });

    expect(layout).toEqual({
      insightRows: 1,
      toolbarHeight: 52,
      pageFits: true,
      controlOverflows: [],
      tableFits: true,
    });
  });

  test("muestra datos clínicos reales y una gráfica funcional en el resumen", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await openDirectory(page);
    await seedClinicalDrawerData(page);
    await page.reload();
    await page
      .getByRole("textbox", { name: "Buscar pacientes" })
      .fill("María Directorio");

    const mariaRow = page
      .locator(".nc-patients-tableWrap tbody tr")
      .filter({ hasText: "María Directorio" })
      .first();
    await expect(mariaRow).toBeVisible();
    await mariaRow.locator("td").nth(2).click();

    const drawer = page.getByRole("dialog", { name: "María Directorio" });
    await expect(drawer).toBeVisible();
    await expect(drawer).toContainText("88.6 kg");
    await expect(drawer).toContainText("28.4");
    await expect(drawer).toContainText("29.6%");
    await expect(drawer).toContainText("98 cm");
    await expect(drawer).toContainText("4 de 7 citas asistidas");
    await expect(drawer).toContainText("Déficit moderado");
    await expect(drawer).toContainText("2,100 kcal · 5 tiempos de comida");
    await expect(drawer).toContainText("Proteína30%");
    await expect(drawer).toContainText("Carbos42%");
    await expect(drawer).toContainText("Grasas28%");
    await expect(drawer).toContainText(
      "Mantener hidratación y registrar comidas.",
    );
    await expect(
      drawer.locator(".nc-patients-summaryDrawer__evolution svg"),
    ).toBeVisible();
    await expect(
      drawer.locator(".nc-patients-summaryDrawer__evolution circle"),
    ).toHaveCount(6);
    await expect(
      drawer.locator(
        ".nc-patients-summaryDrawer__attendanceTrack i[data-attended]",
      ),
    ).toHaveCount(4);
    await expect(
      drawer.locator(
        ".nc-patients-summaryDrawer__attendanceTrack i[data-missed]",
      ),
    ).toHaveCount(3);
    await expect(
      drawer.getByRole("link", { name: "Abrir expediente" }),
    ).toHaveAttribute(
      "href",
      "#/pacientes/018f0000-0000-7000-8000-000000000001",
    );
    await expect(
      drawer.getByRole("link", { name: "Nueva consulta" }),
    ).toHaveAttribute(
      "href",
      "#/pacientes/018f0000-0000-7000-8000-000000000001/consultas/nueva",
    );
  });

  test("aplica la escala y el fondo del resumen en Tauri", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, "__TAURI_INTERNALS__", {
        configurable: true,
        value: {},
      });
    });
    await page.setViewportSize({ width: 1536, height: 864 });
    await openDirectory(page);
    await seedClinicalDrawerData(page);
    await page.reload();
    await page
      .getByRole("textbox", { name: "Buscar pacientes" })
      .fill("María Directorio");

    const mariaRow = page
      .locator(".nc-patients-tableWrap tbody tr")
      .filter({ hasText: "María Directorio" })
      .first();
    await mariaRow.locator("td").nth(2).click();

    const drawer = page.getByRole("dialog", { name: "María Directorio" });
    const overlay = page.locator(".nc-patients-summaryDrawer__overlay--tauri");
    const geometry = await drawer.evaluate((element) => {
      const styles = getComputedStyle(element);
      const title = element.querySelector<HTMLElement>(
        ".nc-patients-summaryDrawer__header h2",
      )!;
      const primaryButton = element.querySelector<HTMLElement>(
        ".nc-patients-summaryDrawer__footer a",
      )!;
      return {
        width: element.getBoundingClientRect().width,
        fontFamily: styles.fontFamily,
        titleFontSize: getComputedStyle(title).fontSize,
        buttonHeight: primaryButton.getBoundingClientRect().height,
        buttonFontSize: getComputedStyle(primaryButton).fontSize,
      };
    });
    const overlayStyles = await overlay.evaluate((element) => {
      const styles = getComputedStyle(element);
      return {
        background: styles.backgroundColor,
        backdropFilter: styles.backdropFilter,
      };
    });

    expect(geometry.width).toBe(322);
    expect(geometry.fontFamily).toContain("Inter");
    expect(geometry.titleFontSize).toBe("13px");
    expect(geometry.buttonHeight).toBe(30);
    expect(geometry.buttonFontSize).toBe("8px");
    expect(overlayStyles.background).toBe("rgba(42, 53, 70, 0.42)");
    expect(overlayStyles.backdropFilter).toBe("blur(2px)");
  });

  test("pagina todos los pacientes de la sucursal", async ({ page }) => {
    await openDirectory(page);
    await page.getByRole("button", { name: "2", exact: true }).click();
    await expect(
      page
        .locator(".nc-patients-pagination")
        .getByText(/Mostrando 11–13 de 13 pacientes/),
    ).toBeVisible();
  });

  test("usa cards en móvil sin desbordamiento horizontal", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openDirectory(page);

    await expect(page.locator(".nc-patient-card").first()).toBeVisible();
    await expect(page.locator(".nc-patients-tableWrap")).toBeHidden();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  });

  test("respeta los temas aprobados", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openDirectory(page);

    for (const theme of ["dark", "alternative"] as const) {
      await page.evaluate((nextTheme) => {
        const stored = JSON.parse(
          localStorage.getItem("ui-store") ?? '{"state":{},"version":0}',
        );
        stored.state = { ...stored.state, theme: nextTheme };
        localStorage.setItem("ui-store", JSON.stringify(stored));
        localStorage.setItem("theme", nextTheme);
      }, theme);
      await page.reload();

      await expect(page.locator("html")).toHaveClass(
        new RegExp(`(^|\\s)${theme}(\\s|$)`),
      );
      await expect(page.locator(".nc-patients-overview")).toBeVisible();
      await expect(page.locator(".nc-patients-tableWrap")).toBeVisible();
      expect(
        await page.locator(".nc-patients-overview").evaluate((element) => {
          const style = getComputedStyle(element);
          return {
            borderTopWidth: style.borderTopWidth,
            borderRadius: style.borderTopLeftRadius,
          };
        }),
      ).toEqual({ borderTopWidth: "1px", borderRadius: "18px" });

      if (theme === "dark") {
        expect(
          await page.evaluate(() => {
            const backgroundOf = (selector: string) =>
              getComputedStyle(document.querySelector<HTMLElement>(selector)!)
                .backgroundColor;
            return {
              page: backgroundOf(".nc-patients-page"),
              hero: backgroundOf(".nc-patients-hero"),
              toolbar: backgroundOf(".nc-patients-toolbar"),
              search: backgroundOf(".nc-patients-search input"),
              tableHeader: backgroundOf(".nc-patients-tableWrap thead"),
            };
          }),
        ).toEqual({
          page: "rgb(2, 6, 23)",
          hero: "rgb(7, 17, 31)",
          toolbar: "rgb(7, 17, 31)",
          search: "rgb(10, 23, 40)",
          tableHeader: "rgb(10, 23, 40)",
        });
      }
    }
  });

  test("abre el importador CSV y persiste pacientes", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openDirectory(page);

    await page.getByRole("link", { name: "Importar CSV" }).click();

    await expect(page).toHaveURL(/#\/pacientes\/importar$/);
    await expect(
      page.getByRole("heading", { name: "Importar pacientes desde CSV" }),
    ).toBeVisible();
    await expect(page.locator(".nc-importer-hero")).toBeVisible();
    await expect(page.locator(".nc-importer-steps li")).toHaveCount(3);
    await expect(
      page.locator(".nc-importer-steps li[data-current]"),
    ).toContainText("Cargar archivo");
    await expect(
      page.locator(".nc-importer-workspace > .nc-importer-card"),
    ).toHaveCount(2);
    await expect(page.locator(".nc-importer-dropzone")).toHaveCSS(
      "border-top-style",
      "dashed",
    );
    await expect(
      page.getByRole("heading", {
        name: "Aún no hay datos para previsualizar",
      }),
    ).toBeVisible();
    await expect(page.locator('[data-layout-sidebar="premium"]')).toBeVisible();
    await expect(
      page
        .locator(".nc-dashboard-sidebar")
        .getByRole("link", { name: "Pacientes" }),
    ).toHaveClass(/nc-dashboard-sidebar__item--active/);
    const breadcrumb = page
      .locator(".nc-dashboard-header")
      .getByRole("navigation", { name: "Ruta actual" });
    const patientsBreadcrumbLink = breadcrumb.getByRole("link", {
      name: "Pacientes",
      exact: true,
    });
    await expect(patientsBreadcrumbLink).toHaveAttribute("href", "#/pacientes");
    await expect(
      breadcrumb.getByText("Importar CSV", { exact: true }),
    ).toHaveAttribute("aria-current", "page");

    const sampleDownloadPromise = page.waitForEvent("download");
    const samplePreviewPromise = page.context().waitForEvent("page");
    await page.getByRole("button", { name: "Descargar CSV" }).click();
    await page.getByRole("menuitem", { name: /Plantilla de ejemplo/ }).click();
    const sampleDownload = await sampleDownloadPromise;
    const samplePreview = await samplePreviewPromise;
    expect(sampleDownload.suggestedFilename()).toBe(
      "plantilla-ejemplo-pacientes.csv",
    );
    await expect.poll(() => samplePreview.url()).toMatch(/^blob:/);
    await expect(
      page
        .locator(".nc-importer-downloadStatus")
        .getByText(/Plantilla de ejemplo descargada/),
    ).toBeVisible();
    await expect(
      page
        .locator(".nc-importer-downloadStatus")
        .getByText("plantilla-ejemplo-pacientes.csv"),
    ).toBeVisible();
    await samplePreview.close();

    const patientsDownloadPromise = page.waitForEvent("download");
    const patientsPreviewPromise = page.context().waitForEvent("page");
    await page.getByRole("button", { name: "Descargar CSV" }).click();
    await page.getByRole("menuitem", { name: /Pacientes actuales/ }).click();
    const patientsDownload = await patientsDownloadPromise;
    const patientsPreview = await patientsPreviewPromise;
    expect(patientsDownload.suggestedFilename()).toMatch(
      /^pacientes-actuales-\d{4}-\d{2}-\d{2}\.csv$/,
    );
    await expect.poll(() => patientsPreview.url()).toMatch(/^blob:/);
    await expect(page.locator(".nc-importer-downloadStatus")).toContainText(
      "13 pacientes actuales descargados",
    );
    await patientsPreview.close();

    const csv =
      "nombre,apellido,fecha de nacimiento,sexo,correo,teléfono\nImportado,CSV,1994-04-12,masculino,importado@example.com,5512349876";
    const fileChooserPromise = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Seleccionar archivo CSV" }).click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
      name: "pacientes.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csv),
    });
    await expect(page.locator(".nc-importer-selectedFile")).toContainText(
      "pacientes.csv",
    );
    await expect(
      page.locator(".nc-importer-steps li[data-current]"),
    ).toContainText("Vista previa");
    await expect(page.getByText("1 válidas", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Importar 1 pacientes" }).click();

    const confirmDialog = page.getByRole("dialog", {
      name: "Confirmar importación",
    });
    await expect(confirmDialog).toBeVisible();
    await expect(
      page.locator(".nc-importer-steps li[data-current]"),
    ).toContainText("Revisar y confirmar");
    await confirmDialog
      .getByRole("button", { name: "Importar", exact: true })
      .click();
    await expect(
      page.getByText("1 pacientes importados", { exact: true }),
    ).toBeVisible();

    await patientsBreadcrumbLink.click();
    await expect(page).toHaveURL(/#\/pacientes$/);
    await page
      .getByRole("textbox", { name: "Buscar pacientes" })
      .fill("Importado CSV");
    await expect(
      page.getByRole("link", { name: "Importado CSV", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("14 pacientes activos", { exact: true }),
    ).toBeVisible();
  });

  test("mantiene fijo el shell premium al navegar desde Dashboard", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(hashUrl("/"));
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible({
      timeout: 30_000,
    });
    await seedDirectory(page);

    const sidebar = page.locator(".nc-dashboard-sidebar");
    const header = page.locator(".nc-dashboard-header");
    const statusBar = page.locator(".nc-dashboard-bottom-bar");
    await expect(sidebar).toHaveCount(1);
    await expect(header).toHaveCount(1);
    await expect(statusBar).toHaveCount(1);
    await expect(
      header.getByText("Aquí tienes el resumen de tu clínica hoy."),
    ).toBeVisible();
    await expect(
      header.getByRole("navigation", { name: "Ruta actual" }),
    ).toHaveCount(0);
    await expect(
      sidebar
        .getByRole("link", { name: "Dashboard", exact: true })
        .locator(".nc-dashboard-home-active-icon"),
    ).toHaveCSS("width", "22px");
    const dashboardActiveSize = await sidebar
      .getByRole("link", { name: "Dashboard", exact: true })
      .evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return { width: rect.width, height: rect.height };
      });
    await sidebar.evaluate((element) =>
      element.setAttribute("data-shell-probe", "sidebar"),
    );
    await header.evaluate((element) =>
      element.setAttribute("data-shell-probe", "header"),
    );
    await statusBar.evaluate((element) =>
      element.setAttribute("data-shell-probe", "status"),
    );

    await sidebar.getByRole("link", { name: "Pacientes" }).click();
    await expect(
      page.getByRole("heading", { name: "Pacientes", exact: true }),
    ).toBeVisible();
    await expect(page.locator('[data-shell-probe="sidebar"]')).toBeVisible();
    await expect(page.locator('[data-shell-probe="header"]')).toBeVisible();
    await expect(page.locator('[data-shell-probe="status"]')).toBeVisible();
    const breadcrumb = header.getByRole("navigation", { name: "Ruta actual" });
    await expect(
      header.getByText("Aquí tienes el resumen de tu clínica hoy."),
    ).toHaveCount(0);
    await expect(breadcrumb).toBeVisible();
    await expect(
      breadcrumb.locator(".nc-dashboard-header__breadcrumbIcon"),
    ).toHaveClass(/lucide-users-round/);
    const breadcrumbGap = await header.evaluate((element) => {
      const title = element.querySelector<HTMLElement>(
        ".nc-dashboard-header__title",
      );
      const route = element.querySelector<HTMLElement>(
        ".nc-dashboard-header__breadcrumb",
      );
      if (!title || !route)
        throw new Error("No se encontró el encabezado de navegación");
      return (
        route.getBoundingClientRect().top - title.getBoundingClientRect().bottom
      );
    });
    expect(breadcrumbGap).toBeGreaterThanOrEqual(32);
    await expect(
      breadcrumb.getByRole("link", {
        name: "Gestión Clínica y Nutricional",
        exact: true,
      }),
    ).toHaveAttribute("href", "#/");
    await expect(
      breadcrumb.getByText("Pacientes", { exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await expect(sidebar.getByRole("link", { name: "Pacientes" })).toHaveClass(
      /nc-dashboard-sidebar__item--active/,
    );

    const patientActive = sidebar.getByRole("link", { name: "Pacientes" });
    await expect(
      sidebar
        .getByRole("link", { name: "Dashboard", exact: true })
        .locator(".nc-dashboard-home-icon"),
    ).toHaveCSS("width", "22px");
    const patientActiveSize = await patientActive.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return { width: rect.width, height: rect.height };
    });
    expect(
      Math.abs(patientActiveSize.width - dashboardActiveSize.width),
    ).toBeLessThanOrEqual(1);
    expect(
      Math.abs(patientActiveSize.height - dashboardActiveSize.height),
    ).toBeLessThanOrEqual(1);
    await expect(patientActive.locator("svg")).toHaveCSS("width", "15px");

    const scrollState = await page.evaluate(() => {
      const outerMain = document.querySelector<HTMLElement>("#main-content");
      const shellMain =
        document.querySelector<HTMLElement>(".nc-dashboard-main");
      if (!outerMain || !shellMain)
        throw new Error("No se encontró el shell del dashboard");

      return {
        rootOverflow: getComputedStyle(document.documentElement).overflowY,
        bodyOverflow: getComputedStyle(document.body).overflowY,
        outerFits: outerMain.scrollHeight <= outerMain.clientHeight + 1,
        outerOverflow: getComputedStyle(outerMain).overflowY,
        shellOverflow: getComputedStyle(shellMain).overflowY,
      };
    });
    expect(scrollState).toEqual({
      rootOverflow: "hidden",
      bodyOverflow: "hidden",
      outerFits: true,
      outerOverflow: "hidden",
      shellOverflow: "auto",
    });

    await page.locator(".nc-dashboard-main").evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    await expect
      .poll(() =>
        page
          .locator(".nc-dashboard-main")
          .evaluate((element) => element.scrollTop),
      )
      .toBeGreaterThan(0);
    expect(
      await page.evaluate(() => ({
        documentScrollTop: document.documentElement.scrollTop,
        outerScrollTop:
          document.querySelector<HTMLElement>("#main-content")?.scrollTop ?? -1,
      })),
    ).toEqual({ documentScrollTop: 0, outerScrollTop: 0 });

    await page.goto(hashUrl("/pacientes/nuevo"));
    const nestedBreadcrumb = page
      .locator(".nc-dashboard-header")
      .getByRole("navigation", { name: "Ruta actual" });
    await expect(
      nestedBreadcrumb.getByRole("link", { name: "Pacientes", exact: true }),
    ).toHaveAttribute("href", "#/pacientes");
    await expect(
      nestedBreadcrumb.getByText("Nuevo paciente", { exact: true }),
    ).toHaveAttribute("aria-current", "page");

    await page.goto(hashUrl("/agenda"));
    const menuBreadcrumb = page
      .locator(".nc-dashboard-header")
      .getByRole("navigation", { name: "Ruta actual" });
    await expect(
      menuBreadcrumb.getByText("Agenda", { exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await expect(
      page
        .locator(".nc-dashboard-sidebar")
        .getByRole("link", { name: "Agenda" }),
    ).toHaveClass(/nc-dashboard-sidebar__item--active/);
  });

  test("permite comparar con la vista anterior y volver al diseño nuevo", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openDirectory(page);

    await page
      .locator('[data-layout-sidebar="premium"]')
      .getByRole("button", { name: "Vista anterior" })
      .click();

    await expect(page.locator('[data-layout-sidebar="premium"]')).toHaveCount(
      0,
    );
    await expect(page.locator('[data-layout-sidebar="legacy"]')).toBeVisible();
    await expect(page).toHaveURL(/#\/pacientes$/);
    await expect(
      page.getByRole("heading", { name: "Pacientes", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(() =>
        sessionStorage.getItem("nutriclinica.layout.mode"),
      ),
    ).toBe("legacy");

    await page
      .locator('[data-layout-sidebar="legacy"]')
      .getByRole("button", { name: "Volver al diseño nuevo" })
      .click();

    await expect(page.locator('[data-layout-sidebar="legacy"]')).toHaveCount(0);
    await expect(page.locator('[data-layout-sidebar="premium"]')).toBeVisible();
    await expect(
      page
        .locator(".nc-dashboard-header")
        .getByRole("navigation", { name: "Ruta actual" }),
    ).toBeVisible();
    expect(
      await page.evaluate(() =>
        sessionStorage.getItem("nutriclinica.layout.mode"),
      ),
    ).toBeNull();
  });
});
