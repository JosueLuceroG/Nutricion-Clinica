import { expect, test, type Page } from "@playwright/test";
import { fakeLogin, hashUrl } from "./helpers";

const BRANCH_ID = "e2e-clinical-alerts";
const PATIENT_ID = "018f0000-0000-7000-8000-000000000901";
const APPOINTMENT_ID = "018f0000-0000-7000-8000-000000000902";

async function seedUpcomingAppointment(page: Page) {
  await page.evaluate(
    async ({ branchId, patientId, appointmentId }) => {
      const pad = (value: number) => String(value).padStart(2, "0");
      const startsAt = new Date(Date.now() + 9 * 60_000);
      const endsAt = new Date(startsAt.getTime() + 45 * 60_000);
      const date = `${startsAt.getFullYear()}-${pad(startsAt.getMonth() + 1)}-${pad(startsAt.getDate())}`;
      const startTime = `${pad(startsAt.getHours())}:${pad(startsAt.getMinutes())}`;
      const endTime = `${pad(endsAt.getHours())}:${pad(endsAt.getMinutes())}`;

      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.open("nutriclinica");
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction(["patients", "appointments"], "readwrite");
          transaction.onerror = () => reject(transaction.error);
          transaction.oncomplete = () => resolve();
          transaction.objectStore("patients").put({
            id: patientId,
            sucursal_id: branchId,
            first_name: "Elena",
            last_name: "Recordatorio",
            second_last_name: null,
            birth_date: "1992-04-10T12:00:00.000Z",
            sex: "female",
            gender: null,
            marital_status: null,
            occupation: null,
            education: null,
            email: "elena.alerta@example.com",
            phone: "5550000901",
            secondary_phone: null,
            emergency_contact_name: null,
            emergency_contact_relationship: null,
            emergency_contact_phone: null,
            record_status: "active",
            record_opened_at: "2026-01-01T12:00:00.000Z",
            general_notes: null,
            consentimiento_informado_id: null,
            fecha_firma_consentimiento: null,
            version_politica_privacidad: null,
            clinical_tags: "[]",
            clave_interna: "ALT-901",
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
            created_at: "2026-01-01T12:00:00.000Z",
            updated_at: new Date().toISOString(),
            deleted_at: null,
          });
          transaction.objectStore("appointments").put({
            id: appointmentId,
            patient_id: patientId,
            professional_id: "e2e-test-user",
            office_id: branchId,
            date,
            start_time: startTime,
            end_time: endTime,
            duration_min: 45,
            type: "follow_up",
            status: "confirmed",
            reason: "Seguimiento nutricional",
            notes: "",
            consultation_id: null,
            reminder_sent: 0,
            confirmed_at: new Date().toISOString(),
            cancelled_reason: "",
            rescheduled_from_id: null,
            cost: 0,
            paid: 0,
            payment_method: "",
            created_at: Date.now(),
            updated_at: Date.now(),
          });
        };
      });
    },
    { branchId: BRANCH_ID, patientId: PATIENT_ID, appointmentId: APPOINTMENT_ID },
  );
}

test.describe("alertas clínicas configurables", () => {
  test.beforeEach(async ({ page }) => {
    await fakeLogin(page, BRANCH_ID);
  });

  test("configura y conserva la anticipación por usuario y sucursal", async ({ page }) => {
    await page.goto(hashUrl("/configuracion?section=clinical-alerts"));
    const card = page.getByTestId("clinical-alerts-settings");
    await expect(card).toBeVisible({ timeout: 30_000 });
    await expect(card).toBeFocused();

    const leadSelect = card.getByRole("combobox", { name: "Próxima consulta" });
    await leadSelect.click();
    await page.getByRole("option", { name: "30 min antes" }).click();
    await expect(leadSelect).toContainText("30 min antes");

    await page.reload();
    await expect(page.getByTestId("clinical-alerts-settings")).toBeVisible();
    await expect(
      page.getByTestId("clinical-alerts-settings").getByRole("combobox", { name: "Próxima consulta" }),
    ).toContainText("30 min antes");
  });

  test("muestra la próxima consulta y abre su detalle desde la campana", async ({ page }) => {
    await page.goto(hashUrl("/"));
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible({ timeout: 30_000 });
    await seedUpcomingAppointment(page);
    // Raw IndexedDB seeding does not emit Dexie's live-query mutation event.
    await page.reload();
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible({ timeout: 30_000 });

    const popup = page.locator("[data-sonner-toast]").filter({ hasText: "Próxima consulta" });
    await expect(popup).toContainText("Elena Recordatorio", { timeout: 15_000 });

    await page.getByRole("button", { name: /^Notificaciones \(/ }).click();
    await page.getByRole("tab", { name: /^General/ }).click();
    const notification = page
      .locator(".nc-dashboard-notification-menu__item")
      .filter({ hasText: "Elena Recordatorio" });
    await expect(notification).toContainText("Próxima consulta");
    await notification.click();

    await expect(page).toHaveURL(new RegExp(`#/agenda\\?date=.*appointmentId=${APPOINTMENT_ID}$`));
  });
});
