import { useLiveQuery } from "dexie-react-hooks";
import { isBillingReportRole } from "@modules/auth/authRoles";
import { patientRowToDomain } from "@modules/patient/infrastructure/patientMapper";
import { db } from "@services/db/dexieSchema";
import { useAuthStore } from "@store/authStore";
import { rowMatchesSucursal } from "@services/tenancy/sucursalScope";
import type {
  PatientClinicalSummary,
  PatientClinicalSummaryAlert,
} from "../../application/quickConsultationTypes";

const ACTIVE_APPOINTMENT_STATUSES = new Set([
  "scheduled",
  "confirmed",
  "in_progress",
]);

type AlertCandidate = PatientClinicalSummaryAlert & {
  deduplicationKey: string;
};

const ALERT_SEVERITY_RANK: Record<
  PatientClinicalSummaryAlert["severity"],
  number
> = {
  critical: 0,
  warning: 1,
  info: 2,
};

const normalizeAlertSubject = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-MX")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

const mergeAlerts = (
  candidates: readonly AlertCandidate[],
): PatientClinicalSummaryAlert[] => {
  const alertsByKey = new Map<string, PatientClinicalSummaryAlert>();

  for (const { deduplicationKey, ...candidate } of candidates) {
    const current = alertsByKey.get(deduplicationKey);
    if (!current) {
      alertsByKey.set(deduplicationKey, candidate);
      continue;
    }

    alertsByKey.set(deduplicationKey, {
      ...current,
      severity:
        ALERT_SEVERITY_RANK[current.severity] <=
        ALERT_SEVERITY_RANK[candidate.severity]
          ? current.severity
          : candidate.severity,
      message:
        candidate.message.length > current.message.length
          ? candidate.message
          : current.message,
    });
  }

  return Array.from(alertsByKey.values()).sort(
    (left, right) =>
      ALERT_SEVERITY_RANK[left.severity] - ALERT_SEVERITY_RANK[right.severity],
  );
};

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
    if (!patientId || !branchId) return { summary: null, error: null };

    try {
      const patientRow = await db.patients.get(patientId);
      if (!patientRow || !rowMatchesSucursal(patientRow, branchId)) {
        return { summary: null, error: null };
      }

      const [
        consultations,
        plans,
        goals,
        allergies,
        intolerances,
        appointments,
        measurements,
      ] = await Promise.all([
        db.consultations
          .where("patient_id")
          .equals(patientId)
          .filter(
            (row) =>
              row.deleted_at === null &&
              rowMatchesSucursal(row, branchId),
          )
          .toArray(),
        db.meal_plans
          .where("patient_id")
          .equals(patientId)
          .filter(
            (row) =>
              row.deleted_at === null &&
              row.status === "active" &&
              rowMatchesSucursal(row, branchId),
          )
          .toArray(),
        db.goals.where("patient_id").equals(patientId).toArray(),
        db.allergies.where("patient_id").equals(patientId).toArray(),
        db.intolerances.where("patient_id").equals(patientId).toArray(),
        db.appointments
          .where("patient_id")
          .equals(patientId)
          .filter((row) =>
            rowMatchesSucursal({ sucursal_id: row.office_id }, branchId),
          )
          .toArray(),
        db.anthropometry
          .where("patient_id")
          .equals(patientId)
          .filter(
            (row) =>
              row.deleted_at === null && rowMatchesSucursal(row, branchId),
          )
          .toArray(),
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
      measurements.sort((left, right) =>
        left.measured_at.localeCompare(right.measured_at),
      );
      const latestMeasurement = measurements.at(-1) ?? null;
      const measurementHistory = measurements.slice(-6).map((row) => ({
        measuredAt: row.measured_at,
        weightKg: row.weight_kg,
      }));
      const latestBia = (() => {
        if (!latestMeasurement?.bia_json) return null;
        try {
          return JSON.parse(latestMeasurement.bia_json) as {
            bodyFatPct?: unknown;
          };
        } catch {
          return null;
        }
      })();
      const alertCandidates: AlertCandidate[] = [
        ...allergies.map((row) => ({
          id: `allergy:${row.id}`,
          deduplicationKey: `allergy:${normalizeAlertSubject(row.allergen)}`,
          severity:
            row.severity === "severa" || row.severity === "anafilaxia"
              ? ("critical" as const)
              : ("warning" as const),
          message: `Alergia a ${row.allergen}`,
        })),
        ...intolerances.map((row) => ({
          id: `intolerance:${row.id}`,
          deduplicationKey: `intolerance:${normalizeAlertSubject(row.food)}`,
          severity:
            row.severity === "severa"
              ? ("critical" as const)
              : ("warning" as const),
          message: `Intolerancia a ${row.food}`,
        })),
      ];

      if (patientRow) {
        try {
          const intake = patientRowToDomain(patientRow).medicalIntake;
          alertCandidates.push(
            ...intake.medicationAllergyDetails.map((detail, index) => ({
              id: `intake-allergy:${index}`,
              deduplicationKey: `allergy:${normalizeAlertSubject(detail.medication)}`,
              severity:
                detail.severity === "severe" || detail.requiredMedicalAttention
                  ? ("critical" as const)
                  : ("warning" as const),
              message: `Alergia a ${detail.medication}: ${detail.reaction}${
                detail.requiredMedicalAttention
                  ? "; requirió atención médica"
                  : ""
              }`,
            })),
            ...intake.intoleranceDetails.map((detail, index) => ({
              id: `intake-intolerance:${index}`,
              deduplicationKey: `intolerance:${normalizeAlertSubject(detail.substance)}`,
              severity:
                detail.severity === "severe"
                  ? ("critical" as const)
                  : ("warning" as const),
              message: `Intolerancia a ${detail.substance}: ${detail.reaction}`,
            })),
          );

          if (intake.adverseMedicationOrSupplementEffects) {
            alertCandidates.push({
              id: "intake-adverse-effect",
              deduplicationKey: `adverse-effect:${normalizeAlertSubject(
                intake.adverseEffectDetails ?? "reported",
              )}`,
              severity: "warning",
              message: `Efecto adverso a medicamento o suplemento reportado${
                intake.adverseEffectDetails
                  ? `: ${intake.adverseEffectDetails}`
                  : ""
              }`,
            });
          }
        } catch {
          // A malformed patient row must not hide normalized clinical alerts.
        }
      }

      const alerts = mergeAlerts(alertCandidates);

      const pendingConsultations = consultations.filter((row) => {
        if (!(row.cost > 0)) return false;
        // fallback para filas legacy sin payment_status
        const ps = row.payment_status ?? (row.paid ? "paid" : "pending");
        return ps === "pending" || ps === "partial";
      });
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
      const attendanceAppointments = appointments.filter((row) =>
        ["completed", "no_show"].includes(row.status),
      );
      const macroCalories = activePlan
        ? activePlan.protein_target_g * 4 +
          activePlan.carbs_target_g * 4 +
          activePlan.fat_target_g * 9
        : 0;
      const activePlanMeals = activePlan
        ? (() => {
            try {
              const meals = JSON.parse(activePlan.meals_json) as unknown;
              return Array.isArray(meals)
                ? meals.filter(
                    (meal) =>
                      meal &&
                      typeof meal === "object" &&
                      "exchanges" in meal &&
                      Array.isArray(meal.exchanges) &&
                      meal.exchanges.length > 0,
                  ).length
                : 0;
            } catch {
              return 0;
            }
          })()
        : 0;

      const summary: PatientClinicalSummary = {
        latestConsultation: latestConsultation
          ? {
              id: latestConsultation.id,
              date: latestConsultation.consultation_date,
              reason: latestConsultation.reason,
              note:
                latestConsultation.plan ??
                latestConsultation.assessment ??
                latestConsultation.objective ??
                latestConsultation.subjective ??
                null,
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
              endDate: activePlan.end_date,
              kcalTarget: activePlan.kcal_target,
              mealCount: activePlanMeals,
              macroPercentages:
                macroCalories > 0
                  ? {
                      protein: Math.round(
                        (activePlan.protein_target_g * 4 * 100) / macroCalories,
                      ),
                      carbs: Math.round(
                        (activePlan.carbs_target_g * 4 * 100) / macroCalories,
                      ),
                      fat: Math.round(
                        (activePlan.fat_target_g * 9 * 100) / macroCalories,
                      ),
                    }
                  : null,
            }
          : null,
        anthropometry: {
          latest: latestMeasurement
            ? {
                measuredAt: latestMeasurement.measured_at,
                weightKg: latestMeasurement.weight_kg,
                bmi:
                  latestMeasurement.height_m > 0
                    ? latestMeasurement.weight_kg /
                      latestMeasurement.height_m ** 2
                    : 0,
                bodyFatPct:
                  typeof latestBia?.bodyFatPct === "number" &&
                  Number.isFinite(latestBia.bodyFatPct)
                    ? latestBia.bodyFatPct
                    : null,
                waistCm:
                  typeof latestMeasurement.circumferences?.waist === "number"
                    ? latestMeasurement.circumferences.waist
                    : null,
              }
            : null,
          history: measurementHistory,
        },
        attendance: {
          attended: attendanceAppointments.filter(
            (row) => row.status === "completed",
          ).length,
          total: attendanceAppointments.length,
        },
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
