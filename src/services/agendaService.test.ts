import { beforeEach, describe, expect, it, vi } from "vitest";
import "fake-indexeddb/auto";

const { mockAuthState, mockSyncState } = vi.hoisted(() => ({
  mockAuthState: vi.fn(),
  mockSyncState: vi.fn(),
}));

vi.mock("@store/authStore", () => ({
  useAuthStore: { getState: mockAuthState },
}));

vi.mock("@store/syncStore", () => ({
  useSyncStore: { getState: mockSyncState },
}));

import { resolveAgendaOfficeId, resolveAgendaProfessionalId, setDefaultProfessionalId } from "./agendaService";

describe("agendaService context resolution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setDefaultProfessionalId(null);
    mockAuthState.mockReturnValue({ user: null, sucursalActivaId: null });
    mockSyncState.mockReturnValue({ sucursalId: null });
  });

  it("usa el profesional explicito si se proporciona", () => {
    expect(resolveAgendaProfessionalId("00000000-0000-0000-0000-000000000001")).toBe("00000000-0000-0000-0000-000000000001");
  });

  it("usa el profesional autenticado cuando no hay profesional explicito", () => {
    mockAuthState.mockReturnValue({ user: { id: "00000000-0000-0000-0000-000000000002" }, sucursalActivaId: null });

    expect(resolveAgendaProfessionalId()).toBe("00000000-0000-0000-0000-000000000002");
  });

  it("falla si no hay profesional real", () => {
    expect(() => resolveAgendaProfessionalId()).toThrow("No hay profesional autenticado");
  });

  it("usa la sucursal activa del sync store", () => {
    mockSyncState.mockReturnValue({ sucursalId: "00000000-0000-0000-0000-000000000003" });

    expect(resolveAgendaOfficeId()).toBe("00000000-0000-0000-0000-000000000003");
  });

  it("falla si no hay sucursal activa", () => {
    expect(() => resolveAgendaOfficeId()).toThrow("No hay sucursal activa");
  });
});
