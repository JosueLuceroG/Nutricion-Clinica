import { useLiveQuery } from "dexie-react-hooks";
import {
  DEFAULT_PATIENT_DIRECTORY_FILTERS,
  type PatientDirectoryBooleanFilter,
  type PatientDirectoryClinicalStatus,
  type PatientDirectoryItem,
  type PatientDirectoryQuery,
  type PatientDirectoryResult,
} from "../application/patientDirectoryTypes";
import { patientRowToDomain } from "../infrastructure/patientMapper";
import { db } from "@services/db/dexieSchema";

const normalizeText = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .trim();

const onlyDigits = (value: string | null | undefined): string =>
  value?.replace(/\D/g, "") ?? "";

const matchesBooleanFilter = (
  value: boolean,
  filter: PatientDirectoryBooleanFilter,
): boolean => filter === "all" || (filter === "with" ? value : !value);

const rowMatchesBranch = (
  row: { sucursal_id?: string | null },
  branchId: string,
): boolean => !row.sucursal_id || row.sucursal_id === branchId;

const getInitials = (firstName: string, lastName: string): string =>
  `${firstName.charAt(0)}${lastName.charAt(0)}`.toLocaleUpperCase();

const DAY_MS = 24 * 60 * 60 * 1000;

const dateTime = (value: string | null | undefined): number | null => {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const daysBetween = (from: number, to: number): number =>
  Math.max(0, Math.floor((to - from) / DAY_MS));

const progressBetween = (
  initialValue: number,
  targetValue: number,
  currentValue: number,
): number => {
  const expectedChange = targetValue - initialValue;
  if (expectedChange === 0) return currentValue === targetValue ? 100 : 0;
  return Math.max(
    0,
    Math.min(100, ((currentValue - initialValue) / expectedChange) * 100),
  );
};

const currentValueForGoal = (
  variable: string,
  latestMeasurement: { weight_kg: number; height_m: number } | undefined,
): number | null => {
  if (!latestMeasurement) return null;
  const normalized = normalizeText(variable);
  if (normalized.includes("peso") || normalized.includes("weight")) {
    return latestMeasurement.weight_kg;
  }
  if (normalized.includes("imc") || normalized.includes("bmi")) {
    return latestMeasurement.weight_kg / latestMeasurement.height_m ** 2;
  }
  return null;
};

const clinicalPriority: Record<PatientDirectoryClinicalStatus, number> = {
  urgent: 0,
  "expiring-plan": 1,
  "follow-up": 2,
  new: 3,
  "on-track": 4,
};

export function usePatientDirectory(query: PatientDirectoryQuery) {
  const result = useLiveQuery(async () => {
    if (!query.branchId) {
      return {
        data: null,
        error: new Error("Selecciona una sucursal para consultar pacientes."),
      };
    }

    try {
      const [
        patientRows,
        planRows,
        appointmentRows,
        consultationRows,
        anthropometryRows,
        goalRows,
      ] = await Promise.all([
        db.patients
          .filter((row) => rowMatchesBranch(row, query.branchId!))
          .toArray(),
        db.meal_plans
          .filter(
            (row) =>
              rowMatchesBranch(row, query.branchId!) &&
              !row.deleted_at &&
              row.status === "active",
          )
          .toArray(),
        db.appointments
          .filter(
            (row) =>
              (!row.office_id || row.office_id === query.branchId) &&
              row.date >= new Date().toISOString().slice(0, 10) &&
              ["scheduled", "confirmed", "in_progress", "rescheduled"].includes(
                row.status,
              ),
          )
          .toArray(),
        db.consultations
          .filter(
            (row) => rowMatchesBranch(row, query.branchId!) && !row.deleted_at,
          )
          .toArray(),
        db.anthropometry.filter((row) => !row.deleted_at).toArray(),
        db.goals.toArray(),
      ]);

      const patientIds = new Set(patientRows.map((row) => row.id));
      const activePlanByPatient = new Map<string, (typeof planRows)[number]>();
      for (const plan of planRows.sort((left, right) =>
        right.start_date.localeCompare(left.start_date),
      )) {
        if (!activePlanByPatient.has(plan.patient_id)) {
          activePlanByPatient.set(plan.patient_id, plan);
        }
      }

      const nextAppointmentByPatient = new Map<
        string,
        (typeof appointmentRows)[number]
      >();
      for (const appointment of appointmentRows.sort((left, right) =>
        `${left.date}T${left.start_time}`.localeCompare(
          `${right.date}T${right.start_time}`,
        ),
      )) {
        if (!nextAppointmentByPatient.has(appointment.patient_id)) {
          nextAppointmentByPatient.set(appointment.patient_id, appointment);
        }
      }

      const latestConsultationByPatient = new Map<
        string,
        (typeof consultationRows)[number]
      >();
      for (const consultation of consultationRows
        .filter((row) => row.status === "completed")
        .sort((left, right) =>
          right.consultation_date.localeCompare(left.consultation_date),
        )) {
        if (!latestConsultationByPatient.has(consultation.patient_id)) {
          latestConsultationByPatient.set(
            consultation.patient_id,
            consultation,
          );
        }
      }

      const measurementsByPatient = new Map<
        string,
        (typeof anthropometryRows)[number][]
      >();
      for (const measurement of anthropometryRows) {
        if (!patientIds.has(measurement.patient_id)) continue;
        const measurements =
          measurementsByPatient.get(measurement.patient_id) ?? [];
        measurements.push(measurement);
        measurementsByPatient.set(measurement.patient_id, measurements);
      }
      for (const measurements of measurementsByPatient.values()) {
        measurements.sort((left, right) =>
          right.measured_at.localeCompare(left.measured_at),
        );
      }

      const activeGoalByPatient = new Map<string, (typeof goalRows)[number]>();
      for (const goal of goalRows
        .filter(
          (row) => patientIds.has(row.patient_id) && row.status === "activo",
        )
        .sort((left, right) =>
          right.start_date.localeCompare(left.start_date),
        )) {
        if (!activeGoalByPatient.has(goal.patient_id)) {
          activeGoalByPatient.set(goal.patient_id, goal);
        }
      }

      const pendingBalanceByPatient = new Map<string, number>();
      for (const consultation of consultationRows) {
        const cost = Number.isFinite(consultation.cost) ? consultation.cost : 0;
        const paidAmount = consultation.paid
          ? cost
          : Number.isFinite(consultation.amount_paid)
            ? (consultation.amount_paid ?? 0)
            : 0;
        const pending = Math.max(cost - paidAmount, 0);
        if (pending > 0) {
          pendingBalanceByPatient.set(
            consultation.patient_id,
            (pendingBalanceByPatient.get(consultation.patient_id) ?? 0) +
              pending,
          );
        }
      }

      const counts = patientRows.reduce(
        (summary, row) => {
          if (row.deleted_at) {
            summary.deleted += 1;
            return summary;
          }
          summary.total += 1;
          if (row.status === "active") summary.active += 1;
          if (row.status === "inactive") summary.inactive += 1;
          if (row.status === "archived") summary.archived += 1;
          return summary;
        },
        { total: 0, active: 0, inactive: 0, archived: 0, deleted: 0 },
      );

      const normalizedSearch = normalizeText(query.search);
      const searchDigits = onlyDigits(query.search);
      const normalizedTag = normalizeText(query.filters.tag);
      const now = Date.now();
      const today = new Date().toISOString().slice(0, 10);
      const weekEnd = new Date(now + 7 * DAY_MS).toISOString().slice(0, 10);

      const directoryItems: PatientDirectoryItem[] = patientRows.map((row) => {
        const patient = patientRowToDomain(row);
        const pendingBalance = pendingBalanceByPatient.get(row.id) ?? 0;
        const nextAppointment = nextAppointmentByPatient.get(row.id);
        const nextAppointmentAt = nextAppointment
          ? `${nextAppointment.date}T${nextAppointment.start_time}`
          : null;
        const activePlan = activePlanByPatient.get(row.id);
        const measurements = measurementsByPatient.get(row.id) ?? [];
        const latestMeasurement = measurements[0];
        const previousMeasurement = measurements[1];
        const activeGoal = activeGoalByPatient.get(row.id);
        const goalCurrentValue = activeGoal
          ? currentValueForGoal(activeGoal.variable, latestMeasurement)
          : null;
        const goalProgress =
          activeGoal && goalCurrentValue !== null
            ? progressBetween(
                activeGoal.initial_value,
                activeGoal.target_value,
                goalCurrentValue,
              )
            : null;
        const latestConsultation = latestConsultationByPatient.get(row.id);
        const lastConsultationTime = dateTime(
          latestConsultation?.consultation_date,
        );
        const daysSinceLastConsultation =
          lastConsultationTime === null
            ? null
            : daysBetween(lastConsultationTime, now);
        const patientAgeInDirectory = daysBetween(
          patient.createdAt.getTime(),
          now,
        );
        const planEndTime = dateTime(activePlan?.end_date);
        const planStartTime = dateTime(activePlan?.start_date);
        const activePlanProgress =
          planEndTime !== null &&
          planStartTime !== null &&
          planEndTime > planStartTime
            ? Math.max(
                0,
                Math.min(
                  100,
                  ((now - planStartTime) / (planEndTime - planStartTime)) * 100,
                ),
              )
            : null;
        const planExpiresSoon =
          planEndTime !== null &&
          planEndTime >= now - DAY_MS &&
          planEndTime <= now + 7 * DAY_MS;
        const isNew = patientAgeInDirectory <= 30 && !latestConsultation;
        const needsUrgentContact =
          !nextAppointment &&
          (daysSinceLastConsultation !== null
            ? daysSinceLastConsultation > 30
            : patientAgeInDirectory > 30);
        const clinicalStatus: PatientDirectoryClinicalStatus = isNew
          ? "new"
          : needsUrgentContact
            ? "urgent"
            : planExpiresSoon
              ? "expiring-plan"
              : !nextAppointment || !activePlan || pendingBalance > 0
                ? "follow-up"
                : "on-track";
        return {
          patient,
          initials: getInitials(row.first_name, row.last_name),
          recordNumber:
            row.clave_interna ??
            row.external_record_number ??
            row.id.slice(0, 8).toLocaleUpperCase(),
          hasActivePlan: activePlan !== undefined,
          hasUpcomingAppointment: nextAppointmentAt !== null,
          nextAppointmentAt,
          nextAppointmentStatus: nextAppointment?.status ?? null,
          hasPendingBalance: pendingBalance > 0,
          pendingBalance,
          activePlanName: activePlan?.name ?? null,
          activePlanKcal: activePlan?.kcal_target ?? null,
          activePlanStartAt: activePlan?.start_date ?? null,
          activePlanEndAt: activePlan?.end_date ?? null,
          activePlanProgress,
          goalLabel: activeGoal?.reason || activeGoal?.variable || null,
          goalUnit: activeGoal?.unit ?? null,
          goalInitialValue: activeGoal?.initial_value ?? null,
          goalTargetValue: activeGoal?.target_value ?? null,
          goalCurrentValue,
          goalProgress,
          lastConsultationAt: latestConsultation?.consultation_date ?? null,
          daysSinceLastConsultation,
          latestWeightKg: latestMeasurement?.weight_kg ?? null,
          previousWeightKg: previousMeasurement?.weight_kg ?? null,
          clinicalStatus,
        } satisfies PatientDirectoryItem;
      });

      const allItems = directoryItems
        .filter((item) =>
          query.status === "deleted"
            ? item.patient.deletedAt !== null
            : item.patient.deletedAt === null &&
              (query.status === "all" || item.patient.status === query.status),
        )
        .filter((item) => {
          const patient = item.patient;
          if (normalizedSearch) {
            const searchable = normalizeText(
              [
                patient.fullName,
                patient.email?.toString(),
                patient.phone?.toString(),
                patient.secondaryPhone?.toString(),
                patient.claveInterna,
                patient.externalRecordNumber,
                item.recordNumber,
                item.activePlanName,
                item.goalLabel,
                ...patient.clinicalTags,
              ]
                .filter(Boolean)
                .join(" "),
            );
            const phoneMatches =
              searchDigits.length > 0 &&
              [patient.phone?.toString(), patient.secondaryPhone?.toString()]
                .map(onlyDigits)
                .some((phone) => phone.includes(searchDigits));
            if (!searchable.includes(normalizedSearch) && !phoneMatches)
              return false;
          }

          if (
            query.filters.sex !== "all" &&
            patient.sex !== query.filters.sex
          ) {
            return false;
          }
          if (
            query.filters.minimumAge !== null &&
            patient.age < query.filters.minimumAge
          ) {
            return false;
          }
          if (
            query.filters.maximumAge !== null &&
            patient.age > query.filters.maximumAge
          ) {
            return false;
          }
          if (
            query.filters.registeredFrom &&
            patient.createdAt.toISOString().slice(0, 10) <
              query.filters.registeredFrom
          ) {
            return false;
          }
          if (
            query.filters.registeredTo &&
            patient.createdAt.toISOString().slice(0, 10) >
              query.filters.registeredTo
          ) {
            return false;
          }
          if (
            normalizedTag &&
            !patient.clinicalTags.some((tag) =>
              normalizeText(tag).includes(normalizedTag),
            )
          ) {
            return false;
          }
          return (
            matchesBooleanFilter(
              item.hasActivePlan,
              query.filters.activePlan,
            ) &&
            matchesBooleanFilter(
              item.hasUpcomingAppointment,
              query.filters.upcomingAppointment,
            ) &&
            matchesBooleanFilter(
              item.hasPendingBalance,
              query.filters.pendingBalance,
            )
          );
        });

      const clinicalCounts = allItems.reduce(
        (summary, item) => {
          summary.all += 1;
          if (item.clinicalStatus === "on-track") summary.onTrack += 1;
          if (item.clinicalStatus === "follow-up") summary.followUp += 1;
          if (
            item.clinicalStatus === "urgent" ||
            item.clinicalStatus === "expiring-plan"
          ) {
            summary.atRisk += 1;
          }
          if (item.clinicalStatus === "new") summary.new += 1;
          return summary;
        },
        { all: 0, onTrack: 0, followUp: 0, atRisk: 0, new: 0 },
      );

      const priorityItems = [...allItems]
        .filter(
          (item) =>
            item.patient.status === "active" &&
            !item.patient.deletedAt &&
            item.clinicalStatus !== "on-track",
        )
        .sort(
          (left, right) =>
            clinicalPriority[left.clinicalStatus] -
              clinicalPriority[right.clinicalStatus] ||
            (right.daysSinceLastConsultation ?? -1) -
              (left.daysSinceLastConsultation ?? -1),
        )
        .slice(0, 3);

      const items = allItems.filter((item) => {
        if (query.clinicalSegment === "all") return true;
        if (query.clinicalSegment === "at-risk") {
          return (
            item.clinicalStatus === "urgent" ||
            item.clinicalStatus === "expiring-plan"
          );
        }
        return item.clinicalStatus === query.clinicalSegment;
      });

      items.sort((left, right) => {
        if (query.sort === "clinical-priority") {
          return (
            clinicalPriority[left.clinicalStatus] -
              clinicalPriority[right.clinicalStatus] ||
            left.patient.fullName.localeCompare(right.patient.fullName)
          );
        }
        if (query.sort === "next-appointment") {
          return (
            (dateTime(left.nextAppointmentAt) ?? Number.MAX_SAFE_INTEGER) -
            (dateTime(right.nextAppointmentAt) ?? Number.MAX_SAFE_INTEGER)
          );
        }
        if (query.sort === "goal-progress") {
          return (right.goalProgress ?? -1) - (left.goalProgress ?? -1);
        }
        if (query.sort === "last-consultation") {
          return (
            (dateTime(left.lastConsultationAt) ?? 0) -
            (dateTime(right.lastConsultationAt) ?? 0)
          );
        }
        return left.patient.fullName.localeCompare(
          right.patient.fullName,
          undefined,
          { sensitivity: "base" },
        );
      });

      const insightItems = directoryItems.filter(
        (item) => item.patient.isActive,
      );
      const patientsWithGoal = insightItems.filter(
        (item) => item.goalProgress !== null,
      );
      const insights = {
        activeWithPlan: insightItems.filter((item) => item.hasActivePlan)
          .length,
        advancingToGoal: patientsWithGoal.filter(
          (item) => (item.goalProgress ?? 0) > 0,
        ).length,
        patientsWithGoal: patientsWithGoal.length,
        appointmentsThisWeek: appointmentRows.filter(
          (row) => row.date >= today && row.date <= weekEnd,
        ).length,
        requiresContact: insightItems.filter(
          (item) => item.clinicalStatus === "urgent",
        ).length,
        expiringPlans: insightItems.filter(
          (item) => item.clinicalStatus === "expiring-plan",
        ).length,
      };

      const filteredTotal = items.length;
      const totalPages = Math.max(1, Math.ceil(filteredTotal / query.pageSize));
      const page = Math.min(Math.max(query.page, 1), totalPages);
      const offset = (page - 1) * query.pageSize;
      const pagedItems = items.slice(offset, offset + query.pageSize);

      const data: PatientDirectoryResult = {
        items: pagedItems,
        filteredTotal,
        counts,
        clinicalCounts,
        insights,
        priorityItems,
        page,
        pageSize: query.pageSize,
        totalPages,
        from: filteredTotal === 0 ? 0 : offset + 1,
        to: Math.min(offset + pagedItems.length, filteredTotal),
      };

      return { data, error: null };
    } catch (error) {
      return {
        data: null,
        error:
          error instanceof Error
            ? error
            : new Error("No fue posible cargar los pacientes."),
      };
    }
  }, [
    query.branchId,
    query.search,
    query.status,
    query.filters.sex,
    query.filters.minimumAge,
    query.filters.maximumAge,
    query.filters.registeredFrom,
    query.filters.registeredTo,
    query.filters.tag,
    query.filters.activePlan,
    query.filters.upcomingAppointment,
    query.filters.pendingBalance,
    query.clinicalSegment,
    query.sort,
    query.page,
    query.pageSize,
    query.refreshToken,
  ]);

  return {
    data: result?.data ?? null,
    error: result?.error ?? null,
    loading: result === undefined,
  };
}

export { DEFAULT_PATIENT_DIRECTORY_FILTERS };
