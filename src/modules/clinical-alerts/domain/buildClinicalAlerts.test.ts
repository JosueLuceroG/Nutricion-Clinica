import { describe, expect, it } from "vitest";
import { buildClinicalAlertCandidates } from "./buildClinicalAlerts";
import { createDefaultClinicalAlertPreferences } from "./clinicalAlertPreferences";

const branchId = "branch-a";
const patient = {
  id: "patient-1",
  sucursal_id: branchId,
  first_name: "María",
  last_name: "López",
  second_last_name: null,
  status: "active",
  deleted_at: null,
};

function input(overrides: Partial<Parameters<typeof buildClinicalAlertCandidates>[0]> = {}) {
  return {
    now: new Date(2026, 7, 1, 9, 50, 0),
    branchId,
    preferences: createDefaultClinicalAlertPreferences(),
    patients: [patient],
    appointments: [],
    mealPlans: [],
    consultations: [],
    ...overrides,
  };
}

describe("buildClinicalAlertCandidates", () => {
  it("alerts exactly ten minutes before a consultation without duplicating the confirmation reminder", () => {
    const alerts = buildClinicalAlertCandidates(input({
      appointments: [{
        id: "appointment-1",
        patient_id: patient.id,
        office_id: branchId,
        date: "2026-08-01",
        start_time: "10:00",
        status: "scheduled",
        updated_at: 1,
      }],
    }));

    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({
      kind: "upcoming-consultation",
      patientName: "María López",
      minutesUntil: 10,
      targetRoute: "/agenda?date=2026-08-01&appointmentId=appointment-1",
    });
  });

  it("creates an early unconfirmed alert but ignores other branches and terminal appointments", () => {
    const appointments = [
      {
        id: "unconfirmed",
        patient_id: patient.id,
        office_id: branchId,
        date: "2026-08-02",
        start_time: "09:00",
        status: "scheduled",
        updated_at: 1,
      },
      {
        id: "other-branch",
        patient_id: patient.id,
        office_id: "branch-b",
        date: "2026-08-02",
        start_time: "09:00",
        status: "scheduled",
        updated_at: 1,
      },
      {
        id: "cancelled",
        patient_id: patient.id,
        office_id: branchId,
        date: "2026-08-02",
        start_time: "09:00",
        status: "cancelled",
        updated_at: 1,
      },
    ];
    const alerts = buildClinicalAlertCandidates(input({ appointments }));

    expect(alerts.map((alert) => alert.kind)).toEqual(["unconfirmed-appointment"]);
  });

  it("uses only the latest active plan and reports calendar-day expiration", () => {
    const mealPlans = [
      {
        id: "old-plan",
        sucursal_id: branchId,
        patient_id: patient.id,
        start_date: "2026-06-01",
        end_date: "2026-08-01",
        status: "active",
        updated_at: "2026-06-01T00:00:00.000Z",
        deleted_at: null,
      },
      {
        id: "new-plan",
        sucursal_id: branchId,
        patient_id: patient.id,
        start_date: "2026-07-01",
        end_date: "2026-08-09",
        status: "active",
        updated_at: "2026-07-01T00:00:00.000Z",
        deleted_at: null,
      },
    ];

    expect(buildClinicalAlertCandidates(input({ mealPlans }))).toHaveLength(0);

    mealPlans[1]!.end_date = "2026-08-01";
    expect(buildClinicalAlertCandidates(input({ mealPlans }))).toMatchObject([
      { kind: "expiring-plan", daysUntil: 0 },
    ]);
  });

  it("alerts only completed consultations with a real outstanding balance", () => {
    const baseConsultation = {
      sucursal_id: branchId,
      patient_id: patient.id,
      consultation_date: "2026-07-31T10:00:00.000Z",
      cost: 1_000,
      paid: false,
      payment_status: "partial",
      amount_paid: 400,
      updated_at: "2026-08-01T00:00:00.000Z",
      deleted_at: null,
    };
    const consultations = [
      { ...baseConsultation, id: "completed", status: "completed" },
      { ...baseConsultation, id: "in-progress", status: "in-progress" },
      { ...baseConsultation, id: "paid", status: "completed", payment_status: "paid", paid: true },
    ];
    const alerts = buildClinicalAlertCandidates(input({ consultations }));

    expect(alerts).toMatchObject([
      { kind: "pending-payment", remainingAmount: 600, patientName: "María López" },
    ]);
  });

  it("returns no alerts when the master setting is disabled", () => {
    const preferences = createDefaultClinicalAlertPreferences();
    preferences.enabled = false;
    expect(buildClinicalAlertCandidates(input({ preferences }))).toEqual([]);
  });
});
