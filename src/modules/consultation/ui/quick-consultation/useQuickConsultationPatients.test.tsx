import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { QuickConsultationPatient } from "../../application/quickConsultationTypes";

const patients = Array.from({ length: 15 }, (_, index) => ({
  id: `patient-${index}`,
  fullName: `Paciente Activo ${index}`,
  recordNumber: String(index).padStart(5, "0"),
  phone: `555000${String(index).padStart(4, "0")}`,
  email: `paciente${index}@example.com`,
  photoUrl: null,
  initials: "PA",
  updatedAt: `2026-07-15T12:${String(index).padStart(2, "0")}:00.000Z`,
})) satisfies QuickConsultationPatient[];

vi.mock("dexie-react-hooks", () => ({
  useLiveQuery: () => ({ patients, error: null }),
}));

vi.mock("@store/authStore", () => ({
  useAuthStore: (selector: (state: { sucursalActivaId: string }) => unknown) =>
    selector({ sucursalActivaId: "branch-1" }),
}));

import { useQuickConsultationPatients } from "./useQuickConsultationPatients";

describe("useQuickConsultationPatients", () => {
  it("does not limit active patients or matching search results", () => {
    const { result, rerender } = renderHook(
      ({ query }) => useQuickConsultationPatients(query),
      { initialProps: { query: "" } },
    );

    expect(result.current.visiblePatients).toHaveLength(15);

    rerender({ query: "Paciente Activo" });
    expect(result.current.visiblePatients).toHaveLength(15);
  });
});
