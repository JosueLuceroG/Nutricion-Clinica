import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";
import express from "express";
import { afterEach, describe, expect, it } from "vitest";
import {
  installStandaloneApiPrefix,
  mountStandaloneWeb,
  rewriteStandaloneApiPath,
} from "./webHosting.js";

const resources: Array<() => Promise<void>> = [];

afterEach(async () => {
  for (const cleanup of resources.splice(0)) await cleanup();
});

describe("standalone Web hosting", () => {
  it("rewrites only the explicit /api prefix", () => {
    expect(rewriteStandaloneApiPath("/api/pacientes?limit=1")).toBe(
      "/pacientes?limit=1",
    );
    expect(rewriteStandaloneApiPath("/api")).toBe("/");
    expect(rewriteStandaloneApiPath("/apix")).toBeNull();
  });

  it("serves the SPA and keeps unknown API paths fail-closed", async () => {
    const root = await mkdtemp(join(tmpdir(), "nutriclinica-web-"));
    resources.push(() => rm(root, { recursive: true, force: true }));
    await writeFile(
      join(root, "index.html"),
      "<!doctype html><title>NC</title>",
    );

    const app = express();
    installStandaloneApiPrefix(app);
    app.get("/health", (_req, res) => res.json({ status: "ok" }));
    mountStandaloneWeb(app, root);
    const server = createServer(app);
    resources.push(
      () =>
        new Promise<void>((resolve) => {
          if (!server.listening) {
            resolve();
            return;
          }
          server.close(() => resolve());
        }),
    );
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", () => resolve());
    });
    const address = server.address();
    if (!address || typeof address === "string")
      throw new Error("server address unavailable");
    const base = `http://127.0.0.1:${address.port}`;

    const api = await fetch(`${base}/api/health`);
    expect(api.status).toBe(200);
    await expect(api.json()).resolves.toEqual({ status: "ok" });

    const spa = await fetch(`${base}/patients`);
    expect(spa.status).toBe(200);
    expect(await spa.text()).toContain("<title>NC</title>");

    const unknown = await fetch(`${base}/api/not-a-route`);
    expect(unknown.status).toBe(404);
    await expect(unknown.json()).resolves.toEqual({
      error: "Ruta API no encontrada",
    });

    const apiHtml = await fetch(`${base}/api/index.html`);
    expect(apiHtml.status).toBe(404);
    await expect(apiHtml.json()).resolves.toEqual({
      error: "Ruta API no encontrada",
    });
  });
});
