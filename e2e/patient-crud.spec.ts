import { test, expect } from "@playwright/test";
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

test.describe.serial("Pacientes — soft-delete round-trip", () => {
  test("crear paciente, sincronizar, soft-delete, re-sincronizar y NO resucita", async ({ page }) => {
    await loginAsAdmin(page);
    const email = uniqueEmail("crear");

    // 1) Ir al formulario de nuevo paciente
    await page.goto(hashUrl("/pacientes/nuevo"));
    await expect(page.getByText(/nuevo paciente/i).first()).toBeVisible();

    // 2) Llenar campos requeridos (usando placeholders, no getByLabel)
    await page.locator('input[name="firstName"]').fill(PATIENT_FIRST);
    await page.locator('input[name="lastName"]').fill(PATIENT_LAST);
    await page.locator('input[name="lastName"]').press("Tab"); // blur para validar
    await page.locator('input[name="birthDate"]').fill("1990-01-15");
    // Sexo
    await page.locator('select[name="sex"]').selectOption("male");
    await page.locator('input[name="email"]').fill(email);

    // 3) Submit
    const submit = page.getByRole("button", { name: /guardar|crear|siguiente/i }).first();
    await submit.click();

    // Tras crear, redirige al detalle del paciente
    await page.waitForURL(/\/pacientes\/[a-f0-9-]{36}$/, { timeout: 15_000 });
    const detailUrl = page.url();
    const patientId = detailUrl.match(/\/pacientes\/([a-f0-9-]{36})/)?.[1];
    expect(patientId).toBeTruthy();

    // 4) Disparar sync manual (botón "Sincronizar" en el StatusBar)
    const syncBtn = page.getByRole("button", { name: /^Sincronizar$/i });
    await syncBtn.click();
    // Esperar a que vuelva a "Sincronizado" (o a idle)
    await expect(page.getByText(/Sincronizado|Sin conexi[oó]n|Error de sync/i).first()).toBeVisible({
      timeout: 10_000,
    });

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
            const rows = getReq.result as Array<{ id: string; first_name: string; last_name: string; status: string; deleted_at: string | null }>;
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
    console.log("After create + sync, patients:", JSON.stringify(allPatients, null, 2));
    // El paciente recién creado debe estar en Dexie con status='active', deleted_at=null
    expect(allPatients).toMatchObject({ withThisId: { status: "active", deleted_at: null } });

    // 6) Regresar al detalle y soft-delete
    await page.goto(detailUrl);
    const deleteBtn = page.getByTestId("delete-patient-button");
    await expect(deleteBtn).toBeVisible({ timeout: 10_000 });
    await deleteBtn.click();
    // Confirm dialog
    const confirmBtn = page.getByRole("button", { name: /confirmar|eliminar todo|s[ií]/i }).last();
    await confirmBtn.click();

    // Esperar a que el soft-delete se propague localmente
    await page.waitForTimeout(1500);
    const afterDelete = await page.evaluate(async (id: string) => {
      return new Promise<unknown>((resolve, reject) => {
        const req = indexedDB.open("nutriclinica");
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction("patients", "readonly");
          const store = tx.objectStore("patients");
          const getReq = store.get(id);
          getReq.onsuccess = () => resolve(getReq.result);
          getReq.onerror = () => reject(getReq.error);
        };
        req.onerror = () => reject(req.error);
      });
    }, patientId);
    console.log("After soft-delete (local):", JSON.stringify(afterDelete, null, 2));
    // Debe tener deleted_at set
    expect(afterDelete).toMatchObject({ deleted_at: expect.stringMatching(/\d{4}/) });

    // 7) Re-sincronizar y volver a verificar: NO resucita
    await syncBtn.click();
    await expect(page.getByText(/Sincronizado|Sin conexi[oó]n|Error de sync/i).first()).toBeVisible({
      timeout: 10_000,
    });
    await page.waitForTimeout(2000);
    const afterResync = await page.evaluate(async (id: string) => {
      return new Promise<unknown>((resolve, reject) => {
        const req = indexedDB.open("nutriclinica");
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction("patients", "readonly");
          const store = tx.objectStore("patients");
          const getReq = store.get(id);
          getReq.onsuccess = () => resolve(getReq.result);
          getReq.onerror = () => reject(getReq.error);
        };
        req.onerror = () => reject(req.error);
      });
    }, patientId);
    console.log("After re-sync:", JSON.stringify(afterResync, null, 2));
    // CRÍTICO: deleted_at debe seguir set, NO resucitar
    expect(afterResync).toMatchObject({ deleted_at: expect.stringMatching(/\d{4}/) });
  });
});
