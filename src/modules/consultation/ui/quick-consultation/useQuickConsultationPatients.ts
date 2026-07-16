import * as React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@services/db/dexieSchema";
import { useAuthStore } from "@store/authStore";
import type { QuickConsultationPatient } from "../../application/quickConsultationTypes";

const normalizeSearchValue = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .trim();

const getInitials = (firstName: string, lastName: string): string =>
  `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();

export function useQuickConsultationPatients(query: string) {
  const branchId = useAuthStore((state) => state.sucursalActivaId);
  const deferredQuery = React.useDeferredValue(query);
  const result = useLiveQuery(async () => {
    if (!branchId) {
      return {
        patients: [] as QuickConsultationPatient[],
        error: "Selecciona una sucursal para buscar pacientes.",
      };
    }

    try {
      const rows = await db.patients
        .filter(
          (row) =>
            (!row.sucursal_id || row.sucursal_id === branchId) &&
            !row.deleted_at &&
            row.status === "active",
        )
        .toArray();

      const patients = rows
        .sort(
          (left, right) =>
            new Date(right.updated_at).getTime() -
            new Date(left.updated_at).getTime(),
        )
        .map((row) => {
          const fullName = [row.first_name, row.last_name, row.second_last_name]
            .filter(Boolean)
            .join(" ");

          return {
            id: row.id,
            fullName,
            recordNumber:
              row.clave_interna ??
              row.external_record_number ??
              row.id.slice(0, 8).toUpperCase(),
            phone: row.phone,
            email: row.email,
            photoUrl: row.photo_url,
            initials: getInitials(row.first_name, row.last_name),
            updatedAt: row.updated_at,
          } satisfies QuickConsultationPatient;
        });

      return { patients, error: null };
    } catch (error) {
      return {
        patients: [] as QuickConsultationPatient[],
        error:
          error instanceof Error
            ? error.message
            : "No fue posible cargar los pacientes.",
      };
    }
  }, [branchId]);

  const normalizedQuery = normalizeSearchValue(deferredQuery);
  const patients = result?.patients ?? [];
  const visiblePatients = normalizedQuery
    ? patients.filter((patient) =>
        normalizeSearchValue(
          [patient.fullName, patient.phone, patient.email, patient.recordNumber]
            .filter(Boolean)
            .join(" "),
        ).includes(normalizedQuery),
      )
    : patients;

  return {
    patients,
    visiblePatients,
    loading: result === undefined,
    error: result?.error ?? null,
    searching: normalizedQuery.length > 0,
  };
}
