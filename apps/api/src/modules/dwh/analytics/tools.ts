import { getDwhPool } from '../dwhConnection.js';
import { computeMetric, comparePeriods, type AnalyticsScope, type MetricResult } from '../semantic/metricService.js';
import { getMetricDefinition, listApprovedMetrics } from '../semantic/catalog.js';
import { dwhEvidenceItem, periodRange, type DwhEvidenceInput } from './evidence.js';
import type { EvidenceItem } from '../../ai/contracts/evidenceEnvelope.js';

/**
 * Herramientas de analytics ALLOWLIST (Build 08, spec 23):
 *  - el LLM NUNCA genera SQL: solo puede invocar tools registradas aquí.
 *  - los inputs se tipan/validan; los identificadores salen del catálogo.
 *  - cada resultado produce evidencia DWH (determinista).
 *  - el único destino de datos es la capa semántica (nunca tablas crudas OLTP).
 */

export type AnalyticsToolId =
  | 'get_metric'
  | 'compare_periods'
  | 'trend_metric'
  | 'breakdown_by_branch'
  | 'breakdown_by_professional'
  | 'consultation_volume'
  | 'patient_growth'
  | 'adherence_population_summary'
  | 'data_freshness';

export interface AnalyticsToolDef {
  toolId: AnalyticsToolId;
  name: string;
  description: string;
  parameters: Array<{ name: string; type: 'metricId' | 'date' | 'granularity' | 'dimension'; required: boolean }>;
}

export const ANALYTICS_TOOLS: readonly AnalyticsToolDef[] = [
  { toolId: 'get_metric', name: 'Obtener métrica', description: 'Valor de una métrica aprobada en un rango de fechas.', parameters: [{ name: 'metricId', type: 'metricId', required: true }, { name: 'from', type: 'date', required: true }, { name: 'to', type: 'date', required: true }] },
  { toolId: 'compare_periods', name: 'Comparar períodos', description: 'Métrica en dos períodos con delta absoluto y porcentual.', parameters: [{ name: 'metricId', type: 'metricId', required: true }, { name: 'from', type: 'date', required: true }, { name: 'to', type: 'date', required: true }, { name: 'priorFrom', type: 'date', required: true }, { name: 'priorTo', type: 'date', required: true }] },
  { toolId: 'trend_metric', name: 'Tendencia de métrica', description: 'Serie mensual de una métrica en el rango.', parameters: [{ name: 'metricId', type: 'metricId', required: true }, { name: 'from', type: 'date', required: true }, { name: 'to', type: 'date', required: true }, { name: 'granularity', type: 'granularity', required: false }] },
  { toolId: 'breakdown_by_branch', name: 'Desglose por sucursal', description: 'Métrica agrupada por sucursal (admin: todas las sucursales).', parameters: [{ name: 'metricId', type: 'metricId', required: true }, { name: 'from', type: 'date', required: true }, { name: 'to', type: 'date', required: true }] },
  { toolId: 'breakdown_by_professional', name: 'Desglose por profesional', description: 'Métrica agrupada por profesional (no-admin: solo sí mismo).', parameters: [{ name: 'metricId', type: 'metricId', required: true }, { name: 'from', type: 'date', required: true }, { name: 'to', type: 'date', required: true }] },
  { toolId: 'consultation_volume', name: 'Volumen de consultas', description: 'consultation_count con serie mensual.', parameters: [{ name: 'from', type: 'date', required: true }, { name: 'to', type: 'date', required: true }] },
  { toolId: 'patient_growth', name: 'Crecimiento de pacientes', description: 'new_patients del período vs período previo.', parameters: [{ name: 'from', type: 'date', required: true }, { name: 'to', type: 'date', required: true }, { name: 'priorFrom', type: 'date', required: true }, { name: 'priorTo', type: 'date', required: true }] },
  { toolId: 'adherence_population_summary', name: 'Resumen de adherencia', description: 'Eventos de adherencia y promedio de menú en el rango.', parameters: [{ name: 'from', type: 'date', required: true }, { name: 'to', type: 'date', required: true }] },
  { toolId: 'data_freshness', name: 'Frescura de datos', description: 'Última carga exitosa y lag por pipeline.', parameters: [] },
];

const TOOL_INDEX = new Map(ANALYTICS_TOOLS.map((t) => [t.toolId, t]));

export function getAnalyticsTool(toolId: string): AnalyticsToolDef | null {
  return TOOL_INDEX.get(toolId as AnalyticsToolId) ?? null;
}

export function listAnalyticsTools(): AnalyticsToolDef[] {
  return Array.from(ANALYTICS_TOOLS);
}

function parseDate(value: unknown, name: string): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${name} debe ser fecha ISO YYYY-MM-DD`);
  }
  return value;
}

function parseMetricId(value: unknown): string {
  if (typeof value !== 'string' || !getMetricDefinition(value)) {
    throw new Error(`metricId inválida o no registrada: ${String(value)}`);
  }
  return value;
}

export interface ToolResult {
  toolId: AnalyticsToolId;
  status: 'OK' | 'DWH_NOT_READY' | 'NO_DATA' | 'METRIC_NOT_APPROVED' | 'FAILED_RECONCILIATION' | 'STALE' | 'INVALID_RANGE';
  value: number | null;
  series: Array<{ key: string; label: string; value: number }>;
  comparison?: {
    current: number | null;
    prior: number | null;
    deltaAbs: number | null;
    deltaPct: number | null;
    priorAbsent: boolean;
  };
  meta: {
    dataAsOf: string | null;
    stale: boolean;
    lagDays: number | null;
    reconciliationStatus: string;
    loadRunId: number | null;
    suppressedCells: number;
    granularity?: string;
    dimension?: string;
  };
  evidence: EvidenceItem[];
  message?: string;
}

function toToolResult(toolId: AnalyticsToolId, metric: MetricResult, supports: string[], period: string): ToolResult {
  return {
    toolId,
    status: metric.status,
    value: metric.value,
    series: metric.series,
    meta: {
      dataAsOf: metric.dataAsOf,
      stale: metric.stale,
      lagDays: metric.lagDays,
      reconciliationStatus: metric.reconciliationStatus,
      loadRunId: metric.loadRunId,
      suppressedCells: metric.suppressedCells,
    },
    evidence: [dwhEvidenceItem({
      metricId: metric.metricId,
      metricVersion: metric.metricVersion,
      period,
      loadRunId: metric.loadRunId,
      reconciliationStatus: metric.reconciliationStatus,
      dataAsOf: metric.dataAsOf,
      supports,
    })],
    message: metric.message,
  };
}

export async function executeAnalyticsTool(toolId: string, params: Record<string, unknown>, scope: AnalyticsScope): Promise<ToolResult> {
  const tool = getAnalyticsTool(toolId);
  if (!tool) throw new Error(`herramienta no registrada: ${toolId}`);

  switch (toolId) {
    case 'get_metric': {
      const metricId = parseMetricId(params.metricId);
      const from = parseDate(params.from, 'from');
      const to = parseDate(params.to, 'to');
      const metric = await computeMetric({ metricId, from, to, scope });
      return toToolResult(toolId, metric, [`${metricId} en ${from}..${to}`], periodRange(from, to));
    }
    case 'compare_periods': {
      const metricId = parseMetricId(params.metricId);
      const from = parseDate(params.from, 'from');
      const to = parseDate(params.to, 'to');
      const priorFrom = parseDate(params.priorFrom, 'priorFrom');
      const priorTo = parseDate(params.priorTo, 'priorTo');
      const comparison = await comparePeriods({ metricId, from, to, priorFrom, priorTo, scope });
      const def = getMetricDefinition(metricId);
      const evidenceInput: DwhEvidenceInput = {
        metricId,
        metricVersion: comparison.metricVersion,
        period: periodRange(from, to),
        loadRunId: null,
        reconciliationStatus: comparison.reconciliationStatus,
        dataAsOf: comparison.dataAsOf,
        supports: [`${metricId} actual ${from}..${to} vs previo ${priorFrom}..${priorTo}`],
        observedAt: to,
      };
      const evidence = [dwhEvidenceItem(evidenceInput)];
      if (comparison.prior !== null && !comparison.priorAbsent) {
        evidence.push(dwhEvidenceItem({
          metricId,
          metricVersion: comparison.metricVersion,
          period: periodRange(priorFrom, priorTo),
          loadRunId: null,
          reconciliationStatus: comparison.reconciliationStatus,
          dataAsOf: comparison.dataAsOf,
          supports: [`${metricId} previo ${priorFrom}..${priorTo}`],
          observedAt: priorTo,
        }));
      }
      return {
        toolId,
        status: comparison.status,
        value: comparison.current,
        series: [],
        comparison: {
          current: comparison.current,
          prior: comparison.prior,
          deltaAbs: comparison.deltaAbs,
          deltaPct: comparison.deltaPct,
          priorAbsent: comparison.priorAbsent,
        },
        meta: {
          dataAsOf: comparison.dataAsOf,
          stale: comparison.stale,
          lagDays: null,
          reconciliationStatus: comparison.reconciliationStatus,
          loadRunId: null,
          suppressedCells: 0,
        },
        evidence,
        message: def?.description,
      };
    }
    case 'trend_metric': {
      const metricId = parseMetricId(params.metricId);
      const from = parseDate(params.from, 'from');
      const to = parseDate(params.to, 'to');
      const metric = await computeMetric({ metricId, from, to, scope, groupBy: 'month' });
      const result = toToolResult(toolId, metric, [`tendencia mensual ${metricId} ${from}..${to}`], periodRange(from, to));
      result.meta.granularity = 'month';
      return result;
    }
    case 'breakdown_by_branch': {
      const metricId = parseMetricId(params.metricId);
      const from = parseDate(params.from, 'from');
      const to = parseDate(params.to, 'to');
      const metric = await computeMetric({ metricId, from, to, scope, groupBy: 'sucursal' });
      const result = toToolResult(toolId, metric, [`${metricId} por sucursal ${from}..${to}`], periodRange(from, to));
      result.meta.dimension = 'sucursal';
      return result;
    }
    case 'breakdown_by_professional': {
      const metricId = parseMetricId(params.metricId);
      const from = parseDate(params.from, 'from');
      const to = parseDate(params.to, 'to');
      const metric = await computeMetric({ metricId, from, to, scope, groupBy: 'professional' });
      const result = toToolResult(toolId, metric, [`${metricId} por profesional ${from}..${to}`], periodRange(from, to));
      result.meta.dimension = 'professional';
      return result;
    }
    case 'consultation_volume': {
      const from = parseDate(params.from, 'from');
      const to = parseDate(params.to, 'to');
      const metric = await computeMetric({ metricId: 'consultation_count', from, to, scope, groupBy: 'month' });
      return toToolResult(toolId, metric, [`volumen de consultas ${from}..${to}`], periodRange(from, to));
    }
    case 'patient_growth': {
      const from = parseDate(params.from, 'from');
      const to = parseDate(params.to, 'to');
      const priorFrom = parseDate(params.priorFrom, 'priorFrom');
      const priorTo = parseDate(params.priorTo, 'priorTo');
      const comparison = await comparePeriods({ metricId: 'new_patients', from, to, priorFrom, priorTo, scope });
      const evidence = [dwhEvidenceItem({
        metricId: 'new_patients',
        metricVersion: comparison.metricVersion,
        period: periodRange(from, to),
        loadRunId: null,
        reconciliationStatus: comparison.reconciliationStatus,
        dataAsOf: comparison.dataAsOf,
        supports: [`pacientes nuevos ${from}..${to} vs ${priorFrom}..${priorTo}`],
        observedAt: to,
      })];
      return {
        toolId,
        status: comparison.status,
        value: comparison.current,
        series: [],
        comparison: {
          current: comparison.current,
          prior: comparison.prior,
          deltaAbs: comparison.deltaAbs,
          deltaPct: comparison.deltaPct,
          priorAbsent: comparison.priorAbsent,
        },
        meta: {
          dataAsOf: comparison.dataAsOf,
          stale: comparison.stale,
          lagDays: null,
          reconciliationStatus: comparison.reconciliationStatus,
          loadRunId: null,
          suppressedCells: 0,
        },
        evidence,
      };
    }
    case 'adherence_population_summary': {
      const from = parseDate(params.from, 'from');
      const to = parseDate(params.to, 'to');
      const metric = await computeMetric({ metricId: 'adherence_population_summary', from, to, scope });
      return toToolResult(toolId, metric, [`resumen de adherencia ${from}..${to}`], periodRange(from, to));
    }
    case 'data_freshness': {
      const dwh = await getDwhPool();
      const result = await dwh.request()
        .query<{ pipeline_id: string; last_success_at: Date | null; watermark_at: Date | null; rows: number }>(`
          SELECT r.pipeline_id,
                 (SELECT TOP 1 completed_at FROM dwh_load_runs lr WHERE lr.pipeline_id = r.pipeline_id AND lr.status = 'succeeded' ORDER BY lr.load_run_id DESC) AS last_success_at,
                 w.watermark_at,
                 (SELECT COUNT(*) FROM dwh_watermarks w2 WHERE w2.pipeline_id = r.pipeline_id) AS rows
          FROM (SELECT DISTINCT pipeline_id FROM dwh_load_runs) r
          LEFT JOIN dwh_watermarks w ON w.pipeline_id = r.pipeline_id
        `);
      const now = Date.now();
      const series = result.recordset.map((r) => ({
        key: r.pipeline_id,
        label: r.pipeline_id,
        value: r.last_success_at ? Math.round((now - r.last_success_at.getTime()) / 86_400_000) : -1,
      }));
      return {
        toolId,
        status: 'OK',
        value: null,
        series,
        meta: { dataAsOf: null, stale: series.some((s) => s.value > 3 || s.value === -1), lagDays: null, reconciliationStatus: 'n/a', loadRunId: null, suppressedCells: 0 },
        evidence: [dwhEvidenceItem({ metricId: 'data_freshness', metricVersion: 'v1', period: periodRange('*', '*'), loadRunId: null, reconciliationStatus: 'n/a', dataAsOf: null, supports: ['frescura por pipeline'] })],
      };
    }
    default:
      throw new Error(`herramienta no implementada: ${toolId}`);
  }
}

export { listApprovedMetrics };