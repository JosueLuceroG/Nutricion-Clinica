import type { ClinicalAlertPreferences } from "./clinicalAlertPreferences";

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export type ClinicalAlertKind =
  | "upcoming-consultation"
  | "unconfirmed-appointment"
  | "expiring-plan"
  | "pending-payment";

export interface ClinicalAlertCandidate {
  id: string;
  kind: ClinicalAlertKind;
  patientId: string;
  patientName: string;
  targetRoute: string;
  occursAt: string;
  priority: number;
  minutesUntil?: number;
  hoursUntil?: number;
  daysUntil?: number;
  remainingAmount?: number;
}

interface PatientAlertRow {
  id: string;
  sucursal_id?: string | null;
  first_name: string;
  last_name: string;
  second_last_name?: string | null;
  status: string;
  deleted_at: string | null;
}

interface AppointmentAlertRow {
  id: string;
  patient_id: string;
  office_id: string | null;
  date: string;
  start_time: string;
  status: string;
  updated_at: number;
}

interface MealPlanAlertRow {
  id: string;
  sucursal_id?: string | null;
  patient_id: string;
  start_date: string;
  end_date: string | null;
  status: string;
  updated_at: string;
  deleted_at: string | null;
}

interface ConsultationAlertRow {
  id: string;
  sucursal_id?: string | null;
  patient_id: string;
  consultation_date: string;
  status: string;
  cost: number;
  paid: boolean;
  payment_status: string | null;
  amount_paid: number | null;
  updated_at: string;
  deleted_at: string | null;
}

interface BuildClinicalAlertsInput {
  now: Date;
  branchId: string;
  preferences: ClinicalAlertPreferences;
  patients: PatientAlertRow[];
  appointments: AppointmentAlertRow[];
  mealPlans: MealPlanAlertRow[];
  consultations: ConsultationAlertRow[];
}

function localDateTime(date: string, time: string): Date | null {
  const value = new Date(`${date}T${time.length === 5 ? `${time}:00` : time}`);
  return Number.isFinite(value.getTime()) ? value : null;
}

function localDate(date: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
  if (!match) return null;
  const value = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 23, 59, 59, 999);
  return Number.isFinite(value.getTime()) ? value : null;
}

function calendarDaysUntil(date: string, now: Date): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
  if (!match) return null;
  const target = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (!Number.isFinite(target.getTime())) return null;
  return Math.round((target.getTime() - today.getTime()) / DAY_MS);
}

function patientName(row: PatientAlertRow): string {
  return [row.first_name, row.last_name, row.second_last_name].filter(Boolean).join(" ");
}

export function buildClinicalAlertCandidates({
  now,
  branchId,
  preferences,
  patients,
  appointments,
  mealPlans,
  consultations,
}: BuildClinicalAlertsInput): ClinicalAlertCandidate[] {
  if (!preferences.enabled) return [];

  const nowMs = now.getTime();
  const patientRows = patients.filter(
    (row) => row.sucursal_id === branchId && !row.deleted_at,
  );
  const patientNames = new Map(patientRows.map((row) => [row.id, patientName(row)]));
  const activePatientIds = new Set(
    patientRows.filter((row) => row.status === "active").map((row) => row.id),
  );
  const alerts: ClinicalAlertCandidate[] = [];

  appointments
    .filter(
      (row) =>
        row.office_id === branchId &&
        (row.status === "scheduled" || row.status === "confirmed"),
    )
    .forEach((row) => {
      const startsAt = localDateTime(row.date, row.start_time);
      if (!startsAt) return;
      const millisecondsUntil = startsAt.getTime() - nowMs;
      if (millisecondsUntil <= 0) return;
      const minutesUntil = Math.ceil(millisecondsUntil / MINUTE_MS);
      const withinUpcomingWindow =
        preferences.upcomingConsultation.enabled &&
        millisecondsUntil <= preferences.upcomingConsultation.lead * MINUTE_MS;

      if (withinUpcomingWindow) {
        alerts.push({
          id: `clinical-alert:upcoming:${row.id}:${row.date}:${row.start_time}:${preferences.upcomingConsultation.lead}`,
          kind: "upcoming-consultation",
          patientId: row.patient_id,
          patientName: patientNames.get(row.patient_id) ?? "Paciente",
          targetRoute: `/agenda?date=${encodeURIComponent(row.date)}&appointmentId=${encodeURIComponent(row.id)}`,
          occursAt: startsAt.toISOString(),
          priority: 0,
          minutesUntil,
        });
      }

      if (
        row.status === "scheduled" &&
        preferences.unconfirmedAppointment.enabled &&
        !withinUpcomingWindow &&
        millisecondsUntil <= preferences.unconfirmedAppointment.lead * HOUR_MS
      ) {
        alerts.push({
          id: `clinical-alert:unconfirmed:${row.id}:${row.date}:${row.start_time}:${preferences.unconfirmedAppointment.lead}`,
          kind: "unconfirmed-appointment",
          patientId: row.patient_id,
          patientName: patientNames.get(row.patient_id) ?? "Paciente",
          targetRoute: `/agenda?date=${encodeURIComponent(row.date)}&appointmentId=${encodeURIComponent(row.id)}`,
          occursAt: startsAt.toISOString(),
          priority: 1,
          hoursUntil: Math.ceil(millisecondsUntil / HOUR_MS),
        });
      }
    });

  if (preferences.expiringPlan.enabled) {
    const latestActivePlanByPatient = new Map<string, MealPlanAlertRow>();
    mealPlans
      .filter(
        (row) =>
          row.sucursal_id === branchId &&
          !row.deleted_at &&
          row.status === "active" &&
          activePatientIds.has(row.patient_id),
      )
      .forEach((row) => {
        const current = latestActivePlanByPatient.get(row.patient_id);
        if (!current || row.start_date > current.start_date) {
          latestActivePlanByPatient.set(row.patient_id, row);
        }
      });

    latestActivePlanByPatient.forEach((row) => {
      if (!row.end_date) return;
      const endsAt = localDate(row.end_date);
      if (!endsAt) return;
      const daysUntil = calendarDaysUntil(row.end_date, now);
      if (daysUntil === null) return;
      if (daysUntil > preferences.expiringPlan.lead) return;
      alerts.push({
        id: `clinical-alert:plan:${row.id}:${row.end_date}:${preferences.expiringPlan.lead}`,
        kind: "expiring-plan",
        patientId: row.patient_id,
        patientName: patientNames.get(row.patient_id) ?? "Paciente",
        targetRoute: `/pacientes/${encodeURIComponent(row.patient_id)}/planes`,
        occursAt: endsAt.toISOString(),
        priority: 2,
        daysUntil,
      });
    });
  }

  if (preferences.pendingPayment.enabled) {
    consultations
      .filter((row) => {
        if (row.sucursal_id !== branchId || row.deleted_at || row.status !== "completed" || !(row.cost > 0)) {
          return false;
        }
        const paymentStatus = row.payment_status ?? (row.paid ? "paid" : "pending");
        if (paymentStatus !== "pending" && paymentStatus !== "partial") return false;
        const consultationTime = new Date(row.consultation_date).getTime();
        return Number.isFinite(consultationTime) && nowMs - consultationTime >= preferences.pendingPayment.lead * DAY_MS;
      })
      .forEach((row) => {
        const remainingAmount = Math.max(0, row.cost - Math.max(0, row.amount_paid ?? (row.paid ? row.cost : 0)));
        if (remainingAmount <= 0) return;
        alerts.push({
          id: `clinical-alert:payment:${row.id}:${preferences.pendingPayment.lead}`,
          kind: "pending-payment",
          patientId: row.patient_id,
          patientName: patientNames.get(row.patient_id) ?? "Paciente",
          targetRoute: "/billing",
          occursAt: row.consultation_date,
          priority: 3,
          remainingAmount,
        });
      });
  }

  return alerts.sort((left, right) =>
    left.priority - right.priority || left.occursAt.localeCompare(right.occursAt),
  );
}
