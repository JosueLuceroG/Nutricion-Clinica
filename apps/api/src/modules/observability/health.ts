import { isEgressEnabled } from '../ai/aiEgressPolicy.js';
import { selectTelemetryStore } from './telemetryStore.js';
import { telemetryAggregates } from './aggregator.js';

/**
 * Modelo de salud (Build 09 §30).
 * - HEALTY/DEGRADED/UNAVAILABLE/BLOCKED/UNKNOWN para INFRAESTRUCTURA.
 * - La disponibilidad de MODELO CLINICO se reporta por separado:
 *   NO_ELIGIBLE_MODEL NO es una caida de infraestructura.
 * Los kill switches existentes siguen siendo autoritativos: aqui solo se muestran.
 */

export type SystemHealth = 'HEALTHY' | 'DEGRADED' | 'UNAVAILABLE' | 'BLOCKED' | 'UNKNOWN';
export type ModelAvailability = 'HEALTHY' | 'DEGRADED' | 'NO_ELIGIBLE_MODEL' | 'BLOCKED_BY_HARDWARE' | 'BLOCKED_BY_CREDENTIAL' | 'UNKNOWN';

export interface HealthReport {
  infrastructure: SystemHealth;
  clinicalModelAvailability: ModelAvailability;
  eligibleClinicalModel: 'NONE' | string;
  egressKillSwitch: 'ENABLED' | 'DISABLED';
  shadowKillSwitch: 'ENABLED' | 'DISABLED';
  dwhFreshness: { status: SystemHealth; detail: string };
  breakerStates: Array<{ key: string; state: string; reasonCategory?: string }>;
  reasons: string[];
}

export async function buildHealthReport(env: NodeJS.ProcessEnv = process.env): Promise<HealthReport> {
  const reasons: string[] = [];
  const aggregates = telemetryAggregates();
  const breakerStates = aggregates.breakers.map((b) => ({ key: b.key, state: b.state.state, reasonCategory: b.state.reasonCategory }));

  let infra: SystemHealth = 'HEALTHY';
  const store = selectTelemetryStore(env);
  let dwhDetail = 'no hay telemetria dwh';
  try {
    const dwhEvents = await store.recent(500);
    const dwhEtl = dwhEvents.filter((e) => e.eventType === 'dwh.etl');
    if (dwhEtl.length === 0) {
      dwhDetail = 'sin carga registrada (pendiente)';
      infra = 'DEGRADED';
      reasons.push('DWH sin ejecuciones de ETL registradas');
    } else {
      const latest = dwhEtl[dwhEtl.length - 1]!;
      if (latest.status === 'failed') {
        dwhDetail = `ultima carga fallo (${latest.reasonCode ?? 'unknown'})`;
        infra = 'DEGRADED';
        reasons.push('ultima carga DWH fallida');
      } else {
        dwhDetail = `ultima carga OK (${latest.counts?.loaded ?? 0} filas)`;
      }
    }
  } catch {
    infra = 'UNKNOWN';
    reasons.push('store de telemetria no disponible');
  }

  const openBreakers = breakerStates.filter((b) => b.state === 'OPEN');
  if (openBreakers.length > 0) {
    infra = 'DEGRADED';
    reasons.push(`${openBreakers.length} circuit breaker(s) abiertos`);
  }

  return {
    infrastructure: infra,
    clinicalModelAvailability: 'NO_ELIGIBLE_MODEL',
    eligibleClinicalModel: 'NONE',
    egressKillSwitch: isEgressEnabled(env) ? 'ENABLED' : 'DISABLED',
    shadowKillSwitch: env.AI_SHADOW_STATE === 'ACTIVE_PROFESSIONAL_SHADOW' ? 'ENABLED' : 'DISABLED',
    dwhFreshness: { status: infra, detail: dwhDetail },
    breakerStates,
    reasons,
  };
}