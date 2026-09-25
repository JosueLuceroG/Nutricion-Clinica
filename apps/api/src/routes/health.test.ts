import express from "express";
import { createServer } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { createHealthRouter } from "./health.js";

const servers: ReturnType<typeof createServer>[] = [];

afterEach(async () => {
  await Promise.all(
    servers
      .splice(0)
      .map(
        (server) =>
          new Promise<void>((resolve) => server.close(() => resolve())),
      ),
  );
});

async function serve(
  oltp: boolean,
  dwh: boolean,
  dwhEnabled = false,
  shuttingDown = false,
  dwhStore = dwhEnabled ? "sql" : "memory",
) {
  const app = express();
  app.use(
    "/health",
    createHealthRouter({
      oltp: async () => oltp,
      dwh: async () => dwh,
      env: {
        RELEASE_VERSION: "0.1.0-test",
        DWH_ENABLED: String(dwhEnabled),
        DWH_STORE: dwhStore,
      },
      isShuttingDown: () => shuttingDown,
    }),
  );
  const server = createServer(app);
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("test server address");
  return `http://127.0.0.1:${address.port}`;
}

describe("operational health", () => {
  it("liveness is process-only and never echoes request data", async () => {
    const base = await serve(false, false);
    const marker = "PHI_DEPLOYMENT_MARKER_6f6db2";
    const response = await fetch(`${base}/health/live?patient=${marker}`);
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).not.toContain(marker);
    expect(JSON.parse(body)).toMatchObject({ status: "alive" });
  });

  it("readiness fails without critical OLTP and does not expose errors", async () => {
    const base = await serve(false, false);
    const response = await fetch(`${base}/health/ready`);
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      status: "not_ready",
      checks: { oltp: "not_ready", dwh: "disabled" },
      optionalDependencies: {
        aiRuntime: "not_required",
        modelEligibility: "not_checked",
      },
    });
  });

  it("requires DWH only when enabled", async () => {
    const base = await serve(true, false, true);
    const response = await fetch(`${base}/health/ready`);
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      checks: { oltp: "ready", dwh: "not_ready" },
    });
  });

  it("does not probe a SQL DWH when the configured store is memory", async () => {
    const base = await serve(true, false, true, false, "memory");
    const response = await fetch(`${base}/health/ready`);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      checks: { oltp: "ready", dwh: "memory" },
    });
  });

  it("fails readiness immediately while draining", async () => {
    const base = await serve(true, true, false, true);
    const response = await fetch(`${base}/health/ready`);
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      status: "not_ready",
      checks: { shutdown: "draining" },
    });
  });
});
