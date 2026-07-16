import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_PATIENT_DIRECTORY_FILTERS } from "../application/patientDirectoryTypes";
import type { PatientRow } from "../infrastructure/patientMapper";
import { db } from "@services/db/dexieSchema";
import { usePatientDirectory } from "./usePatientDirectory";

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
  page: 1,
  pageSize: 10,
};

beforeEach(async () => {
  await Promise.all([
    db.patients.clear(),
    db.meal_plans.clear(),
    db.appointments.clear(),
    db.consultations.clear(),
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

afterEach(async () => {
  await db.patients.clear();
});

describe("usePatientDirectory", () => {
  it("scopes the directory and paginates beyond the first ten records", async () => {
    const { result, rerender } = renderHook(
      ({ page }) => usePatientDirectory({ ...baseQuery, page }),
      { initialProps: { page: 1 } },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data?.filteredTotal).toBe(13);
    expect(result.current.data?.items).toHaveLength(10);
    expect(result.current.data?.counts.deleted).toBe(1);
    expect(
      result.current.data?.items.some(
        (item) => item.patient.id.toString() === "other-branch",
      ),
    ).toBe(false);

    await act(async () => rerender({ page: 2 }));
    await waitFor(() => expect(result.current.data?.page).toBe(2));
    expect(result.current.data?.items).toHaveLength(3);
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
});
