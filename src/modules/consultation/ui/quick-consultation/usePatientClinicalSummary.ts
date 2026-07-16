import { useLiveQuery } from "dexie-react-hooks";
import { isBillingReportRole } from "@modules/auth/authRoles";
import { db } from "@services/db/dexieSchema";
import { useAuthStore } from "@store/authStore";
import type {
  PatientClinicalSummary,
  PatientClinicalSummaryAlert,
} from "../../application/quickConsultationTypes";

const ACTIVE_APPOINTMENT_STATUSES = new Set([
  "scheduled",
  "confirmed",
  "in_progress",
]);

const goalPriority = (value: string): number => {
  if (value === "alta") return 0;
  if (value === "media") return 1;
  return 2;
};

export function usePatientClinicalSummary(patientId: string | null) {
  const branchId = useAuthStore((state) => state.sucursalActivaId);
  const role = useAuthStore((state) => state.user?.rol ?? null);
  const canViewFinancial = isBillingReportRole(role);

  const result = useLiveQuery(async () => {
    if (!patientId) return { summary: null, error: null };

    try {
      const [
        consultations,
        plans,
        goals,
        allergies,
        intolerances,
        appointments,
      ] = await Promise.all([
        db.consultations
          .where("patient_id")
          .equals(patientId)
          .filter(
            (row) =>
              row.deleted_at === null &&
              (!branchId || !row.sucursal_id || row.sucursal_id === branchId),
          )
          .toArray(),
        db.meal_plans
          .where("patient_id")
          .equals(patientId)
          .filter(
            (row) =>
              row.deleted_at === null &&
              row.status === "active" &&
              (!branchId || !row.sucursal_id || row.sucursal_id === branchId),
          )
          .toArray(),
        db.goals.where("patient_id").equals(patientId).toArray(),
        db.allergies.where("patient_id").equals(patientId).toArray(),
        db.intolerances.where("patient_id").equals(patientId).toArray(),
        db.appointments.where("patient_id").equals(patientId).toArray(),
      ]);

      consultations.sort(
        (left, right) =>
          new Date(right.consultation_date).getTime() -
          new Date(left.consultation_date).getTime(),
      );
      plans.sort(
        (left, right) =>
          new Date(right.start_date).getTime() -
          new Date(left.start_date).getTime(),
      );
      goals.sort((left, right) => {
        const priorityDifference =
          goalPriority(left.priority) - goalPriority(right.priority);
        if (priorityDifference !== 0) return priorityDifference;
        return left.target_date.localeCompare(right.target_date);
      });

      const latestConsultation =
        consultations.find((row) => row.status === "completed") ?? null;
      const activePlan = plans[0] ?? null;
      const activeGoal = goals.find((row) => row.status === "activo") ?? null;
      const alerts: PatientClinicalSummaryAlert[] = [
        ...allergies.map((row) => ({
          id: `allergy:${row.id}`,
          severity:
            row.severity === "severa" || row.severity === "anafilaxia"
              ? ("critical" as const)
              : ("warning" as const),
          message: `Alergia a ${row.allergen}`,
        })),
        ...intolerances.map((row) => ({
          id: `intolerance:${row.id}`,
          severity:
            row.severity === "severa"
              ? ("critical" as const)
              : ("warning" as const),
          message: `Intolerancia a ${row.food}`,
        })),
      ].sort((left, right) => {
        const rank = { critical: 0, warning: 1, info: 2 };
        return rank[left.severity] - rank[right.severity];
      });

      const pendingConsultations = consultations.filter(
        (row) =>
          row.cost > 0 &&
          (row.payment_status === "pending" ||
            row.payment_status === "partial"),
      );
      const today = new Date().toISOString().slice(0, 10);
      const nextAppointment = appointments
        .filter(
          (row) =>
            row.date >= today && ACTIVE_APPOINTMENT_STATUSES.has(row.status),
        )
        .sort((left, right) =>
          `${left.date}T${left.start_time}`.localeCompare(
            `${right.date}T${right.start_time}`,
          ),
        )[0];

      const summary: PatientClinicalSummary = {
        latestConsultation: latestConsultation
          ? {
              id: latestConsultation.id,
              date: latestConsultation.consultation_date,
              reason: latestConsultation.reason,
            }
          : null,
        activeGoal: activeGoal
          ? {
              id: activeGoal.id,
              label: activeGoal.variable,
              targetDate: activeGoal.target_date,
            }
          : null,
        activePlan: activePlan
          ? {
              id: activePlan.id,
              name: activePlan.name,
              startDate: activePlan.start_date,
            }
          : null,
        alerts,
        financial: canViewFinancial
          ? {
              pendingCount: pendingConsultations.length,
              pendingAmount: pendingConsultations.reduce(
                (total, row) =>
                  total + Math.max(0, row.cost - (row.amount_paid ?? 0)),
                0,
              ),
            }
          : null,
        followUp: {
          scheduledDate: nextAppointment?.date ?? null,
          scheduledTime: nextAppointment?.start_time ?? null,
          recommendedDate: latestConsultation?.next_visit_date ?? null,
        },
      };

      return { summary, error: null };
    } catch (error) {
      return {
        summary: null,
        error:
          error instanceof Error
            ? error.message
            : "No fue posible cargar el resumen clínico.",
      };
    }
  }, [branchId, canViewFinancial, patientId]);

  return {
    summary: result?.summary ?? null,
    loading: Boolean(patientId) && result === undefined,
    error: result?.error ?? null,
  };
}
