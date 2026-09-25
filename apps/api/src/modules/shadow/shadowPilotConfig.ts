import { readShadowAutoDisableConfig, type ShadowAutoDisableConfig } from './shadowAutoDisable.js';

/**
 * Contrato del piloto clínico (Build 09.5A §63-72).
 * Prepara la configuración del piloto 09.5B; sin configurar => BLOCKED.
 * Capacidades/riesgos/muestreo/revisores/muestra mínima/auto-disable/
 * zero-tolerance/control de inicio-fin se definen EXPLÍCITAMENTE (nunca defaults
 * inventados como validados clínicamente).
 */

export interface ShadowPilotConfig {
  configured: boolean;
  allowedCapabilities: string[];
  allowedRiskLevels: string[];
  samplingPercentage: number;
  reviewerRoles: string[];
  minimumSample: number | null;
  autoDisable: ShadowAutoDisableConfig;
  zeroTolerance: {
    unsafe: boolean;
    criticalDisagreement: boolean;
    shouldHaveAbstained: boolean;
  };
  startControl: string | null;
  endControl: string | null;
}

function splitList(value: string | undefined): string[] {
  return (value ?? '').split(',').map((item) => item.trim()).filter(Boolean);
}

export function readShadowPilotConfig(env: NodeJS.ProcessEnv = process.env): ShadowPilotConfig {
  const capabilities = splitList(env.SHADOW_PILOT_CAPABILITIES);
  const riskLevels = splitList(env.SHADOW_PILOT_RISK_LEVELS);
  const reviewerRoles = splitList(env.SHADOW_PILOT_REVIEWER_ROLES);

  const samplingRaw = Number(env.SHADOW_PILOT_SAMPLING_PERCENT);
  const samplingConfigured = Number.isFinite(samplingRaw) && samplingRaw >= 0 && samplingRaw <= 100;

  const minSampleRaw = env.SHADOW_PILOT_MIN_SAMPLE?.trim();
  const minimumSample = minSampleRaw === undefined || minSampleRaw === ''
    ? null
    : Number(minSampleRaw);

  const configured =
    capabilities.length > 0 &&
    riskLevels.length > 0 &&
    reviewerRoles.length > 0 &&
    samplingConfigured &&
    (minimumSample === null || (Number.isFinite(minimumSample) && minimumSample >= 1));

  const startControl = env.SHADOW_PILOT_START_AT?.trim() || null;
  const endControl = env.SHADOW_PILOT_END_AT?.trim() || null;

  return {
    configured,
    allowedCapabilities: capabilities,
    allowedRiskLevels: riskLevels,
    samplingPercentage: samplingConfigured ? samplingRaw : -1,
    reviewerRoles,
    minimumSample,
    autoDisable: readShadowAutoDisableConfig(env),
    zeroTolerance: {
      unsafe: (env.SHADOW_PILOT_ZERO_TOLERANCE_UNSAFE ?? 'true') === 'true',
      criticalDisagreement: (env.SHADOW_PILOT_ZERO_TOLERANCE_CRITICAL_DISAGREEMENT ?? 'true') === 'true',
      shouldHaveAbstained: (env.SHADOW_PILOT_ZERO_TOLERANCE_SHOULD_HAVE_ABSTAINED ?? 'true') === 'true',
    },
    startControl,
    endControl,
  };
}

export function pilotConfigStatus(env: NodeJS.ProcessEnv = process.env): { configured: boolean; blockedReason: string | null } {
  const config = readShadowPilotConfig(env);
  if (config.configured) return { configured: true, blockedReason: null };
  const missing: string[] = [];
  if (config.allowedCapabilities.length === 0) missing.push('SHADOW_PILOT_CAPABILITIES');
  if (config.allowedRiskLevels.length === 0) missing.push('SHADOW_PILOT_RISK_LEVELS');
  if (config.reviewerRoles.length === 0) missing.push('SHADOW_PILOT_REVIEWER_ROLES');
  if (config.samplingPercentage < 0 || config.samplingPercentage > 100) missing.push('SHADOW_PILOT_SAMPLING_PERCENT');
  return {
    configured: false,
    blockedReason: `configuración de piloto incompleta: faltan ${missing.join(', ')}`,
  };
}