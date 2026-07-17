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
          patients.put(
            makePatient(13, { id: "legacy-directory", sucursal_id: null }),
          );
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

async function openDirectory(page: Page) {
  await page.goto(hashUrl("/"));
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible({
    timeout: 30_000,
  });
  await seedDirectory(page);
  await page.goto(hashUrl("/pacientes"));
  await expect(page.getByRole("heading", { name: "Pacientes" })).toBeVisible();
}

test.describe("directorio de pacientes", () => {
  test.beforeEach(async ({ page }) => {
    await fakeLogin(page, BRANCH_ID);
  });

  test("busca por teléfono y separa la papelera", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await openDirectory(page);
    await expect(page.getByText("13 pacientes", { exact: true })).toBeVisible();
    await expect(page.locator(".nc-patients-tableWrap")).toBeVisible();
    await expect(
      page.getByRole("columnheader", { name: "Edad del paciente" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Importar CSV" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Agregar paciente" })).toHaveCount(0);
    await expect(
      page.locator(".nc-dashboard-header").getByRole("button", { name: "Agregar paciente" }),
    ).toBeVisible();

    const referenceLayout = await page.evaluate(() => {
      const pageContent = document.querySelector<HTMLElement>(".nc-patients-page")!;
      const hero = document.querySelector<HTMLElement>(".nc-patients-hero")!;
      const directory = document.querySelector<HTMLElement>(".nc-patients-directory")!;
      const importButton = document.querySelector<HTMLElement>(".nc-patients-importButton")!;
      const search = document.querySelector<HTMLElement>(".nc-patients-search")!;
      const tabs = document.querySelector<HTMLElement>(".nc-patients-tabs")!;
      const filter = document.querySelector<HTMLElement>(".nc-patients-filterButton")!;
      const heroIcon = document.querySelector<HTMLElement>(".nc-patients-hero__icon")!;
      const results = document.querySelector<HTMLElement>(".nc-patients-results")!;
      const tableWrap = document.querySelector<HTMLElement>(".nc-patients-tableWrap")!;
      const firstRow = document.querySelector<HTMLElement>(".nc-patients-tableWrap tbody tr")!;
      const firstAvatar = firstRow.querySelector<HTMLElement>(".nc-patient-avatar")!;
      const firstAction = firstRow.querySelector<HTMLElement>(".nc-patient-actions")!;
      const pageRect = pageContent.getBoundingClientRect();
      const heroRect = hero.getBoundingClientRect();
      const directoryRect = directory.getBoundingClientRect();
      const searchRect = search.getBoundingClientRect();
      const resultsRect = results.getBoundingClientRect();
      const tableRect = tableWrap.getBoundingClientRect();
      const importRect = importButton.getBoundingClientRect();
      const filterRect = filter.getBoundingClientRect();
      const heroStyle = getComputedStyle(hero);
      const resultsStyle = getComputedStyle(results);

      return {
        heroTopGap: heroRect.top - pageRect.top,
        gap: Math.abs(directoryRect.top - heroRect.bottom),
        heroBorder: heroStyle.borderTopWidth,
        heroRadius: heroStyle.borderTopLeftRadius,
        heroImportCount: hero.querySelectorAll('a[href*="/importar"]').length,
        importHeight: importRect.height,
        importFilterGap: filterRect.left - importRect.right,
        importBeforeFilter: importRect.right <= filterRect.left,
        toolbarRightInset: directoryRect.right - filterRect.right,
        searchWidth: searchRect.width,
        searchHeight: search.querySelector("input")!.getBoundingClientRect().height,
        tabsWidth: tabs.getBoundingClientRect().width,
        filterHeight: filter.getBoundingClientRect().height,
        resultsInset: resultsRect.left - directoryRect.left,
        searchTableAlignment: Math.abs(searchRect.left - resultsRect.left),
        tableRightInset: directoryRect.right - resultsRect.right,
        resultsBorder: resultsStyle.borderTopWidth,
        resultsRadius: resultsStyle.borderTopLeftRadius,
        avatarInset: firstAvatar.getBoundingClientRect().left - tableRect.left,
        rowIdentityGap: getComputedStyle(firstRow.querySelector<HTMLElement>(".nc-patient-identity")!).gap,
        rowHeight: firstRow.getBoundingClientRect().height,
        avatarWidth: firstAvatar.getBoundingClientRect().width,
        actionWidth: firstAction.getBoundingClientRect().width,
        heroIconWidth: heroIcon.getBoundingClientRect().width,
        heroIconTop: heroIcon.getBoundingClientRect().top - pageRect.top,
        identityGap: getComputedStyle(document.querySelector<HTMLElement>(".nc-patients-hero__identity")!).gap,
        heroArcWidth: getComputedStyle(hero, "::after").width,
      };
    });
    expect(referenceLayout.heroTopGap).toBeLessThanOrEqual(1);
    expect(referenceLayout.gap).toBeLessThanOrEqual(1);
    expect(referenceLayout.heroBorder).toBe("0px");
    expect(referenceLayout.heroRadius).toBe("0px");
    expect(referenceLayout.heroImportCount).toBe(0);
    expect(referenceLayout.importHeight).toBe(44);
    expect(referenceLayout.importFilterGap).toBe(10);
    expect(referenceLayout.importBeforeFilter).toBe(true);
    expect(referenceLayout.toolbarRightInset).toBeGreaterThanOrEqual(17);
    expect(referenceLayout.toolbarRightInset).toBeLessThanOrEqual(19);
    expect(referenceLayout.searchWidth).toBeLessThanOrEqual(521);
    expect(referenceLayout.searchHeight).toBe(44);
    expect(referenceLayout.tabsWidth).toBeLessThanOrEqual(551);
    expect(referenceLayout.filterHeight).toBe(44);
    expect(referenceLayout.resultsInset).toBeGreaterThanOrEqual(17);
    expect(referenceLayout.resultsInset).toBeLessThanOrEqual(19);
    expect(referenceLayout.searchTableAlignment).toBeLessThanOrEqual(1);
    expect(referenceLayout.tableRightInset).toBeGreaterThanOrEqual(17);
    expect(referenceLayout.tableRightInset).toBeLessThanOrEqual(19);
    expect(referenceLayout.resultsBorder).toBe("1px");
    expect(referenceLayout.resultsRadius).toBe("12px");
    expect(referenceLayout.avatarInset).toBeGreaterThanOrEqual(16);
    expect(referenceLayout.avatarInset).toBeLessThanOrEqual(18);
    expect(referenceLayout.rowIdentityGap).toBe("18px");
    expect(referenceLayout.rowHeight).toBeLessThanOrEqual(53);
    expect(referenceLayout.avatarWidth).toBe(36);
    expect(referenceLayout.actionWidth).toBe(36);
    expect(referenceLayout.heroIconWidth).toBe(74);
    expect(referenceLayout.heroIconTop).toBeGreaterThanOrEqual(28);
    expect(referenceLayout.heroIconTop).toBeLessThanOrEqual(32);
    expect(referenceLayout.identityGap).toBe("26px");
    expect(referenceLayout.heroArcWidth).toBe("1000px");
    await page
      .getByRole("button", { name: "Acciones para María Directorio" })
      .click();
    for (const action of [
      "Ver perfil",
      "Editar paciente",
      "Nueva consulta",
      "Ver historial",
      "Archivar",
      "Eliminar / desactivar",
    ]) {
      await expect(page.getByRole("menuitem", { name: action })).toBeVisible();
    }
    await page.keyboard.press("Escape");

    const search = page.getByRole("textbox", { name: "Buscar pacientes" });
    await expect(search).toHaveAttribute(
      "placeholder",
      "Busca paciente por nombre o teléfono...",
    );
    await search.fill("555123");
    await expect(
      page.getByRole("link", { name: "María Directorio" }),
    ).toBeVisible();
    await expect(
      page.locator(".nc-patients-pagination").getByText(/Página 1 de 1/),
    ).toBeVisible();

    await page.getByRole("button", { name: "Limpiar búsqueda" }).click();
    await page.getByRole("button", { name: "Filtros" }).click();
    await page.getByRole("combobox", { name: "Sexo" }).click();
    await page.getByRole("option", { name: "Masculino" }).click();
    await page.getByRole("button", { name: "Aplicar filtros" }).click();
    await expect(
      page.getByRole("link", { name: "María Directorio" }),
    ).toBeHidden();

    await page.getByRole("button", { name: /Filtros/ }).click();
    await page.getByRole("button", { name: "Limpiar filtros" }).click();
    await page.getByRole("button", { name: "Aplicar filtros" }).click();
    await page.getByRole("tab", { name: "Eliminado" }).click();
    await expect(
      page.locator("strong:visible", { hasText: "Eliminado Directorio" }),
    ).toBeVisible();
    await expect(page.getByText("María Directorio")).toBeHidden();
  });

  test("pagina todos los pacientes de la sucursal", async ({ page }) => {
    await openDirectory(page);
    await page.getByRole("button", { name: "2", exact: true }).click();
    await expect(
      page.locator(".nc-patients-pagination").getByText(/Página 2 de 2/),
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
      await expect(page.locator(".nc-patients-hero")).toBeVisible();
      await expect(page.locator(".nc-patients-tableWrap")).toBeVisible();
      expect(
        await page.locator(".nc-patients-hero").evaluate((element) => {
          const style = getComputedStyle(element);
          return {
            backgroundColor: style.backgroundColor,
            backgroundImage: style.backgroundImage,
            borderTopWidth: style.borderTopWidth,
            boxShadow: style.boxShadow,
          };
        }),
      ).toEqual({
        backgroundColor: "rgba(0, 0, 0, 0)",
        backgroundImage: "none",
        borderTopWidth: "0px",
        boxShadow: "none",
      });

      if (theme === "dark") {
        expect(
          await page.evaluate(() => {
            const backgroundOf = (selector: string) =>
              getComputedStyle(document.querySelector<HTMLElement>(selector)!).backgroundColor;
            return {
              page: backgroundOf(".nc-patients-page"),
              directory: backgroundOf(".nc-patients-directory"),
              search: backgroundOf(".nc-patients-search input"),
              tableHeader: backgroundOf(".nc-patients-tableWrap thead"),
            };
          }),
        ).toEqual({
          page: "rgb(2, 6, 23)",
          directory: "rgb(7, 17, 31)",
          search: "rgb(7, 17, 31)",
          tableHeader: "rgb(8, 19, 33)",
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
    await expect(page.locator(".nc-importer-steps li[data-current]")).toContainText(
      "Cargar archivo",
    );
    await expect(page.locator(".nc-importer-workspace > .nc-importer-card")).toHaveCount(2);
    await expect(page.locator(".nc-importer-dropzone")).toHaveCSS(
      "border-top-style",
      "dashed",
    );
    await expect(
      page.getByRole("heading", { name: "Aún no hay datos para previsualizar" }),
    ).toBeVisible();
    await expect(page.locator('[data-layout-sidebar="premium"]')).toBeVisible();
    await expect(
      page.locator(".nc-dashboard-sidebar").getByRole("link", { name: "Pacientes" }),
    ).toHaveClass(/nc-dashboard-sidebar__item--active/);
    const breadcrumb = page
      .locator(".nc-dashboard-header")
      .getByRole("navigation", { name: "Ruta actual" });
    const patientsBreadcrumbLink = breadcrumb.getByRole("link", {
      name: "Pacientes",
      exact: true,
    });
    await expect(patientsBreadcrumbLink).toHaveAttribute("href", "#/pacientes");
    await expect(breadcrumb.getByText("Importar CSV", { exact: true })).toHaveAttribute(
      "aria-current",
      "page",
    );

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
    await expect(page.locator(".nc-importer-steps li[data-current]")).toContainText(
      "Vista previa",
    );
    await expect(page.getByText("1 válidas", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Importar 1 pacientes" }).click();

    const confirmDialog = page.getByRole("dialog", { name: "Confirmar importación" });
    await expect(confirmDialog).toBeVisible();
    await expect(page.locator(".nc-importer-steps li[data-current]")).toContainText(
      "Revisar y confirmar",
    );
    await confirmDialog.getByRole("button", { name: "Importar", exact: true }).click();
    await expect(page.getByText("1 pacientes importados", { exact: true })).toBeVisible();

    await patientsBreadcrumbLink.click();
    await expect(page).toHaveURL(/#\/pacientes$/);
    await expect(page.getByRole("link", { name: "Importado CSV" })).toBeVisible();
    await expect(page.getByText("14 pacientes", { exact: true })).toBeVisible();
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
    await expect(header.getByText("Aquí tienes el resumen de tu clínica hoy.")).toBeVisible();
    await expect(header.getByRole("navigation", { name: "Ruta actual" })).toHaveCount(0);
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
    await expect(header.getByText("Aquí tienes el resumen de tu clínica hoy.")).toHaveCount(0);
    await expect(breadcrumb).toBeVisible();
    await expect(breadcrumb.locator(".nc-dashboard-header__breadcrumbIcon")).toHaveClass(
      /lucide-users-round/,
    );
    const breadcrumbGap = await header.evaluate((element) => {
      const title = element.querySelector<HTMLElement>(".nc-dashboard-header__title");
      const route = element.querySelector<HTMLElement>(".nc-dashboard-header__breadcrumb");
      if (!title || !route) throw new Error("No se encontró el encabezado de navegación");
      return route.getBoundingClientRect().top - title.getBoundingClientRect().bottom;
    });
    expect(breadcrumbGap).toBeGreaterThanOrEqual(32);
    await expect(
      breadcrumb.getByRole("link", {
        name: "Gestión Clínica y Nutricional",
        exact: true,
      }),
    ).toHaveAttribute("href", "#/");
    await expect(breadcrumb.getByText("Pacientes", { exact: true })).toHaveAttribute("aria-current", "page");
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
    expect(Math.abs(patientActiveSize.width - dashboardActiveSize.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(patientActiveSize.height - dashboardActiveSize.height)).toBeLessThanOrEqual(1);
    await expect(patientActive.locator("svg")).toHaveCSS("width", "15px");

    const scrollState = await page.evaluate(() => {
      const outerMain = document.querySelector<HTMLElement>("#main-content");
      const shellMain = document.querySelector<HTMLElement>(".nc-dashboard-main");
      if (!outerMain || !shellMain) throw new Error("No se encontró el shell del dashboard");

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
      .poll(() => page.locator(".nc-dashboard-main").evaluate((element) => element.scrollTop))
      .toBeGreaterThan(0);
    expect(
      await page.evaluate(() => ({
        documentScrollTop: document.documentElement.scrollTop,
        outerScrollTop: document.querySelector<HTMLElement>("#main-content")?.scrollTop ?? -1,
      })),
    ).toEqual({ documentScrollTop: 0, outerScrollTop: 0 });

    await page.goto(hashUrl("/pacientes/nuevo"));
    const nestedBreadcrumb = page.locator(".nc-dashboard-header").getByRole("navigation", { name: "Ruta actual" });
    await expect(
      nestedBreadcrumb.getByRole("link", { name: "Pacientes", exact: true }),
    ).toHaveAttribute("href", "#/pacientes");
    await expect(nestedBreadcrumb.getByText("Nuevo paciente", { exact: true })).toHaveAttribute("aria-current", "page");

    await page.goto(hashUrl("/agenda"));
    const menuBreadcrumb = page.locator(".nc-dashboard-header").getByRole("navigation", { name: "Ruta actual" });
    await expect(menuBreadcrumb.getByText("Agenda", { exact: true })).toHaveAttribute("aria-current", "page");
    await expect(page.locator(".nc-dashboard-sidebar").getByRole("link", { name: "Agenda" })).toHaveClass(
      /nc-dashboard-sidebar__item--active/,
    );
  });

  test("permite comparar con la vista anterior y volver al diseño nuevo", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openDirectory(page);

    await page
      .locator('[data-layout-sidebar="premium"]')
      .getByRole("button", { name: "Vista anterior" })
      .click();

    await expect(page.locator('[data-layout-sidebar="premium"]')).toHaveCount(0);
    await expect(page.locator('[data-layout-sidebar="legacy"]')).toBeVisible();
    await expect(page).toHaveURL(/#\/pacientes$/);
    await expect(page.getByRole("heading", { name: "Pacientes", exact: true })).toBeVisible();
    expect(await page.evaluate(() => sessionStorage.getItem("nutriclinica.layout.mode"))).toBe("legacy");

    await page
      .locator('[data-layout-sidebar="legacy"]')
      .getByRole("button", { name: "Volver al diseño nuevo" })
      .click();

    await expect(page.locator('[data-layout-sidebar="legacy"]')).toHaveCount(0);
    await expect(page.locator('[data-layout-sidebar="premium"]')).toBeVisible();
    await expect(
      page.locator(".nc-dashboard-header").getByRole("navigation", { name: "Ruta actual" }),
    ).toBeVisible();
    expect(await page.evaluate(() => sessionStorage.getItem("nutriclinica.layout.mode"))).toBeNull();
  });
});
