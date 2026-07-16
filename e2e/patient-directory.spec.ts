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
    timeout: 15_000,
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

    const search = page.getByRole("textbox", { name: "Buscar pacientes" });
    await search.fill("555123");
    await expect(
      page.getByRole("link", { name: "María Directorio" }),
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
});
