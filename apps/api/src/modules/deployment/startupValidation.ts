import { assertDwhDatabaseSeparate } from '../dwh/config.js';
import { readEnvironmentClass } from './environmentIdentity.js';
import { DEFAULT_OLTP_DB, DEFAULT_DWH_DB } from './targetGuard.js';
import { SHADOW_STATES } from '../shadow/shadowStateMachine.js';

/**
 * Validación central de arranque (Build 09.5A §16-18, §35-38, §73).
 * Fail-fast: cualquier issue 'error' impide el arranque del servidor.
 * En STAGING/PRODUCTION el entorno debe declararse explícitamente y no
 * apuntar a bases locales por defecto; CORS no puede ser comodín.
 */

export interface StartupIssue {
  group: string;
  severity: 'error' | 'warning';
  message: string;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean | null {
  if (value === undefined || value.trim() === '') return fallback;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return null;
}

function parseNumberInRange(value: string | undefined, min: number, max: number, label: string, issues: StartupIssue[]): void {
  if (value === undefined || value.trim() === '') return;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    issues.push({ group: 'config', severity: 'error', message: `${label}: se esperaba número entre ${min} y ${max}, recibido '${value}'` });
  }
}

export interface StartupValidationDeps {
  ai?: {
    validate: (env: NodeJS.ProcessEnv) => { severity: 'error' | 'warning'; message: string }[];
  };
}

export function validateStartupConfig(
  env: NodeJS.ProcessEnv = process.env,
  deps: StartupValidationDeps = {},
): StartupIssue[] {
  const issues: StartupIssue[] = [];
  const environmentClass = readEnvironmentClass(env);

  if (environmentClass === 'UNKNOWN') {
    issues.push({
      group: 'environment',
      severity: 'error',
      message: 'ENVIRONMENT_CLASS ausente/inválido con NODE_ENV=production: arranque fail-closed',
    });
  }

  if (environmentClass === 'STAGING' || environmentClass === 'PRODUCTION') {
    const oltp = (env.DB_NAME ?? '').trim().toLowerCase();
    const dwh = (env.DWH_DATABASE ?? '').trim().toLowerCase();
    if (!oltp || !dwh) {
      issues.push({ group: 'environment', severity: 'error', message: 'STAGING/PRODUCTION requieren DB_NAME y DWH_DATABASE explícitos' });
    } else {
      if (oltp === DEFAULT_OLTP_DB || dwh === DEFAULT_DWH_DB) {
        issues.push({
          group: 'environment',
          severity: 'error',
          message: `STAGING/PRODUCTION no pueden apuntar a las bases por defecto locales ('${oltp}'/'${dwh}')`,
        });
      }
      if (oltp === dwh) {
        issues.push({ group: 'environment', severity: 'error', message: `OLTP y DWH no pueden ser la misma base ('${oltp}')` });
      }
    }
    const origins = (env.CORS_ORIGIN ?? '').split(',').map((o) => o.trim()).filter(Boolean);
    if (origins.some((o) => o === '*' || o.includes('*'))) {
      issues.push({ group: 'config', severity: 'error', message: 'CORS_ORIGIN con comodín (*) prohibido en STAGING/PRODUCTION' });
    }
  }

  if (environmentClass === 'PRODUCTION') {
    const trusted = env.DB_TRUSTED === 'true';
    const usesDefaultPassword = !trusted && (env.DB_PASSWORD === undefined || env.DB_PASSWORD === '');
    if (usesDefaultPassword) {
      issues.push({ group: 'database', severity: 'error', message: 'PRODUCTION no puede usar contraseña vacía por defecto' });
    }
  }

  const dwhEnabled = (env.DWH_ENABLED ?? 'false') === 'true';
  if (dwhEnabled) {
    try {
      assertDwhDatabaseSeparate(env);
    } catch (err) {
      issues.push({ group: 'dwh', severity: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  }

  const egress = parseBoolean(env.AI_EGRESS_ENABLED, false);
  if (egress === null) {
    issues.push({ group: 'ai', severity: 'error', message: `AI_EGRESS_ENABLED debe ser true/false, recibido '${env.AI_EGRESS_ENABLED}'` });
  }
  const patientAi = parseBoolean(env.AI_PATIENT_ENABLED, false);
  if (patientAi === null) {
    issues.push({ group: 'ai', severity: 'error', message: `AI_PATIENT_ENABLED debe ser true/false, recibido '${env.AI_PATIENT_ENABLED}'` });
  }
  if (patientAi === true) {
    issues.push({ group: 'ai', severity: 'warning', message: 'AI_PATIENT_ENABLED=true: el gate clínico sigue bloqueado hasta release gate' });
  }

  const shadowState = (env.AI_SHADOW_STATE ?? 'DISABLED').trim();
  if (!SHADOW_STATES.includes(shadowState as never)) {
    issues.push({ group: 'shadow', severity: 'error', message: `AI_SHADOW_STATE inválido: '${shadowState}'` });
  }
  parseNumberInRange(env.AI_SHADOW_SAMPLE_RATE, 0, 1, 'AI_SHADOW_SAMPLE_RATE', issues);
  parseNumberInRange(env.AI_TELEMETRY_PERCENTILE_MIN_SAMPLES, 1, 100000, 'AI_TELEMETRY_PERCENTILE_MIN_SAMPLES', issues);

  const telemetryStore = (env.AI_TELEMETRY_STORE ?? 'memory').trim();
  if (telemetryStore !== 'memory' && telemetryStore !== 'sql') {
    issues.push({ group: 'observability', severity: 'error', message: `AI_TELEMETRY_STORE inválido: '${telemetryStore}'` });
  }

  const certificationStore = (env.AI_CERTIFICATION_STORE ?? 'memory').trim();
  if (certificationStore !== 'memory' && certificationStore !== 'sql') {
    issues.push({ group: 'certification', severity: 'error', message: `AI_CERTIFICATION_STORE inválido: '${certificationStore}'` });
  }

  if (deps.ai) {
    for (const issue of deps.ai.validate(env)) {
      issues.push({ group: 'ai', severity: issue.severity, message: issue.message });
    }
  }

  return issues;
}

export function assertStartupConfigValid(env: NodeJS.ProcessEnv = process.env, deps: StartupValidationDeps = {}): void {
  const issues = validateStartupConfig(env, deps);
  const errors = issues.filter((issue) => issue.severity === 'error');
  if (errors.length > 0) {
    throw new Error(`configuración de arranque inválida (fail-fast):\n${errors.map((e) => `- [${e.group}] ${e.message}`).join('\n')}`);
  }
  for (const warning of issues.filter((issue) => issue.severity === 'warning')) {
    console.warn(`[startup-config] ${warning.message}`);
  }
}