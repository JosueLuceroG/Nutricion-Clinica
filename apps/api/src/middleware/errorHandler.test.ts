import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type { Request, Response } from "express";
import { errorHandler, HttpError } from "./errorHandler.js";

describe("errorHandler HttpError details", () => {
  it("returns safe structured details supplied by a domain policy error", () => {
    const res = {
      status: vi.fn(),
      json: vi.fn(),
    };
    res.status.mockReturnValue(res);

    errorHandler(
      new HttpError(403, "Forbidden", [{ index: 1, code: "unauthorized" }]),
      {} as Request,
      res as unknown as Response,
      vi.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: "Forbidden",
      details: [{ index: 1, code: "unauthorized" }],
    });
  });

  it("does not throw when structured details are circular", () => {
    const details: Record<string, unknown> = {};
    details.self = details;
    const res = { status: vi.fn(), json: vi.fn() };
    res.status.mockReturnValue(res);

    expect(() =>
      errorHandler(
        new HttpError(400, "Invalid", details),
        {} as Request,
        res as unknown as Response,
        vi.fn(),
      ),
    ).not.toThrow();
    expect(res.json).toHaveBeenCalledWith({
      error: "Invalid",
      details: "Detalles no serializables",
    });
  });

  it("redacts secret-shaped keys and JSON-like strings from structured details", () => {
    const res = { status: vi.fn(), json: vi.fn() };
    res.status.mockReturnValue(res);

    errorHandler(
      new HttpError(400, "Invalid", {
        token: "secret-token-value",
        nested: {
          password: "secret-password-value",
          message: '{"apiKey":"secret-api-key-value"}',
        },
      }),
      {} as Request,
      res as unknown as Response,
      vi.fn(),
    );

    const response = res.json.mock.calls[0]?.[0];
    expect(JSON.stringify(response)).not.toContain("secret-token-value");
    expect(JSON.stringify(response)).not.toContain("secret-password-value");
    expect(JSON.stringify(response)).not.toContain("secret-api-key-value");
    expect(response).toMatchObject({
      details: {
        token: "<secret>",
        nested: { password: "<secret>" },
      },
    });
  });

  it("honors a bounded explicit HTTP status from existing domain guards", () => {
    const res = { status: vi.fn(), json: vi.fn() };
    res.status.mockReturnValue(res);
    const error = Object.assign(new Error("Forbidden"), { status: 403 });

    errorHandler(error, {} as Request, res as unknown as Response, vi.fn());

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: "Forbidden" });
  });

  it("maps request validation failures to HTTP 400", () => {
    const parsed = z.object({ id: z.string().uuid() }).safeParse({ id: "bad" });
    if (parsed.success) throw new Error("expected invalid fixture");
    const res = { status: vi.fn(), json: vi.fn() };
    res.status.mockReturnValue(res);

    errorHandler(
      parsed.error,
      {} as Request,
      res as unknown as Response,
      vi.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: "Invalid request" }),
    );
  });
});
