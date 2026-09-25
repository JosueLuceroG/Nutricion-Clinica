import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PatientRow } from "@modules/patient/infrastructure/patientMapper";
import { db } from "@services/db/dexieSchema";
import { useSyncStore } from "@store/syncStore";
import { markRemoteTransaction } from "@services/sync/atomicOutbox";

vi.mock("@store/authStore", () => ({
  useAuthStore: (
    selector: (state: {
      sucursalActivaId: string;
      user: { rol: string };
    }) => unknown,
  ) => selector({ sucursalActivaId: "branch-1", user: { rol: "nutriologo" } }),
}));

import { usePatientClinicalSummary } from "./usePatientClinicalSummary";

const PATIENT_ID = "patient-alerts";
const NOW = "2026-07-30T12:00:00.000Z";

const makePatient = (medicalIntake: object): PatientRow => ({
  id: PATIENT_ID,
  sucursal_id: "branch-1",
  first_name: "Ana",
  last_name: "Alertas",
  second_last_name: null,
  birth_date: "1990-01-15T12:00:00.000Z",
  sex: "female",
  gender: null,
  marital_status: null,
  occupation: null,
  education: null,
  email: null,
  phone: null,
  secondary_phone: null,
  emergency_contact_name: null,
  emergency_contact_relationship: null,
  emergency_contact_phone: null,
  record_status: "active",
  record_opened_at: NOW,
  general_notes: null,
  consentimiento_informado_id: null,
  fecha_firma_consentimiento: null,
  version_politica_privacidad: null,
  clinical_tags: "[]",
  clave_interna: null,
  birth_place: null,
  address: null,
  nationality: null,
  id_type: null,
  id_number: null,
  discharge_reason: null,
  responsible_professional_id: null,
  external_record_number: null,
  admission_reason: null,
  photo_url: null,
  medical_intake: JSON.stringify(medicalIntake),
  status: "active",
  created_at: NOW,
  updated_at: NOW,
  deleted_at: null,
});

const renderSummary = async () => {
  const hook = renderHook(() => usePatientClinicalSummary(PATIENT_ID));
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  return hook;
};

beforeEach(async () => {
  useSyncStore.getState().setSucursalId("branch-1");
  await db.transaction("rw", db.tables, async () => {
  markRemoteTransaction();
  await Promise.all([
    db.patients.clear(),
    db.consultations.clear(),
    db.meal_plans.clear(),
    db.goals.clear(),
    db.allergies.clear(),
    db.intolerances.clear(),
    db.appointments.clear(),
    db.anthropometry.clear(),
  ]);
  });
});

describe("usePatientClinicalSummary alerts", () => {
  it("shows intake-only alerts without turning diagnoses into alerts", async () => {
    await db.patients.put(
      makePatient({
        diagnosedConditions: true,
        diagnosedConditionDetails: [
          {
            diagnosis: "Diabetes mellitus tipo 2",
            diagnosisYear: 2020,
            status: "controlled",
            treatment: "Metformina",
          },
        ],
        medicationAllergies: true,
        medicationAllergyDetails: [
          {
            medication: "Penicilina",
            reaction: "Urticaria",
            severity: "moderate",
            requiredMedicalAttention: false,
          },
        ],
        intolerances: true,
        intoleranceDetails: [
          {
            substance: "Lactosa",
            reaction: "Distensión abdominal",
            severity: "moderate",
          },
        ],
        adverseMedicationOrSupplementEffects: true,
        adverseEffectDetails: "Náusea intensa con hierro",
      }),
    );

    const { result } = await renderSummary();
    const alerts = result.current.summary?.alerts ?? [];

    expect(alerts).toHaveLength(3);
    expect(alerts.map((alert) => alert.message)).toEqual(
      expect.arrayContaining([
        "Alergia a Penicilina: Urticaria",
        "Intolerancia a Lactosa: Distensión abdominal",
        "Efecto adverso a medicamento o suplemento reportado: Náusea intensa con hierro",
      ]),
    );
    expect(alerts.some((alert) => alert.message.includes("Diabetes"))).toBe(
      false,
    );
  });

  it("deduplicates equivalent intake and normalized alerts", async () => {
    await db.patients.put(
      makePatient({
        medicationAllergyDetails: [
          {
            medication: "acido acetilsalicilico",
            reaction: "Urticaria",
            severity: "moderate",
            requiredMedicalAttention: false,
          },
        ],
        intoleranceDetails: [
          {
            substance: "lactosa",
            reaction: "Distensión",
            severity: "moderate",
          },
        ],
      }),
    );
    await Promise.all([
      db.allergies.put({
        id: "allergy-normalized",
        patient_id: PATIENT_ID,
        allergen: "ÁCIDO   ACETILSALICÍLICO",
        reaction: "Urticaria",
        severity: "moderada",
        diagnosis: "clinico",
        notes: null,
        created_at: NOW,
        updated_at: NOW,
      }),
      db.intolerances.put({
        id: "intolerance-normalized",
        patient_id: PATIENT_ID,
        food: "Láctosa",
        symptom: "Distensión",
        severity: "moderada",
        threshold_dose: null,
        mechanism: "lactosa",
        notes: null,
        created_at: NOW,
        updated_at: NOW,
      }),
    ]);

    const { result } = await renderSummary();
    const alerts = result.current.summary?.alerts ?? [];

    expect(alerts).toHaveLength(2);
    expect(
      alerts.filter((alert) => alert.id.startsWith("allergy:")),
    ).toHaveLength(1);
    expect(
      alerts.filter((alert) => alert.id.startsWith("intolerance:")),
    ).toHaveLength(1);
  });

  it("assigns critical severity to severe or medically attended intake alerts", async () => {
    await db.patients.put(
      makePatient({
        medicationAllergyDetails: [
          {
            medication: "Ibuprofeno",
            reaction: "Broncoespasmo",
            severity: "mild",
            requiredMedicalAttention: true,
          },
          {
            medication: "Sulfas",
            reaction: "Exantema",
            severity: "moderate",
            requiredMedicalAttention: false,
          },
        ],
        intoleranceDetails: [
          {
            substance: "Gluten",
            reaction: "Dolor abdominal",
            severity: "severe",
          },
        ],
        adverseMedicationOrSupplementEffects: true,
        adverseEffectDetails: "Mareo con suplemento",
      }),
    );

    const { result } = await renderSummary();
    const alerts = result.current.summary?.alerts ?? [];
    const severityFor = (text: string) =>
      alerts.find((alert) => alert.message.includes(text))?.severity;

    expect(severityFor("Ibuprofeno")).toBe("critical");
    expect(severityFor("atención médica")).toBe("critical");
    expect(severityFor("Gluten")).toBe("critical");
    expect(severityFor("Sulfas")).toBe("warning");
    expect(severityFor("Mareo con suplemento")).toBe("warning");
  });

  it("maps persisted anthropometry, attendance, plan macros, and latest note", async () => {
    await db.patients.put(makePatient({}));
    await db.anthropometry.bulkPut([
      {
        id: "measurement-1",
        sucursal_id: "branch-1",
        patient_id: PATIENT_ID,
        measured_at: "2026-02-01T12:00:00.000Z",
        weight_kg: 88,
        height_m: 1.766,
        circumferences: { waist: 99 },
        skinfolds: null,
        bia_json: JSON.stringify({ bodyFatPct: 30.2 }),
        notes: null,
        created_at: NOW,
        updated_at: NOW,
        deleted_at: null,
      },
      {
        id: "measurement-2",
        sucursal_id: "branch-1",
        patient_id: PATIENT_ID,
        measured_at: "2026-07-01T12:00:00.000Z",
        weight_kg: 88.6,
        height_m: 1.766,
        circumferences: { waist: 98 },
        skinfolds: null,
        bia_json: JSON.stringify({ bodyFatPct: 29.6 }),
        notes: null,
        created_at: NOW,
        updated_at: NOW,
        deleted_at: null,
      },
    ]);
    await db.meal_plans.put({
      id: "active-plan",
      sucursal_id: "branch-1",
      patient_id: PATIENT_ID,
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
        { slot: "breakfast", exchanges: [{ foodId: "food-1", count: 1 }] },
        { slot: "morning_snack", exchanges: [{ foodId: "food-2", count: 1 }] },
        { slot: "lunch", exchanges: [{ foodId: "food-3", count: 1 }] },
        {
          slot: "afternoon_snack",
          exchanges: [{ foodId: "food-4", count: 1 }],
        },
        { slot: "dinner", exchanges: [{ foodId: "food-5", count: 1 }] },
        { slot: "late_snack", exchanges: [] },
      ]),
      notes: null,
      status: "active",
      created_at: NOW,
      updated_at: NOW,
      deleted_at: null,
    });
    await db.appointments.bulkPut(
      Array.from({ length: 7 }, (_, index) => ({
        id: `appointment-${index}`,
        patient_id: PATIENT_ID,
        professional_id: "professional-1",
        office_id: "branch-1",
        date: `2026-0${index + 1}-15`,
        start_time: "10:00",
        end_time: "11:00",
        duration_min: 60,
        type: "follow_up",
        status: index < 4 ? "completed" : "no_show",
        reason: "Seguimiento",
        notes: "",
        consultation_id: index < 4 ? `consultation-${index}` : null,
        reminder_sent: 1,
        confirmed_at: null,
        cancelled_reason: "",
        rescheduled_from_id: null,
        cost: 0,
        paid: 0,
        payment_method: "",
        created_at: Date.now(),
        updated_at: Date.now(),
      })),
    );
    await db.consultations.put({
      id: "latest-consultation",
      sucursal_id: "branch-1",
      patient_id: PATIENT_ID,
      consultation_date: "2026-07-30T12:00:00.000Z",
      consultation_number: 4,
      reason: "Seguimiento nutricional",
      subjective: null,
      objective: null,
      vitals_json: null,
      assessment: null,
      plan: "Mantener hidratación y registrar comidas.",
      anthropometry_id: "measurement-2",
      lab_panel_id: null,
      next_visit_date: null,
      status: "completed",
      cost: 0,
      paid: false,
      payment_status: "paid",
      payment_concept: "consulta",
      payment_method: null,
      paid_at: null,
      reference: null,
      invoice_number: null,
      billing_notes: null,
      amount_paid: null,
      created_at: NOW,
      updated_at: NOW,
      deleted_at: null,
    });

    const { result } = await renderSummary();
    const summary = result.current.summary;

    expect(summary?.anthropometry.latest).toMatchObject({
      weightKg: 88.6,
      bodyFatPct: 29.6,
      waistCm: 98,
    });
    expect(summary?.anthropometry.latest?.bmi).toBeCloseTo(28.4, 1);
    expect(summary?.anthropometry.history).toEqual([
      { measuredAt: "2026-02-01T12:00:00.000Z", weightKg: 88 },
      { measuredAt: "2026-07-01T12:00:00.000Z", weightKg: 88.6 },
    ]);
    expect(summary?.attendance).toEqual({ attended: 4, total: 7 });
    expect(summary?.activePlan).toMatchObject({
      name: "Déficit moderado",
      kcalTarget: 2100,
      mealCount: 5,
      macroPercentages: { protein: 30, carbs: 42, fat: 28 },
    });
    expect(summary?.latestConsultation?.note).toBe(
      "Mantener hidratación y registrar comidas.",
    );
  });
});
