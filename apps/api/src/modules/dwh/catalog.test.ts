import { describe, expect, it } from 'vitest';
import { getMetric, listDimensions, listMetrics } from './catalog.js';

describe('catalogo semantico', () => {
  it('lists metrics and dimensions with lineage metadata', () => {
    const metrics = listMetrics();
    expect(metrics.length).toBeGreaterThanOrEqual(5);
    for (const metric of metrics) {
      expect(metric.id).toBeTruthy();
      expect(metric.source.table).toBeTruthy();
      expect(metric.source.note).toBeTruthy();
    }
    expect(listDimensions().map((d) => d.id)).toEqual(['fecha', 'sucursal']);
  });

  it('resolves metrics by id and rejects unknown ids', () => {
    expect(getMetric('consultas_diarias')).toBeDefined();
    expect(getMetric('no_existe')).toBeUndefined();
  });

  it('documents that OLTP keeps clinical authority', () => {
    const consultas = getMetric('consultas_diarias');
    expect(consultas?.source.table).toBe('consultas');
  });
});