import { describe, expect, it } from 'vitest';
import { collectAllowedFields, emptyFor, filterByAllowlist } from './filterByAllowlist.js';

describe('filterByAllowlist', () => {
  it('mantiene campos de hoja permitidos y elimina desconocidos', () => {
    const value = { nombre: 'Ana', edad: 30, secreto: 'no-debe-salir', anidado: { permitido: 1, prohibido: 2 } };
    const { filtered, removed } = filterByAllowlist(value, ['nombre', 'anidado.permitido']);
    expect(filtered).toEqual({ nombre: 'Ana', anidado: { permitido: 1 } });
    expect(removed.sort()).toEqual(['anidado.prohibido', 'edad', 'secreto']);
  });

  it('aplica allowlist profunda en arrays preservando longitud', () => {
    const value = {
      labs: [
        { lab_name: 'Glucosa', results_json: '{"v":1}', oculto: true },
        { lab_name: 'HbA1c', results_json: '{"v":2}', oculto: false },
      ],
    };
    const { filtered, removed } = filterByAllowlist(value, ['labs[].lab_name', 'labs[].results_json']);
    expect(filtered).toEqual({
      labs: [
        { lab_name: 'Glucosa', results_json: '{"v":1}' },
        { lab_name: 'HbA1c', results_json: '{"v":2}' },
      ],
    });
    expect(removed).toEqual(['labs.oculto', 'labs.oculto']);
  });

  it('preserva longitud del array y vacía elementos cuando no hay campos permitidos', () => {
    const value = { consultas: [{ motivo: 'x', detalle: 'y' }, { motivo: 'a', detalle: 'b' }] };
    const { filtered, removed } = filterByAllowlist(value, ['consultas[]']);
    expect(filtered).toEqual({ consultas: [{}, {}] });
    expect(removed).toEqual(['consultas.motivo', 'consultas.detalle', 'consultas.motivo', 'consultas.detalle']);
  });

  it('elimina ramas cuyo nodo no coincide con la forma del valor', () => {
    const { filtered, removed } = filterByAllowlist({ items: [{ a: 1 }] }, ['items[].a']);
    expect(filtered).toEqual({ items: [{ a: 1 }] });
    expect(removed).toEqual([]);

    const arrayVsObject = filterByAllowlist({ plan: { kcal: 1800 } }, ['plan[].kcal']);
    expect(arrayVsObject.filtered).toEqual({ plan: null });
    expect(arrayVsObject.removed).toEqual(['plan.*']);
  });

  it('leaf permite el valor completo tal cual', () => {
    const value = { summary: 'todo el texto', extra: 1 };
    const { filtered } = filterByAllowlist(value, ['summary']);
    expect(filtered).toEqual({ summary: 'todo el texto' });
  });

  it('collectAllowedFields devuelve las rutas de hojas', () => {
    const fields = collectAllowedFields(['a.b.c', 'a.d', 'e[]']);
    expect(fields.sort()).toEqual(['a.b.c', 'a.d', 'e[]']);
  });

  it('emptyFor genera el vacío según la forma del valor', () => {
    expect(emptyFor([])).toEqual([]);
    expect(emptyFor({ a: 1 })).toEqual({});
    expect(emptyFor('texto')).toBeNull();
    expect(emptyFor(42)).toBeNull();
  });
});