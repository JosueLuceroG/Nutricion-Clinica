import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  httpRequest: vi.fn(),
  stopSync: vi.fn(),
  clearLocalContext: vi.fn(),
  logout: vi.fn(),
}));

vi.mock("./httpClient.js", () => ({
  httpRequest: mocks.httpRequest,
}));

vi.mock("./sensitiveActionApi.js", () => ({
  sensitiveActionApi: { authorize: vi.fn() },
}));

vi.mock("@store/authStore", () => ({
  useAuthStore: {
    getState: () => ({ logout: mocks.logout }),
  },
}));

vi.mock("@services/sync/syncBootstrap", () => ({
  stopSync: mocks.stopSync,
}));

vi.mock("@services/db", () => ({
  db: { name: "test-db" },
}));

vi.mock("@services/security/localContextBoundary", () => ({
  clearLocalContext: mocks.clearLocalContext,
}));

import { authApi } from "./authApi.js";

describe("authApi local session boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.clearLocalContext.mockResolvedValue(undefined);
    mocks.httpRequest.mockResolvedValue({ ok: true });
    mocks.logout.mockResolvedValue(undefined);
  });

  it("stops sync and clears local data before revoking the server session", async () => {
    await authApi.logout();

    expect(mocks.stopSync).toHaveBeenCalledOnce();
    expect(mocks.clearLocalContext).toHaveBeenCalledOnce();
    expect(mocks.httpRequest).toHaveBeenCalledWith("/auth/logout", {
      method: "POST",
    });
    expect(mocks.logout).toHaveBeenCalledWith({ skipLocalCache: true });
    expect(mocks.clearLocalContext.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.httpRequest.mock.invocationCallOrder[0]!,
    );
  });

  it("clears the local session even when the server logout fails", async () => {
    const error = new Error("logout unavailable");
    mocks.httpRequest.mockRejectedValueOnce(error);

    await expect(authApi.logout()).rejects.toBe(error);

    expect(mocks.logout).toHaveBeenCalledWith({ skipLocalCache: true });
  });

  it("does not call the server or clear auth state when local cleanup is blocked", async () => {
    const error = new Error("cambios pendientes");
    mocks.clearLocalContext.mockRejectedValueOnce(error);

    await expect(authApi.logout()).rejects.toBe(error);

    expect(mocks.httpRequest).not.toHaveBeenCalled();
    expect(mocks.logout).not.toHaveBeenCalled();
  });
});
