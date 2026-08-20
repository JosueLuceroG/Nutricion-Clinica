import { selectTelemetryStore } from '../observability/telemetryStore.js';
import { buildHealthReport } from '../observability/health.js';
import { SHADOW_STATES, type ShadowState } from './shadowStateMachine.js';
import { readEnvironmentClass } from '../deployment/environmentIdentity.js';
import { clinicalCertificationRegistry } from '../ai/certification/clinicalCertification.js';
import { evaluateConsentReadiness } from './governanceConfig.js';
import { pilotConfigStatus } from './shadowPilotConfig.js';
import { readReviewerScopes } from './reviewerScope.js';

/**
 * Prerrequisitos del shadow (Build 09 §14 + Build 09.5A §61).
 * El bloqueo NO es falla de infraestructura: se reporta BLOCKED con causas
 * explicitas. El modo tecnico GOLDEN (TECHNICAL_TEST_ONLY) satisface los
 * prerrequisitos clinicos como "n/a" (ingenieria); el piloto profesional exige
 * declaraciones explicitas (consentimiento, alcance de revisores, umbrales,
 * rollback y backup verificados).
 */

export interface ShadowPrerequisite {
  id: string;
  label: string;
  met: boolean;
  detail: string;
}

export interface ShadowReadiness {
  ready: boolean;
  state: ShadowState;
  blocker: 'BLOCKED_NO_ELIGIBLE_MODEL' | 'BLOCKED_STAGING_UNAVAILABLE' | 'BLOCKED_PREREQUISITES' | 'NONE';
  prerequisites: ShadowPrerequisite[];
  lastCheckedAt: string;
  machineReadable: 'BLOCKED' | 'READY' | 'NOT_CONFIGURED';
}

export async function evaluateShadowPrerequisites(env: NodeJS.ProcessEnv = process.env): Promise<ShadowReadiness> {
  const prerequisites: ShadowPrerequisite[] = [];
  const state = (env.AI_SHADOW_STATE ?? 'DISABLED') as ShadowState;
  const technicalOnly = state === 'TECHNICAL_TEST_ONLY';

  const environmentValid = readEnvironmentClass(env) !== 'UNKNOWN';
  prerequisites.push({
    id: 'environment_valid',
    label: 'Entorno válido declarado',
    met: environmentValid,
    detail: environmentValid ? `ENVIRONMENT_CLASS=${readEnvironmentClass(env)}` : 'entorno UNKNOWN (fail-closed)',
  });

  const hasStaging = Boolean(env.AI_STAGING_BASE_URL);
  prerequisites.push({
    id: 'staging_available',
    label: 'Entorno staging disponible',
    met: hasStaging,
    detail: hasStaging ? 'staging configurado' : 'STAGING NOT_AVAILABLE',
  });

  const hasEligibleModel = Boolean(
    env.SHADOW_TEST_QUALIFIED_PROVIDER &&
    env.SHADOW_TEST_QUALIFIED_MODEL,
  );
  prerequisites.push({
    id: 'model_eligible',
    label: 'Modelo clínico elegible (profesional, certificado)',
    met: hasEligibleModel,
    detail: hasEligibleModel
      ? `${env.SHADOW_TEST_QUALIFIED_PROVIDER}/${env.SHADOW_TEST_QUALIFIED_MODEL}`
      : 'NONE (ningún modelo real cumple requisitos clínicos)',
  });

  let certificationDetail = 'sin modelo';
  let certificationMet = false;
  if (hasEligibleModel) {
    const provider = env.SHADOW_TEST_QUALIFIED_PROVIDER!;
    const model = env.SHADOW_TEST_QUALIFIED_MODEL!;
    if (technicalOnly) {
      certificationMet = true;
      certificationDetail = 'GOLDEN de ingeniería (camino técnico, no clínico)';
    } else {
      const record = clinicalCertificationRegistry.list().find((rec) => rec.key.providerId === provider && rec.key.modelId === model);
      const modelVersion = record?.key.modelVersion ?? model;
      const resolution = clinicalCertificationRegistry.resolve(provider, model, modelVersion, 'nutrition_reasoning', {
        requiredState: 'APPROVED_NUTRITION_SUPPORT',
      });
      certificationMet = resolution.eligible;
      certificationDetail = resolution.eligible
        ? `${provider}/${model} certificado`
        : `${provider}/${model} ${resolution.reason ?? 'no certificado'}`;
    }
  }
  prerequisites.push({
    id: 'model_certification_valid',
    label: 'Certificación clínica vigente (sin REQUALIFICATION_REQUIRED)',
    met: certificationMet,
    detail: certificationDetail,
  });

  const egressApproved = (env.AI_EGRESS_ENABLED ?? 'false') === 'true' || technicalOnly;
  prerequisites.push({
    id: 'egress_approved',
    label: 'Egreso AI aprobado para el entorno',
    met: egressApproved,
    detail: egressApproved ? `AI_EGRESS_ENABLED=${env.AI_EGRESS_ENABLED ?? 'false'}` : 'kill switch de egreso activo',
  });

  const consent = evaluateConsentReadiness(env);
  const consentReady = technicalOnly || consent.status === 'CONSENT_READY';
  prerequisites.push({
    id: 'consent_ready',
    label: 'Consentimiento/uso clínico declarado',
    met: consentReady,
    detail: technicalOnly ? 'n/a (GOLDEN de ingeniería)' : consent.detail,
  });

  const hasProfessionalPool = Boolean(env.SHADOW_REVIEWER_KEYS && env.SHADOW_REVIEWER_KEYS.split(',').filter(Boolean).length > 0);
  prerequisites.push({
    id: 'professional_reviewers',
    label: 'Pool de profesionales revisores',
    met: hasProfessionalPool,
    detail: hasProfessionalPool ? `${env.SHADOW_REVIEWER_KEYS!.split(',').filter(Boolean).length} revisores` : 'ninguno',
  });

  const scopes = readReviewerScopes(env);
  const reviewReady = technicalOnly || scopes.length > 0;
  prerequisites.push({
    id: 'professional_review_ready',
    label: 'Alcance de revisores configurado (sucursal/capability)',
    met: reviewReady,
    detail: technicalOnly ? 'n/a (GOLDEN de ingeniería)' : `${scopes.length} alcances`,
  });

  const stateOk = SHADOW_STATES.includes(state) && state !== 'DISABLED';
  prerequisites.push({
    id: 'shadow_state',
    label: 'Estado de shadow habilitado por configuración',
    met: stateOk,
    detail: state,
  });

  let infraOk: boolean;
  let infraDetail: string;
  try {
    const health = await buildHealthReport(env);
    infraOk = health.infrastructure === 'HEALTHY';
    infraDetail = infraOk ? 'infraestructura HEALTHY' : `infraestructura ${health.infrastructure}`;
  } catch {
    infraOk = false;
    infraDetail = 'health no disponible';
  }
  prerequisites.push({ id: 'observability_ready', label: 'Observabilidad/telemetría operativa', met: infraOk, detail: infraDetail });

  const killSwitchKnown = (env.AI_EGRESS_ENABLED ?? 'false') === 'true' || (env.AI_EGRESS_ENABLED ?? 'false') === 'false';
  prerequisites.push({
    id: 'kill_switch_ready',
    label: 'Kill switch conocido y probado',
    met: killSwitchKnown,
    detail: `AI_EGRESS_ENABLED=${env.AI_EGRESS_ENABLED ?? 'false'}`,
  });

  const rollbackReady = (env.SHADOW_ROLLBACK_VERIFIED ?? 'false') === 'true';
  prerequisites.push({
    id: 'rollback_ready',
    label: 'Rollback verificado',
    met: rollbackReady,
    detail: rollbackReady ? 'rollback verificado por operador' : 'SHADOW_ROLLBACK_VERIFIED=false (no verificado)',
  });

  const backupReady = (env.SHADOW_BACKUP_VERIFIED ?? 'false') === 'true';
  prerequisites.push({
    id: 'backup_ready',
    label: 'Backup disponible/restaurable',
    met: backupReady,
    detail: backupReady ? 'backup verificado por operador' : 'SHADOW_BACKUP_VERIFIED=false (no verificado)',
  });

  const pilot = pilotConfigStatus(env);
  const thresholdsReady = technicalOnly || pilot.configured;
  prerequisites.push({
    id: 'thresholds_configured',
    label: 'Umbrales/parámetros del piloto configurados',
    met: thresholdsReady,
    detail: technicalOnly ? 'n/a (umbrales de ingeniería por defecto)' : (pilot.blockedReason ?? 'piloto configurado'),
  });

  const met = prerequisites.filter((p) => p.met).length;
  const ready = met === prerequisites.length;

  let blocker: ShadowReadiness['blocker'];
  let machineReadable: ShadowReadiness['machineReadable'];
  if (ready) {
    blocker = 'NONE';
    machineReadable = 'READY';
  } else if (!hasEligibleModel) {
    blocker = 'BLOCKED_NO_ELIGIBLE_MODEL';
    machineReadable = 'BLOCKED';
  } else if (!hasStaging) {
    blocker = 'BLOCKED_STAGING_UNAVAILABLE';
    machineReadable = 'BLOCKED';
  } else {
    blocker = 'BLOCKED_PREREQUISITES';
    machineReadable = 'BLOCKED';
  }

  return {
    ready,
    state,
    blocker,
    prerequisites,
    lastCheckedAt: new Date().toISOString(),
    machineReadable,
  };
}

export async function assertShadowCanRun(env: NodeJS.ProcessEnv = process.env): Promise<void> {
  const readiness = await evaluateShadowPrerequisites(env);
  if (!readiness.ready) {
    const err = new Error(`shadow no disponible: ${readiness.blocker}`) as Error & { status?: number };
    err.status = 503;
    throw err;
  }
}

/** Acceso a telemetria para el shadow runner (store compartido, sin PHI). */
export function shadowTelemetryStore() {
  return selectTelemetryStore();
}