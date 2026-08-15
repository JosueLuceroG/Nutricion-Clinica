export interface SemanticDimension {
  id: string;
  name: string;
  description: string;
}

export interface SemanticMetric {
  id: string;
  name: string;
  description: string;
  aggregation: 'count' | 'sum' | 'avg' | 'latest';
  source: { table: string; column: string; note: string };
  unit?: string;
}

export const DWH_DIMENSIONS: readonly SemanticDimension[] = [
  { id: 'fecha', name: 'Fecha', description: 'Dia calendario de la observacion (UTC).' },
  { id: 'sucursal', name: 'Sucursal', description: 'Sucursal propietaria de los datos fuente.' },
];

export const DWH_METRICS: readonly SemanticMetric[] = [
  {
    id: 'consultas_diarias',
    name: 'Consultas por dia',
    description: 'Total de consultas registradas por dia.',
    aggregation: 'count',
    source: { table: 'consultas', column: 'id', note: 'OLTP consultas con deleted_at IS NULL' },
  },
  {
    id: 'pacientes_nuevos_diarios',
    name: 'Pacientes nuevos por dia',
    description: 'Pacientes creados por dia.',
    aggregation: 'count',
    source: { table: 'pacientes', column: 'id', note: 'OLTP pacientes con deleted_at IS NULL' },
  },
  {
    id: 'planes_activos_diarios',
    name: 'Planes alimenticios activos por dia',
    description: 'Planes con estado active observados por dia.',
    aggregation: 'count',
    source: { table: 'planes_alimenticios', column: 'id', note: 'OLTP planes_alimenticios status = active' },
  },
  {
    id: 'adherencia_promedio_diaria',
    name: 'Adherencia promedio por dia',
    description: 'Promedio de adherencia por dia.',
    aggregation: 'avg',
    unit: '%',
    source: { table: 'adherence_records', column: 'adherence_menu+water+activity+supplements+sleep', note: 'OLTP adherence_records, promedio de las 5 subescalas' },
  },
  {
    id: 'consultas_pendientes_pago_diarias',
    name: 'Consultas pendientes de pago por dia',
    description: 'Consultas sin pago registradas por dia.',
    aggregation: 'count',
    source: { table: 'consultas', column: 'id', note: 'OLTP consultas paid = 0 y cost > 0' },
  },
];

export function listMetrics(): SemanticMetric[] {
  return [...DWH_METRICS];
}

export function getMetric(metricId: string): SemanticMetric | undefined {
  return DWH_METRICS.find((metric) => metric.id === metricId);
}

export function listDimensions(): SemanticDimension[] {
  return [...DWH_DIMENSIONS];
}