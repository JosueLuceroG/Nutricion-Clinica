import { test, expect, type Page } from "@playwright/test";
import { loginAsAdmin, hashUrl, uniqueEmail } from "./helpers";

/**
 * E2E de pacientes.
 *
 * Cubre el flujo crítico que reveló el bug de resurrección post-soft-delete:
 *   1. Crear paciente
 *   2. Disparar sync (push local → server)
 *   3. Soft-delete local
 *   4. Disparar sync (push delete → server; pull → confirma que el server
 *      ya no devuelve la fila como viva)
 *   5. Re-cargar: la fila debe seguir soft-deleted localmente (NO resucita)
 *
 * Selectors: el formulario de paciente usa `<Label>` sin `htmlFor`, por lo
 * que `getByLabel` no funciona. Usamos `placeholder` y `name` (vía locator).
 */

const PATIENT_FIRST = "E2E";
const PATIENT_LAST = "SmokeTest";
const SYNC_BUTTON_NAME =
  /^(Sincronizar(?: ahora)?|Sync Now|Forzar un ciclo de sync ahora)$/i;

async function forceSync(page: Page) {
  const syncBtn = page.getByRole("button", { name: SYNC_BUTTON_NAME });
  await expect(syncBtn).toBeEnabled({ timeout: 60_000 });
  await syncBtn.click();
  await expect(
    page.getByText(/Sincronizado|Sin conexi[oó]n|Error de sync/i).first(),
  ).toBeVisible({
    timeout: 60_000,
  });
}

async function readPatientRow(
  page: Page,
  id: string,
): Promise<{
  deleted_at: string | null;
  whatsapp_enabled?: boolean | null;
} | null> {
  return page.evaluate(async (patientId: string) => {
    return new Promise<{
      deleted_at: string | null;
      whatsapp_enabled?: boolean | null;
    } | null>((resolve, reject) => {
      const req = indexedDB.open("nutriclinica");
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction("patients", "readonly");
        const store = tx.objectStore("patients");
        const getReq = store.get(patientId);
        getReq.onsuccess = () => resolve(getReq.result ?? null);
        getReq.onerror = () => reject(getReq.error);
      };
      req.onerror = () => reject(req.error);
    });
  }, id);
}

async function waitForPatientDeleted(
  page: Page,
  id: string,
): Promise<{
  deleted_at: string | null;
  whatsapp_enabled?: boolean | null;
} | null> {
  await expect
    .poll(async () => (await readPatientRow(page, id))?.deleted_at ?? null, {
      timeout: 30_000,
    })
    .toMatch(/\d{4}/);
  return readPatientRow(page, id);
}

test.describe.serial("Pacientes — soft-delete round-trip", () => {
  test.setTimeout(90_000);

  test("crear paciente, sincronizar, soft-delete, re-sincronizar y NO resucita", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    const email = uniqueEmail("crear");

    // 1) Ir al formulario de nuevo paciente
    await page.goto(hashUrl("/pacientes/nuevo"));
    await expect(
      page.getByText(/agregar paciente|nuevo paciente/i).first(),
    ).toBeVisible();

    // 2) Llenar campos requeridos (usando placeholders, no getByLabel)
    await page.locator('input[name="firstName"]').fill(PATIENT_FIRST);
    await page.locator('input[name="lastName"]').fill(PATIENT_LAST);
    await page.locator('input[name="lastName"]').press("Tab"); // blur para validar
    await page.locator('input[name="age"]').fill("36");
    // Sexo
    await page.locator('select[name="sex"]').selectOption("male");
    await page
      .getByRole("button", { name: /siguiente|next/i })
      .last()
      .click();
    await page.locator('input[name="email"]').fill(email);
    await page.locator('input[name="phone"]').fill("+52 55 1234 5678");
    await page
      .getByRole("button", { name: /siguiente|next/i })
      .last()
      .click();
    await page
      .locator('input[name="emergencyContactName"]')
      .fill("Contacto E2E");
    await page
      .locator('select[name="emergencyContactRelationship"]')
      .selectOption("Madre");
    await page
      .locator('input[name="emergencyContactPhone"]')
      .fill("+52 55 2468 1357");
    await page
      .getByRole("button", { name: /siguiente|next/i })
      .last()
      .click();
    await page
      .locator('input[name="externalRecordNumber"]')
      .fill(`EXP-${Date.now()}`);
    await page
      .locator('textarea[name="admissionReason"]')
      .fill("Registro de prueba E2E");
    await page
      .getByRole("button", { name: /siguiente|next/i })
      .last()
      .click();

    for (const field of [
      "diagnosedConditions",
      "previousSurgeries",
      "currentTreatments",
      "intolerances",
    ]) {
      await page
        .locator(`input[name="${field}"][value="no"]`)
        .check({ force: true });
    }
    await page
      .getByRole("button", { name: /siguiente|next/i })
      .last()
      .click();
    for (const field of [
      "familyDiabetes",
      "familyHypertension",
      "familyObesity",
      "familyCardiovascular",
      "familyDyslipidemia",
      "familyKidneyDisease",
      "familyThyroidDisease",
    ]) {
      const familySelect = page.locator(`[data-family-field="${field}"]`);
      await familySelect
        .locator(".nc-new-patient__familySelectTrigger")
        .click();
      await familySelect
        .locator('input[type="checkbox"][value="none"]')
        .click();
    }
    await page
      .getByRole("button", { name: /siguiente|next/i })
      .last()
      .click();
    for (const field of [
      "supplements",
      "medicationAllergies",
      "medications",
      "adverseMedicationOrSupplementEffects",
    ]) {
      await page
        .locator(`input[name="${field}"][value="no"]`)
        .check({ force: true });
    }
    await page
      .getByRole("button", { name: /siguiente|next/i })
      .last()
      .click();
    await page
      .locator('input[name="physicalActivity"][value="no"]')
      .check({ force: true });
    await page
      .getByRole("button", { name: /siguiente|next/i })
      .last()
      .click();

    // 3) Submit
    const submit = page
      .getByRole("button", { name: /crear expediente|create record/i })
      .last();
    await submit.click();

    // Tras crear, redirige al detalle del paciente
    await page.waitForURL(/\/pacientes\/[a-f0-9-]{36}$/, { timeout: 15_000 });
    const detailUrl = page.url();
    const patientId = detailUrl.match(/\/pacientes\/([a-f0-9-]{36})/)?.[1];
    expect(patientId).toBeTruthy();

    // 4) Disparar sync manual (botón "Sincronizar" en el StatusBar)
    await forceSync(page);

    // 5) Volver a la lista para verificar que el paciente aparece
    await page.goto(hashUrl("/pacientes"));
    await expect(page.getByText(/^Pacientes$/).first()).toBeVisible();

    // Debug: leer la tabla de pacientes desde IndexedDB
    const allPatients = await page.evaluate(async (id: string) => {
      return new Promise<unknown>((resolve, reject) => {
        const req = indexedDB.open("nutriclinica");
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction("patients", "readonly");
          const store = tx.objectStore("patients");
          const getReq = store.getAll();
          getReq.onsuccess = () => {
            const rows = getReq.result as Array<{
              id: string;
              first_name: string;
              last_name: string;
              status: string;
              deleted_at: string | null;
              whatsapp_enabled?: boolean | null;
            }>;
            resolve({
              total: rows.length,
              withThisId: rows.find((r) => r.id === id),
              thisId: id,
            });
          };
          getReq.onerror = () => reject(getReq.error);
        };
        req.onerror = () => reject(req.error);
      });
    }, patientId);
    console.log(
      "After create + sync, patients:",
      JSON.stringify(allPatients, null, 2),
    );
    // El paciente recién creado debe estar en Dexie con status='active', deleted_at=null
    expect(allPatients).toMatchObject({
      withThisId: {
        status: "active",
        deleted_at: null,
        whatsapp_enabled: true,
      },
    });

    // 6) Regresar al detalle y soft-delete
    await page.goto(detailUrl);
    const deleteBtn = page.getByTestId("delete-patient-button");
    await expect(deleteBtn).toBeVisible({ timeout: 10_000 });
    await deleteBtn.click();
    const cascadeDialog = page.getByTestId("cascade-delete-dialog");
    const hasCascadeDialog = await cascadeDialog
      .isVisible({ timeout: 5_000 })
      .catch(() => false);
    if (hasCascadeDialog) {
      await page.getByTestId("cascade-delete-all").click();
    }

    const afterDelete = await waitForPatientDeleted(page, patientId);
    console.log(
      "After soft-delete (local):",
      JSON.stringify(afterDelete, null, 2),
    );
    // Debe tener deleted_at set
    expect(afterDelete).toMatchObject({
      deleted_at: expect.stringMatching(/\d{4}/),
    });

    // 7) Re-sincronizar y volver a verificar: NO resucita
    await forceSync(page);
    const afterResync = await waitForPatientDeleted(page, patientId);
    console.log("After re-sync:", JSON.stringify(afterResync, null, 2));
    // CRÍTICO: deleted_at debe seguir set, NO resucitar
    expect(afterResync).toMatchObject({
      deleted_at: expect.stringMatching(/\d{4}/),
    });
  });
});
