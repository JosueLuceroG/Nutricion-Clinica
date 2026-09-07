import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";

const mocks = vi.hoisted(() => ({ getPool: vi.fn() }));

vi.mock("../db/connection.js", () => ({ getPool: mocks.getPool }));

import { auditLog, requiredAuditLog } from "./auditMiddleware.js";

function request(): Request {
  return {
    method: "POST",
    path: "/deployment/certification/register",
    baseUrl: "/deployment",
    route: { path: "/certification/register" },
    params: {},
    query: {},
    socket: {},
    header: () => undefined,
  } as unknown as Request;
}

describe("audit middleware failure policy", () => {
  beforeEach(() => {
    mocks.getPool.mockReset();
    mocks.getPool.mockRejectedValue(new Error("database unavailable"));
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps ordinary audit best-effort", async () => {
    const next = vi.fn() as NextFunction;
    await auditLog("read", "record")(request(), {} as Response, next);
    expect(next).toHaveBeenCalledWith();
  });

  it("fails closed when a required audit cannot be persisted", async () => {
    const next = vi.fn() as NextFunction;
    await requiredAuditLog("create", "ai_certification")(
      request(),
      {} as Response,
      next,
    );
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 503 }));
  });

  it("persists only route templates, parameter names, and safe references", async () => {
    const inputs = new Map<string, unknown>();
    const dbRequest = {
      input: vi.fn((name: string, _type: unknown, value: unknown) => {
        inputs.set(name, value);
        return dbRequest;
      }),
      query: vi.fn().mockResolvedValue(undefined),
    };
    mocks.getPool.mockResolvedValue({ request: () => dbRequest });
    const next = vi.fn() as NextFunction;
    const req = {
      ...request(),
      path: "/records/super-secret-token",
      baseUrl: "/api",
      route: { path: "/records/:id" },
      params: { id: "super-secret-token" },
      query: { access_token: "hidden-value" },
    } as unknown as Request;

    await auditLog(
      "read",
      "record",
      () => "super-secret-token",
      () => `sha256:${"a".repeat(64)}`,
    )(req, {} as Response, next);

    expect(next).toHaveBeenCalledWith();
    expect(inputs.get("entity_id")).toBeNull();
    expect(JSON.parse(String(inputs.get("detalles")))).toEqual({
      phase: "attempt",
      method: "POST",
      path: "/api/records/:id",
      paramKeys: ["id"],
      queryKeys: ["access_token"],
      reference: `sha256:${"a".repeat(64)}`,
    });
    expect(String(inputs.get("detalles"))).not.toContain("super-secret-token");
    expect(String(inputs.get("detalles"))).not.toContain("hidden-value");
  });
});
