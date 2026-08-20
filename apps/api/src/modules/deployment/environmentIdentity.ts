import { execSync } from 'node:child_process';
import { hostname } from 'node:os';

/**
 * Identidad de entorno (Build 09.5A §4-5).
 * - Clases explicitas: LOCAL | TEST | STAGING | PRODUCTION.
 * - No se infiere de NODE_ENV a secas: NODE_ENV=production sin ENVIRONMENT_CLASS
 *   explicito => UNKNOWN (fail-closed para operaciones sensibles).
 * - Dev local sin ENVIRONMENT_CLASS => LOCAL (comportamiento historico).
 */

export const ENVIRONMENT_CLASSES = ['LOCAL', 'TEST', 'STAGING', 'PRODUCTION'] as const;
export type EnvironmentClass = (typeof ENVIRONMENT_CLASSES)[number] | 'UNKNOWN';

const DEPLOYMENT_SENSITIVE_CLASSES: readonly EnvironmentClass[] = ['STAGING', 'PRODUCTION'];

export function readEnvironmentClass(env: NodeJS.ProcessEnv = process.env): EnvironmentClass {
  const raw = (env.ENVIRONMENT_CLASS ?? '').trim().toUpperCase();
  if ((ENVIRONMENT_CLASSES as readonly string[]).includes(raw)) return raw as EnvironmentClass;
  if (env.NODE_ENV === 'production') return 'UNKNOWN';
  return 'LOCAL';
}

export function isDeploymentSensitive(env: NodeJS.ProcessEnv = process.env): boolean {
  return (DEPLOYMENT_SENSITIVE_CLASSES as readonly EnvironmentClass[]).includes(readEnvironmentClass(env));
}

export function isProductionEnvironment(env: NodeJS.ProcessEnv = process.env): boolean {
  return readEnvironmentClass(env) === 'PRODUCTION';
}

export function isStagingEnvironment(env: NodeJS.ProcessEnv = process.env): boolean {
  return readEnvironmentClass(env) === 'STAGING';
}

let cachedGitCommit: string | null = null;

/** Commit actual de Git (cacheado). Sin repositorio: 'UNKNOWN' (nunca se inventa). */
export function currentGitCommit(): string {
  if (cachedGitCommit !== null) return cachedGitCommit;
  try {
    cachedGitCommit = execSync('git rev-parse HEAD', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    cachedGitCommit = 'UNKNOWN';
  }
  return cachedGitCommit;
}

export interface EnvironmentIdentity {
  environmentName: string;
  environmentClass: EnvironmentClass;
  instanceId: string;
  deploymentId: string;
  releaseVersion: string;
  gitCommit: string;
  databaseTarget: string;
  dwhTarget: string;
  aiEnabled: boolean;
  shadowAllowed: boolean;
  patientAiAllowed: boolean;
  production: boolean;
}

/** Identidad maquina-readable del entorno. Nunca incluye secretos. */
export function buildEnvironmentIdentity(env: NodeJS.ProcessEnv = process.env): EnvironmentIdentity {
  const environmentClass = readEnvironmentClass(env);
  const instanceId = (env.INSTANCE_ID ?? env.DEPLOYMENT_ID ?? `host-${hostname()}`).trim();
  return {
    environmentName: (env.ENVIRONMENT_NAME ?? `${environmentClass.toLowerCase()}-default`).trim(),
    environmentClass,
    instanceId,
    deploymentId: (env.DEPLOYMENT_ID ?? instanceId).trim(),
    releaseVersion: (env.RELEASE_VERSION ?? '0.0.0-dev').trim(),
    gitCommit: (env.GIT_COMMIT ?? currentGitCommit()).trim(),
    databaseTarget: (env.DB_NAME ?? 'nutriclinica').trim(),
    dwhTarget: (env.DWH_DATABASE ?? 'nutriclinicadw').trim(),
    aiEnabled: (env.AI_EGRESS_ENABLED ?? 'false') === 'true',
    shadowAllowed: environmentClass !== 'PRODUCTION' && (env.AI_SHADOW_STATE ?? 'DISABLED') !== 'DISABLED',
    patientAiAllowed: (env.AI_PATIENT_ENABLED ?? 'false') === 'true',
    production: environmentClass === 'PRODUCTION',
  };
}

/** Entorno desconocido o clase invalida: fail-closed para operaciones de despliegue. */
export function assertEnvironmentKnown(env: NodeJS.ProcessEnv = process.env, action: string): void {
  const environmentClass = readEnvironmentClass(env);
  if (environmentClass === 'UNKNOWN') {
    throw new Error(`entorno UNKNOWN (ENVIRONMENT_CLASS ausente o invalido con NODE_ENV=production): '${action}' fail-closed`);
  }
}