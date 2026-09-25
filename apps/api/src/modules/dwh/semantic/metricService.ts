import sql from 'mssql';
import { getDwhPool } from '../dwhConnection.js';
import { readDwhConfig } from '../config.js';
import { getMetricDefinition, isMetricApproved } from './catalog.js';

/**
 * Servicio semántico: ÚNICO lugar que traduce métricas registradas a SQL.
 *  - Los identificadores (tabla/columna) provienen SIEMPRE del catálogo.
 *  - La entrada del usuario solo puede filtrar por dimensión registrada y
 *    rango de fechas, siempre como parámetros tipados (nunca SQL crudo).
 *  - Sin métrica aprobada => METRIC_NOT_APPROVED (nunca un número inventado).
 *  - Sin carga exitosa previa => DWH_NOT_READY (no 0 fingido).
 */

export interface AnalyticsScope {
  sucursalKeys: number[];
  professionalKey?: number;
  isAdmin: boolean;
}

export interface MetricQueryInput {
  metricId: string;
  from: string;
  to: string;
  scope: AnalyticsScope;
  groupBy?: 'sucursal' | 'professional' | 'month';
  smallCellMin?: number;
}

export type MetricResultStatus = 'OK' | 'DWH_NOT_READY' | 'NO_DATA' | 'METRIC_NOT_APPROVED' | 'FAILED_RECONCILIATION' | 'STALE' | 'INVALID_RANGE';

export interface MetricResult {
  metricId: string;
  metricVersion: string;
  status: MetricResultStatus;
  value: number | null;
  series: Array<{ key: string; label: string; value: number }>;
  dataAsOf: string | null;
  stale: boolean;
  lagDays: number | null;
  reconciliationStatus: string;
  loadRunId: number | null;
  suppressedCells: number;
  message?: string;
}

export interface PeriodComparison {
  metricId: string;
  metricVersion: string;
  status: MetricResultStatus;
  current: number | null;
  prior: number | null;
  deltaAbs: number | null;
  deltaPct: number | null;
  priorAbsent: boolean;
  currentAbsent: boolean;
  dataAsOf: string | null;
  stale: boolean;
  reconciliationStatus: string;
}

interface FactSpec {
  table: string;
  dateColumn: string;
  isDeletedColumn: string;
}

const FACT_BY_METRIC: Record<string, FactSpec> = {
  consultation_count: { table: 'fact_consultation', dateColumn: 'date_key', isDeletedColumn: 'is_deleted' },
  patient_count: { table: 'fact_consultation', dateColumn: 'date_key', isDeletedColumn: 'is_deleted' },
  new_patients: { table: 'fact_consultation', dateColumn: 'date_key', isDeletedColumn: 'is_deleted' },
  avg_consultations_per_period: { table: 'fact_consultation', dateColumn: 'date_key', isDeletedColumn: 'is_deleted' },
  anthropometry_volume: { table: 'fact_anthropometry', dateColumn: 'date_key', isDeletedColumn: 'is_deleted' },
  lab_observation_volume: { table: 'fact_lab', dateColumn: 'date_key', isDeletedColumn: 'is_deleted' },
  meal_plan_volume: { table: 'fact_meal_plan', dateColumn: 'start_date_key', isDeletedColumn: 'is_deleted' },
  adherence_population_summary: { table: 'fact_adherence', dateColumn: 'date_key', isDeletedColumn: 'is_deleted' },
};

const PIPELINE_BY_METRIC: Record<string, string> = {
  consultation_count: 'fact_consultation',
  patient_count: 'fact_consultation',
  new_patients: 'fact_consultation',
  avg_consultations_per_period: 'fact_consultation',
  anthropometry_volume: 'fact_anthropometry',
  lab_observation_volume: 'fact_lab',
  meal_plan_volume: 'fact_meal_plan',
  adherence_population_summary: 'fact_adherence',
};

function parseDateKey(value: string): number {
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) throw new Error(`fecha inválida: ${value}`);
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

async function latestSuccessfulLoad(dwh: sql.ConnectionPool, pipelineId: string): Promise<{ completedAt: Date; loadRunId: number; watermark: Date | null } | null> {
  const result = await dwh.request()
    .input('pipelineId', sql.NVarChar(60), pipelineId)
    .query<{ completed_at: Date; load_run_id: string; source_watermark: Date | null }>(`
      SELECT TOP 1 completed_at, load_run_id, source_watermark
      FROM dwh_load_runs
      WHERE pipeline_id = @pipelineId AND status = 'succeeded'
      ORDER BY load_run_id DESC
    `);
  if (result.recordset.length === 0) return null;
  return {
    completedAt: result.recordset[0]!.completed_at,
    loadRunId: Number(result.recordset[0]!.load_run_id),
    watermark: result.recordset[0]!.source_watermark,
  };
}

async function latestReconciliation(dwh: sql.ConnectionPool, pipelineId: string): Promise<{ unexpectedLoss: number; loaded: number; sourceExpected: number } | null> {
  const result = await dwh.request()
    .input('pipelineId', sql.NVarChar(60), pipelineId)
    .query<{ unexpected_loss: number; loaded: number; source_expected: number }>(`
      SELECT TOP 1 unexpected_loss, loaded, source_expected
      FROM dwh_reconciliation
      WHERE pipeline_id = @pipelineId
      ORDER BY reconciliation_id DESC
    `);
  if (result.recordset.length === 0) return null;
  return {
    unexpectedLoss: result.recordset[0]!.unexpected_loss,
    loaded: result.recordset[0]!.loaded,
    sourceExpected: result.recordset[0]!.source_expected,
  };
}

function scopeWhere(scope: AnalyticsScope, table: string): { sql: string; params: Array<{ name: string; value: number }> } {
  const params: Array<{ name: string; value: number }> = [];
  const clauses: string[] = [];
  if (scope.sucursalKeys.length > 0) {
    scope.sucursalKeys.forEach((k, i) => {
      params.push({ name: `suc${i}`, value: k });
      clauses.push(`${table}.sucursal_key = @suc${i}`);
    });
  }
  if (scope.professionalKey !== undefined && scope.professionalKey !== null) {
    params.push({ name: 'prof', value: scope.professionalKey });
    clauses.push(`${table}.professional_key = @prof`);
  }
  return { sql: clauses.length > 0 ? ` AND (${clauses.join(' OR ')})` : '', params };
}

export async function computeMetric(input: MetricQueryInput): Promise<MetricResult> {
  const def = getMetricDefinition(input.metricId);
  if (!def) return { metricId: input.metricId, metricVersion: 'v0', status: 'METRIC_NOT_APPROVED', value: null, series: [], dataAsOf: null, stale: false, lagDays: null, reconciliationStatus: 'unknown', loadRunId: null, suppressedCells: 0, message: 'métrica no registrada' };
  if (!isMetricApproved(input.metricId)) {
    return { metricId: input.metricId, metricVersion: def.metricVersion, status: 'METRIC_NOT_APPROVED', value: null, series: [], dataAsOf: null, stale: false, lagDays: null, reconciliationStatus: 'unknown', loadRunId: null, suppressedCells: 0, message: 'métrica no aprobada (semántica no canónica)' };
  }

  const fromKey = parseDateKey(input.from);
  const toKey = parseDateKey(input.to);
  if (fromKey > toKey) return { metricId: input.metricId, metricVersion: def.metricVersion, status: 'INVALID_RANGE', value: null, series: [], dataAsOf: null, stale: false, lagDays: null, reconciliationStatus: 'unknown', loadRunId: null, suppressedCells: 0 };

  const dwh = await getDwhPool();
  const pipelineId = PIPELINE_BY_METRIC[input.metricId]!;
  const load = await latestSuccessfulLoad(dwh, pipelineId);
  if (!load) {
    return { metricId: input.metricId, metricVersion: def.metricVersion, status: 'DWH_NOT_READY', value: null, series: [], dataAsOf: null, stale: false, lagDays: null, reconciliationStatus: 'no_load_run', loadRunId: null, suppressedCells: 0, message: 'DWH sin carga exitosa previa' };
  }

  const reconciliation = await latestReconciliation(dwh, pipelineId);
  const reconciliationStatus = reconciliation
    ? (reconciliation.unexpectedLoss === 0 ? `OK (expected=${reconciliation.sourceExpected}, loaded=${reconciliation.loaded})` : 'FAILED_RECONCILIATION')
    : 'unknown';
  if (reconciliation && reconciliation.unexpectedLoss !== 0) {
    return { metricId: input.metricId, metricVersion: def.metricVersion, status: 'FAILED_RECONCILIATION', value: null, series: [], dataAsOf: load.completedAt.toISOString(), stale: false, lagDays: null, reconciliationStatus, loadRunId: load.loadRunId, suppressedCells: 0, message: 'reconciliación fallida: métrica no confiable' };
  }

  const config = readDwhConfig();
  const lagDays = (Date.now() - load.completedAt.getTime()) / 86_400_000;
  const stale = lagDays > config.maxFreshnessDays;

  const fact = FACT_BY_METRIC[input.metricId]!;
  const scope = scopeWhere(input.scope, fact.table);
  const smallCellMin = input.smallCellMin ?? config.smallCellMin;

  const baseWhere = `${fact.table}.${fact.dateColumn} BETWEEN @fromKey AND @toKey AND ${fact.table}.${fact.isDeletedColumn} = 0${scope.sql}`;
  const request = dwh.request()
    .input('fromKey', sql.Int, fromKey)
    .input('toKey', sql.Int, toKey);
  for (const p of scope.params) request.input(p.name, sql.Int, p.value);

  let value: number | null;
  let series: Array<{ key: string; label: string; value: number }> = [];

  if (input.metricId === 'patient_count') {
    const result = await request.query<{ n: number }>(`SELECT COUNT(DISTINCT ${fact.table}.patient_key) AS n FROM ${fact.table} WHERE ${baseWhere}`);
    value = result.recordset[0]?.n ?? 0;
  } else if (input.metricId === 'new_patients') {
    const result = await request.query<{ n: number }>(`
      SELECT COUNT(*) AS n FROM (
        SELECT ${fact.table}.patient_key
        FROM ${fact.table}
        WHERE ${fact.table}.${fact.isDeletedColumn} = 0${scope.sql}
        GROUP BY ${fact.table}.patient_key
        HAVING MIN(${fact.table}.${fact.dateColumn}) BETWEEN @fromKey AND @toKey
      ) AS first_consultations
    `);
    value = result.recordset[0]?.n ?? 0;
  } else if (input.metricId === 'avg_consultations_per_period') {
    const result = await request.query<{ n: number; months: number }>(`
      SELECT COUNT(*) AS n, COUNT(DISTINCT CONCAT(dim_date.year_key, '-', dim_date.month_key)) AS months
      FROM ${fact.table}
      JOIN dim_date ON dim_date.date_key = ${fact.table}.${fact.dateColumn}
      WHERE ${baseWhere}
    `);
    const months = Math.max(1, result.recordset[0]?.months ?? 1);
    value = (result.recordset[0]?.n ?? 0) / months;
  } else if (input.metricId === 'adherence_population_summary') {
    const result = await request.query<{ n: number; avg: number | null }>(`
      SELECT COUNT(*) AS n, AVG(${fact.table}.adherence_menu) AS avg
      FROM ${fact.table}
      WHERE ${baseWhere}
    `);
    value = result.recordset[0]?.n ?? 0;
    series.push({ key: 'adherence_menu_avg', label: 'adherencia de menú promedio (0-100)', value: Number((result.recordset[0]?.avg ?? 0).toFixed(1)) });
  } else if (input.metricId === 'consultation_count' || input.metricId === 'anthropometry_volume' || input.metricId === 'lab_observation_volume' || input.metricId === 'meal_plan_volume') {
    const result = await request.query<{ n: number }>(`SELECT COUNT(*) AS n FROM ${fact.table} WHERE ${baseWhere}`);
    value = result.recordset[0]?.n ?? 0;
  } else {
    return { metricId: input.metricId, metricVersion: def.metricVersion, status: 'METRIC_NOT_APPROVED', value: null, series: [], dataAsOf: load.completedAt.toISOString(), stale, lagDays: Math.round(lagDays), reconciliationStatus, loadRunId: load.loadRunId, suppressedCells: 0, message: 'métrica sin implementación' };
  }

  let suppressedCells = 0;
  if (input.groupBy) {
    if (input.metricId === 'new_patients') {
      return { metricId: input.metricId, metricVersion: def.metricVersion, status: 'METRIC_NOT_APPROVED', value: null, series: [], dataAsOf: load.completedAt.toISOString(), stale, lagDays: Math.round(lagDays), reconciliationStatus, loadRunId: load.loadRunId, suppressedCells: 0, message: 'new_patients no soporta groupBy (semántica de primera consulta global)' };
    }
    const groupExpr = input.groupBy === 'month'
      ? `CONCAT(dim_date.year_key, '-', dim_date.month_key)`
      : input.groupBy === 'sucursal'
        ? 'dim_sucursal.sucursal_key'
        : 'dim_professional.professional_key';
    const labelExpr = input.groupBy === 'month'
      ? `CONCAT(dim_date.year_key, '-', dim_date.month_key)`
      : input.groupBy === 'sucursal'
        ? 'dim_sucursal.nombre'
        : 'dim_professional.nombre_completo';
    const groupByExpr = input.groupBy === 'month'
      ? 'dim_date.year_key, dim_date.month_key'
      : input.groupBy === 'sucursal'
        ? 'dim_sucursal.sucursal_key, dim_sucursal.nombre'
        : 'dim_professional.professional_key, dim_professional.nombre_completo';
    const join = input.groupBy === 'month'
      ? 'JOIN dim_date ON dim_date.date_key = fact.date_key'
      : input.groupBy === 'sucursal'
        ? 'JOIN dim_sucursal ON dim_sucursal.sucursal_key = fact.sucursal_key AND dim_sucursal.is_current = 1'
        : 'JOIN dim_professional ON dim_professional.professional_key = fact.professional_key AND dim_professional.is_current = 1';
    const groupedWhere = baseWhere.replaceAll(`${fact.table}.`, 'fact.');
    const countExpr = input.metricId === 'patient_count' ? 'COUNT(DISTINCT fact.patient_key)' : 'COUNT(*)';
    const result = await request.query<{ gk: string; gl: string; n: number }>(`
      SELECT ${groupExpr} AS gk, ${labelExpr} AS gl, ${countExpr} AS n
      FROM ${fact.table} fact
      ${join}
      WHERE ${groupedWhere}
      GROUP BY ${groupByExpr}
      ORDER BY ${groupExpr}
    `);
    series = result.recordset.map((r) => ({ key: r.gk, label: r.gl, value: r.n }));
    if (def.metricId === 'patient_count') {
      series = series.map((s) => (s.value < smallCellMin ? { ...s, value: -1 } : s));
      suppressedCells = series.filter((s) => s.value === -1).length;
    }
  }

  return {
    metricId: input.metricId,
    metricVersion: def.metricVersion,
    status: 'OK',
    value,
    series,
    dataAsOf: load.completedAt.toISOString(),
    stale,
    lagDays: Math.round(lagDays),
    reconciliationStatus,
    loadRunId: load.loadRunId,
    suppressedCells,
  };
}

export async function comparePeriods(input: {
  metricId: string;
  from: string;
  to: string;
  priorFrom: string;
  priorTo: string;
  scope: AnalyticsScope;
}): Promise<PeriodComparison> {
  const def = getMetricDefinition(input.metricId);
  if (!def || !isMetricApproved(input.metricId)) {
    return { metricId: input.metricId, metricVersion: def?.metricVersion ?? 'v0', status: 'METRIC_NOT_APPROVED', current: null, prior: null, deltaAbs: null, deltaPct: null, priorAbsent: false, currentAbsent: false, dataAsOf: null, stale: false, reconciliationStatus: 'unknown' };
  }
  const current = await computeMetric({ metricId: input.metricId, from: input.from, to: input.to, scope: input.scope });
  if (current.status !== 'OK') {
    return { metricId: input.metricId, metricVersion: def.metricVersion, status: current.status, current: null, prior: null, deltaAbs: null, deltaPct: null, priorAbsent: false, currentAbsent: false, dataAsOf: current.dataAsOf, stale: current.stale, reconciliationStatus: current.reconciliationStatus };
  }
  const prior = await computeMetric({ metricId: input.metricId, from: input.priorFrom, to: input.priorTo, scope: input.scope });
  const priorValue = prior.status === 'OK' ? (prior.value ?? 0) : null;
  const priorAbsent = prior.status !== 'OK' || priorValue === 0 || priorValue === null;
  const currentAbsent = current.value === 0 || current.value === null;
  let deltaAbs: number | null = null;
  let deltaPct: number | null = null;
  if (current.value !== null && priorValue !== null) {
    deltaAbs = current.value - priorValue;
    if (priorValue !== 0) {
      deltaPct = Math.round(((current.value - priorValue) / priorValue) * 1000) / 10;
    }
  }
  return {
    metricId: input.metricId,
    metricVersion: def.metricVersion,
    status: current.status,
    current: current.value,
    prior: priorValue,
    deltaAbs,
    deltaPct,
    priorAbsent,
    currentAbsent,
    dataAsOf: current.dataAsOf,
    stale: current.stale,
    reconciliationStatus: current.reconciliationStatus,
  };
}

export { getMetricDefinition, isMetricApproved };