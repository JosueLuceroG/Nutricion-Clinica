import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockRecord, mockAuthState } = vi.hoisted(() => ({
  mockRecord: vi.fn(),
  mockAuthState: vi.fn(),
}));

vi.mock("./auditService", () => ({
  auditService: { record: mockRecord },
}));

vi.mock("@store/authStore", () => ({
  useAuthStore: { getState: mockAuthState },
}));

import { getCurrentAuditUserId, recordClinicalAudit } from "./clinicalAudit";

describe("clinicalAudit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthState.mockReturnValue({ user: { id: "user-1" } });
  });

  it("uses authenticated user as audit actor", () => {
    expect(getCurrentAuditUserId()).toBe("user-1");
  });

  it("falls back to system if there is no authenticated user", () => {
    mockAuthState.mockReturnValue({ user: null });

    expect(getCurrentAuditUserId()).toBe("system");
  });

  it("records clinical metadata without patient payload", async () => {
    await recordClinicalAudit({
      module: "patients",
      action: "create",
      resourceType: "patient",
      resourceId: "p1",
      patientId: "p1",
    });

    expect(mockRecord).toHaveBeenCalledWith({
      module: "patients",
      action: "create",
      resourceType: "patient",
      resourceId: "p1",
      patientId: "p1",
      userId: "user-1",
    });
  });

  it("does not throw if audit storage fails", async () => {
    mockRecord.mockRejectedValueOnce(new Error("db failed"));

    await expect(recordClinicalAudit({
      module: "patients",
      action: "update",
      resourceType: "patient",
      resourceId: "p1",
    })).resolves.toBeUndefined();
  });
});
