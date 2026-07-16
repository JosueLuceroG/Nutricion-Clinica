import { useLiveQuery } from "dexie-react-hooks";
import {
  DEFAULT_PATIENT_DIRECTORY_FILTERS,
  type PatientDirectoryBooleanFilter,
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

export function usePatientDirectory(query: PatientDirectoryQuery) {
  const result = useLiveQuery(async () => {
    if (!query.branchId) {
      return {
        data: null,
        error: new Error("Selecciona una sucursal para consultar pacientes."),
      };
    }

    try {
      const [patientRows, planRows, appointmentRows, consultationRows] =
        await Promise.all([
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
                [
                  "scheduled",
                  "confirmed",
                  "in_progress",
                  "rescheduled",
                ].includes(row.status),
            )
            .toArray(),
          db.consultations
            .filter(
              (row) =>
                rowMatchesBranch(row, query.branchId!) && !row.deleted_at,
            )
            .toArray(),
        ]);

      const activePlanIds = new Set(planRows.map((row) => row.patient_id));
      const nextAppointmentByPatient = new Map<string, string>();
      for (const appointment of appointmentRows.sort((left, right) =>
        `${left.date}T${left.start_time}`.localeCompare(
          `${right.date}T${right.start_time}`,
        ),
      )) {
        if (!nextAppointmentByPatient.has(appointment.patient_id)) {
          nextAppointmentByPatient.set(
            appointment.patient_id,
            `${appointment.date}T${appointment.start_time}`,
          );
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

      const items = patientRows
        .filter((row) =>
          query.status === "deleted"
            ? Boolean(row.deleted_at)
            : !row.deleted_at &&
              (query.status === "all" || row.status === query.status),
        )
        .map((row) => {
          const patient = patientRowToDomain(row);
          const pendingBalance = pendingBalanceByPatient.get(row.id) ?? 0;
          const nextAppointmentAt =
            nextAppointmentByPatient.get(row.id) ?? null;
          return {
            patient,
            initials: getInitials(row.first_name, row.last_name),
            recordNumber:
              row.clave_interna ??
              row.external_record_number ??
              row.id.slice(0, 8).toLocaleUpperCase(),
            hasActivePlan: activePlanIds.has(row.id),
            hasUpcomingAppointment: nextAppointmentAt !== null,
            nextAppointmentAt,
            hasPendingBalance: pendingBalance > 0,
            pendingBalance,
          } satisfies PatientDirectoryItem;
        })
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
        })
        .sort((left, right) =>
          left.patient.fullName.localeCompare(
            right.patient.fullName,
            undefined,
            {
              sensitivity: "base",
            },
          ),
        );

      const filteredTotal = items.length;
      const totalPages = Math.max(1, Math.ceil(filteredTotal / query.pageSize));
      const page = Math.min(Math.max(query.page, 1), totalPages);
      const offset = (page - 1) * query.pageSize;
      const pagedItems = items.slice(offset, offset + query.pageSize);

      const data: PatientDirectoryResult = {
        items: pagedItems,
        filteredTotal,
        counts,
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
