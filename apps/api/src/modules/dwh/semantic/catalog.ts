/**
 * Catálogo semántico de métricas — autoritativo en el SERVIDOR.
 * El frontend NO es dueño de fórmulas. Las fórmulas se versionan.
 * Las métricas financieras quedan METRIC_NOT_APPROVED hasta resolver
 * el source-of-truth (ver FINANCIAL SOURCE MATRIX en el reporte Build 08).
 */

export type MetricStatus = 'APPROVED' | 'METRIC_NOT_APPROVED' | 'DEPRECATED';
export type MetricSensitivity = 'low' | 'moderate' | 'high';

export interface MetricDefinition {
  metricId: string;
  name: string;
  description: string;
  domain: 'clinical' | 'operational' | 'population';
  formula: string;
  grain: string;
  dimensions: Array<'sucursal' | 'professional' | 'date'>;
  filters: string[];
  owner: string;
  metricVersion: string;
  freshnessRequirementDays: number;
  sensitivity: MetricSensitivity;
  status: MetricStatus;
  sourceFacts: string[];
  lineage: string[];
  numerator?: string;
  denominator?: string;
  exclusions?: string[];
}

export const SMALL_CELL_DEFAULT_MIN = 5;

export const METRICS: readonly MetricDefinition[] = [
  {
    metricId: 'patient_count',
    name: 'Conteo de pacientes',
    description: 'Número de pacientes distintos con al menos una consulta no eliminada en el período.',
    domain: 'population',
    formula: 'COUNT(DISTINCT patient_key) FROM fact_consultation WHERE is_deleted=0 AND date_key en [from,to]',
    grain: 'paciente distinto (consultado en el período)',
    dimensions: ['sucursal', 'professional', 'date'],
    filters: ['is_deleted=0', 'rango de fecha'],
    owner: 'remediation-build-08',
    metricVersion: 'v1',
    freshnessRequirementDays: 3,
    sensitivity: 'moderate',
    status: 'APPROVED',
    sourceFacts: ['fact_consultation'],
    lineage: ['semantic.patient_count -> fact_consultation.patient_key -> etl.fact_consultation -> OLTP consultas.paciente_id'],
    exclusions: ['consultas eliminadas (is_deleted=1)'],
  },
  {
    metricId: 'new_patients',
    name: 'Pacientes nuevos',
    description: 'Pacientes cuya PRIMERA consulta no eliminada cae en el período.',
    domain: 'population',
    formula: 'COUNT(DISTINCT patient_key) CON primera consulta en [from,to] (mínimo date_key por paciente, is_deleted=0)',
    grain: 'paciente (primera consulta)',
    dimensions: ['sucursal', 'date'],
    filters: ['is_deleted=0', 'rango de fecha'],
    owner: 'remediation-build-08',
    metricVersion: 'v1',
    freshnessRequirementDays: 3,
    sensitivity: 'moderate',
    status: 'APPROVED',
    sourceFacts: ['fact_consultation'],
    lineage: ['semantic.new_patients -> MIN(fact_consultation.date_key) por patient_key -> etl.fact_consultation -> OLTP consultas'],
    exclusions: ['pacientes con consultas previas al período'],
  },
  {
    metricId: 'consultation_count',
    name: 'Volumen de consultas',
    description: 'Número de consultas registradas (no eliminadas) en el período.',
    domain: 'operational',
    formula: 'COUNT(*) FROM fact_consultation WHERE is_deleted=0 AND date_key en [from,to]',
    grain: 'una fila por consulta',
    dimensions: ['sucursal', 'professional', 'date'],
    filters: ['is_deleted=0', 'rango de fecha'],
    owner: 'remediation-build-08',
    metricVersion: 'v1',
    freshnessRequirementDays: 3,
    sensitivity: 'low',
    status: 'APPROVED',
    sourceFacts: ['fact_consultation'],
    lineage: ['semantic.consultation_count -> fact_consultation -> etl.fact_consultation -> OLTP consultas'],
    exclusions: ['consultas eliminadas'],
  },
  {
    metricId: 'avg_consultations_per_period',
    name: 'Promedio de consultas por período',
    description: 'consultation_count dividido entre el número de meses del rango solicitado.',
    domain: 'operational',
    formula: 'consultation_count / COUNT(meses distintos en [from,to])',
    grain: 'mes (período de comparación)',
    dimensions: ['sucursal', 'date'],
    filters: ['rango de fecha'],
    owner: 'remediation-build-08',
    metricVersion: 'v1',
    freshnessRequirementDays: 3,
    sensitivity: 'low',
    status: 'APPROVED',
    numerator: 'consultation_count',
    denominator: 'meses calendario en el rango',
    sourceFacts: ['fact_consultation'],
    lineage: ['semantic.avg_consultations_per_period -> consultation_count -> fact_consultation'],
    exclusions: ['meses sin consultas cuentan como 0'],
  },
  {
    metricId: 'adherence_population_summary',
    name: 'Resumen de adherencia poblacional',
    description: 'Eventos de adherencia (no eliminados) en el período y adherencia de menú promedio (0-100).',
    domain: 'clinical',
    formula: 'COUNT(*) eventos; AVG(adherence_menu) entre eventos con adherence_menu NOT NULL',
    grain: 'evento de adherencia (record_date)',
    dimensions: ['sucursal', 'date'],
    filters: ['is_deleted=0', 'rango de fecha'],
    owner: 'remediation-build-08',
    metricVersion: 'v1',
    freshnessRequirementDays: 3,
    sensitivity: 'moderate',
    status: 'APPROVED',
    numerator: 'AVG(adherence_menu)',
    denominator: 'eventos con adherence_menu NOT NULL',
    sourceFacts: ['fact_adherence'],
    lineage: ['semantic.adherence_population_summary -> fact_adherence -> etl.fact_adherence -> OLTP adherence_records'],
    exclusions: ['eventos sin adherence_menu (excluidos del promedio, documentado)'],
  },
  {
    metricId: 'anthropometry_volume',
    name: 'Volumen de mediciones antropométricas',
    description: 'Número de eventos de medición (no eliminados) en el período.',
    domain: 'clinical',
    formula: 'COUNT(*) FROM fact_anthropometry WHERE is_deleted=0 AND date_key en [from,to]',
    grain: 'evento de medición',
    dimensions: ['sucursal', 'professional', 'date'],
    filters: ['is_deleted=0', 'rango de fecha'],
    owner: 'remediation-build-08',
    metricVersion: 'v1',
    freshnessRequirementDays: 3,
    sensitivity: 'moderate',
    status: 'APPROVED',
    sourceFacts: ['fact_anthropometry'],
    lineage: ['semantic.anthropometry_volume -> fact_anthropometry -> etl.fact_anthropometry -> OLTP antropometrias'],
    exclusions: ['mediciones eliminadas'],
  },
  {
    metricId: 'meal_plan_volume',
    name: 'Volumen de planes alimenticios',
    description: 'Planes (no eliminados) iniciados en el período (start_date_key en rango).',
    domain: 'clinical',
    formula: 'COUNT(*) FROM fact_meal_plan WHERE is_deleted=0 AND start_date_key en [from,to]',
    grain: 'una fila por plan (versión autoritativa por plan)',
    dimensions: ['sucursal', 'professional', 'date'],
    filters: ['is_deleted=0', 'rango de fecha'],
    owner: 'remediation-build-08',
    metricVersion: 'v1',
    freshnessRequirementDays: 3,
    sensitivity: 'moderate',
    status: 'APPROVED',
    sourceFacts: ['fact_meal_plan'],
    lineage: ['semantic.meal_plan_volume -> fact_meal_plan -> etl.fact_meal_plan -> OLTP planes_alimenticios'],
    exclusions: ['planes eliminados'],
  },
  {
    metricId: 'lab_observation_volume',
    name: 'Volumen de observaciones de laboratorio',
    description: 'Observaciones de laboratorio (no eliminadas) en el período. Sin agregación de unidades: solo conteo.',
    domain: 'clinical',
    formula: 'COUNT(*) FROM fact_lab WHERE is_deleted=0 AND date_key en [from,to]',
    grain: 'una fila por observación',
    dimensions: ['sucursal', 'professional', 'date'],
    filters: ['is_deleted=0', 'rango de fecha'],
    owner: 'remediation-build-08',
    metricVersion: 'v1',
    freshnessRequirementDays: 3,
    sensitivity: 'moderate',
    status: 'APPROVED',
    sourceFacts: ['fact_lab'],
    lineage: ['semantic.lab_observation_volume -> fact_lab -> etl.fact_lab (OPENJSON results_json) -> OLTP lab_panels'],
    exclusions: ['observaciones de paneles eliminados'],
  },
  {
    metricId: 'revenue',
    name: 'Ingresos',
    description: 'Métricas financieras bloqueadas: semántica canónica no resuelta (ver FINANCIAL SOURCE MATRIX).',
    domain: 'operational',
    formula: 'NO DEFINIDA (no publicar)',
    grain: 'no definido',
    dimensions: ['sucursal', 'date'],
    filters: [],
    owner: 'remediation-build-08',
    metricVersion: 'v0',
    freshnessRequirementDays: 1,
    sensitivity: 'high',
    status: 'METRIC_NOT_APPROVED',
    sourceFacts: [],
    lineage: ['BLOQUEADA: consulta billing / Dexie pagos / SQL pagos / presupuestos / comprobantes / gastos'],
  },
  {
    metricId: 'collections',
    name: 'Cobros',
    description: 'Métrica financiera bloqueada (source-of-truth no resuelto).',
    domain: 'operational',
    formula: 'NO DEFINIDA',
    grain: 'no definido',
    dimensions: ['sucursal', 'date'],
    filters: [],
    owner: 'remediation-build-08',
    metricVersion: 'v0',
    freshnessRequirementDays: 1,
    sensitivity: 'high',
    status: 'METRIC_NOT_APPROVED',
    sourceFacts: [],
    lineage: ['BLOQUEADA'],
  },
  {
    metricId: 'outstanding_balance',
    name: 'Saldo pendiente',
    description: 'Métrica financiera bloqueada (source-of-truth no resuelto).',
    domain: 'operational',
    formula: 'NO DEFINIDA',
    grain: 'no definido',
    dimensions: ['sucursal', 'date'],
    filters: [],
    owner: 'remediation-build-08',
    metricVersion: 'v0',
    freshnessRequirementDays: 1,
    sensitivity: 'high',
    status: 'METRIC_NOT_APPROVED',
    sourceFacts: [],
    lineage: ['BLOQUEADA'],
  },
];

const METRIC_INDEX = new Map(METRICS.map((m) => [m.metricId, m]));

export function getMetricDefinition(metricId: string): MetricDefinition | null {
  return METRIC_INDEX.get(metricId) ?? null;
}

export function listApprovedMetrics(): MetricDefinition[] {
  return METRICS.filter((m) => m.status === 'APPROVED');
}

export function isMetricApproved(metricId: string): boolean {
  const def = METRIC_INDEX.get(metricId);
  return def !== undefined && def.status === 'APPROVED';
}