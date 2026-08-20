import sql from 'mssql';
import { getPool } from '../../db/connection.js';
import { telemetryAggregates } from './aggregator.js';

/**
 * Alertas deterministas internas (Build 09 §32). Umbrales configurables.
 * No alertas ruidosas arbitrarias; condiciones operativas explicitas.
 */

export type AlertSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export interface AlertCondition {
  ruleId: string;
  severity: AlertSeverity;
  message: string;
  value?: number;
  threshold?: number;
}

export interface AlertingConfig {
  breakerOpened: boolean;
  schemaFailureSpikeThreshold: number;
  citationValidityMin: number;
  dwhReconciliationFailed: boolean;
  unsafeEvent: boolean;
  unauthorizedRetrieval: boolean;
  criticalDisagreementThreshold: number;
}

export function readAlertingConfig(env: NodeJS.ProcessEnv = process.env): AlertingConfig {
  return {
    breakerOpened: env.AI_TELEMETRY_ALERT_BREAKER_OPENED !== 'false',
    schemaFailureSpikeThreshold: Number(env.AI_TELEMETRY_ALERT_SCHEMA_FAILURE_SPIKE ?? 5),
    citationValidityMin: Number(env.AI_TELEMETRY_ALERT_CITATION_VALIDITY_MIN ?? 0.5),
    dwhReconciliationFailed: env.AI_TELEMETRY_ALERT_DWH_RECONCILIATION !== 'false',
    unsafeEvent: env.AI_TELEMETRY_ALERT_UNSAFE_EVENT !== 'false',
    unauthorizedRetrieval: env.AI_TELEMETRY_ALERT_UNAUTHORIZED_RETRIEVAL !== 'false',
    criticalDisagreementThreshold: Number(env.AI_TELEMETRY_ALERT_CRITICAL_DISAGREEMENT ?? 1),
  };
}

export function evaluateAlerts(recentEvents: Array<{ eventType: string; status: string; reasonCode?: string; counts?: Record<string, number> }>, cfg: AlertingConfig): AlertCondition[] {
  const alerts: AlertCondition[] = [];
  const breakers = telemetryAggregates().breakers;
  const openBreakers = breakers.filter((b) => b.state.state === 'OPEN');
  if (cfg.breakerOpened && openBreakers.length > 0) {
    alerts.push({ ruleId: 'breaker_opened', severity: 'CRITICAL', message: `${openBreakers.length} circuit breaker(s) abiertos`, value: openBreakers.length });
  }

  const schemaFails = recentEvents.filter((e) => e.eventType === 'ai.structured_output' && e.status === 'schema_fail').length;
  if (schemaFails >= cfg.schemaFailureSpikeThreshold) {
    alerts.push({ ruleId: 'schema_failure_spike', severity: 'WARNING', message: `spike de fallos de schema (${schemaFails})`, value: schemaFails, threshold: cfg.schemaFailureSpikeThreshold });
  }

  const citations = recentEvents.filter((e) => e.eventType === 'rag.citation');
  if (citations.length > 0) {
    const valid = citations.filter((e) => e.status === 'valid').length;
    const ratio = valid / citations.length;
    if (ratio < cfg.citationValidityMin) {
      alerts.push({ ruleId: 'citation_validity_collapse', severity: 'CRITICAL', message: `validez de citas ${(ratio * 100).toFixed(0)}% (min ${cfg.citationValidityMin * 100}%)`, value: ratio, threshold: cfg.citationValidityMin });
    }
  }

  const dwhFailed = recentEvents.filter((e) => e.eventType === 'dwh.etl' && e.status === 'failed');
  if (cfg.dwhReconciliationFailed && dwhFailed.length > 0) {
    alerts.push({ ruleId: 'dwh_reconciliation_failed', severity: 'WARNING', message: 'carga DWH fallo', value: dwhFailed.length });
  }

  if (cfg.unsafeEvent && recentEvents.some((e) => e.reasonCode === 'SAFETY_BLOCK' || e.reasonCode === 'UNSAFE_OUTPUT')) {
    alerts.push({ ruleId: 'unsafe_event', severity: 'CRITICAL', message: 'evento de seguridad detectado' });
  }

  if (cfg.unauthorizedRetrieval && recentEvents.some((e) => e.eventType === 'tool.safety' && e.status === 'unauthorized')) {
    alerts.push({ ruleId: 'unauthorized_retrieval', severity: 'CRITICAL', message: 'recuperacion no autorizada detectada' });
  }

  const critical = recentEvents.filter((e) => e.eventType === 'shadow.review' && e.status === 'critical_disagreement').length;
  if (critical >= cfg.criticalDisagreementThreshold) {
    alerts.push({ ruleId: 'critical_disagreement', severity: 'CRITICAL', message: `desacuerdos criticos (${critical})`, value: critical, threshold: cfg.criticalDisagreementThreshold });
  }

  return alerts;
}

export async function persistAlerts(alerts: AlertCondition[]): Promise<void> {
  if (alerts.length === 0) return;
  try {
    const pool = await getPool();
    for (const a of alerts) {
      await pool.request()
        .input('rule', sql.NVarChar(64), a.ruleId)
        .input('sev', sql.NVarChar(16), a.severity)
        .input('msg', sql.NVarChar(500), a.message.slice(0, 500))
        .input('val', sql.Float, a.value ?? null)
        .input('thr', sql.Float, a.threshold ?? null)
        .query(`
          INSERT INTO ai_telemetry_alerts (rule_id, severity, message, value, threshold)
          SELECT @rule, @sev, @msg, @val, @thr
          WHERE NOT EXISTS (
            SELECT 1 FROM ai_telemetry_alerts
            WHERE rule_id = @rule AND created_at > DATEADD(hour, -1, SYSUTCDATETIME())
          )
        `);
    }
  } catch {
    /* fail-soft */
  }
}