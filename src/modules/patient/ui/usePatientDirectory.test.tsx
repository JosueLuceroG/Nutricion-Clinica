import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_PATIENT_DIRECTORY_FILTERS,
  type PatientDirectoryClinicalSegment,
} from "../application/patientDirectoryTypes";
import type { PatientRow } from "../infrastructure/patientMapper";
import { db } from "@services/db/dexieSchema";
import { usePatientDirectory } from "./usePatientDirectory";
import { markRemoteTransaction } from "@services/sync/atomicOutbox";
import { useSyncStore } from "@store/syncStore";

const makePatient = (
  index: number,
  overrides: Partial<PatientRow> = {},
): PatientRow => ({
  id: `patient-${String(index).padStart(3, "0")}`,
  sucursal_id: "branch-1",
  first_name: `Paciente ${String(index).padStart(2, "0")}`,
  last_name: "Directorio",
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
  record_opened_at: "2025-01-01T12:00:00.000Z",
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
  photo_url: null,
  status: "active",
  created_at: "2025-01-01T12:00:00.000Z",
  updated_at: "2025-01-01T12:00:00.000Z",
  deleted_at: null,
  ...overrides,
});

const baseQuery = {
  branchId: "branch-1",
  search: "",
  status: "all" as const,
  filters: DEFAULT_PATIENT_DIRECTORY_FILTERS,
  clinicalSegment: "all" as const,
  sort: "clinical-priority" as const,
  page: 1,
  pageSize: 10,
};

const dateFromToday = (days: number): string => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const isoFromToday = (days: number): string =>
  `${dateFromToday(days)}T12:00:00.000Z`;

beforeEach(async () => {
  useSyncStore.getState().setSucursalId("branch-1");
  await db.transaction("rw", db.tables, async () => {
  markRemoteTransaction();
  await Promise.all([
    db.patients.clear(),
    db.meal_plans.clear(),
    db.appointments.clear(),
    db.consultations.clear(),
    db.anthropometry.clear(),
    db.goals.clear(),
  ]);

  await db.patients.bulkPut([
    ...Array.from({ length: 12 }, (_, index) =>
      makePatient(
        index + 1,
        index === 0
          ? {
              first_name: "María",
              last_name: "Especial",
              phone: "+52 55 5123 4567",
              clave_interna: "EXP-UNICO",
            }
          : {},
      ),
    ),
    makePatient(20, { id: "legacy-patient", sucursal_id: null }),
    makePatient(21, { id: "other-branch", sucursal_id: "branch-2" }),
    makePatient(22, {
      id: "deleted-patient",
      status: "inactive",
      deleted_at: "2026-01-10T12:00:00.000Z",
    }),
  ]);
  });
});

afterEach(async () => {
  await db.transaction("rw", db.patients, async () => {
    markRemoteTransaction();
    await db.patients.clear();
  });
});

describe("usePatientDirectory", () => {
  it("scopes the directory and paginates beyond the first ten records", async () => {
    const { result, rerender } = renderHook(
      ({ page }) => usePatientDirectory({ ...baseQuery, page }),
      { initialProps: { page: 1 } },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data?.filteredTotal).toBe(12);
    expect(result.current.data?.items).toHaveLength(10);
    expect(result.current.data?.counts.deleted).toBe(1);
    expect(
      result.current.data?.items.some(
        (item) => item.patient.id.toString() === "other-branch",
      ),
    ).toBe(false);

    await act(async () => rerender({ page: 2 }));
    await waitFor(() => expect(result.current.data?.page).toBe(2));
    expect(result.current.data?.items).toHaveLength(2);
  });

  it("searches without accents and by phone or record number", async () => {
    const firstSearch = renderHook(() =>
      usePatientDirectory({ ...baseQuery, search: "maria" }),
    );

    await waitFor(() =>
      expect(firstSearch.result.current.data?.filteredTotal).toBe(1),
    );
    expect(firstSearch.result.current.data?.items[0]?.patient.fullName).toBe(
      "María Especial",
    );
    firstSearch.unmount();

    const phoneSearch = renderHook(() =>
      usePatientDirectory({ ...baseQuery, search: "555123" }),
    );
    await waitFor(() =>
      expect(phoneSearch.result.current.data?.filteredTotal).toBe(1),
    );
    phoneSearch.unmount();

    const recordSearch = renderHook(() =>
      usePatientDirectory({ ...baseQuery, search: "exp-unico" }),
    );
    await waitFor(() =>
      expect(recordSearch.result.current.data?.filteredTotal).toBe(1),
    );
  });

  it("returns only soft-deleted patients in the deleted view", async () => {
    const { result } = renderHook(() =>
      usePatientDirectory({ ...baseQuery, status: "deleted" }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data?.filteredTotal).toBe(1);
    expect(result.current.data?.items[0]?.patient.id.toString()).toBe(
      "deleted-patient",
    );
  });

  it("derives clinical segments and insights from real patient records", async () => {
    await Promise.all([
      db.meal_plans.bulkPut([
        {
          id: "plan-on-track",
          sucursal_id: "branch-1",
          patient_id: "patient-001",
          consultation_id: null,
          name: "Plan metabólico",
          description: null,
          start_date: isoFromToday(-14),
          end_date: isoFromToday(21),
          kcal_target: 1800,
          protein_target_g: 100,
          carbs_target_g: 210,
          fat_target_g: 60,
          meals_json: "[]",
          notes: null,
          status: "active",
          created_at: isoFromToday(-14),
          updated_at: isoFromToday(-14),
          deleted_at: null,
        },
        {
          id: "plan-expiring",
          sucursal_id: "branch-1",
          patient_id: "patient-002",
          consultation_id: null,
          name: "Plan por renovar",
          description: null,
          start_date: isoFromToday(-30),
          end_date: isoFromToday(3),
          kcal_target: 1900,
          protein_target_g: 100,
          carbs_target_g: 220,
          fat_target_g: 65,
          meals_json: "[]",
          notes: null,
          status: "active",
          created_at: isoFromToday(-30),
          updated_at: isoFromToday(-30),
          deleted_at: null,
        },
      ]),
      db.appointments.put({
        id: "appointment-on-track",
        patient_id: "patient-001",
        professional_id: "professional-1",
        office_id: "branch-1",
        date: dateFromToday(2),
        start_time: "10:00",
        end_time: "11:00",
        duration_min: 60,
        type: "follow_up",
        status: "confirmed",
        reason: "Seguimiento",
        notes: "",
        consultation_id: null,
        reminder_sent: 0,
        confirmed_at: isoFromToday(0),
        cancelled_reason: "",
        rescheduled_from_id: null,
        cost: 700,
        paid: 0,
        payment_method: "",
        created_at: Date.now(),
        updated_at: Date.now(),
      }),
      db.consultations.bulkPut([
        {
          id: "consultation-on-track",
          sucursal_id: "branch-1",
          patient_id: "patient-001",
          consultation_date: isoFromToday(-10),
          consultation_number: 1,
          reason: "Seguimiento",
          subjective: null,
          objective: null,
          vitals_json: null,
          assessment: null,
          plan: null,
          anthropometry_id: "measurement-on-track",
          lab_panel_id: null,
          next_visit_date: null,
          status: "completed",
          cost: 700,
          paid: true,
          payment_status: "paid",
          payment_concept: "consulta",
          payment_method: "cash",
          paid_at: isoFromToday(-10),
          reference: null,
          invoice_number: null,
          billing_notes: null,
          amount_paid: 700,
          created_at: isoFromToday(-10),
          updated_at: isoFromToday(-10),
          deleted_at: null,
        },
        {
          id: "consultation-expiring",
          sucursal_id: "branch-1",
          patient_id: "patient-002",
          consultation_date: isoFromToday(-5),
          consultation_number: 1,
          reason: "Seguimiento",
          subjective: null,
          objective: null,
          vitals_json: null,
          assessment: null,
          plan: null,
          anthropometry_id: null,
          lab_panel_id: null,
          next_visit_date: null,
          status: "completed",
          cost: 700,
          paid: true,
          payment_status: "paid",
          payment_concept: "consulta",
          payment_method: "cash",
          paid_at: isoFromToday(-5),
          reference: null,
          invoice_number: null,
          billing_notes: null,
          amount_paid: 700,
          created_at: isoFromToday(-5),
          updated_at: isoFromToday(-5),
          deleted_at: null,
        },
      ]),
      db.anthropometry.put({
        id: "measurement-on-track",
        patient_id: "patient-001",
        measured_at: isoFromToday(-10),
        weight_kg: 80,
        height_m: 1.7,
        circumferences: null,
        skinfolds: null,
        bia_json: null,
        notes: null,
        created_at: isoFromToday(-10),
        updated_at: isoFromToday(-10),
        deleted_at: null,
      }),
      db.goals.put({
        id: "goal-on-track",
        patient_id: "patient-001",
        consultation_origin_id: null,
        type: "antropometrico",
        variable: "Peso",
        initial_value: 90,
        initial_value_date: dateFromToday(-30),
        target_value: 70,
        unit: "kg",
        start_date: dateFromToday(-30),
        target_date: dateFromToday(90),
        close_date: null,
        status: "activo",
        criterion: "menor_igual",
        criterion_detail: "",
        priority: "alta",
        source: "profesional",
        reason: "Reducción de peso",
        action_plan: "",
        tracking_metrics: "[]",
        alerts: "[]",
        professional_id: "professional-1",
        notes: "",
        created_at: Date.now(),
        updated_at: Date.now(),
      }),
    ]);

    const { result, rerender } = renderHook(
      ({
        clinicalSegment,
      }: {
        clinicalSegment: PatientDirectoryClinicalSegment;
      }) => usePatientDirectory({ ...baseQuery, clinicalSegment }),
      {
        initialProps: {
          clinicalSegment: "all" as PatientDirectoryClinicalSegment,
        },
      },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data?.clinicalCounts).toEqual({
      all: 12,
      onTrack: 1,
      followUp: 0,
      atRisk: 11,
      new: 0,
    });
    expect(result.current.data?.insights).toEqual({
      activeWithPlan: 2,
      advancingToGoal: 1,
      patientsWithGoal: 1,
      appointmentsThisWeek: 1,
      requiresContact: 10,
      expiringPlans: 1,
    });

    await act(async () => rerender({ clinicalSegment: "on-track" }));
    await waitFor(() => expect(result.current.data?.filteredTotal).toBe(1));
    expect(result.current.data?.items[0]).toMatchObject({
      activePlanName: "Plan metabólico",
      goalLabel: "Reducción de peso",
      goalProgress: 50,
      clinicalStatus: "on-track",
    });
  });
});
