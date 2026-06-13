import { test, expect, request, type Page } from "@playwright/test";
import { ADMIN_EMAIL, ADMIN_PASSWORD, loginAsAdmin, hashUrl } from "./helpers";

/**
 * E2E de "Marcar pagada" en /consultas/:id.
 *
 * Setup vía API: crea una consulta con cost > 0, paid = false, y
 * le hace push al server. Después la UI la descarga en el siguiente
 * sync cycle. Esto evita tener que crear paciente + consulta + asignar
 * costo desde la UI (3 wizards), que sería lento y frágil.
 *
 * El test verifica:
 *   1. Botón "Marcar pagada" visible en el detalle de la consulta
 *   2. Apertura del dialog
 *   3. Submit del form cierra el dialog y muestra la consulta pagada
 *   4. Tras sync + reload, sigue pagada (no rebota a no pagada)
 */

const API_BASE = process.env.API_URL ?? "http://localhost:3000";
const SUCURSAL_ID = "B60E364C-2780-40C0-B7E8-22171665F697";
const PROFESIONAL_ID = "91875862-906D-499F-B505-F3A72ABDA57E";
const PATIENT_ID = "14AB7228-AA7E-4741-86FA-D8EC2652A01A"; // paciente "carlos" que ya existe
const SYNC_BUTTON_NAME = /^(Sincronizar|Forzar un ciclo de sync ahora)$/i;

async function forceSync(page: Page) {
  const syncBtn = page.getByRole("button", { name: SYNC_BUTTON_NAME });
  await expect(syncBtn).toBeEnabled({ timeout: 60_000 });
  await syncBtn.click();
  await expect(syncBtn).toBeEnabled({ timeout: 60_000 });
}

async function readConsultationRow(page: Page, id: string): Promise<{ paid?: boolean; payment_status?: string | null } | null> {
  return page.evaluate(async (consultationId: string) => {
    return new Promise<{ paid?: boolean; payment_status?: string | null } | null>((resolve, reject) => {
      const req = indexedDB.open("nutriclinica");
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction("consultations", "readonly");
        const store = tx.objectStore("consultations");
        const getReq = store.get(consultationId);
        getReq.onsuccess = () => resolve(getReq.result ?? null);
        getReq.onerror = () => reject(getReq.error);
      };
      req.onerror = () => reject(req.error);
    });
  }, id);
}

async function apiLogin(): Promise<string> {
  const ctx = await request.newContext({ baseURL: API_BASE });
  const resp = await ctx.post("/auth/login", {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  if (!resp.ok()) {
    throw new Error(`Login API falló: ${resp.status()} ${await resp.text()}`);
  }
  const body = (await resp.json()) as { token: string };
  return body.token;
}

async function pushUnpaidConsultation(token: string, id: string, cost: number): Promise<void> {
  const ctx = await request.newContext({ baseURL: API_BASE });
  const now = new Date().toISOString();
  const resp = await ctx.post("/sync/push", {
    headers: { Authorization: `Bearer ${token}`, "X-Sucursal-Id": SUCURSAL_ID },
    data: {
      sucursalId: SUCURSAL_ID,
      operations: [
        {
          op: "create",
          entity: "consultas",
          id,
          clientUpdatedAt: now,
          payload: {
            id,
            patient_id: PATIENT_ID,
            profesional_id: PROFESIONAL_ID,
            consultation_number: Math.floor(Math.random() * 1000) + 100,
            consultation_date: now,
            reason: "E2E billing smoke test",
            subjective: null,
            objective: null,
            assessment: null,
            plan: null,
            status: "completed",
            cost,
            paid: false,
            payment_method: null,
            paid_at: null,
            reference: null,
            invoice_number: null,
            billing_notes: null,
            deleted_at: null,
          },
        },
      ],
    },
  });
  if (!resp.ok()) {
    throw new Error(`Push consulta falló: ${resp.status()} ${await resp.text()}`);
  }
  await ctx.dispose();
}

test.describe.serial("Billing — marcar consulta como pagada desde el detalle", () => {
  test.setTimeout(90_000);

  test("botón 'Marcar pagada' en ConsultationDetailPage abre dialog y persiste", async ({ page }) => {
    // 1) Setup: crear una consulta con cost > 0 vía API
    const token = await apiLogin();
    const consultationId = `CCCCCCCC-1111-1111-1111-${Date.now().toString().slice(-12)}`;
    await pushUnpaidConsultation(token, consultationId, 750.0);

    // 2) Login en la UI y disparar sync para bajarla
    await loginAsAdmin(page);

    // Esperar a que la pull request termine y verificar que incluye nuestra consulta
    const pullPromise = page.waitForResponse(
      (resp) => resp.url().includes("/sync/pull"),
      { timeout: 30_000 },
    );
    await page.getByRole("button", { name: SYNC_BUTTON_NAME }).click();
    const pullResp = await pullPromise;
    const pullBody = await pullResp.text();
    expect(pullBody.toLowerCase()).toContain(consultationId.toLowerCase());

    // Esperar a que la sync engine termine de aplicar el pull
    await page.waitForTimeout(1500);

    // 3) Navegar al detalle de la consulta
    await page.goto(hashUrl(`/consultas/${consultationId}`));
    // El PageHeader muestra "Consulta #N" (texto, no heading role)
    await expect(page.getByText(/Consulta #\d+/i).first()).toBeVisible({ timeout: 15_000 });

    // 4) Verificar que el botón "Marcar pagada" está visible
    const markPaid = page.getByTestId("mark-paid-detail");
    await expect(markPaid).toBeVisible({ timeout: 10_000 });
    await expect(markPaid).toHaveText(/Marcar( como)? pagada/i);

    // 5) Click → dialog abre
    await markPaid.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/Registrar pago|Marcar( como)? pagada/i).first()).toBeVisible();

    // 6) Llenar método de pago (requerido) y referencia
    const methodTrigger = page.getByTestId("paid-method");
    await methodTrigger.click();
    await page.getByRole("option", { name: /efectivo|cash/i }).first().click();
    await page.getByTestId("paid-reference").fill("E2E-001");

    // 7) Submit
    await dialog.getByRole("button", { name: /Marcar( como)? pagada|Guardando/i }).click();

    // 8) Dialog cierra y la UI refleja el pago
    await expect(dialog).not.toBeVisible({ timeout: 10_000 });
    // El botón ahora dice "Editar pago" en lugar de "Marcar pagada"
    await expect(page.getByTestId("mark-paid-detail")).toHaveText(/Editar pago/i, {
      timeout: 10_000,
    });
    await expect.poll(async () => (await readConsultationRow(page, consultationId))?.paid ?? false, {
      timeout: 10_000,
    }).toBe(true);

    // 9) Re-sync y recarga de ruta: el pago persiste localmente y no rebota.
    await forceSync(page);
    await expect.poll(async () => (await readConsultationRow(page, consultationId))?.payment_status ?? null, {
      timeout: 10_000,
    }).toBe("paid");
    await page.goto(hashUrl(`/consultas/${consultationId}`));
    await expect(page.getByText(/Consulta #\d+/i).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("mark-paid-detail")).toHaveText(/Editar pago/i, {
      timeout: 10_000,
    });
  });
});
