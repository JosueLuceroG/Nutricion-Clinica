import { describe, it, expect, vi, beforeEach } from "vitest";
import { hasModuleAccess, checkPermission, canAccessModule } from "./securityService";

const mockGetState = vi.fn<() => { user: { rol: string } | null }>();

vi.mock("@store/authStore", () => ({
  useAuthStore: { getState: () => mockGetState() },
}));

beforeEach(() => {
  mockGetState.mockReset();
});

describe("hasModuleAccess", () => {
  describe("permission matrix covers all 6 roles", () => {
    it("recognizes admin", () => {
      expect(hasModuleAccess("patients", "admin")).toBe(true);
    });

    it("recognizes nutriologa", () => {
      expect(hasModuleAccess("patients", "nutriologa")).toBe(true);
    });

    it("recognizes asistente", () => {
      expect(hasModuleAccess("patients", "asistente")).toBe(true);
    });

    it("recognizes soporte_tecnico", () => {
      expect(hasModuleAccess("patients", "soporte_tecnico")).toBe(true);
    });

    it("recognizes auditor", () => {
      expect(hasModuleAccess("patients", "auditor")).toBe(true);
    });

    it("recognizes facturacion", () => {
      expect(hasModuleAccess("billing", "facturacion")).toBe(true);
    });
  });

  describe("each role has expected permissions", () => {
    it("nutriologa has full access to patient-related modules", () => {
      expect(hasModuleAccess("patients", "nutriologa")).toBe(true);
      expect(hasModuleAccess("consultations", "nutriologa")).toBe(true);
      expect(hasModuleAccess("anthropometry", "nutriologa")).toBe(true);
      expect(hasModuleAccess("laboratory", "nutriologa")).toBe(true);
      expect(hasModuleAccess("mealplan", "nutriologa")).toBe(true);
      expect(hasModuleAccess("recipes", "nutriologa")).toBe(true);
      expect(hasModuleAccess("goals", "nutriologa")).toBe(true);
      expect(hasModuleAccess("adherence", "nutriologa")).toBe(true);
      expect(hasModuleAccess("documents", "nutriologa")).toBe(true);
      expect(hasModuleAccess("meal-planner", "nutriologa")).toBe(true);
      expect(hasModuleAccess("agenda", "nutriologa")).toBe(true);
      expect(hasModuleAccess("reports", "nutriologa")).toBe(true);
      expect(hasModuleAccess("medications", "nutriologa")).toBe(true);
      expect(hasModuleAccess("dashboard", "nutriologa")).toBe(true);
    });

    it("nutriologa does not have access to billing or backup", () => {
      expect(hasModuleAccess("billing", "nutriologa")).toBe(false);
      expect(hasModuleAccess("backup", "nutriologa")).toBe(false);
    });

    it("asistente has read access to patients, consultations, anthropometry, laboratory, reports", () => {
      expect(hasModuleAccess("patients", "asistente")).toBe(true);
      expect(hasModuleAccess("consultations", "asistente")).toBe(true);
      expect(hasModuleAccess("anthropometry", "asistente")).toBe(true);
      expect(hasModuleAccess("laboratory", "asistente")).toBe(true);
      expect(hasModuleAccess("reports", "asistente")).toBe(true);
    });

    it("asistente has full access to agenda", () => {
      expect(hasModuleAccess("agenda", "asistente")).toBe(true);
    });

    it("asistente cannot write with a patients:read permission", () => {
      expect(hasModuleAccess("patients", "asistente", "write")).toBe(false);
      expect(hasModuleAccess("patients", "asistente", "read")).toBe(true);
    });

    it("asistente does not have access to billing or mealplan", () => {
      expect(hasModuleAccess("billing", "asistente")).toBe(false);
      expect(hasModuleAccess("mealplan", "asistente")).toBe(false);
    });

    it("soporte_tecnico has read access to all modules via *:read", () => {
      expect(hasModuleAccess("patients", "soporte_tecnico")).toBe(true);
      expect(hasModuleAccess("consultations", "soporte_tecnico")).toBe(true);
      expect(hasModuleAccess("billing", "soporte_tecnico")).toBe(true);
      expect(hasModuleAccess("patients", "soporte_tecnico", "write")).toBe(false);
    });

    it("soporte_tecnico has full access to backup and sync", () => {
      expect(hasModuleAccess("backup", "soporte_tecnico")).toBe(true);
      expect(hasModuleAccess("sync", "soporte_tecnico")).toBe(true);
    });

    it("auditor has read access to all modules via *:read", () => {
      expect(hasModuleAccess("patients", "auditor")).toBe(true);
      expect(hasModuleAccess("consultations", "auditor")).toBe(true);
      expect(hasModuleAccess("billing", "auditor")).toBe(true);
      expect(hasModuleAccess("patients", "auditor", "write")).toBe(false);
    });

    it("auditor has full access to audit module", () => {
      expect(hasModuleAccess("audit", "auditor")).toBe(true);
    });

    it("facturacion has read access to consultations and reports", () => {
      expect(hasModuleAccess("consultations", "facturacion")).toBe(true);
      expect(hasModuleAccess("reports", "facturacion")).toBe(true);
    });

    it("facturacion has full access to billing", () => {
      expect(hasModuleAccess("billing", "facturacion")).toBe(true);
    });

    it("facturacion cannot access patients or mealplan", () => {
      expect(hasModuleAccess("patients", "facturacion")).toBe(false);
      expect(hasModuleAccess("mealplan", "facturacion")).toBe(false);
    });
  });

  describe("admin role has all permissions", () => {
    it("returns true for any module", () => {
      expect(hasModuleAccess("patients", "admin")).toBe(true);
      expect(hasModuleAccess("billing", "admin")).toBe(true);
      expect(hasModuleAccess("backup", "admin")).toBe(true);
      expect(hasModuleAccess("non_existent_module", "admin")).toBe(true);
    });

    it("returns true for any action", () => {
      expect(hasModuleAccess("patients", "admin", "read")).toBe(true);
      expect(hasModuleAccess("patients", "admin", "write")).toBe(true);
      expect(hasModuleAccess("patients", "admin", "delete")).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("returns false for unknown role", () => {
      expect(hasModuleAccess("patients", "unknown_role")).toBe(false);
      expect(hasModuleAccess("patients", "")).toBe(false);
    });

    it("returns false for unknown module when role has no wildcard", () => {
      expect(hasModuleAccess("non_existent", "nutriologa")).toBe(false);
      expect(hasModuleAccess("non_existent", "asistente")).toBe(false);
      expect(hasModuleAccess("non_existent", "facturacion")).toBe(false);
    });

    it("returns true for unknown module when role has wildcard", () => {
      expect(hasModuleAccess("non_existent", "admin")).toBe(true);
      expect(hasModuleAccess("non_existent", "soporte_tecnico")).toBe(true);
      expect(hasModuleAccess("non_existent", "auditor")).toBe(true);
    });

    it("returns false when role is undefined", () => {
      expect(hasModuleAccess("patients", undefined as unknown as string)).toBe(false);
    });
  });
});

describe("checkPermission", () => {
  it("returns true when the current role has access", () => {
    mockGetState.mockReturnValue({ user: { rol: "nutriologa" } });
    expect(checkPermission("patients")).toBe(true);
  });

  it("returns false when the current role lacks access", () => {
    mockGetState.mockReturnValue({ user: { rol: "facturacion" } });
    expect(checkPermission("patients")).toBe(false);
  });

  it("respects the action parameter when role has specific module:action permissions", () => {
    mockGetState.mockReturnValue({ user: { rol: "facturacion" } });
    expect(checkPermission("billing")).toBe(true);
    expect(checkPermission("billing", "read")).toBe(true);
    expect(checkPermission("patients")).toBe(false);
  });

  it("returns false when no user is logged in", () => {
    mockGetState.mockReturnValue({ user: null });
    expect(checkPermission("patients")).toBe(false);
  });
});

describe("canAccessModule", () => {
  it("returns true for an accessible module", () => {
    mockGetState.mockReturnValue({ user: { rol: "nutriologa" } });
    expect(canAccessModule("patients")).toBe(true);
  });

  it("returns false for an inaccessible module", () => {
    mockGetState.mockReturnValue({ user: { rol: "facturacion" } });
    expect(canAccessModule("patients")).toBe(false);
  });
});
