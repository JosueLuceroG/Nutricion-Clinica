import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Request, Response } from "express";
import { AIOrchestrator } from "../ai/aiOrchestrator.js";
import type { AICompletionResult } from "../ai/providers/aiProviderAdapter.js";
import { resetStagingSyntheticData } from "../../db/stagingReset.js";
import { buildDeploymentManifest } from "./deploymentManifest.js";
import { buildEnvironmentIdentity } from "./environmentIdentity.js";
import { effectiveFeatureFlags, readFeatureFlags } from "./featureFlags.js";
import { evaluatePreDeployGate } from "./preDeployGate.js";
import { evaluateReleaseGate } from "./releaseGate.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const MIGRATIONS_DIR = join(__dirname, "..", "..", "..", "migrations");

const SUCCESS: AICompletionResult = {
  content: "ok",
  model: "m",
  finishReason: "stop",
  usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
};

describe("E2E kill switch (Build 09.5A §32-34, §45-46)", () => {
  it("egreso apagado => 503 AI_DISABLED, cero llamadas al adapter, flag off", async () => {
    const adapter = { complete: vi.fn(async () => SUCCESS) };
    const orchestrator = new AIOrchestrator({
      getProviderAdapter: () => adapter,
      env: () => ({ AI_EGRESS_ENABLED: "false" }) as NodeJS.ProcessEnv,
    });

    const result = await orchestrator.execute({
      request: {
        model: "gpt-4o-mini",
        systemPrompt: "sys",
        userPrompt: "user",
      },
      egress: {
        capability: "nutrition_reasoning",
        patientId: "11111111-1111-1111-1111-111111111111",
      },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(503);
      expect(result.code).toBe("AI_DISABLED");
    }
    expect(adapter.complete).not.toHaveBeenCalled();
    expect(
      readFeatureFlags({ AI_EGRESS_ENABLED: "false" }).find(
        (f) => f.id === "ai_egress",
      )?.enabled,
    ).toBe(false);
  });

  it("el kill switch es verificable y el release gate lo reporta como conocido", async () => {
    const gate = await evaluateReleaseGate({ AI_EGRESS_ENABLED: "false" });
    expect(gate.groups.find((g) => g.group === "KILL_SWITCH")?.status).toBe(
      "READY",
    );
    expect(
      gate.groups.find((g) => g.group === "KILL_SWITCH")?.detail,
    ).toContain("AI_EGRESS_ENABLED=false");
    expect(["BLOCKED", "NOT_READY"]).toContain(gate.overall);
  });
});

describe("E2E rollback (Build 09.5A §47-48)", () => {
  it("reset de staging es fail-closed: exige ENVIRONMENT_CLASS=STAGING/TEST explícito", async () => {
    await expect(
      resetStagingSyntheticData({ ENVIRONMENT_CLASS: "LOCAL" }),
    ).rejects.toThrow(/fail-closed/);
    await expect(
      resetStagingSyntheticData({ ENVIRONMENT_CLASS: "PRODUCTION" }),
    ).rejects.toThrow(/fail-closed/);
    await expect(
      resetStagingSyntheticData({ NODE_ENV: "production" }),
    ).rejects.toThrow(/fail-closed/);
  });

  it("migración 039 es puramente aditiva: rollback = revert de release sin DROP destructivo", () => {
    const sql039 = readFileSync(
      join(MIGRATIONS_DIR, "039-deployment-certification-persistence.sql"),
      "utf8",
    );
    expect(sql039).toMatch(
      /CREATE TABLE\s+(dbo\.)?\[?ai_certification_records\]?/i,
    );
    expect(sql039).toMatch(
      /CREATE TABLE\s+(dbo\.)?\[?ai_requalification_flags\]?/i,
    );
    expect(sql039).toMatch(
      /INSERT INTO\s+(dbo\.)?\[?ai_requalification_flags\]?/i,
    );
    expect(sql039).not.toMatch(
      /\bDROP\s+(TABLE|COLUMN|INDEX|PROCEDURE|VIEW|TRIGGER|DATABASE)\b/i,
    );
    expect(sql039).not.toMatch(/ALTER\s+TABLE[^;]*\b(DROP|ALTER\s+COLUMN)\b/i);
  });

  it("stagingReset preserva esquema: solo TRUNCATE de tablas sintéticas, nunca DROP", () => {
    const source = readFileSync(
      join(__dirname, "..", "..", "db", "stagingReset.ts"),
      "utf8",
    );
    expect(source).toMatch(/TRUNCATE TABLE/);
    expect(source).not.toMatch(/\bDROP\s+(TABLE|DATABASE)\b/i);
    expect(source).toMatch(/NUNCA tablas\s*\*\s*cl[íi]nicas/);
  });
});

describe("E2E smoke operativo (Build 09.5A §22-25)", () => {
  it("secuencia identidad -> manifiesto -> flags -> pre-deploy coherente en LOCAL", () => {
    const env = { ENVIRONMENT_CLASS: "LOCAL" };
    const identity = buildEnvironmentIdentity(env);
    expect(identity.environmentClass).toBe("LOCAL");

    const manifest = buildDeploymentManifest(env);
    expect(manifest.environment.environmentClass).toBe("LOCAL");
    expect(manifest.oltpSchemaVersion).toBe("039");
    expect(manifest.gitCommit).toMatch(/^[0-9a-f]{7,}$/);

    const flags = effectiveFeatureFlags(env);
    expect(flags.every((f) => f.enabled === false)).toBe(true);

    const pre = evaluatePreDeployGate(env);
    expect(pre.checks.find((c) => c.id === "config_valid")?.status).toBe(
      "PASS",
    );
    expect(pre.checks.find((c) => c.id === "manifest_complete")?.status).toBe(
      "PASS",
    );
    expect(pre.checks.find((c) => c.id === "release_traceable")?.status).toBe(
      "PASS",
    );
    expect(pre.checks.find((c) => c.id === "secret_scan")?.status).toBe("PASS");
    expect(pre.deployableToStaging).toBe(false);
  });

  it("release gate en LOCAL: bloqueos honestos, nunca READY inventado", async () => {
    const gate = await evaluateReleaseGate({ ENVIRONMENT_CLASS: "LOCAL" });
    const blocked = gate.groups
      .filter((g) => g.status === "BLOCKED")
      .map((g) => g.group);
    expect(blocked).toContain("STAGING");
    expect(gate.groups.find((g) => g.group === "MODEL")?.status).toBe(
      "NOT_READY",
    );
    expect(
      gate.groups.find((g) => g.group === "PROFESSIONAL_VALIDATION")?.status,
    ).toBe("NOT_READY");
    expect(
      gate.groups.find((g) => g.group === "CLINICAL_CERTIFICATION")?.status,
    ).toBe("NOT_READY");
    expect(gate.overall).not.toBe("READY");
  });
});

describe("E2E leaks (Build 09.5A §37)", () => {
  it("errorHandler en STAGING: mensaje genérico, sin PHI ni secretos", async () => {
    vi.resetModules();
    vi.stubEnv("ENVIRONMENT_CLASS", "STAGING");
    const { errorHandler, HttpError } =
      await import("../../middleware/errorHandler.js");

    const body = await new Promise<unknown>((resolve) => {
      const res = {
        status: () => res,
        json: (b: unknown) => {
          resolve(b);
          return res;
        },
      } as unknown as Response;
      errorHandler(
        new HttpError(
          403,
          "Paciente Ana Gómez, email ana@test.com, password sk-leak-test-key-12345678",
          { paciente: "Ana Gómez", token: "sk-leak-test-key-12345678" },
        ),
        {} as Request,
        res,
        () => {},
      );
    });
    vi.unstubAllEnvs();

    const json = JSON.stringify(body);
    expect(json).not.toContain("Ana Gómez");
    expect(json).not.toContain("ana@test.com");
    expect(json).not.toContain("sk-leak");
  });

  it("errorHandler en UNKNOWN (fail-closed): mismo saneamiento genérico", async () => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "production");
    delete process.env.ENVIRONMENT_CLASS;
    const { errorHandler, HttpError } =
      await import("../../middleware/errorHandler.js");

    const body = await new Promise<unknown>((resolve) => {
      const res = {
        status: () => res,
        json: (b: unknown) => {
          resolve(b);
          return res;
        },
      } as unknown as Response;
      errorHandler(
        new HttpError(
          500,
          "secreto sk-leak-test-key-12345678 y paciente Ana Gómez",
        ),
        {} as Request,
        res,
        () => {},
      );
    });
    vi.unstubAllEnvs();

    const json = JSON.stringify(body);
    expect(json).not.toContain("Ana Gómez");
    expect(json).not.toContain("sk-leak");
  });

  it("errorHandler en STAGING no escribe PHI ni secretos en logs", async () => {
    vi.resetModules();
    vi.stubEnv("ENVIRONMENT_CLASS", "STAGING");
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const { errorHandler } = await import("../../middleware/errorHandler.js");
      const res = {
        status: () => res,
        json: () => res,
      } as unknown as Response;

      errorHandler(
        new Error(
          "PHI_DEPLOYMENT_MARKER_6f6db2 ana@test.com sk-leak-test-key-12345678",
        ),
        {} as Request,
        res,
        () => {},
      );

      const output = JSON.stringify(log.mock.calls);
      expect(output).not.toContain("PHI_DEPLOYMENT_MARKER_6f6db2");
      expect(output).not.toContain("ana@test.com");
      expect(output).not.toContain("sk-leak");
    } finally {
      log.mockRestore();
      vi.unstubAllEnvs();
    }
  });
});
