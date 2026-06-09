import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  batchSavePatientSubstitutions,
  createPatientSubstitution,
  deletePatientSubstitution,
  getPatientSubstitutions,
  updatePatientSubstitution,
} from "./patientSubstitutionApi";

const mockFetch = vi.fn();
const mockGetAuthState = vi.fn();

vi.stubGlobal("fetch", mockFetch);

vi.mock("@store/authStore", () => ({
  useAuthStore: { getState: () => mockGetAuthState() },
}));

vi.mock("@store/syncStore", () => ({
  useSyncStore: { getState: () => ({ sucursalId: "s-active" }) },
}));

vi.mock("@nutriclinica/shared", () => ({}));

const substitution = {
  id: 1,
  pacienteId: "patient/1",
  originalFoodId: null,
  substituteFoodId: "fruta-manzana",
  mealSlot: "breakfast",
  createdAt: "2026-06-09T00:00:00.000Z",
  updatedAt: "2026-06-09T00:00:00.000Z",
  isActive: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetAuthState.mockReturnValue({ token: "jwt-token" });
  process.env.VITE_API_URL = "http://test.local";
});

describe("patientSubstitutionApi", () => {
  it("getPatientSubstitutions codifica el paciente y usa auth/sucursal", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, text: async () => JSON.stringify({ substitutions: [substitution] }) });

    const result = await getPatientSubstitutions("patient/1");

    expect(result).toHaveLength(1);
    expect(mockFetch).toHaveBeenCalledWith(
      "http://test.local/pacientes/patient%2F1/substitutions",
      expect.objectContaining({ method: "GET" }),
    );
    const call = mockFetch.mock.calls[0]!;
    expect(call[1].headers.Authorization).toBe("Bearer jwt-token");
    expect(call[1].headers["X-Sucursal-Id"]).toBe("s-active");
  });

  it("createPatientSubstitution serializa body una sola vez", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, text: async () => JSON.stringify(substitution) });

    await createPatientSubstitution("p1", {
      originalFoodId: null,
      substituteFoodId: "fruta-manzana",
      mealSlot: "breakfast",
    });

    const call = mockFetch.mock.calls[0]!;
    expect(call[0]).toBe("http://test.local/pacientes/p1/substitutions");
    expect(call[1].method).toBe("POST");
    expect(call[1].body).toBe('{"originalFoodId":null,"substituteFoodId":"fruta-manzana","mealSlot":"breakfast"}');
  });

  it("updatePatientSubstitution llama PUT con patch JSON", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, text: async () => JSON.stringify({ updated: 1 }) });

    await updatePatientSubstitution("p1", 7, { mealSlot: "lunch" });

    const call = mockFetch.mock.calls[0]!;
    expect(call[0]).toBe("http://test.local/pacientes/p1/substitutions/7");
    expect(call[1].method).toBe("PUT");
    expect(call[1].body).toBe('{"mealSlot":"lunch"}');
  });

  it("deletePatientSubstitution llama DELETE", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, text: async () => JSON.stringify({ deleted: 1 }) });

    await deletePatientSubstitution("p1", 7);

    expect(mockFetch).toHaveBeenCalledWith(
      "http://test.local/pacientes/p1/substitutions/7",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("batchSavePatientSubstitutions retorna inserted y serializa array", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, text: async () => JSON.stringify({ inserted: 2 }) });

    const result = await batchSavePatientSubstitutions("p1", [
      { substituteFoodId: "fruta-manzana", mealSlot: "breakfast" },
      { substituteFoodId: "aoa-pechuga-pollo", mealSlot: "lunch" },
    ]);

    expect(result.inserted).toBe(2);
    const call = mockFetch.mock.calls[0]!;
    expect(call[0]).toBe("http://test.local/pacientes/p1/substitutions/batch");
    expect(call[1].body).toContain('"substitutions"');
    expect(call[1].body).not.toContain('\\"substitutions\\"');
  });
});
