import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  flushPendingPortalAdherenceSubmissions,
  getCachedPatientPortalPayload,
  getPatientPortalPayloadWithCache,
  getPendingPortalAdherenceSubmissions,
  createPatientPortalLink,
  getPortalNotifications,
  getPortalNotificationsWithCache,
  getPatientPortalPayload,
  listPatientPortalLinks,
  revokePatientPortalLink,
  sendPortalReminder,
  submitPatientPortalAdherence,
  submitPatientPortalAdherenceWithQueue,
} from "./patientPortalApi";

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

const portalPayload = {
  portal: {
    tokenId: "token-1",
    sucursalId: "s1",
    expiresAt: "2026-07-01T00:00:00.000Z",
    scopes: ["summary", "plan", "appointments", "documents"],
  },
  patient: {
    id: "p1",
    fullName: "Ana Perez",
    birthDate: "1990-01-01",
    sex: "female",
    email: "ana@example.test",
    phone: "555-0101",
    updatedAt: "2026-06-01T00:00:00.000Z",
  },
  summary: {
    activePlanName: "Plan activo",
    nextAppointmentAt: "2026-06-20T16:00:00.000Z",
    documentsCount: 1,
  },
  activePlan: null,
  upcomingAppointments: [],
  documents: [],
};

const portalLink = {
  id: "link-1",
  sucursalId: "s1",
  pacienteId: "p1",
  label: "Portal Ana",
  scopes: ["summary", "plan", "appointments", "documents"],
  expiresAt: "2026-07-01T00:00:00.000Z",
  revokedAt: null,
  lastAccessedAt: null,
  createdByProfesionalId: "prof-1",
  createdAt: "2026-06-01T00:00:00.000Z",
  updatedAt: "2026-06-01T00:00:00.000Z",
  status: "active",
  recentEvents: [
    {
      id: "audit-1",
      tokenId: "link-1",
      sucursalId: "s1",
      pacienteId: "p1",
      profesionalId: "prof-1",
      type: "created",
      ipAddress: "127.0.0.1",
      userAgent: "vitest",
      details: { label: "Portal Ana" },
      occurredAt: "2026-06-01T00:00:00.000Z",
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockFetch.mockReset();
  mockGetAuthState.mockReturnValue({ token: "jwt-token" });
  localStorage.clear();
  process.env.VITE_API_URL = "http://test.local";
});

describe("getPatientPortalPayload", () => {
  it("consulta el endpoint publico sin Authorization ni X-Sucursal-Id", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify(portalPayload),
    });

    const result = await getPatientPortalPayload("portal token/with spaces");

    expect(result.patient.fullName).toBe("Ana Perez");
    expect(mockFetch).toHaveBeenCalledWith(
      "http://test.local/patient-portal/portal%20token%2Fwith%20spaces",
      expect.objectContaining({ method: "GET" }),
    );
    const call = mockFetch.mock.calls[0]!;
    expect(call[1].headers.Authorization).toBeUndefined();
    expect(call[1].headers["X-Sucursal-Id"]).toBeUndefined();
  });

  it("rechaza payloads que no cumplen el contrato", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({ patient: null }),
    });
    await expect(
      getPatientPortalPayload("token-123456789012345678901234567890"),
    ).rejects.toThrow();
  });

  it("guarda payload exitoso y usa cache si la red falla", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify(portalPayload),
    });

    const online = await getPatientPortalPayloadWithCache("portal-cache-token");

    expect(online.source).toBe("network");
    expect(
      getCachedPatientPortalPayload("portal-cache-token")?.data.patient
        .fullName,
    ).toBe("Ana Perez");

    mockFetch.mockRejectedValueOnce(new Error("offline"));

    const cached = await getPatientPortalPayloadWithCache("portal-cache-token");

    expect(cached.source).toBe("cache");
    expect(cached.data.summary?.activePlanName).toBe("Plan activo");
    expect(cached.error).toContain("offline");
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});

describe("submitPatientPortalAdherence", () => {
  it("envia adherencia del portal sin Authorization ni X-Sucursal-Id", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () =>
        JSON.stringify({ record: { id: "adh-1", date: "2026-06-09" } }),
    });

    const result = await submitPatientPortalAdherence(
      "portal token/with spaces",
      {
        date: "2026-06-09",
        adherenceMenu: 90,
        adherenceWater: 80,
        adherenceActivity: 70,
        adherenceSupplements: 60,
        adherenceSleep: 85,
        barriers: "Sin tiempo",
      },
    );

    expect(result.id).toBe("adh-1");
    expect(mockFetch).toHaveBeenCalledWith(
      "http://test.local/patient-portal/portal%20token%2Fwith%20spaces/adherence",
      expect.objectContaining({ method: "POST" }),
    );
    const call = mockFetch.mock.calls[0]!;
    expect(call[1].headers.Authorization).toBeUndefined();
    expect(call[1].headers["X-Sucursal-Id"]).toBeUndefined();
    expect(call[1].body).toContain('"adherenceMenu":90');
  });

  it("encola adherencia si no hay red y la sincroniza al reconectar", async () => {
    mockFetch.mockRejectedValueOnce(new Error("offline"));

    const queued = await submitPatientPortalAdherenceWithQueue(
      "portal-cache-token",
      {
        date: "2026-06-09",
        adherenceMenu: 90,
        adherenceWater: 80,
        adherenceActivity: 70,
        adherenceSupplements: 60,
        adherenceSleep: 85,
        barriers: "Sin tiempo",
      },
    );

    expect(queued.status).toBe("queued");
    expect(
      getPendingPortalAdherenceSubmissions("portal-cache-token"),
    ).toHaveLength(1);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () =>
        JSON.stringify({ record: { id: "adh-queued", date: "2026-06-09" } }),
    });

    const result =
      await flushPendingPortalAdherenceSubmissions("portal-cache-token");

    expect(result).toEqual({ submitted: 1, failed: 0, remaining: 0 });
    expect(
      getPendingPortalAdherenceSubmissions("portal-cache-token"),
    ).toHaveLength(0);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});

describe("portal notifications/reminders", () => {
  it("sendPortalReminder usa endpoint público sin Authorization ni X-Sucursal-Id", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () =>
        JSON.stringify({
          sent: true,
          messageId: "simulated-1",
          to: "ana@example.test",
        }),
    });

    const result = await sendPortalReminder("portal token/with spaces");

    expect(result.sent).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      "http://test.local/patient-portal/portal%20token%2Fwith%20spaces/send-reminder",
      expect.objectContaining({ method: "POST" }),
    );
    const call = mockFetch.mock.calls[0]!;
    expect(call[1].headers.Authorization).toBeUndefined();
    expect(call[1].headers["X-Sucursal-Id"]).toBeUndefined();
  });

  it("getPortalNotifications parsea historial público sin Authorization ni X-Sucursal-Id", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () =>
        JSON.stringify({
          notifications: [
            {
              id: "notif-1",
              type: "appointment_reminder",
              to: "ana@example.test",
              subject: "Recordatorio de cita",
              error: null,
              sentAt: "2026-06-09T00:00:00.000Z",
            },
          ],
        }),
    });

    const result = await getPortalNotifications("portal token/with spaces");

    expect(result[0]!.subject).toBe("Recordatorio de cita");
    expect(mockFetch).toHaveBeenCalledWith(
      "http://test.local/patient-portal/portal%20token%2Fwith%20spaces/notifications",
      expect.objectContaining({ method: "GET" }),
    );
    const call = mockFetch.mock.calls[0]!;
    expect(call[1].headers.Authorization).toBeUndefined();
    expect(call[1].headers["X-Sucursal-Id"]).toBeUndefined();
  });

  it("cachea historial de notificaciones y lo usa sin red", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () =>
        JSON.stringify({
          notifications: [
            {
              id: "notif-cache",
              type: "appointment_reminder",
              to: "ana@example.test",
              subject: "Recordatorio cacheado",
              error: null,
              sentAt: "2026-06-09T00:00:00.000Z",
            },
          ],
        }),
    });

    const online = await getPortalNotificationsWithCache("portal-cache-token");
    expect(online.source).toBe("network");

    mockFetch.mockRejectedValueOnce(new Error("offline"));

    const cached = await getPortalNotificationsWithCache("portal-cache-token");
    expect(cached.source).toBe("cache");
    expect(cached.notifications[0]!.subject).toBe("Recordatorio cacheado");
  });
});

describe("professional portal link API", () => {
  it("listPatientPortalLinks usa auth y sucursal activa", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({ tokens: [portalLink] }),
    });

    const result = await listPatientPortalLinks("p1");

    expect(result).toHaveLength(1);
    expect(result[0]!.recentEvents[0]!.type).toBe("created");
    expect(mockFetch).toHaveBeenCalledWith(
      "http://test.local/patient-portal/tokens?pacienteId=p1",
      expect.objectContaining({ method: "GET" }),
    );
    const call = mockFetch.mock.calls[0]!;
    expect(call[1].headers.Authorization).toBe("Bearer jwt-token");
    expect(call[1].headers["X-Sucursal-Id"]).toBe("s-active");
  });

  it("createPatientPortalLink serializa input y retorna token claro de una sola vez", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () =>
        JSON.stringify({
          token: "clear-token",
          portalPath: "/portal/clear-token",
          link: portalLink,
        }),
    });

    const result = await createPatientPortalLink({
      pacienteId: "p1",
      expiresInDays: 30,
      label: "Portal Ana",
    });

    expect(result.token).toBe("clear-token");
    const call = mockFetch.mock.calls[0]!;
    expect(call[0]).toBe("http://test.local/patient-portal/tokens");
    expect(call[1].method).toBe("POST");
    expect(call[1].body).toBe(
      '{"pacienteId":"p1","expiresInDays":30,"label":"Portal Ana"}',
    );
  });

  it("revokePatientPortalLink llama PATCH y retorna metadata revocada", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () =>
        JSON.stringify({
          token: {
            ...portalLink,
            status: "revoked",
            revokedAt: "2026-06-02T00:00:00.000Z",
          },
        }),
    });

    const result = await revokePatientPortalLink("link-1");

    expect(result.status).toBe("revoked");
    expect(mockFetch).toHaveBeenCalledWith(
      "http://test.local/patient-portal/tokens/link-1/revoke",
      expect.objectContaining({ method: "PATCH" }),
    );
  });
});
