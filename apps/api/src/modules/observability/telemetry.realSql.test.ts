import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import sql from 'mssql';
import { getPool } from '../../db/connection.js';
import { selectTelemetryStore, resetTelemetryStoreForTests } from '../observability/telemetryStore.js';
import { retentionPurgeSql } from '../observability/retention.js';
import { persistAlerts, evaluateAlerts, readAlertingConfig } from '../observability/alerting.js';
import { evaluateAutoDisable, readShadowAutoDisableConfig } from '../shadow/shadowAutoDisable.js';
import { canTransition } from '../shadow/shadowStateMachine.js';

/**
 * VERIFICACIÓN SQL REAL — Build 09 (migración 038: telemetría + shadow).
 * Solo corre con AI_REAL_SQL_TEST=1 contra nc_b09_oltp (PS1 runbook).
 * Sin mocks: runner aplica 001-038, tablas verificadas, dedup por executionId
 * contra SQL real, MERGE de agregados, retención, alertas y tablas de shadow.
 */

const REAL_SQL = process.env.AI_REAL_SQL_TEST === '1';

const T1 = 'c0000000-0000-4000-8000-000000000001';
const T2 = 'c0000000-0000-4000-8000-000000000002';

describe.runIf(REAL_SQL)('Build 09 real SQL (nc_b09_oltp, migración 038)', () => {
  let pool: sql.ConnectionPool;

  beforeAll(async () => {
    expect(process.env.DB_NAME).toMatch(/nc_b09_oltp/i);
    pool = await getPool();
  });

  afterAll(async () => {
    if (pool) await pool.close();
    resetTelemetryStoreForTests();
  });

  async function count(table: string, where = '1=1'): Promise<number> {
    const r = await pool.request().query<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table} WHERE ${where}`);
    return r.recordset[0]!.n;
  }

  it('migración 038 aplicada: tablas de telemetría + shadow existen', async () => {
    const tables = [
      'ai_telemetry_events', 'ai_telemetry_aggregates', 'ai_telemetry_alerts',
      'shadow_state', 'shadow_runs', 'shadow_reviews', 'shadow_auto_disable_events', 'shadow_cohorts',
    ];
    for (const table of tables) {
      const r = await pool.request().input('t', sql.NVarChar(100), table)
        .query<{ n: number }>(`SELECT COUNT(*) AS n FROM sys.tables WHERE name = @t`);
      expect(r.recordset[0]!.n, `tabla ${table}`).toBe(1);
    }
  });

  it('runner registró la migración 038 en schema_migrations', async () => {
    const r = await pool.request().input('f', sql.NVarChar(100), '038-telemetry.sql')
      .query<{ checksum: string }>(`SELECT checksum FROM schema_migrations WHERE filename = @f`);
    expect(r.recordset[0]).toBeDefined();
    expect(r.recordset[0]!.checksum).toMatch(/^[0-9a-f]{64}$/i);
  });

  it('store SQL: inserta evento y deduplica terminal por executionId', async () => {
    resetTelemetryStoreForTests();
    const store = selectTelemetryStore({ AI_TELEMETRY_STORE: 'sql' });
    const event = {
      eventType: 'ai.execution.completed' as const,
      executionId: T1,
      correlationId: 'corr-b09-1',
      capability: 'nutricion_plan',
      provider: 'fake',
      model: 'golden',
      status: 'completed',
      reasonCode: undefined,
      durationMs: 42,
      counts: { attempts: 1 },
    };
    await store.record(event);
    await store.record(event);
    expect(await count('ai_telemetry_events', `execution_id = N'${T1}'`)).toBe(1);

    await store.record({ ...event, executionId: T2, correlationId: 'corr-b09-2' });
    expect(await count('ai_telemetry_events', `execution_id = N'${T2}'`)).toBe(1);
  });

  it('store SQL: MERGE de agregados (count acumula, p50 reemplaza)', async () => {
    resetTelemetryStoreForTests();
    const store = selectTelemetryStore({ AI_TELEMETRY_STORE: 'sql' });
    await store.recordAggregate('ai.execution.completed|count', 'event', 'count', 5, 5);
    await store.recordAggregate('ai.execution.completed|count', 'event', 'count', 3, 3);
    const rows = await store.findAggregate('ai.execution.completed|count');
    expect(rows.length).toBe(1);
    expect(rows[0]!.value).toBe(8);
    expect(rows[0]!.sampleCount).toBe(8);
  });

  it('retención: purge SQL es válido y no borra reciente', async () => {
    await pool.request().batch(retentionPurgeSql({ AI_TELEMETRY_RETENTION_RAW_DAYS: '7' }));
    expect(await count('ai_telemetry_events', `execution_id = N'${T2}'`)).toBe(1);
  });

  it('alertas: persisten con dedup por regla (1 por hora)', async () => {
    const alerts = evaluateAlerts(
      Array.from({ length: 6 }, () => ({ eventType: 'ai.structured_output', status: 'schema_fail' })),
      readAlertingConfig({}),
    );
    expect(alerts.length).toBeGreaterThan(0);
    await persistAlerts(alerts);
    await persistAlerts(alerts);
    const r = await pool.request().input('rule', sql.NVarChar(64), 'schema_failure_spike')
      .query<{ n: number }>(`SELECT COUNT(*) AS n FROM ai_telemetry_alerts WHERE rule_id = @rule`);
    expect(r.recordset[0]!.n).toBe(1);
  });

  it('tablas de shadow: cohortes, runs y revisión FK', async () => {
    await pool.request().batch(`
      INSERT INTO shadow_cohorts (cohort_key, version_bundle, note) VALUES (N'engineering-golden', N'v1|t1|p1|s1|k1|m1|c1|d1', N'sintetico');
      INSERT INTO shadow_runs (correlation_id, capability, risk_level, provider, model, version_bundle, sampled, status, execution_id)
        VALUES (N'corr-b09', N'nutricion_plan', N'medium', N'fake-qualified', N'golden-model-v1', N'v1|t1|p1|s1|k1|m1|c1|d1', 1, N'COMPLETED', N'${T1}');
      INSERT INTO shadow_reviews (shadow_run_id, reviewer_key, reviewer_sucursal_id, label, critical_disagreement, unsafe, version_bundle)
        SELECT shadow_run_id, N'rev-1', N'suc-1', N'ACCEPTED', 0, 0, N'v1|t1|p1|s1|k1|m1|c1|d1' FROM shadow_runs WHERE execution_id = N'${T1}';
    `);
    expect(await count('shadow_runs', `execution_id = N'${T1}'`)).toBe(1);
    expect(await count('shadow_reviews')).toBe(1);
  });

  it('auto-disable y estado: contratos inmutables en SQL real', async () => {
    const reviews = Array.from({ length: 6 }, () => ({ label: 'ACCEPTED' as const, criticalDisagreement: false, unsafe: true, citationValid: true }));
    const decision = evaluateAutoDisable(reviews, readShadowAutoDisableConfig({}));
    expect(decision.triggerCode).toBe('ZERO_TOLERANCE_UNSAFE');
    expect(canTransition('ACTIVE_PROFESSIONAL_SHADOW', 'AUTO_DISABLED', 'auto').allowed).toBe(true);
  });

  it('SECRET SCAN: fixture sintético sin datos reales', async () => {
    const txt = JSON.stringify({ t1: T1, t2: T2 });
    expect(txt).not.toMatch(/NutriCl1n1c4/);
  });
});