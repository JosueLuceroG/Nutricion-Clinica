import { describe, it, expect } from 'vitest';
import {
  prepareColumnsForWrite,
  dbRowToClient,
  getColumnMap,
} from './entityColumnMaps.js';

describe('entityColumnMaps — pacientes', () => {
  it('clientPayloadToDb: traduce first_name → nombres y last_name → apellido_paterno', async () => {
    // Importing the legacy helper if it still exists
    const { clientPayloadToDb } = await import('./entityColumnMaps.js');
    const db = clientPayloadToDb('pacientes', {
      first_name: 'Ana',
      last_name: 'Pérez',
      second_last_name: 'García',
      birth_date: '1990-05-12T00:00:00.000Z',
      sex: 'female',
      email: 'ana@example.com',
      phone: '+52 55 1234 5678',
    });
    expect(db.nombres).toBe('Ana');
    expect(db.apellido_paterno).toBe('Pérez');
    expect(db.apellido_materno).toBe('García');
    expect(db.fecha_nacimiento).toBeInstanceOf(Date);
    expect((db.fecha_nacimiento as Date).toISOString().slice(0, 10)).toBe('1990-05-12');
    expect(db.sexo).toBe('female');
    expect(db.email).toBe('ana@example.com');
    expect(db.telefono).toBe('+52 55 1234 5678');
  });

  it('ignora campos no mapeados (whitelist)', async () => {
    const { clientPayloadToDb } = await import('./entityColumnMaps.js');
    const db = clientPayloadToDb('pacientes', {
      first_name: 'Ana',
      evil: 'DROP TABLE pacientes',
      id: 'forged-id',
    });
    expect(db.nombres).toBe('Ana');
    expect(db.evil).toBeUndefined();
    expect(db.id).toBeUndefined();
  });
});

describe('prepareColumnsForWrite — tipos SQL correctos', () => {
  it('pacientes: tipos correctos por columna', () => {
    const cols = prepareColumnsForWrite('pacientes', {
      first_name: 'Ana',
      last_name: 'Pérez',
      birth_date: '1990-05-12T00:00:00.000Z',
      sex: 'female',
      weight_kg_not_a_field: 70.5,
    });
    const byName = Object.fromEntries(cols.map((c) => [c.dbColumn, c]));
    expect(byName.nombres?.value).toBe('Ana');
    expect(byName.apellido_paterno?.value).toBe('Pérez');
    expect(byName.fecha_nacimiento?.value).toBeInstanceOf(Date);
    expect(byName.sexo?.value).toBe('female');
  });

  it('consultas: consultation_number va como Int (no string)', () => {
    const cols = prepareColumnsForWrite('consultas', {
      consultation_number: 1,
      patient_id: 'aabbccdd-1111-2222-3333-444455556666',
    });
    const byName = Object.fromEntries(cols.map((c) => [c.dbColumn, c]));
    expect(byName.consultation_number?.value).toBe(1);
    // mssql ISqlType factory — no inspeccionamos el tipo interno, solo que el valor es numérico
  });

  it('antropometrias: weight_kg como Decimal (no string)', () => {
    const cols = prepareColumnsForWrite('antropometrias', {
      weight_kg: 70.5,
      height_m: 1.7,
      measured_at: '2026-06-01T10:30:00.000Z',
    });
    const byName = Object.fromEntries(cols.map((c) => [c.dbColumn, c]));
    expect(byName.weight_kg?.value).toBe(70.5);
    expect(byName.height_m?.value).toBe(1.7);
    expect(byName.measured_at?.value).toBeInstanceOf(Date);
  });

  it('lab_panels: results se stringifica a JSON', () => {
    const cols = prepareColumnsForWrite('lab_panels', {
      results: { glucose: 95, hba1c: 5.4 },
    });
    const col = cols.find((c) => c.dbColumn === 'results_json');
    expect(col?.value).toBe('{"glucose":95,"hba1c":5.4}');
  });

  it('consultas: vitals se stringifica a JSON', () => {
    const cols = prepareColumnsForWrite('consultas', {
      vitals: { bp: '120/80', hr: 72 },
    });
    const col = cols.find((c) => c.dbColumn === 'vitals_json');
    expect(col?.value).toBe('{"bp":"120/80","hr":72}');
  });

  it('pacientes: clinical_tags se stringifica', () => {
    const cols = prepareColumnsForWrite('pacientes', {
      clinical_tags: ['diabetes', 'hipertension'],
    });
    const col = cols.find((c) => c.dbColumn === 'clinical_tags_json');
    expect(col?.value).toBe('["diabetes","hipertension"]');
  });

  it('pacientes: clinical_tags null pasa como null (no string "null")', () => {
    const cols = prepareColumnsForWrite('pacientes', {
      clinical_tags: null,
    });
    const col = cols.find((c) => c.dbColumn === 'clinical_tags_json');
    expect(col?.value).toBeNull();
  });

  it('pacientes: record_status "active" → "open" (DB CHECK constraint)', () => {
    const cols = prepareColumnsForWrite('pacientes', { record_status: 'active' });
    const col = cols.find((c) => c.dbColumn === 'record_status');
    expect(col?.value).toBe('open');
  });

  it('pacientes: record_status "discharged" / "inactive" / "referred" → "closed"', () => {
    for (const v of ['discharged', 'inactive', 'referred']) {
      const cols = prepareColumnsForWrite('pacientes', { record_status: v });
      const col = cols.find((c) => c.dbColumn === 'record_status');
      expect(col?.value).toBe('closed');
    }
  });

  it('planes_alimenticios: kcal_target, protein_target_g como Int', () => {
    const cols = prepareColumnsForWrite('planes_alimenticios', {
      kcal_target: 1800,
      protein_target_g: 90,
    });
    const byName = Object.fromEntries(cols.map((c) => [c.dbColumn, c]));
    expect(byName.kcal_target?.value).toBe(1800);
    expect(byName.protein_target_g?.value).toBe(90);
  });

  it('fechas: convierte ISO string a Date object (mssql acepta Date, no ISO con Z)', () => {
    const cols = prepareColumnsForWrite('pacientes', {
      birth_date: '1990-05-12T00:00:00.000Z',
    });
    const col = cols.find((c) => c.dbColumn === 'fecha_nacimiento');
    expect(col?.value).toBeInstanceOf(Date);
    expect((col?.value as Date).toISOString().slice(0, 10)).toBe('1990-05-12');
  });

  it('ignora campos no presentes en el payload (no emite columnas vacías)', () => {
    const cols = prepareColumnsForWrite('pacientes', { first_name: 'Ana' });
    const colNames = cols.map((c) => c.dbColumn);
    expect(colNames).toEqual(['nombres']);
  });

  it('ignora undefined (no nulos accidentales)', () => {
    const cols = prepareColumnsForWrite('pacientes', {
      first_name: 'Ana',
      last_name: undefined,
    });
    const colNames = cols.map((c) => c.dbColumn);
    expect(colNames).toEqual(['nombres']);
  });
});

describe('dbRowToClient', () => {
  it('pacientes: traduce columnas DB → campos cliente', () => {
    const client = dbRowToClient('pacientes', {
      id: 'abc-123',
      nombres: 'Ana',
      apellido_paterno: 'Pérez',
      apellido_materno: null,
      fecha_nacimiento: new Date('1990-05-12'),
      sexo: 'female',
      email: 'ana@example.com',
      telefono: '+52 55 1234 5678',
      created_at: '2026-01-01',
      updated_at: '2026-01-02',
      deleted_at: null,
    });
    expect(client.first_name).toBe('Ana');
    expect(client.last_name).toBe('Pérez');
    expect(client.second_last_name).toBeNull();
    expect(client.birth_date).toBeInstanceOf(Date);
    expect(client.sex).toBe('female');
    expect(client.email).toBe('ana@example.com');
    expect(client.phone).toBe('+52 55 1234 5678');
    // sistema se pasa
    expect(client.id).toBe('abc-123');
    expect(client.created_at).toBe('2026-01-01');
    expect(client.deleted_at).toBeNull();
    // columnas que el cliente no quiere, se filtran
    expect(client.sucursal_id).toBeUndefined();
    expect(client.row_version).toBeUndefined();
  });

  it('getColumnMap lanza error para entidad desconocida', () => {
    // @ts-expect-error — test defensivo
    expect(() => getColumnMap('inventado')).toThrow();
  });
});
