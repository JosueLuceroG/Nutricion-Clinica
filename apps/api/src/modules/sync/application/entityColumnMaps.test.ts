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

describe('entityColumnMaps — consultas: campos de pago (Sprint 14D)', () => {
  it('prepareColumnsForWrite: traduce cost/paid/payment_method/paid_at/reference/invoice_number/billing_notes', () => {
    const cols = prepareColumnsForWrite('consultas', {
      cost: 1200.5,
      paid: true,
      payment_method: 'transfer',
      paid_at: '2026-06-01T15:30:00.000Z',
      reference: 'TRF-123',
      invoice_number: 'INV-99',
      billing_notes: 'pagado en mostrador',
    });
    const byName = Object.fromEntries(cols.map((c) => [c.dbColumn, c]));
    expect(byName.cost?.value).toBe(1200.5);
    expect(byName.paid?.value).toBe(true);
    expect(byName.payment_method?.value).toBe('transfer');
    expect(byName.paid_at?.value).toBeInstanceOf(Date);
    expect(byName.reference?.value).toBe('TRF-123');
    expect(byName.invoice_number?.value).toBe('INV-99');
    expect(byName.billing_notes?.value).toBe('pagado en mostrador');
  });

  it('consultas: cost como Decimal(12,2) sin transformación', () => {
    const cols = prepareColumnsForWrite('consultas', { cost: 999.99 });
    const col = cols.find((c) => c.dbColumn === 'cost');
    expect(col?.value).toBe(999.99);
  });

  it('consultas: paid como Bit acepta boolean directo', () => {
    const cols = prepareColumnsForWrite('consultas', { paid: true });
    const col = cols.find((c) => c.dbColumn === 'paid');
    expect(col?.value).toBe(true);
  });

  it('consultas: paid_at null pasa como null', () => {
    const cols = prepareColumnsForWrite('consultas', { paid_at: null });
    const col = cols.find((c) => c.dbColumn === 'paid_at');
    expect(col?.value).toBeNull();
  });

  it('dbRowToClient: traduce fila de DB con campos de pago a objeto cliente', () => {
    const client = dbRowToClient('consultas', {
      id: 'cid-1',
      paciente_id: 'pid-1',
      profesional_id: 'pro-1',
      consultation_number: 1,
      consultation_date: new Date('2026-06-01'),
      status: 'completed',
      reason: 'Control',
      cost: 1500,
      paid: true,
      payment_method: 'cash',
      paid_at: new Date('2026-06-01T10:30:00Z'),
      reference: 'CAJA-7',
      invoice_number: null,
      billing_notes: null,
      created_at: '2026-06-01',
      updated_at: '2026-06-01',
      deleted_at: null,
    });
    expect(client.cost).toBe(1500);
    expect(client.paid).toBe(true);
    expect(client.payment_method).toBe('cash');
    expect(client.reference).toBe('CAJA-7');
    expect(client.invoice_number).toBeNull();
    expect(client.billing_notes).toBeNull();
  });

  it('getColumnMap("consultas").writableDbColumns incluye las 7 nuevas columnas de pago', () => {
    const map = getColumnMap('consultas');
    expect(map.writableDbColumns.has('cost')).toBe(true);
    expect(map.writableDbColumns.has('paid')).toBe(true);
    expect(map.writableDbColumns.has('payment_method')).toBe(true);
    expect(map.writableDbColumns.has('paid_at')).toBe(true);
    expect(map.writableDbColumns.has('reference')).toBe(true);
    expect(map.writableDbColumns.has('invoice_number')).toBe(true);
    expect(map.writableDbColumns.has('billing_notes')).toBe(true);
  });

  it('todas las entidades sincronizables tienen deleted_at en writableDbColumns (fix resurrección post-soft-delete)', () => {
    const entities = ['pacientes', 'consultas', 'antropometrias', 'lab_panels', 'planes_alimenticios'] as const;
    for (const entity of entities) {
      const map = getColumnMap(entity);
      expect(
        map.writableDbColumns.has('deleted_at'),
        `entity ${entity} no expone deleted_at como writable — el server ignorará el soft-delete y la fila volverá en la próxima pull`,
      ).toBe(true);
    }
  });
});
