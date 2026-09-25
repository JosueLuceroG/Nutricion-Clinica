import { beforeEach, describe, expect, it, vi } from 'vitest';
import { computeMetric, comparePeriods } from './metricService.js';

/**
 * Build 08 adversarial del servicio semántico (sin base real):
 * - DWH sin carga exitosa => DWH_NOT_READY (no 0 fingido);
 * - métrica financiera => METRIC_NOT_APPROVED;
 * - rango invertido => INVALID_RANGE;
 * - comparación sin período previo => priorAbsent, deltaPct null (sin div-0).
 */

function fakePool(loadRuns: unknown[], reconciliation: unknown[] = []) {
  const requests: Array<{ inputs: Array<[string, unknown, unknown]>; sql: string }> = [];
  return {
    requests,
    request() {
      const req = {
        inputs: [] as Array<[string, unknown, unknown]>,
        input(name: string, type: unknown, value: unknown) {
          this.inputs.push([name, type, value]);
          return this;
        },
        async query<T>(sqlText: string): Promise<{ recordset: T[] }> {
          requests.push({ inputs: this.inputs, sql: sqlText });
          if (sqlText.includes('FROM dwh_load_runs')) return { recordset: loadRuns as T[] };
          if (sqlText.includes('FROM dwh_reconciliation')) return { recordset: reconciliation as T[] };
          return { recordset: [] };
        },
      };
      return req;
    },
  };
}

vi.mock('../dwhConnection.js', () => ({
  getDwhPool: vi.fn(),
}));

import { getDwhPool } from '../dwhConnection.js';

const SCOPE = { sucursalKeys: [1], isAdmin: true };

describe('computeMetric (sin base real)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('métrica no registrada => METRIC_NOT_APPROVED sin tocar la base', async () => {
    const result = await computeMetric({ metricId: 'revenue', from: '2026-01-01', to: '2026-01-31', scope: SCOPE });
    expect(result.status).toBe('METRIC_NOT_APPROVED');
    expect(result.value).toBeNull();
    expect(getDwhPool).not.toHaveBeenCalled();
  });

  it('rango invertido => INVALID_RANGE sin tocar la base', async () => {
    const result = await computeMetric({ metricId: 'consultation_count', from: '2026-02-01', to: '2026-01-01', scope: SCOPE });
    expect(result.status).toBe('INVALID_RANGE');
    expect(getDwhPool).not.toHaveBeenCalled();
  });

  it('sin carga exitosa previa => DWH_NOT_READY (no 0 fingido)', async () => {
    const pool = fakePool([]);
    (getDwhPool as ReturnType<typeof vi.fn>).mockResolvedValue(pool);
    const result = await computeMetric({ metricId: 'consultation_count', from: '2026-01-01', to: '2026-01-31', scope: SCOPE });
    expect(result.status).toBe('DWH_NOT_READY');
    expect(result.value).toBeNull();
    expect(result.reconciliationStatus).toBe('no_load_run');
  });

  it('reconciliación fallida => FAILED_RECONCILIATION (métrica no confiable)', async () => {
    const pool = fakePool(
      [{ completed_at: new Date('2026-08-19T06:00:00Z'), load_run_id: 3, source_watermark: null }],
      [{ unexpected_loss: 2, loaded: 10, source_expected: 12 }],
    );
    (getDwhPool as ReturnType<typeof vi.fn>).mockResolvedValue(pool);
    const result = await computeMetric({ metricId: 'consultation_count', from: '2026-01-01', to: '2026-01-31', scope: SCOPE });
    expect(result.status).toBe('FAILED_RECONCILIATION');
    expect(result.value).toBeNull();
    expect(result.reconciliationStatus).toBe('FAILED_RECONCILIATION');
  });

  it('DWH fresco y reconciliado => el SQL generado es 100% parametrizado (sin literales de usuario)', async () => {
    const pool = fakePool(
      [{ completed_at: new Date('2026-08-19T06:00:00Z'), load_run_id: 3, source_watermark: null }],
      [{ unexpected_loss: 0, loaded: 10, source_expected: 10 }],
    );
    (getDwhPool as ReturnType<typeof vi.fn>).mockResolvedValue(pool);
    const result = await computeMetric({ metricId: 'consultation_count', from: '2026-01-01', to: '2026-01-31', scope: SCOPE });
    expect(result.status).toBe('OK');
    expect(result.value).toBe(0);
    const factQueries = pool.requests.filter((r) => r.sql.includes('fact_consultation'));
    expect(factQueries.length).toBeGreaterThan(0);
    for (const q of factQueries) {
      expect(q.sql).not.toContain("'2026-01-01'");
      expect(q.sql).not.toContain('DROP');
    }
    const hasFromParam = pool.requests.some((r) => r.inputs.some(([name]) => name === 'fromKey'));
    expect(hasFromParam).toBe(true);
  });
});

describe('comparePeriods (sin base real)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sin período previo (cero/ausente) => priorAbsent y deltaPct null, sin división por cero', async () => {
    const pool = fakePool(
      [{ completed_at: new Date('2026-08-19T06:00:00Z'), load_run_id: 3, source_watermark: null }],
      [{ unexpected_loss: 0, loaded: 10, source_expected: 10 }],
    );
    (getDwhPool as ReturnType<typeof vi.fn>).mockResolvedValue(pool);
    const result = await comparePeriods({
      metricId: 'consultation_count',
      from: '2026-02-01',
      to: '2026-02-28',
      priorFrom: '2026-01-01',
      priorTo: '2026-01-31',
      scope: SCOPE,
    });
    expect(result.status).toBe('OK');
    expect(result.current).toBe(0);
    expect(result.prior).toBe(0);
    expect(result.priorAbsent).toBe(true);
    expect(result.deltaPct).toBeNull();
    expect(result.deltaAbs).toBe(0);
  });

  it('métrica financiera en comparación => METRIC_NOT_APPROVED', async () => {
    const result = await comparePeriods({
      metricId: 'revenue',
      from: '2026-02-01',
      to: '2026-02-28',
      priorFrom: '2026-01-01',
      priorTo: '2026-01-31',
      scope: SCOPE,
    });
    expect(result.status).toBe('METRIC_NOT_APPROVED');
    expect(result.current).toBeNull();
  });
});