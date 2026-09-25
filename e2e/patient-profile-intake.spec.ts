import { expect, test } from "@playwright/test";
import { fakeLogin, hashUrl } from "./helpers";

const PATIENT_ID = "e2e-profile-intake";

test("muestra en el perfil los datos capturados para diagnóstico", async ({
  page,
}) => {
  await fakeLogin(page, "e2e-branch");
  await page.goto(hashUrl("/pacientes"));
  await page.waitForLoadState("domcontentloaded");
  await expect(
    page
      .getByLabel(/Directorio de pacientes|Patient directory/i)
      .getByRole("button", { name: /Agregar paciente|Add patient/i }),
  ).toBeVisible();

  await page.evaluate(
    async ({ patientId }) => {
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open("nutriclinica");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const transaction = database.transaction("patients", "readwrite");
      const now = new Date().toISOString();
      transaction.objectStore("patients").put({
        id: patientId,
        sucursal_id: "e2e-branch",
        first_name: "Elena",
        last_name: "Diagnóstico",
        second_last_name: "Completo",
        birth_date: "1988-04-09T12:00:00.000Z",
        sex: "female",
        gender: "woman",
        marital_status: "married",
        occupation: "Docente",
        education: "postgraduate",
        email: "elena@example.com",
        phone: "+525512345678",
        secondary_phone: null,
        whatsapp_enabled: true,
        emergency_contact_name: "Contacto Elena",
        emergency_contact_relationship: "Hermana",
        emergency_contact_phone: "+525587654321",
        record_status: "active",
        record_opened_at: now,
        general_notes: "Seguimiento integral",
        consentimiento_informado_id: null,
        fecha_firma_consentimiento: null,
        version_politica_privacidad: null,
        clinical_tags: '["riesgo metabólico"]',
        clave_interna: "CLI-ELENA",
        birth_place: "Oaxaca",
        address: "Centro, Oaxaca",
        nationality: "Mexicana",
        id_type: "INE",
        id_number: "INE-123",
        discharge_reason: null,
        responsible_professional_id: "e2e-test-user",
        external_record_number: "EXP-ELENA-01",
        admission_reason: "Valoración metabólica integral",
        photo_url: null,
        medical_intake: JSON.stringify({
          diagnosedConditions: true,
          diagnosedConditionDetails: [
            {
              diagnosis: "Diabetes tipo 2",
              diagnosisYear: 2021,
              status: "controlled",
              treatment: "Metformina",
            },
          ],
          previousSurgeries: true,
          previousSurgeryDetails: [
            { procedure: "Colecistectomía", year: 2018, reason: "Litiasis" },
          ],
          familyHistory: true,
          familyHistoryMode: "recorded",
          familyHistoryDetails: {
            diabetes: ["mother"],
            hypertension: ["none"],
            obesity: ["none"],
            cardiovascularDisease: ["none"],
            dyslipidemia: ["none"],
            kidneyDisease: ["none"],
            thyroidDisease: ["none"],
            otherConditions: null,
            notes: "Madre con diabetes",
          },
          medicationAllergies: true,
          medicationAllergyDetails: [
            {
              medication: "Penicilina",
              reaction: "Urticaria",
              severity: "severe",
              requiredMedicalAttention: true,
            },
          ],
          nutritionIntake: {
            routine: {
              breakfastTime: "08:00",
              mainMealTime: "14:00",
              dinnerTime: "20:00",
              snackTimes: ["11:00"],
              mealsPerDay: 4,
              skipsMeals: false,
              mostSkippedMeal: null,
              scheduleVaries: false,
              scheduleVariation: null,
              mealDuration: "20To30",
            },
          },
          physicalActivity: true,
          physicalActivityIntake: {
            activity: {
              level: "moderate",
              daysPerWeek: 4,
              sessionDurationMinutes: 45,
              activityTypes: ["walking"],
              primaryGoal: "health",
              hasPhysicalLimitation: false,
              physicalLimitationDetails: null,
              notes: "Caminata vespertina",
            },
          },
        }),
        status: "active",
        created_at: now,
        updated_at: now,
        deleted_at: null,
      });

      await new Promise<void>((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      });
      database.close();
    },
    { patientId: PATIENT_ID },
  );

  await page.goto(hashUrl(`/pacientes/${PATIENT_ID}`));

  await expect(page.getByRole("heading", { name: "Elena Diagnóstico Completo" })).toBeVisible();
  await expect(page.getByText("EXP-ELENA-01", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Valoración metabólica integral", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Tamizaje inicial", { exact: true })).toBeVisible();
  await expect(page.getByText("Diabetes tipo 2", { exact: true })).toBeVisible();
  await expect(page.getByText("Colecistectomía", { exact: true })).toBeVisible();
  await expect(page.getByText("Penicilina", { exact: true })).toBeVisible();
  await expect(page.getByText("Madre con diabetes", { exact: true })).toBeVisible();
  await expect(page.getByText("4 comidas", { exact: true })).toBeVisible();
  await expect(page.getByText("Caminata vespertina", { exact: true })).toBeVisible();

  const consultationsLink = page.locator(
    `a[href="#/pacientes/${PATIENT_ID}/consultas"]`,
  );
  await consultationsLink.hover();
  await consultationsLink.click();
  await expect(page).toHaveURL(
    new RegExp(`#\\/pacientes\\/${PATIENT_ID}\\/consultas$`),
  );
  await expect(
    page.getByRole("heading", {
      name: /Consultas.*Elena Diagnóstico Completo/i,
    }),
  ).toBeVisible();
});
