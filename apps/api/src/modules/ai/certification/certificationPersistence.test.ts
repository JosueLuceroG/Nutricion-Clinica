import { describe, expect, it, vi } from "vitest";
import {
  ClinicalCertificationRegistry,
  clinicalCertificationRegistry,
} from "./clinicalCertification.js";
import { CURRENT_VERSIONS } from "./versions.js";
import {
  createMemoryCertificationPersistence,
  initializeCertificationPersistence,
  parsePersistedCertificationRecord,
  persistRequalificationFlag,
  selectCertificationPersistence,
} from "./certificationPersistence.js";
import type { AIModelCapability } from "../evaluation/capabilities.js";
import { GOLDEN_DATASET_V1_FINGERPRINT } from "../evaluation/certification.js";

const v = CURRENT_VERSIONS;

const { getPoolMock } = vi.hoisted(() => ({ getPoolMock: vi.fn() }));

vi.mock("../../../db/connection.js", () => ({ getPool: getPoolMock }));

function recordFor(
  overrides: Partial<{
    certificationId: string;
    providerId: string;
    modelId: string;
    modelVersion: string;
    capabilityId: AIModelCapability;
    deploymentFingerprint?: string;
  }> = {},
) {
  const capability = overrides.capabilityId ?? "nutrition_reasoning";
  return {
    certificationId:
      overrides.certificationId ??
      `cert-${overrides.providerId}-${overrides.modelId}-${capability}`,
    key: {
      providerId: overrides.providerId ?? "ollama",
      modelId: overrides.modelId ?? "modelo-cert",
      modelVersion: overrides.modelVersion ?? "1.0",
      capabilityId: capability,
      promptVersion: v.promptVersion[capability],
      toolsetVersion: v.toolsetVersion,
      policyVersion: v.policyVersion,
      outputSchemaVersion: v.outputSchemaVersion[capability],
      evaluationDatasetVersion: v.evaluationDatasetVersion,
      knowledgePolicyVersion: v.knowledgePolicyVersion,
      retrievalPolicyVersion: v.retrievalPolicyVersion,
      smaeCatalogVersion: v.smaeCatalogVersion,
      deploymentFingerprint: overrides.deploymentFingerprint,
    },
    state: "APPROVED_NUTRITION_SUPPORT" as const,
    evaluatedAt: "2026-08-20T00:00:00.000Z",
    datasetFingerprint: GOLDEN_DATASET_V1_FINGERPRINT,
    reportRef: "report.json",
  };
}

describe("certification persistence (Build 09.5A §55-57, §85)", () => {
  it("replaceAll: reemplaza seeds por estado persistido (fail-closed)", () => {
    const registry = new ClinicalCertificationRegistry();
    expect(registry.list().length).toBeGreaterThan(0);
    registry.replaceAll([], []);
    expect(registry.list()).toEqual([]);
    const res = registry.resolve(
      "openai",
      "gpt-4o-mini",
      "gpt-4o-mini-2024-07-18",
      "nutrition_reasoning",
      {
        requiredState: "APPROVED_NUTRITION_SUPPORT",
      },
    );
    expect(res.eligible).toBe(false);
  });

  it("registro persistido + reinicio (nuevo registry) => mismo estado cargado", () => {
    const first = new ClinicalCertificationRegistry();
    first.replaceAll(
      [
        recordFor({
          certificationId: "cert-1",
          providerId: "ollama",
          modelId: "modelo-cert",
          deploymentFingerprint: "deploy-abc",
        }),
      ],
      [],
    );
    const records = first.list();
    const flags = first.listRequalificationFlags();

    const restarted = new ClinicalCertificationRegistry();
    restarted.replaceAll(records, flags);
    const res = restarted.resolve(
      "ollama",
      "modelo-cert",
      "1.0",
      "nutrition_reasoning",
      {
        requiredState: "APPROVED_NUTRITION_SUPPORT",
        deploymentFingerprint: "deploy-abc",
      },
    );
    expect(res.eligible).toBe(true);
    expect(res.stale).toBe(false);
  });

  it("cambio de fingerprint tras reinicio => REQUALIFICATION_REQUIRED (nunca se reutiliza)", () => {
    const registry = new ClinicalCertificationRegistry();
    registry.replaceAll(
      [
        recordFor({
          certificationId: "cert-1",
          providerId: "ollama",
          modelId: "modelo-cert",
          deploymentFingerprint: "deploy-abc",
        }),
      ],
      [],
    );
    const res = registry.resolve(
      "ollama",
      "modelo-cert",
      "1.0",
      "nutrition_reasoning",
      {
        requiredState: "APPROVED_NUTRITION_SUPPORT",
        deploymentFingerprint: "deploy-XYZ",
      },
    );
    expect(res.eligible).toBe(false);
    expect(res.requalificationRequired).toBe(true);
    expect(res.stale).toBe(true);
  });

  it("fingerprint ausente en registro + contexto con fingerprint => requalification", () => {
    const registry = new ClinicalCertificationRegistry();
    registry.replaceAll(
      [
        recordFor({
          certificationId: "cert-2",
          providerId: "ollama",
          modelId: "modelo-cert",
        }),
      ],
      [],
    );
    const res = registry.resolve(
      "ollama",
      "modelo-cert",
      "1.0",
      "nutrition_reasoning",
      {
        requiredState: "APPROVED_NUTRITION_SUPPORT",
        deploymentFingerprint: "deploy-abc",
      },
    );
    expect(res.eligible).toBe(false);
    expect(res.requalificationRequired).toBe(true);
  });

  it('requalification flags persistidas bloquean tras "reinicio"', () => {
    const first = new ClinicalCertificationRegistry();
    first.replaceAll(
      [
        recordFor({
          certificationId: "cert-3",
          providerId: "ollama",
          modelId: "modelo-cert",
          deploymentFingerprint: "deploy-abc",
        }),
      ],
      [
        {
          providerId: "ollama",
          modelId: "modelo-cert",
          capabilityId: "nutrition_reasoning",
        },
      ],
    );
    const restarted = new ClinicalCertificationRegistry();
    restarted.replaceAll(first.list(), first.listRequalificationFlags());
    const res = restarted.resolve(
      "ollama",
      "modelo-cert",
      "1.0",
      "nutrition_reasoning",
      {
        requiredState: "APPROVED_NUTRITION_SUPPORT",
        deploymentFingerprint: "deploy-abc",
      },
    );
    expect(res.eligible).toBe(false);
    expect(res.requalificationRequired).toBe(true);
  });

  it("preserva metadata y namespaces en flags de requalification", () => {
    const registry = new ClinicalCertificationRegistry([], []);
    registry.markRequalificationRequired(
      "provider/team",
      "namespace/model",
      "nutrition_reasoning",
      "evidence/report-1",
      "2026-08-20T00:00:00.000Z",
    );

    expect(registry.listRequalificationFlags()).toEqual([
      {
        providerId: "provider/team",
        modelId: "namespace/model",
        capabilityId: "nutrition_reasoning",
        reasonRef: "evidence/report-1",
        flaggedAt: "2026-08-20T00:00:00.000Z",
      },
    ]);
    expect(
      registry.isRequalificationFlagged(
        "provider/team",
        "namespace/model",
        "nutrition_reasoning",
      ),
    ).toBe(true);
  });

  it("no permite sobrescribir evidencia bajo un certificationId existente", () => {
    const registry = new ClinicalCertificationRegistry([], []);
    const original = recordFor({ certificationId: "cert-immutable" });
    registry.register(original);

    expect(() => registry.register(original)).not.toThrow();
    expect(() =>
      registry.register({ ...original, state: "APPROVED_PATIENT" }),
    ).toThrow(/immutable/);
  });

  it("rechaza registros SQL incompletos o con evidencia no ligada a digest", () => {
    const valid = {
      ...recordFor({ certificationId: "cert-persisted-valid" }),
      reportRef: `reports/cert.json@sha256:${"a".repeat(64)}`,
    };
    expect(parsePersistedCertificationRecord(valid).certificationId).toBe(
      "cert-persisted-valid",
    );
    expect(() =>
      parsePersistedCertificationRecord({
        ...valid,
        key: { ...valid.key, evaluationDatasetVersion: undefined },
      }),
    ).toThrow();
    expect(() =>
      parsePersistedCertificationRecord({
        ...valid,
        reportRef: "reports/unbound.json",
      }),
    ).toThrow();
    expect(() =>
      parsePersistedCertificationRecord({
        ...valid,
        evaluatedAt: new Date(Date.now() + 60_000).toISOString(),
      }),
    ).toThrow();
    expect(() =>
      parsePersistedCertificationRecord({
        ...valid,
        datasetFingerprint: "a".repeat(65),
      }),
    ).toThrow();
  });

  it("flags por defecto: llama3.2 y gpt-4o-mini REQUALIFICATION_REQUIRED (torneo 07.5A)", () => {
    const registry = new ClinicalCertificationRegistry();
    const llama = registry.resolve(
      "ollama",
      "llama3.2",
      "3.2",
      "nutrition_reasoning",
      {
        requiredState: "APPROVED_NUTRITION_SUPPORT",
      },
    );
    expect(llama.eligible).toBe(false);
    expect(llama.requalificationRequired).toBe(true);
    const mini = registry.resolve(
      "openai",
      "gpt-4o-mini",
      "gpt-4o-mini-2024-07-18",
      "nutrition_reasoning",
      {
        requiredState: "APPROVED_NUTRITION_SUPPORT",
      },
    );
    expect(mini.eligible).toBe(false);
    expect(mini.requalificationRequired).toBe(true);
  });

  it("clearRequalificationRequired restaura elegibilidad (procedimiento de operador)", () => {
    const registry = new ClinicalCertificationRegistry();
    registry.clearRequalificationRequired(
      "ollama",
      "llama3.2",
      "nutrition_reasoning",
    );
    const res = registry.resolve(
      "ollama",
      "llama3.2",
      "3.2",
      "nutrition_reasoning",
      {
        requiredState: "APPROVED_NUTRITION_SUPPORT",
      },
    );
    expect(res.eligible).toBe(true);
  });

  it("store por defecto memory; selectCertificationPersistence refleja AI_CERTIFICATION_STORE", () => {
    expect(selectCertificationPersistence({}).kind).toBe("memory");
    expect(
      selectCertificationPersistence({ AI_CERTIFICATION_STORE: "sql" }).kind,
    ).toBe("sql");
    expect(
      selectCertificationPersistence({ AI_CERTIFICATION_STORE: " sql " }).kind,
    ).toBe("sql");
    expect(
      selectCertificationPersistence({ AI_CERTIFICATION_STORE: "memory" }).kind,
    ).toBe("memory");
  });

  it("initialize con store memory: no lanza y mantiene registry", async () => {
    const persistence = await initializeCertificationPersistence({
      AI_CERTIFICATION_STORE: "memory",
    });
    expect(persistence.kind).toBe("memory");
  });

  it("persistencia memory: save/mark son no-op sin romper", async () => {
    const persistence = createMemoryCertificationPersistence();
    await persistence.saveCertificationRecord(
      recordFor({ certificationId: "x" }),
    );
    await persistence.markRequalification({
      providerId: "a",
      modelId: "b",
      capabilityId: "chat_general",
    });
    await persistence.clearRequalification("a", "b", "chat_general");
    expect(await persistence.loadCertificationRecords()).toEqual([]);
  });

  it("no muta el registry si falla la persistencia SQL del flag", async () => {
    const providerId = "failure-order-provider";
    const modelId = "failure-order-model";
    getPoolMock.mockRejectedValueOnce(new Error("SQL unavailable"));

    await expect(
      persistRequalificationFlag(
        {
          providerId,
          modelId,
          capabilityId: "chat_general",
          reasonRef: "reports/failure-order",
        },
        { AI_CERTIFICATION_STORE: "sql" },
      ),
    ).rejects.toThrow("SQL unavailable");

    expect(
      clinicalCertificationRegistry.isRequalificationFlagged(
        providerId,
        modelId,
        "chat_general",
      ),
    ).toBe(false);
  });
});
