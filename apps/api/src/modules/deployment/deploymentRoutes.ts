import { Router as ExpressRouter, type Router, type Request, type Response, type NextFunction } from 'express';
import { requireAuth } from '../auth/middleware/requireAuth.js';
import { requireTelemetryRole } from '../observability/accessControl.js';
import { buildEnvironmentIdentity, readEnvironmentClass } from './environmentIdentity.js';
import { buildDeploymentManifest } from './deploymentManifest.js';
import { evaluatePreDeployGate, scanTrackedSecrets, worktreeIsClean } from './preDeployGate.js';
import { evaluateReleaseGate } from './releaseGate.js';
import { readFeatureFlags, effectiveFeatureFlags } from './featureFlags.js';
import { evaluateShadowPrerequisites } from '../shadow/shadowPrerequisites.js';
import { readShadowPilotConfig, pilotConfigStatus } from '../shadow/shadowPilotConfig.js';
import { readGovernanceConfig, evaluateConsentReadiness } from '../shadow/governanceConfig.js';
import { clinicalCertificationRegistry } from '../ai/certification/clinicalCertification.js';
import { persistRequalificationFlag, persistCertificationRecord, type RequalificationFlag } from '../ai/certification/certificationPersistence.js';
import { CURRENT_VERSIONS } from '../ai/certification/versions.js';
import type { AIModelCapability } from '../ai/evaluation/capabilities.js';

/**
 * Rutas de despliegue (Build 09.5A §43-44, §54-57).
 * Solo roles admin/auditor/soporte_tecnico. NUNCA se aprueban modelos aquí:
 * la única mutación soportada es marcar REQUALIFICATION_REQUIRED (bloqueo) y
 * registrar certificaciones con evidencia de evaluación (onboarding auditado).
 */

const router: Router = ExpressRouter();

router.use(requireAuth);

function roleGate(req: Request): void {
  requireTelemetryRole(req.user?.rol ?? '');
}

router.get('/identity', (req: Request, res: Response, next: NextFunction) => {
  try {
    roleGate(req);
    res.json({ identity: buildEnvironmentIdentity() });
  } catch (err) { next(err); }
});

router.get('/manifest', (req: Request, res: Response, next: NextFunction) => {
  try {
    roleGate(req);
    res.json({ manifest: buildDeploymentManifest() });
  } catch (err) { next(err); }
});

router.get('/predeploy', (req: Request, res: Response, next: NextFunction) => {
  try {
    roleGate(req);
    res.json({ gate: evaluatePreDeployGate() });
  } catch (err) { next(err); }
});

router.get('/release-gate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    roleGate(req);
    res.json({ gate: await evaluateReleaseGate() });
  } catch (err) { next(err); }
});

router.get('/flags', (req: Request, res: Response, next: NextFunction) => {
  try {
    roleGate(req);
    const env = process.env;
    res.json({
      flags: readFeatureFlags(env),
      effective: effectiveFeatureFlags(env),
    });
  } catch (err) { next(err); }
});

router.get('/readiness', async (req: Request, res: Response, next: NextFunction) => {
  try {
    roleGate(req);
    const environmentClass = readEnvironmentClass();
    const shadow = await evaluateShadowPrerequisites();
    const pilot = readShadowPilotConfig();
    const consent = evaluateConsentReadiness();
    const governance = readGovernanceConfig();
    res.json({
      environmentClass,
      staging: environmentClass === 'STAGING' ? 'AVAILABLE' : 'NOT_AVAILABLE',
      shadow: {
        machineReadable: shadow.machineReadable,
        blocker: shadow.blocker,
        prerequisites: shadow.prerequisites,
      },
      pilot: { configured: pilot.configured, status: pilotConfigStatus() },
      consent,
      governance: { configured: governance.configured },
      certificationStore: (process.env.AI_CERTIFICATION_STORE ?? 'memory'),
      secretScan: scanTrackedSecrets(),
      worktreeClean: worktreeIsClean(),
    });
  } catch (err) { next(err); }
});

router.get('/certification', (req: Request, res: Response, next: NextFunction) => {
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
      requalificationFlags: clinicalCertificationRegistry.listRequalificationFlags(),
    });
  } catch (err) { next(err); }
});

const VALID_CAPABILITIES: readonly AIModelCapability[] = [
  'chat_general', 'structured_json', 'nutrition_reasoning', 'patient_support',
];

/** Solo BLOQUEO: marca REQUALIFICATION_REQUIRED (nunca aprueba). */
router.post('/certification/requalify', async (req: Request, res: Response, next: NextFunction) => {
  try {
    roleGate(req);
    if (req.user?.rol !== 'admin') {
      const err = new Error('solo admin puede marcar requalificación') as Error & { status?: number };
      err.status = 403;
      throw err;
    }
    const { providerId, modelId, capabilityId } = (req.body ?? {}) as { providerId?: string; modelId?: string; capabilityId?: string };
    if (!providerId || !modelId || !capabilityId || !VALID_CAPABILITIES.includes(capabilityId as AIModelCapability)) {
      const err = new Error('requerido: providerId, modelId, capabilityId válidos') as Error & { status?: number };
      err.status = 400;
      throw err;
    }
    const flag: RequalificationFlag = {
      providerId: String(providerId).trim(),
      modelId: String(modelId).trim(),
      capabilityId: capabilityId as AIModelCapability,
      reasonRef: `marcada por operador ${req.user?.email ?? 'unknown'} ${new Date().toISOString()}`,
    };
    await persistRequalificationFlag(flag);
    res.json({ marked: true, flag: { providerId: flag.providerId, modelId: flag.modelId, capabilityId: flag.capabilityId } });
  } catch (err) { next(err); }
});

/** Onboarding auditado con evidencia (nunca un "approve" temporal manual). */
router.post('/certification/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    roleGate(req);
    if (req.user?.rol !== 'admin') {
      const err = new Error('solo admin puede registrar certificaciones') as Error & { status?: number };
      err.status = 403;
      throw err;
    }
    const body = (req.body ?? {}) as {
      certificationId?: string;
      providerId?: string;
      modelId?: string;
      modelVersion?: string;
      capabilityId?: string;
      state?: string;
      evaluatedAt?: string;
      datasetFingerprint?: string;
      reportRef?: string;
      deploymentFingerprint?: string;
    };
    const {
      certificationId, providerId, modelId, modelVersion, capabilityId, state,
      evaluatedAt, datasetFingerprint, reportRef, deploymentFingerprint,
    } = body;
    if (!certificationId || !providerId || !modelId || !modelVersion || !capabilityId
        || !VALID_CAPABILITIES.includes(capabilityId as AIModelCapability)
        || !state || !evaluatedAt || !datasetFingerprint || !reportRef) {
      const err = new Error('registro incompleto: certificationId, providerId, modelId, modelVersion, capabilityId, state, evaluatedAt, datasetFingerprint, reportRef requeridos') as Error & { status?: number };
      err.status = 400;
      throw err;
    }
    const key = {
      providerId: String(providerId).trim(),
      modelId: String(modelId).trim(),
      modelVersion: String(modelVersion).trim(),
      capabilityId: capabilityId as AIModelCapability,
      promptVersion: CURRENT_VERSIONS.promptVersion[capabilityId as AIModelCapability],
      toolsetVersion: CURRENT_VERSIONS.toolsetVersion,
      policyVersion: CURRENT_VERSIONS.policyVersion,
      outputSchemaVersion: CURRENT_VERSIONS.outputSchemaVersion[capabilityId as AIModelCapability],
      evaluationDatasetVersion: CURRENT_VERSIONS.evaluationDatasetVersion,
      knowledgePolicyVersion: CURRENT_VERSIONS.knowledgePolicyVersion,
      retrievalPolicyVersion: CURRENT_VERSIONS.retrievalPolicyVersion,
      smaeCatalogVersion: CURRENT_VERSIONS.smaeCatalogVersion,
      deploymentFingerprint: deploymentFingerprint?.trim() || undefined,
    };
    const record = {
      certificationId: String(certificationId).trim(),
      key,
      state: state as never,
      evaluatedAt: String(evaluatedAt),
      datasetFingerprint: String(datasetFingerprint).trim(),
      reportRef: String(reportRef).trim(),
    };
    await persistCertificationRecord(record);
    res.json({ registered: true, certificationId: record.certificationId });
  } catch (err) { next(err); }
});

export default router;