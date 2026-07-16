import { expect, test, type Page } from "@playwright/test";
import { fakeLogin, hashUrl } from "./helpers";

const BRANCH_ID = "e2e-quick-consultation";
const PATIENT_ID = "018f0000-0000-7000-8000-000000000321";
const LEGACY_PATIENT_ID = "018f0000-0000-7000-8000-000000000322";

async function seedPatient(page: Page) {
  await page.evaluate(
    async ({ branchId, patientId, legacyPatientId }) =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open("nutriclinica");
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction("patients", "readwrite");
          transaction.onerror = () => reject(transaction.error);
          transaction.oncomplete = () => resolve();
          transaction.objectStore("patients").put({
            id: patientId,
            sucursal_id: branchId,
            first_name: "María",
            last_name: "López",
            second_last_name: null,
            birth_date: "1990-01-15T12:00:00.000Z",
            sex: "female",
            gender: null,
            marital_status: null,
            occupation: null,
            education: null,
            email: "maria.quick@example.com",
            phone: "5551234567",
            secondary_phone: null,
            emergency_contact_name: null,
            emergency_contact_relationship: null,
            emergency_contact_phone: null,
            record_status: "active",
            record_opened_at: "2026-07-15T12:00:00.000Z",
            general_notes: null,
            consentimiento_informado_id: null,
            fecha_firma_consentimiento: null,
            version_politica_privacidad: null,
            clinical_tags: "[]",
            clave_interna: "00123",
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
            created_at: "2026-07-15T12:00:00.000Z",
            updated_at: "2026-07-15T12:00:00.000Z",
            deleted_at: null,
          });
          transaction.objectStore("patients").put({
            id: legacyPatientId,
            sucursal_id: null,
            first_name: "Paciente",
            last_name: "Heredado",
            second_last_name: null,
            birth_date: "1985-03-20T12:00:00.000Z",
            sex: "female",
            gender: null,
            marital_status: null,
            occupation: null,
            education: null,
            email: "paciente.heredado@example.com",
            phone: "5557654321",
            secondary_phone: null,
            emergency_contact_name: null,
            emergency_contact_relationship: null,
            emergency_contact_phone: null,
            record_status: "active",
            record_opened_at: "2025-01-10T12:00:00.000Z",
            general_notes: null,
            consentimiento_informado_id: null,
            fecha_firma_consentimiento: null,
            version_politica_privacidad: null,
            clinical_tags: "[]",
            clave_interna: "00456",
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
            created_at: "2025-01-10T12:00:00.000Z",
            updated_at: "2025-01-10T12:00:00.000Z",
            deleted_at: null,
          });
        };
      }),
    {
      branchId: BRANCH_ID,
      patientId: PATIENT_ID,
      legacyPatientId: LEGACY_PATIENT_ID,
    },
  );
}

async function openDashboardWithPatient(page: Page) {
  await page.goto(hashUrl("/"));
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible({
    timeout: 15_000,
  });
  await seedPatient(page);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Nueva consulta" }),
  ).toBeVisible();
}

async function selectPatientAndAction(
  page: Page,
  action: "Iniciar consulta ahora" | "Programar para después",
) {
  await page.getByRole("button", { name: "Nueva consulta" }).click();
  const dialog = page.getByRole("dialog", { name: "Nueva consulta" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByPlaceholder(/Buscar por nombre/)).toBeFocused();
  const search = dialog.getByPlaceholder(/Buscar por nombre/);
  await search.fill("Paciente Heredado");
  await expect(
    dialog.getByRole("button", { name: /Paciente Heredado EXP-00456/ }),
  ).toBeVisible();
  await search.fill("5551234567");
  await dialog.getByRole("button", { name: /María López EXP-00123/ }).click();
  await dialog.getByRole("radio", { name: new RegExp(action) }).click();
  await expect(dialog.getByRole("button", { name: "Continuar" })).toBeEnabled();
  return dialog;
}

test.describe("nueva consulta rápida", () => {
  test.beforeEach(async ({ page }) => {
    await fakeLogin(page, BRANCH_ID);
  });

  test("abre, valida y entra al wizard con el paciente", async ({ page }) => {
    await openDashboardWithPatient(page);
    const dialog = await selectPatientAndAction(page, "Iniciar consulta ahora");

    await dialog.getByRole("button", { name: "Continuar" }).click();
    await expect(page).toHaveURL(
      new RegExp(
        `#\\/pacientes\\/${PATIENT_ID}\\/consultas\\/nueva\\?mode=start-now&source=dashboard$`,
      ),
    );
    await expect(page.getByText("María López").first()).toBeVisible();
  });

  test("programa en Agenda con paciente precargado", async ({ page }) => {
    await openDashboardWithPatient(page);
    const dialog = await selectPatientAndAction(page, "Programar para después");

    await dialog.getByRole("button", { name: "Continuar" }).click();
    await expect(
      page.getByRole("heading", { name: /Nueva cita/i }),
    ).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      page.getByRole("combobox", { name: "Paciente" }),
    ).toContainText("María López");
  });

  test("cierra con Escape y conserva el acceso al registro", async ({
    page,
  }) => {
    await openDashboardWithPatient(page);
    const trigger = page.getByRole("button", { name: "Nueva consulta" });
    await trigger.click();
    await expect(
      page.getByRole("dialog", { name: "Nueva consulta" }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("dialog", { name: "Nueva consulta" }),
    ).toBeHidden();
    await expect(trigger).toBeFocused();

    await trigger.click();
    await page
      .getByRole("dialog", { name: "Nueva consulta" })
      .getByRole("button", { name: "Registrar paciente nuevo" })
      .click();
    await expect(page).toHaveURL(
      /#\/pacientes\/nuevo\?returnTo=quick-consultation$/,
    );
  });

  test("se adapta como sheet móvil sin desbordamiento horizontal", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openDashboardWithPatient(page);
    await page.getByRole("button", { name: "Nueva consulta" }).click();

    const dialog = page.getByRole("dialog", { name: "Nueva consulta" });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Continuar" }),
    ).toBeVisible();
    await expect
      .poll(async () => (await dialog.boundingBox())?.y ?? -1)
      .toBeGreaterThanOrEqual(0);
    const box = await dialog.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.width).toBeLessThanOrEqual(390);
    expect(box!.height).toBeLessThanOrEqual(844);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  });
});
