import { describe, expect, it } from "vitest";
import type { AuditMiddleware } from "../../middleware/auditMiddleware.js";
import { GOLDEN_DATASET_V1_FINGERPRINT } from "../ai/evaluation/certification.js";
import router, { parseCertificationRegistration } from "./deploymentRoutes.js";

interface RouteLayer {
  route?: {
    path?: string;
    methods?: Record<string, boolean>;
    stack?: Array<{ handle?: Partial<AuditMiddleware> }>;
  };
}

function routeHandlers(path: string) {
  const stack = (router as unknown as { stack: RouteLayer[] }).stack;
  return (
    stack
      .find((layer) => layer.route?.path === path && layer.route.methods?.post)
      ?.route?.stack?.map((layer) => layer.handle) ?? []
  );
}

function validRegistration(overrides: Record<string, unknown> = {}) {
  return {
    certificationId: " cert-1 ",
    providerId: " ollama ",
    modelId: " model-1 ",
    modelVersion: " 1.0 ",
    capabilityId: "nutrition_reasoning",
    state: "EXPERIMENTAL",
    evaluatedAt: "2026-08-20T00:00:00-06:00",
    datasetFingerprint: ` ${GOLDEN_DATASET_V1_FINGERPRINT} `,
    reportRef: ` reports/cert-1.json@sha256:${"a".repeat(64)} `,
    deploymentFingerprint: " deploy-1234abcd ",
    ...overrides,
  };
}

describe("deployment certification routes", () => {
  it("normalizes bounded certification evidence and timestamps", () => {
    expect(parseCertificationRegistration(validRegistration())).toMatchObject({
      certificationId: "cert-1",
      providerId: "ollama",
      evaluatedAt: "2026-08-20T06:00:00.000Z",
      reportRef: `reports/cert-1.json@sha256:${"a".repeat(64)}`,
      deploymentFingerprint: "deploy-1234abcd",
    });
  });

  it("rejects blank, invalid-state, and oversized evidence", () => {
    expect(() =>
      parseCertificationRegistration(validRegistration({ providerId: "   " })),
    ).toThrow();
    expect(() =>
      parseCertificationRegistration(validRegistration({ state: "APPROVED" })),
    ).toThrow();
    expect(() =>
      parseCertificationRegistration(
        validRegistration({ state: "APPROVED_NUTRITION_SUPPORT" }),
      ),
    ).toThrow(/independent certification pipeline/);
    expect(() =>
      parseCertificationRegistration(
        validRegistration({ reportRef: "x".repeat(501) }),
      ),
    ).toThrow();
    expect(() =>
      parseCertificationRegistration(
        validRegistration({ datasetFingerprint: "unverified-dataset" }),
      ),
    ).toThrow();
    expect(() =>
      parseCertificationRegistration(
        validRegistration({ reportRef: "reports/unbound.json" }),
      ),
    ).toThrow();
    expect(() =>
      parseCertificationRegistration(
        validRegistration({ evaluatedAt: "2099-01-01T00:00:00.000Z" }),
      ),
    ).toThrow();
    const { deploymentFingerprint: _omitted, ...missingFingerprint } =
      validRegistration();
    expect(() => parseCertificationRegistration(missingFingerprint)).toThrow();
  });

  it("audits certification registration and requalification attempts", () => {
    const registerAudit = routeHandlers("/certification/register").find(
      (handler) => handler?.auditOperation === "create",
    );
    const requalifyAudit = routeHandlers("/certification/requalify").find(
      (handler) => handler?.auditOperation === "update",
    );
    expect(registerAudit?.auditEntityType).toBe("ai_certification");
    expect(requalifyAudit?.auditEntityType).toBe("ai_certification");
    expect(registerAudit?.auditRequired).toBe(true);
    expect(requalifyAudit?.auditRequired).toBe(true);
    expect(routeHandlers("/certification/register")[0]).toBe(registerAudit);
    expect(routeHandlers("/certification/requalify")[0]).toBe(requalifyAudit);
  });
});
