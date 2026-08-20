import { selectTelemetryStore } from '../observability/telemetryStore.js';
import { buildHealthReport } from '../observability/health.js';
import { SHADOW_STATES, type ShadowState } from './shadowStateMachine.js';

/**
 * Prerrequisitos del shadow (Build 09 §14). TODO es evaluable y observable;
 * en este entorno la lectura honesta es BLOCKED (no hay modelo clinico elegible
 * ni staging real). La falla de prerequisitos NO es falla de infraestructura:
 * se reporta como BLOCKED con causas explicitas.
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

  const hasEligibleModel = Boolean(
    env.SHADOW_TEST_QUALIFIED_PROVIDER &&
    env.SHADOW_TEST_QUALIFIED_MODEL,
  );
  prerequisites.push({
    id: 'eligible_model',
    label: 'Modelo clinico elegible (profesional, certificado)',
    met: hasEligibleModel,
    detail: hasEligibleModel
      ? `${env.SHADOW_TEST_QUALIFIED_PROVIDER}/${env.SHADOW_TEST_QUALIFIED_MODEL}`
      : 'NONE (ningun modelo real cumple requisitos clinicos)',
  });

  const hasStaging = Boolean(env.AI_STAGING_BASE_URL);
  prerequisites.push({
    id: 'staging',
    label: 'Entorno staging disponible',
    met: hasStaging,
    detail: hasStaging ? 'staging configurado' : 'STAGING NOT_AVAILABLE',
  });

  const hasProfessionalPool = Boolean(env.SHADOW_REVIEWER_KEYS && env.SHADOW_REVIEWER_KEYS.split(',').filter(Boolean).length > 0);
  prerequisites.push({
    id: 'professional_reviewers',
    label: 'Pool de profesionales revisores',
    met: hasProfessionalPool,
    detail: hasProfessionalPool ? `${env.SHADOW_REVIEWER_KEYS!.split(',').filter(Boolean).length} revisores` : 'ninguno',
  });

  const stateOk = SHADOW_STATES.includes(state) && state !== 'DISABLED';
  prerequisites.push({
    id: 'shadow_state',
    label: 'Estado de shadow habilitado por configuracion',
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
  prerequisites.push({ id: 'infrastructure', label: 'Infraestructura sana', met: infraOk, detail: infraDetail });

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