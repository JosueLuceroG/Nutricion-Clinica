import { describe, expect, it } from "vitest";
import {
  buildDeploymentManifest,
  currentPromptBundleVersion,
} from "./deploymentManifest.js";
import { readFeatureFlags, effectiveFeatureFlags } from "./featureFlags.js";
import {
  containsSecretTokenPattern,
  evaluatePreDeployGate,
  scanTrackedSecrets,
} from "./preDeployGate.js";
import { evaluateReleaseGate } from "./releaseGate.js";
import { sanitizeForClientMessage, redactSecrets } from "./sanitize.js";
import { errorHandler, HttpError } from "../../middleware/errorHandler.js";
import type { Request, Response } from "express";

describe("deploymentManifest (Build 09.5A §22)", () => {
  it("manifiesto completo y trazable", () => {
    const manifest = buildDeploymentManifest({});
    expect(manifest.gitCommit).toBeTruthy();
    expect(manifest.oltpSchemaVersion).toMatch(/^\d{3}$/);
    expect(manifest.oltpSchemaVersion).toBe("039");
    expect(manifest.dwhSchemaVersion).toMatch(/^dwh-/);
    expect(manifest.semanticCatalogVersion).toBeTruthy();
    expect(manifest.promptBundleVersion).toMatch(
      /^prompt-bundle\.[0-9a-f]{8}$/,
    );
    expect(manifest.outputSchemaBundleVersion).toMatch(
      /^output-schema-bundle\.[0-9a-f]{8}$/,
    );
    expect(manifest.deployedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(manifest.desktopChannel).toBe("primary");
    expect(manifest.desktopVersion).toBeTruthy();
    expect(manifest.desktopTauriVersion).toBeTruthy();
    expect(manifest.dexieSchemaVersion).toBe(33);
    expect(manifest.syncProtocolVersion).toBe(2);
    expect(manifest.webChannel).toBe("secondary");
    expect(manifest.webVersion).toBeTruthy();
    expect(manifest.apiContractVersion).toBe("v1");
    expect(manifest.memoryPolicyVersion).toBeTruthy();
    expect(manifest.retrievalPolicyVersion).toBe("retrieval-policy.v2");
    expect(manifest.evaluationDatasetVersion).toBe("nutrition-golden-v1");
    expect(manifest.apiVersion).toBe("0.1.0");
    expect(manifest.publicEndpoints).toEqual({
      api: "UNCONFIGURED",
      web: "UNCONFIGURED",
    });
    expect(manifest.artifacts.api).toEqual({ id: "UNSET", digest: "UNSET" });
    expect(manifest.replicaSafety).toEqual({
      api: {
        requested: 1,
        certifiedMaximum: 1,
        status: "CERTIFIED_SINGLE_REPLICA",
      },
      jobs: {
        requested: 1,
        certifiedMaximum: 1,
        status: "CERTIFIED_SINGLE_REPLICA",
      },
      etlConcurrency: "BLOCKED_NO_LEASE_RENEWAL",
      retentionConcurrency: "BLOCKED_NO_DISTRIBUTED_LOCK",
    });
  });

  it("manifiesto nunca contiene secretos", () => {
    const manifest = buildDeploymentManifest({
      OPENAI_API_KEY: "sk-leak-test",
      DB_PASSWORD: "pwd-leak",
    });
    const json = JSON.stringify(manifest);
    expect(json).not.toContain("sk-leak-test");
    expect(json).not.toContain("pwd-leak");
  });

  it("incluye endpoints y artefactos seguros sin aceptar valores arbitrarios", () => {
    const manifest = buildDeploymentManifest({
      PUBLIC_API_URL: "https://api.staging.nutriclinica.mx/path",
      PUBLIC_WEB_URL: "https://web.staging.nutriclinica.mx",
      API_ARTIFACT: "nutriclinica-api:0.1.0-rc.1",
      API_ARTIFACT_DIGEST: "sha256:abc123",
      WEB_ARTIFACT: "invalid value with spaces",
    });
    expect(manifest.publicEndpoints.api).toBe("UNCONFIGURED");
    expect(manifest.artifacts.api).toEqual({
      id: "nutriclinica-api:0.1.0-rc.1",
      digest: "UNSET",
    });
    expect(manifest.artifacts.web.id).toBe("UNSET");
  });

  it("conserva la version prerelease completa del artefacto Desktop", () => {
    const manifest = buildDeploymentManifest({
      DESKTOP_RELEASE_VERSION: "0.1.0-rc.2",
    });
    expect(manifest.desktopVersion).toBe("0.1.0-rc.2");
  });

  it("expone replicas no certificadas sin ocultar los bloqueos de concurrencia", () => {
    const manifest = buildDeploymentManifest({
      API_REPLICAS: "2",
      JOBS_REPLICAS: "invalid",
    });
    expect(manifest.replicaSafety.api.status).toBe(
      "MULTI_REPLICA_NOT_CERTIFIED",
    );
    expect(manifest.replicaSafety.jobs.status).toBe(
      "INVALID_REPLICA_CONFIGURATION",
    );
    expect(manifest.replicaSafety.etlConcurrency).toBe(
      "BLOCKED_NO_LEASE_RENEWAL",
    );
    expect(manifest.replicaSafety.retentionConcurrency).toBe(
      "BLOCKED_NO_DISTRIBUTED_LOCK",
    );
  });

  it("no normaliza credenciales o loopback como endpoints publicos", () => {
    const manifest = buildDeploymentManifest({
      PUBLIC_API_URL: "https://0.0.0.0",
      PUBLIC_WEB_URL: "https://localhost.",
    });

    expect(manifest.publicEndpoints).toEqual({
      api: "UNCONFIGURED",
      web: "UNCONFIGURED",
    });
  });

  it("no normaliza dominios reservados como endpoints publicos", () => {
    const manifest = buildDeploymentManifest({
      PUBLIC_API_URL: "https://api.example.test",
      PUBLIC_WEB_URL: "https://web.invalid",
    });

    expect(manifest.publicEndpoints).toEqual({
      api: "UNCONFIGURED",
      web: "UNCONFIGURED",
    });
  });

  it("no propaga marcadores PHI ajenos al contrato", () => {
    const marker = "PHI_DEPLOYMENT_MARKER_6f6db2";
    const json = JSON.stringify(
      buildDeploymentManifest({
        SYNTHETIC_PATIENT: marker,
        GIT_COMMIT: "a".repeat(40),
        SECRET_SCAN_STATUS: "PASS",
        SECRET_SCAN_COMMIT: "a".repeat(40),
        SECRET_SCAN_EVIDENCE_ID: marker,
      }),
    );
    expect(json).not.toContain(marker);
  });

  it("prompt bundle version es determinista", () => {
    expect(currentPromptBundleVersion()).toBe(currentPromptBundleVersion());
  });
});

describe("secret token detection", () => {
  it("detecta tokens sk y no confunde identificadores risk-*", () => {
    expect(
      containsSecretTokenPattern('OPENAI_API_KEY="sk-live_key-123456"'),
    ).toBe(true);
    expect(containsSecretTokenPattern("risk-allergy-severe")).toBe(false);
  });
});

describe("featureFlags (Build 09.5A §32-34)", () => {
  it("defaults seguros: todo deshabilitado", () => {
    const flags = readFeatureFlags({});
    for (const flag of flags) {
      expect(flag.enabled).toBe(false);
      expect(flag.safeDefault).toBe(false);
    }
  });

  it("entorno UNKNOWN => todos apagados (fail-closed)", () => {
    const flags = effectiveFeatureFlags({ NODE_ENV: "production" });
    expect(flags.every((f) => f.enabled === false)).toBe(true);
  });

  it("flags explícitos se reflejan", () => {
    const flags = readFeatureFlags({
      AI_EGRESS_ENABLED: "true",
      AI_SHADOW_STATE: "TECHNICAL_TEST_ONLY",
    });
    expect(flags.find((f) => f.id === "ai_egress")?.enabled).toBe(true);
    expect(flags.find((f) => f.id === "ai_shadow")?.enabled).toBe(true);
    expect(flags.find((f) => f.id === "ai_patient")?.enabled).toBe(false);
  });
});

describe("preDeployGate (Build 09.5A §23-25, §42)", () => {
  it("reporta todos los checks con estado válido", () => {
    const gate = evaluatePreDeployGate({});
    const ids = gate.checks.map((c) => c.id);
    expect(ids).toContain("worktree_clean");
    expect(ids).toContain("release_traceable");
    expect(ids).toContain("config_valid");
    expect(ids).toContain("feature_flags_safe");
    expect(ids).toContain("secret_scan");
    expect(ids).toContain("manifest_complete");
    expect(ids).toContain("kill_switch_known");
    for (const check of gate.checks) {
      expect(["PASS", "FAIL", "PENDING_EXTERNAL"]).toContain(check.status);
    }
  });

  it("tier B (externo) siempre PENDING_EXTERNAL: nunca se finge verificación", () => {
    const gate = evaluatePreDeployGate({});
    for (const id of [
      "pending_migrations",
      "backup_available",
      "rollback_artifact",
      "staging_smoke",
    ]) {
      const check = gate.checks.find((c) => c.id === id)!;
      expect(check.status).toBe("PENDING_EXTERNAL");
      expect(check.detail).not.toMatch(/^(PASS|verificado)$/i);
    }
  });

  it("env UNKNOWN (NODE_ENV=production) => config_valid FAIL", () => {
    const gate = evaluatePreDeployGate({ NODE_ENV: "production" });
    expect(gate.checks.find((c) => c.id === "config_valid")?.status).toBe(
      "FAIL",
    );
  });

  it("secret scan: repositorio sin secretos (excluye tests)", () => {
    const scan = scanTrackedSecrets();
    expect(scan.found).toEqual([]);
    expect(scan.scanned).toBeGreaterThan(50);
  });
});

describe("releaseGate (Build 09.5A §41-42, §45-46)", () => {
  it("lectura honesta: STAGING BLOCKED, MODELO NOT_READY, SHADOW BLOCKED", async () => {
    const gate = await evaluateReleaseGate({});
    expect(gate.groups.find((g) => g.group === "STAGING")?.status).toBe(
      "BLOCKED",
    );
    expect(gate.groups.find((g) => g.group === "MODEL")?.status).toBe(
      "NOT_READY",
    );
    expect(gate.groups.find((g) => g.group === "SHADOW")?.status).toBe(
      "BLOCKED",
    );
    expect(
      gate.groups.find((g) => g.group === "PROFESSIONAL_VALIDATION")?.status,
    ).toBe("NOT_READY");
    expect(
      gate.groups.find((g) => g.group === "CLINICAL_CERTIFICATION")?.status,
    ).toBe("NOT_READY");
    expect(["BLOCKED", "NOT_READY"]).toContain(gate.overall);
  });

  it("bloquea un kill switch con valor desconocido", async () => {
    const gate = await evaluateReleaseGate({ AI_EGRESS_ENABLED: "yes" });
    expect(gate.groups.find((g) => g.group === "KILL_SWITCH")?.status).toBe(
      "BLOCKED",
    );
  });
});

describe("sanitize/redaction (Build 09.5A §37)", () => {
  it("redacta connection strings y claves", () => {
    const raw =
      "Server=tcp:db.example.com,1433;User ID=sa;Password=Sup3rS3cret! User=admin PWD=abc123";
    const redacted = redactSecrets(raw);
    expect(redacted).not.toContain("Sup3rS3cret");
    expect(redacted).not.toContain("db.example.com");
    expect(redacted).not.toContain("abc123");
    expect(redactSecrets("token sk-live_key-123456")).toContain("<secret:sk>");
    expect(redactSecrets("risk-allergy-severe")).toBe("risk-allergy-severe");
  });

  it("sanea mensajes para el cliente (acota longitud, sin saltos)", () => {
    const long = `a ${"x".repeat(600)} \n b`;
    const out = sanitizeForClientMessage(long);
    expect(out.length).toBeLessThanOrEqual(501);
    expect(out).not.toContain("\n");
  });

  it("errorHandler nunca filtra stacks/keys al cliente", () => {
    const res = {
      status: (code: number) => {
        expect(code).toBe(500);
        return res;
      },
      json: (body: unknown) => {
        expect(String(body)).not.toContain("sk-leak");
        expect(String(body)).not.toContain("at Error");
        return res;
      },
    } as unknown as Response;
    const req = {} as Request;
    errorHandler(
      new Error("boom con sk-leak-test-key en stack"),
      req,
      res,
      () => {},
    );
  });

  it("HttpError con detalles sensibles: saneado", () => {
    const res = {
      status: (code: number) => {
        expect(code).toBe(400);
        return res;
      },
      json: (body: unknown) => {
        expect(String(body)).not.toContain("sk-leak");
        return res;
      },
    } as unknown as Response;
    const req = {} as Request;
    errorHandler(
      new HttpError(400, "fallo", { db: "Server=x;Password=sk-leak" }),
      req,
      res,
      () => {},
    );
  });
});
