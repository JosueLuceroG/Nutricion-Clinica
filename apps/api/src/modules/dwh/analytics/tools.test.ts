import { describe, expect, it } from 'vitest';
import { ANALYTICS_TOOLS, getAnalyticsTool, listAnalyticsTools, executeAnalyticsTool } from './tools.js';
import { listApprovedMetrics, getMetricDefinition } from '../semantic/catalog.js';
import { dwhEvidenceItem } from './evidence.js';

/**
 * Build 08: allowlist de tools. El LLM jamás genera SQL: solo invoca tools
 * registradas con parámetros tipados. Métricas financieras => METRIC_NOT_APPROVED.
 */

describe('analytics tools allowlist', () => {
  it('expone exactamente las 9 tools registradas', () => {
    expect(listAnalyticsTools().map((t) => t.toolId)).toEqual([
      'get_metric',
      'compare_periods',
      'trend_metric',
      'breakdown_by_branch',
      'breakdown_by_professional',
      'consultation_volume',
      'patient_growth',
      'adherence_population_summary',
      'data_freshness',
    ]);
  });

  it('getAnalyticsTool rechaza ids no registrados', () => {
    expect(getAnalyticsTool('run_arbitrary_sql')).toBeNull();
    expect(getAnalyticsTool('SELECT * FROM pacientes')).toBeNull();
    expect(getAnalyticsTool('')).toBeNull();
  });

  it('ninguna tool acepta SQL ni identificadores de entrada', () => {
    for (const tool of ANALYTICS_TOOLS) {
      for (const param of tool.parameters) {
        expect(['metricId', 'date', 'granularity', 'dimension']).toContain(param.type);
      }
    }
  });
});

describe('catálogo semántico', () => {
  it('métricas financieras quedan METRIC_NOT_APPROVED (source-of-truth no resuelto)', () => {
    for (const metricId of ['revenue', 'collections', 'outstanding_balance']) {
      expect(getMetricDefinition(metricId)?.status).toBe('METRIC_NOT_APPROVED');
      expect(listApprovedMetrics().some((m) => m.metricId === metricId)).toBe(false);
    }
  });

  it('todas las métricas aprobadas tienen versión, owner, lineage y sourceFacts', () => {
    for (const m of listApprovedMetrics()) {
      expect(m.metricVersion).toMatch(/^v\d+/);
      expect(m.owner.length).toBeGreaterThan(0);
      expect(m.lineage.length).toBeGreaterThan(0);
      expect(m.sourceFacts.length).toBeGreaterThan(0);
    }
  });
});

describe('evidencia DWH', () => {
  it('los ítems de evidencia son deterministas y llevan trazas de load', () => {
    const item = dwhEvidenceItem({
      metricId: 'consultation_count',
      metricVersion: 'v1',
      period: '2026-08-01..2026-08-31',
      loadRunId: 3,
      reconciliationStatus: 'OK (expected=10, loaded=10)',
      dataAsOf: '2026-08-19T06:00:00.000Z',
      supports: ['volumen de consultas'],
    });
    expect(item.sourceType).toBe('DWH');
    expect(item.metricId).toBe('consultation_count');
    expect(item.metricVersion).toBe('v1');
    expect(item.period).toBe('2026-08-01..2026-08-31');
    expect(item.loadRunId).toBe(3);
    expect(item.reconciliationStatus).toContain('OK');
    expect(item.observedAt).toBe('2026-08-31');
  });
});

describe('ejecución de tools', () => {
  it('fecha malformada se rechaza (nunca llega al SQL)', async () => {
    await expect(
      executeAnalyticsTool('get_metric', { metricId: 'consultation_count', from: "2026-01-01'; DROP TABLE dwh_load_runs; --", to: '2026-01-31' }, { sucursalKeys: [1], isAdmin: true }),
    ).rejects.toThrow(/fecha ISO/);
  });

  it('metricId no registrada se rechaza; registrada no aprobada => METRIC_NOT_APPROVED', async () => {
    const finance = await executeAnalyticsTool('get_metric', { metricId: 'revenue', from: '2026-01-01', to: '2026-01-31' }, { sucursalKeys: [1], isAdmin: true });
    expect(finance.status).toBe('METRIC_NOT_APPROVED');
    expect(finance.value).toBeNull();
    await expect(
      executeAnalyticsTool('get_metric', { metricId: 'no_existe', from: '2026-01-01', to: '2026-01-31' }, { sucursalKeys: [1], isAdmin: true }),
    ).rejects.toThrow(/no registrada/);
  });

  it('tool no registrada se rechaza', async () => {
    await expect(
      executeAnalyticsTool('arbitrary', {}, { sucursalKeys: [1], isAdmin: true }),
    ).rejects.toThrow(/no registrada/);
  });
});