import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchDashboardMetrics } from "./dashboardApi";

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

beforeEach(() => {
  vi.clearAllMocks();
  mockGetAuthState.mockReturnValue({ token: "jwt-token" });
  process.env.VITE_API_URL = "http://test.local";
});

describe("fetchDashboardMetrics", () => {
  it("consulta métricas de clínica con Authorization y sucursal activa", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({
        pacientes: { total: 10, activos: 8, inactivos: 1, archivados: 1, nuevosEsteMes: 3 },
        sexoDistribucion: [{ sexo: "female", count: 7 }],
        consultas: { total: 20, esteMes: 5, pendientesPago: 2 },
        planesAlimenticios: { activos: 4, porVencer: 1 },
        adherencia: { promedioGlobal: 86.5, totalRegistros: 6 },
        patologias: [{ tag: "diabetes-t2", count: 2 }],
      }),
    });

    const metrics = await fetchDashboardMetrics();

    expect(metrics.pacientes.activos).toBe(8);
    expect(metrics.adherencia.promedioGlobal).toBe(86.5);
    expect(mockFetch).toHaveBeenCalledWith(
      "http://test.local/dashboard/metrics",
      expect.objectContaining({ method: "GET" }),
    );
    const call = mockFetch.mock.calls[0]!;
    expect(call[1].headers.Authorization).toBe("Bearer jwt-token");
    expect(call[1].headers["X-Sucursal-Id"]).toBe("s-active");
  });

  it("rechaza payloads incompletos", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, text: async () => JSON.stringify({ pacientes: null }) });
    await expect(fetchDashboardMetrics()).rejects.toThrow();
  });
});
