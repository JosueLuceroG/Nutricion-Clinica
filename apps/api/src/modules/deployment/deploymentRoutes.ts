import {
  Router as ExpressRouter,
  type Router,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { createHash } from "node:crypto";
import { z } from "zod";
import { requireAuth } from "../auth/middleware/requireAuth.js";
import { requiredAuditLog } from "../../middleware/auditMiddleware.js";
import { requireTelemetryRole } from "../observability/accessControl.js";
import {
  buildEnvironmentIdentity,
  readEnvironmentClass,
} from "./environmentIdentity.js";
import { buildDeploymentManifest } from "./deploymentManifest.js";
import { evaluatePreDeployGate } from "./preDeployGate.js";
import { evaluateReleaseGate } from "./releaseGate.js";
import { readFeatureFlags, effectiveFeatureFlags } from "./featureFlags.js";
import { evaluateShadowPrerequisites } from "../shadow/shadowPrerequisites.js";
import {
  readShadowPilotConfig,
  pilotConfigStatus,
} from "../shadow/shadowPilotConfig.js";
import {
  readGovernanceConfig,
  evaluateConsentReadiness,
} from "../shadow/governanceConfig.js";
import { clinicalCertificationRegistry } from "../ai/certification/clinicalCertification.js";
import {
  persistRequalificationFlag,
  persistCertificationRecord,
  type RequalificationFlag,
} from "../ai/certification/certificationPersistence.js";
import { CURRENT_VERSIONS } from "../ai/certification/versions.js";
import type { AIModelCapability } from "../ai/evaluation/capabilities.js";
import { CERTIFICATION_STATES } from "../ai/certification/certificationStates.js";
import { GOLDEN_DATASET_V1_FINGERPRINT } from "../ai/evaluation/certification.js";
import { readStagingAvailability } from "./stagingAvailability.js";
import {
  modelRegistry,
  resolvedModelVersion,
} from "../ai/models/modelRegistry.js";

/**
 * Rutas de despliegue (Build 09.5A §43-44, §54-57).
 * Solo roles admin/auditor/soporte_tecnico. NUNCA se aprueban modelos aquí:
 * se puede marcar REQUALIFICATION_REQUIRED y registrar únicamente resultados
 * no aprobados. La aprobación exige un pipeline de evidencia independiente.
 */

const router: Router = ExpressRouter();

router.use(requireAuth);

function roleGate(req: Request): void {
  requireTelemetryRole(req.user?.rol ?? "");
}

router.get("/identity", (req: Request, res: Response, next: NextFunction) => {
  try {
    roleGate(req);
    res.json({ identity: buildEnvironmentIdentity() });
  } catch (err) {
    next(err);
  }
});

router.get("/manifest", (req: Request, res: Response, next: NextFunction) => {
  try {
    roleGate(req);
    res.json({ manifest: buildDeploymentManifest() });
  } catch (err) {
    next(err);
  }
});

router.get("/predeploy", (req: Request, res: Response, next: NextFunction) => {
  try {
    roleGate(req);
    res.json({ gate: evaluatePreDeployGate() });
  } catch (err) {
    next(err);
  }
});

router.get(
  "/release-gate",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      roleGate(req);
      res.json({ gate: await evaluateReleaseGate() });
    } catch (err) {
      next(err);
    }
  },
);

router.get("/flags", (req: Request, res: Response, next: NextFunction) => {
  try {
    roleGate(req);
    const env = process.env;
    res.json({
      flags: readFeatureFlags(env),
      effective: effectiveFeatureFlags(env),
    });
  } catch (err) {
    next(err);
  }
});

router.get(
  "/readiness",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      roleGate(req);
      const environmentClass = readEnvironmentClass();
      const staging = readStagingAvailability();
      const shadow = await evaluateShadowPrerequisites();
      const pilot = readShadowPilotConfig();
      const consent = evaluateConsentReadiness();
      const governance = readGovernanceConfig();
      const predeploy = evaluatePreDeployGate();
      res.json({
        environmentClass,
        staging: staging.status,
        stagingIdentityDeclared: staging.identityDeclared,
        stagingEvidenceId: staging.evidenceId,
        stagingEvidenceCommit: staging.evidenceCommit,
        shadow: {
          machineReadable: shadow.machineReadable,
          blocker: shadow.blocker,
          prerequisites: shadow.prerequisites,
        },
        pilot: { configured: pilot.configured, status: pilotConfigStatus() },
        consent,
        governance: { configured: governance.configured },
        certificationStore: process.env.AI_CERTIFICATION_STORE ?? "memory",
        secretScan: predeploy.checks.find(
          (check) => check.id === "secret_scan",
        ),
        sourceIdentity: predeploy.checks.find(
          (check) => check.id === "worktree_clean",
        ),
      });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/certification",
  (req: Request, res: Response, next: NextFunction) => {
    try {
      roleGate(req);
      res.json({
        records: clinicalCertificationRegistry.list().map((record) => ({
          certificationId: record.certificationId,
          providerId: record.key.providerId,
          modelId: record.key.modelId,
          capabilityId: record.key.capabilityId,
          state: record.state,
          deploymentFingerprint: record.key.deploymentFingerprint ?? null,
          evaluatedAt: record.evaluatedAt,
        })),
        requalificationFlags:
          clinicalCertificationRegistry.listRequalificationFlags(),
      });
    } catch (err) {
      next(err);
    }
  },
);

const VALID_CAPABILITIES = [
  "chat_general",
  "structured_json",
  "nutrition_reasoning",
  "patient_support",
] as const satisfies readonly AIModelCapability[];

function certificationAuditReference(req: Request): string | undefined {
  const body = req.body as Record<string, unknown> | null | undefined;
  if (!body) return undefined;
  const evidence = {
    certificationId: body.certificationId ?? null,
    providerId: body.providerId ?? null,
    modelId: body.modelId ?? null,
    modelVersion: body.modelVersion ?? null,
    capabilityId: body.capabilityId ?? null,
    state: body.state ?? null,
    evaluatedAt: body.evaluatedAt ?? null,
    datasetFingerprint: body.datasetFingerprint ?? null,
    reportRef: body.reportRef ?? null,
    deploymentFingerprint: body.deploymentFingerprint ?? null,
  };
  return `sha256:${createHash("sha256").update(JSON.stringify(evidence)).digest("hex")}`;
}

const RequalificationSchema = z
  .object({
    providerId: z.string().trim().toLowerCase().min(1).max(50),
    modelId: z.string().trim().min(1).max(100),
    capabilityId: z.enum(VALID_CAPABILITIES),
  })
  .strict();

const CertificationRegistrationSchema = z
  .object({
    certificationId: z.string().trim().min(1).max(200),
    providerId: z.string().trim().toLowerCase().min(1).max(50),
    modelId: z.string().trim().min(1).max(100),
    modelVersion: z.string().trim().min(1).max(50),
    capabilityId: z.enum(VALID_CAPABILITIES),
    state: z.enum(CERTIFICATION_STATES),
    evaluatedAt: z
      .string()
      .datetime({ offset: true })
      .transform((value) => new Date(value).toISOString())
      .refine((value) => Date.parse(value) <= Date.now(), {
        message: "evaluatedAt cannot be in the future",
      }),
    datasetFingerprint: z
      .string()
      .trim()
      .refine((value) => value === GOLDEN_DATASET_V1_FINGERPRINT, {
        message: "datasetFingerprint must match the current golden dataset",
      }),
    reportRef: z
      .string()
      .trim()
      .max(500)
      .regex(
        /^[A-Za-z0-9][A-Za-z0-9._/:+-]{4,399}@sha256:[0-9a-f]{64}$/i,
        "reportRef must be bound to an immutable sha256 digest",
      ),
    deploymentFingerprint: z
      .string()
      .trim()
      .regex(/^deploy-[0-9a-f]{8}$/i),
  })
  .strict()
  .refine((value) => !value.state.startsWith("APPROVED_"), {
    path: ["state"],
    message: "approved states require the independent certification pipeline",
  });

export function parseCertificationRegistration(input: unknown) {
  return CertificationRegistrationSchema.parse(input);
}

function assertCanonicalModelIdentity(
  providerId: string,
  modelId: string,
  modelVersion?: string,
): void {
  modelRegistry.syncFromEnv(process.env);
  const model = modelRegistry.get(modelId);
  if (
    !model ||
    model.provider !== providerId ||
    (modelVersion !== undefined && resolvedModelVersion(model) !== modelVersion)
  ) {
    const err = new Error("modelo o versión no registrados") as Error & {
      status?: number;
    };
    err.status = 400;
    throw err;
  }
}

/** Solo BLOQUEO: marca REQUALIFICATION_REQUIRED (nunca aprueba). */
router.post(
  "/certification/requalify",
  requiredAuditLog(
    "update",
    "ai_certification",
    undefined,
    certificationAuditReference,
  ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      roleGate(req);
      if (req.user?.rol !== "admin") {
        const err = new Error(
          "solo admin puede marcar requalificación",
        ) as Error & { status?: number };
        err.status = 403;
        throw err;
      }
      const { providerId, modelId, capabilityId } = RequalificationSchema.parse(
        req.body,
      );
      assertCanonicalModelIdentity(providerId, modelId);
      const flag: RequalificationFlag = {
        providerId,
        modelId,
        capabilityId,
        reasonRef: `marcada por operador ${req.user?.sub ?? "unknown"} ${new Date().toISOString()}`,
      };
      await persistRequalificationFlag(flag);
      res.json({
        marked: true,
        flag: {
          providerId: flag.providerId,
          modelId: flag.modelId,
          capabilityId: flag.capabilityId,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

/** Registra evidencia no aprobada; los estados APPROVED_* no se aceptan por HTTP. */
router.post(
  "/certification/register",
  requiredAuditLog(
    "create",
    "ai_certification",
    undefined,
    certificationAuditReference,
  ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      roleGate(req);
      if (req.user?.rol !== "admin") {
        const err = new Error(
          "solo admin puede registrar certificaciones",
        ) as Error & { status?: number };
        err.status = 403;
        throw err;
      }
      const body = parseCertificationRegistration(req.body);
      const {
        certificationId,
        providerId,
        modelId,
        modelVersion,
        capabilityId,
        state,
        evaluatedAt,
        datasetFingerprint,
        reportRef,
        deploymentFingerprint,
      } = body;
      assertCanonicalModelIdentity(providerId, modelId, modelVersion);
      const key = {
        providerId,
        modelId,
        modelVersion,
        capabilityId,
        promptVersion: CURRENT_VERSIONS.promptVersion[capabilityId],
        toolsetVersion: CURRENT_VERSIONS.toolsetVersion,
        policyVersion: CURRENT_VERSIONS.policyVersion,
        outputSchemaVersion: CURRENT_VERSIONS.outputSchemaVersion[capabilityId],
        evaluationDatasetVersion: CURRENT_VERSIONS.evaluationDatasetVersion,
        knowledgePolicyVersion: CURRENT_VERSIONS.knowledgePolicyVersion,
        retrievalPolicyVersion: CURRENT_VERSIONS.retrievalPolicyVersion,
        smaeCatalogVersion: CURRENT_VERSIONS.smaeCatalogVersion,
        deploymentFingerprint,
      };
      const record = {
        certificationId,
        key,
        state,
        evaluatedAt,
        datasetFingerprint,
        reportRef,
      };
      await persistCertificationRecord(record);
      res.json({ registered: true, certificationId: record.certificationId });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
