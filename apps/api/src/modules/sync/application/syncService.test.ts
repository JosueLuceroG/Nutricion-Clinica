import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockRequestInput, mockRequestQuery, mockPoolRequest, mockGetPool, mockTransaction } = vi.hoisted(() => {
  const mockRequestInput = vi.fn().mockReturnThis();
  const mockRequestQuery = vi.fn();
  const mockPoolRequest = vi.fn(() => ({ input: mockRequestInput, query: mockRequestQuery }));
  const mockTransaction = vi.fn(() => ({
    begin: vi.fn(async () => {}),
    commit: vi.fn(async () => {}),
    rollback: vi.fn(async () => {}),
    request: mockPoolRequest,
  }));
  return {
    mockRequestInput,
    mockRequestQuery,
    mockPoolRequest,
    mockTransaction,
    mockGetPool: vi.fn(async () => ({ request: mockPoolRequest, transaction: mockTransaction })),
  };
});

vi.mock('mssql', () => {
  const NVarChar = (n: number) => ({ type: 'NVarChar', length: n });
  const UniqueIdentifier = () => ({ type: 'UniqueIdentifier' });
  const DateTime2 = () => ({ type: 'DateTime2' });
  const Date = () => ({ type: 'Date' });
  const Int = () => ({ type: 'Int' });
  const Decimal = (p: number, s: number) => ({ type: 'Decimal', precision: p, scale: s });
  const Bit = () => ({ type: 'Bit' });
  const MAX = { type: 'NVarChar', length: 'max' };
  return {
    default: { NVarChar, UniqueIdentifier, DateTime2, Date, Int, Decimal, Bit, MAX },
  };
});

vi.mock('../../../db/connection.js', () => ({
  getPool: mockGetPool,
  closePool: vi.fn(),
}));

import { getManifest, pullChanges, pushBatch } from './syncService.js';

beforeEach(() => {
  vi.clearAllMocks();
  mockRequestInput.mockReturnThis();
  mockPoolRequest.mockImplementation(() => ({ input: mockRequestInput, query: mockRequestQuery }));
  // default: empty recordset (avoids contaminating entity queries with time query default)
  mockRequestQuery.mockResolvedValue({ recordset: [] });
});

describe('syncService.getManifest', () => {
  it('retorna manifest con entidades, schema y capabilities', async () => {
    mockRequestQuery.mockResolvedValueOnce({ recordset: [{ t: new Date('2026-06-04T00:00:00.000Z') }] });
    const m = await getManifest();
    expect(m.apiVersion).toBe('v1');
    expect(m.syncSchemaVersion).toBe(2);
    expect(m.entities).toContain('pacientes');
    expect(m.entities).toContain('consultas');
    expect(m.entities).toContain('antropometrias');
    expect(m.entities).toContain('lab_panels');
    expect(m.entities).toContain('planes_alimenticios');
    expect(m.maxBatchSize).toBe(500);
    expect(m.supportsDelta).toBe(true);
    expect(m.serverTime).toBe('2026-06-04T00:00:00.000Z');
  });
});

describe('syncService.pullChanges', () => {
  it('cursor inválido cae a epoch (primer pull completo) sin lanzar', async () => {
    const time = { recordset: [{ t: new Date('2026-06-04T00:00:00.000Z') }] };
    mockRequestQuery
      .mockResolvedValueOnce({ recordset: [] }) // entity 1 pacientes
      .mockResolvedValueOnce({ recordset: [] }) // entity 2 consultas
      .mockResolvedValueOnce({ recordset: [] }) // entity 3 antropometrias
      .mockResolvedValueOnce({ recordset: [] }) // entity 4 lab_panels
      .mockResolvedValueOnce({ recordset: [] }) // entity 5 planes
      .mockResolvedValueOnce({ recordset: [] }) // entity 6 adherence_records
      .mockResolvedValueOnce(time); // final time

    const r = await pullChanges('s1', { pacientes: 'not-a-date@x' }, null);
    expect(r.changes).toEqual([]);
    expect(r.hasMore).toBe(false);
    const pageSql = mockRequestQuery.mock.calls[0]![0] as string;
    expect(pageSql).toContain('updated_at > @since');
  });

  it('retorna cambios vac\u00edos cuando no hay rows y no avanza cursors', async () => {
    const time = { recordset: [{ t: new Date('2026-06-04T00:00:00.000Z') }] };
    mockRequestQuery
      .mockResolvedValueOnce({ recordset: [] }) // entity 1 pacientes
      .mockResolvedValueOnce({ recordset: [] }) // entity 2 consultas
      .mockResolvedValueOnce({ recordset: [] }) // entity 3 antropometrias
      .mockResolvedValueOnce({ recordset: [] }) // entity 4 lab_panels
      .mockResolvedValueOnce({ recordset: [] }) // entity 5 planes
      .mockResolvedValueOnce({ recordset: [] }) // entity 6 adherence_records
      .mockResolvedValueOnce(time); // final time

    const r = await pullChanges('s1', null, null);
    expect(r.changes).toEqual([]);
    expect(r.hasMore).toBe(false);
    expect(r.cursors).toEqual({});
  });

  it('convierte rows del DB a SyncPullChange[] con op=update/delete', async () => {
    const time = { recordset: [{ t: new Date('2026-06-04T00:00:00.000Z') }] };
    mockRequestQuery
      .mockResolvedValueOnce({
        // entity 1 pacientes (2 rows)
        recordset: [
          { id: 'a1', row_version: Buffer.from([1, 2, 3]), updated_at: new Date('2026-06-01'), deleted_at: null },
          {
            id: 'a2',
            row_version: Buffer.from([4, 5, 6]),
            updated_at: new Date('2026-06-02'),
            deleted_at: new Date('2026-06-02'),
          },
        ],
      })
      .mockResolvedValueOnce({ recordset: [{ nombres: 'Ana' }] }) // detail a1
      .mockResolvedValueOnce({ recordset: [{ nombres: 'Beto' }] }) // detail a2
      .mockResolvedValueOnce({ recordset: [] }) // entity 2 consultas
      .mockResolvedValueOnce({ recordset: [] }) // entity 3 antropometrias
      .mockResolvedValueOnce({ recordset: [] }) // entity 4 lab_panels
      .mockResolvedValueOnce({ recordset: [] }) // entity 5 planes
      .mockResolvedValueOnce({ recordset: [] }) // entity 6 adherence_records
      .mockResolvedValueOnce(time); // final time

    const r = await pullChanges('s1', null, null);
    expect(r.changes).toHaveLength(2);
    expect(r.changes[0]!.op).toBe('update');
    expect(r.changes[1]!.op).toBe('delete');
    expect(r.changes[0]!.serverRowVersion).toBeTruthy();
    // cursor por entidad avanzado a la última fila (t@id)
    expect(r.cursors.pacientes).toBe('2026-06-02T00:00:00.000Z@a2');
  });

  it('usa el cursor por-entidad para paginar sin saltarse filas con mismo updated_at', async () => {
    const time = { recordset: [{ t: new Date('2026-06-04T00:00:00.000Z') }] };
    mockRequestQuery
      .mockResolvedValueOnce({
        // entity 1 pacientes truncado (PULL_PAGE_SIZE + 1 filas)
        recordset: [
          ...Array.from({ length: 1000 }, (_, i) => ({
            id: `aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa${String(i).padStart(3, '0')}`,
            row_version: Buffer.from([i]),
            updated_at: new Date('2026-06-01T00:00:00.000Z'),
            deleted_at: null,
          })),
          {
            id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
            row_version: Buffer.from([9]),
            updated_at: new Date('2026-06-01T00:00:00.000Z'),
            deleted_at: null,
          },
        ],
      })
      .mockResolvedValueOnce({ recordset: [] }) // entity 2 consultas
      .mockResolvedValueOnce({ recordset: [] }) // entity 3 antropometrias
      .mockResolvedValueOnce({ recordset: [] }) // entity 4 lab_panels
      .mockResolvedValueOnce({ recordset: [] }) // entity 5 planes
      .mockResolvedValueOnce({ recordset: [] }) // entity 6 adherence_records
      .mockResolvedValueOnce(time); // final time

    const r = await pullChanges('s1', null, null);
    expect(r.hasMore).toBe(true);
    // el cursor apunta a la última fila de la página con su id (tiebreaker
    // para filas con updated_at idéntico), no solo al timestamp
    expect(r.cursors.pacientes).toBe('2026-06-01T00:00:00.000Z@aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa999');
    expect(r.changes).toHaveLength(1000);

    // la query de página incluye el tiebreaker (updated_at = @since AND id > @last_id)
    const pageSql = mockRequestQuery.mock.calls[0]![0] as string;
    expect(pageSql).toContain('(updated_at > @since OR (updated_at = @since AND id > @last_id))');
    expect(pageSql).toContain('ORDER BY updated_at ASC, id ASC');
  });

  it('avanza el cursor por-entidad y respeta el filtro de entidades', async () => {
    const time = { recordset: [{ t: new Date('2026-06-04T00:00:00.000Z') }] };
    mockRequestQuery
      .mockResolvedValueOnce({
        // pacientes: 1 fila nueva desde su cursor
        recordset: [
          {
            id: 'a2',
            row_version: Buffer.from([1]),
            updated_at: new Date('2026-06-02'),
            deleted_at: null,
          },
        ],
      })
      .mockResolvedValueOnce({ recordset: [{ nombres: 'Ana' }] }) // detail a2
      .mockResolvedValueOnce({ recordset: [] }) // consultas: sin cambios
      .mockResolvedValueOnce(time);

    const r = await pullChanges('s1', { pacientes: '2026-06-01T00:00:00.000Z@a1' }, ['pacientes', 'consultas']);
    expect(r.hasMore).toBe(false);
    // el cursor de pacientes avanza a la última fila vista
    expect(r.cursors.pacientes).toBe('2026-06-02T00:00:00.000Z@a2');
    // consultas no reporta cursor (no hubo rows nuevas; el cliente conserva el suyo)
    expect(r.cursors.consultas).toBeUndefined();
  });
});

const TEST_PROFESIONAL = '00000000-0000-0000-0000-000000000777';
const TEST_ACTOR = { id: TEST_PROFESIONAL, role: 'admin' as const };

describe('syncService.pushBatch', () => {
  it('prevalida todas las operaciones antes de abrir SQL', async () => {
    const billingActor = { id: TEST_PROFESIONAL, role: 'facturacion' as const };

    await expect(
      pushBatch(
        {
          sucursalId: '00000000-0000-0000-0000-000000000001',
          operations: [
            {
              entity: 'consultas',
              id: '00000000-0000-0000-0000-000000000020',
              op: 'update',
              payload: { payment_status: 'paid' },
              clientUpdatedAt: '2026-06-04T00:00:00.000Z',
            },
            {
              entity: 'pacientes',
              id: '00000000-0000-0000-0000-000000000010',
              op: 'delete',
              payload: null,
              clientUpdatedAt: '2026-06-04T00:00:00.000Z',
            },
          ],
        },
        billingActor,
      ),
    ).rejects.toMatchObject({ status: 403, violations: expect.any(Array) });

    expect(mockGetPool).not.toHaveBeenCalled();
    expect(mockRequestQuery).not.toHaveBeenCalled();
  });

  it('rechaza batch vacío antes de abrir SQL', async () => {
    await expect(pushBatch({ sucursalId: '00000000-0000-0000-0000-000000000001', operations: [] }, TEST_ACTOR)).rejects.toMatchObject({ status: 400 });
    expect(mockGetPool).not.toHaveBeenCalled();
  });

  it('procesa delete + update y reporta applied', async () => {
    mockRequestQuery
      // delete op 1
      .mockResolvedValueOnce({ rowsAffected: [1] })
      // update op 2: check exists
      .mockResolvedValueOnce({ recordset: [{ id: 'x' }] });

    const r = await pushBatch(
      {
        sucursalId: '00000000-0000-0000-0000-000000000001',
        operations: [
          {
            entity: 'pacientes',
            id: '00000000-0000-0000-0000-000000000010',
            op: 'delete',
            payload: null,
            clientUpdatedAt: '2026-06-04T00:00:00.000Z',
          },
          {
            entity: 'consultas',
            id: '00000000-0000-0000-0000-000000000020',
            op: 'update',
            payload: {},
            clientUpdatedAt: '2026-06-04T00:00:00.000Z',
          },
        ],
      },
      TEST_ACTOR,
    );

    expect(r.results).toHaveLength(2);
    expect(r.results[0]!.status).toBe('applied');
    expect(r.results[1]!.status).toBe('applied');
  });

  it('create: traduce campos cliente (first_name) a columnas DB (nombres) en el INSERT', async () => {
    mockRequestQuery
      // exists check → no existe
      .mockResolvedValueOnce({ recordset: [] })
      // INSERT real
      .mockResolvedValueOnce({ rowsAffected: [1] });

    const r = await pushBatch(
      {
        sucursalId: '00000000-0000-0000-0000-000000000001',
        operations: [
          {
            entity: 'pacientes',
            id: '00000000-0000-0000-0000-000000000099',
            op: 'create',
            payload: {
              first_name: 'Ana',
              last_name: 'Pérez',
              second_last_name: null,
              birth_date: '1990-05-12T00:00:00.000Z',
              sex: 'female',
              email: 'ana@example.com',
              phone: '+52 55 1234 5678',
            },
            clientUpdatedAt: '2026-06-04T00:00:00.000Z',
          },
        ],
      },
      TEST_ACTOR,
    );

    expect(r.results[0]!.status).toBe('applied');
    // El INSERT ejecutado debe tener las columnas DB en español
    const insertCall = mockRequestQuery.mock.calls[1]!;
    const sqlText = insertCall[0] as string;
    expect(sqlText).toContain('INSERT INTO pacientes');
    expect(sqlText).toContain('[nombres]');
    expect(sqlText).toContain('[apellido_paterno]');
    expect(sqlText).toContain('[apellido_materno]');
    expect(sqlText).toContain('[fecha_nacimiento]');
    expect(sqlText).toContain('[sexo]');
    expect(sqlText).toContain('[email]');
    expect(sqlText).toContain('[telefono]');
    // NO debe usar nombres de columna del cliente
    expect(sqlText).not.toContain('first_name');
    expect(sqlText).not.toContain('last_name');
  });

  it('create: si la fila ya existe, devuelve applied (idempotencia)', async () => {
    mockRequestQuery.mockResolvedValueOnce({ recordset: [{ id: 'x' }] });

    const r = await pushBatch(
      {
        sucursalId: '00000000-0000-0000-0000-000000000001',
        operations: [
          {
            entity: 'pacientes',
            id: '00000000-0000-0000-0000-000000000099',
            op: 'create',
            payload: { first_name: 'Ana' },
            clientUpdatedAt: '2026-06-04T00:00:00.000Z',
          },
        ],
      },
      TEST_ACTOR,
    );
    expect(r.results[0]!.status).toBe('applied');
  });

  it('consulta: inyecta profesional_id desde el JWT si el cliente no lo envía', async () => {
    mockRequestQuery
      .mockResolvedValueOnce({ recordset: [] })
      .mockResolvedValueOnce({ recordset: [{ id: 'p1' }] })
      .mockResolvedValueOnce({ rowsAffected: [1] });

    await pushBatch(
      {
        sucursalId: '00000000-0000-0000-0000-000000000001',
        operations: [
          {
            entity: 'consultas',
            id: '00000000-0000-0000-0000-000000000099',
            op: 'create',
            payload: {
              patient_id: '00000000-0000-0000-0000-000000000010',
              consultation_date: '2026-06-01T10:00:00.000Z',
              reason: 'control',
            },
            clientUpdatedAt: '2026-06-04T00:00:00.000Z',
          },
        ],
      },
      TEST_ACTOR,
    );

    const inputs = mockRequestInput.mock.calls;
    const profCall = inputs.find((c) => (c[0] as string) === 'c_profesional_id');
    expect(profCall).toBeDefined();
    expect(profCall![2]).toBe(TEST_PROFESIONAL);
    const insertSql = mockRequestQuery.mock.calls[2]![0] as string;
    expect(insertSql).toContain('[profesional_id]');
  });

  it('antropometria + lab_panel: inyecta profesional_id', async () => {
    mockRequestQuery
      .mockResolvedValueOnce({ recordset: [] })
      .mockResolvedValueOnce({ recordset: [{ id: 'p1' }] })
      .mockResolvedValueOnce({ rowsAffected: [1] })
      .mockResolvedValueOnce({ recordset: [] })
      .mockResolvedValueOnce({ recordset: [{ id: 'p1' }] })
      .mockResolvedValueOnce({ rowsAffected: [1] });

    await pushBatch(
      {
        sucursalId: '00000000-0000-0000-0000-000000000001',
        operations: [
          {
            entity: 'antropometrias',
            id: '00000000-0000-0000-0000-000000000099',
            op: 'create',
            payload: {
              patient_id: '00000000-0000-0000-0000-000000000010',
              measured_at: '2026-06-01T00:00:00.000Z',
              weight_kg: 70,
              height_m: 1.7,
            },
            clientUpdatedAt: '2026-06-04T00:00:00.000Z',
          },
          {
            entity: 'lab_panels',
            id: '00000000-0000-0000-0000-000000000098',
            op: 'create',
            payload: {
              patient_id: '00000000-0000-0000-0000-000000000010',
              taken_at: '2026-06-01T00:00:00.000Z',
              results: { glucose: 95 },
            },
            clientUpdatedAt: '2026-06-04T00:00:00.000Z',
          },
        ],
      },
      TEST_ACTOR,
    );

    const inputs = mockRequestInput.mock.calls;
    const profCalls = inputs.filter((c) => (c[0] as string) === 'c_profesional_id');
    expect(profCalls.length).toBe(2);
    expect(profCalls.every((c) => c[2] === TEST_PROFESIONAL)).toBe(true);
  });

  it('plan SIN consulta_id en payload: falla con error claro (FK no inferrible)', async () => {
    const r = await pushBatch(
      {
        sucursalId: '00000000-0000-0000-0000-000000000001',
        operations: [
          {
            entity: 'planes_alimenticios',
            id: '00000000-0000-0000-0000-000000000099',
            op: 'create',
            payload: {
              patient_id: '00000000-0000-0000-0000-000000000010',
              name: 'Plan A',
              start_date: '2026-06-01T00:00:00.000Z',
              kcal_target: 1800,
              protein_target_g: 90,
              carbs_target_g: 200,
              fat_target_g: 60,
              meals: [],
              status: 'active',
            },
            clientUpdatedAt: '2026-06-04T00:00:00.000Z',
          },
        ],
      },
      TEST_ACTOR,
    );

    expect(r.results[0]!.status).toBe('error');
    expect(r.results[0]!.error).toContain('consulta_id');
  });

  it('plan CON consulta_id: inyecta profesional_id y crea', async () => {
    mockRequestQuery
      .mockResolvedValueOnce({ recordset: [] })
      .mockResolvedValueOnce({ recordset: [{ id: 'p1' }] })
      .mockResolvedValueOnce({ recordset: [{ id: 'c1' }] })
      .mockResolvedValueOnce({ rowsAffected: [1] });

    const r = await pushBatch(
      {
        sucursalId: '00000000-0000-0000-0000-000000000001',
        operations: [
          {
            entity: 'planes_alimenticios',
            id: '00000000-0000-0000-0000-000000000099',
            op: 'create',
            payload: {
              patient_id: '00000000-0000-0000-0000-000000000010',
              consulta_id: '00000000-0000-0000-0000-000000000050',
              name: 'Plan A',
              start_date: '2026-06-01T00:00:00.000Z',
              kcal_target: 1800,
              protein_target_g: 90,
              carbs_target_g: 200,
              fat_target_g: 60,
              meals: [],
              status: 'active',
            },
            clientUpdatedAt: '2026-06-04T00:00:00.000Z',
          },
        ],
      },
      TEST_ACTOR,
    );

    expect(r.results[0]!.status).toBe('applied');
  });

  it('create: pasa tipos SQL correctos a mssql (Int, Decimal, NVarChar)', async () => {
    mockRequestQuery
      .mockResolvedValueOnce({ recordset: [] })
      .mockResolvedValueOnce({ recordset: [{ id: 'p1' }] })
      .mockResolvedValueOnce({ rowsAffected: [1] });

    await pushBatch(
      {
        sucursalId: '00000000-0000-0000-0000-000000000001',
        operations: [
          {
            entity: 'antropometrias',
            id: '00000000-0000-0000-0000-000000000099',
            op: 'create',
            payload: {
              patient_id: '00000000-0000-0000-0000-000000000010',
              profesional_id: '00000000-0000-0000-0000-000000000020',
              measured_at: '2026-06-01T10:30:00.000Z',
              weight_kg: 70.5,
              height_m: 1.7,
            },
            clientUpdatedAt: '2026-06-04T00:00:00.000Z',
          },
        ],
      },
      TEST_ACTOR,
    );

    // Verificamos que mockRequestInput se llamó con los tipos correctos
    const inputs = mockRequestInput.mock.calls;
    const typesByName: Record<string, string> = {};
    for (const call of inputs) {
      const [name, type] = call as [string, { type?: string }];
      if (type?.type) typesByName[name] = type.type;
    }
    expect(typesByName['c_weight_kg']).toBe('Decimal');
    expect(typesByName['c_height_m']).toBe('Decimal');
    expect(typesByName['c_measured_at']).toBe('DateTime2');
  });

  it('create: rechaza referencias clínicas fuera de la sucursal del batch', async () => {
    mockRequestQuery.mockResolvedValueOnce({ recordset: [] }).mockResolvedValueOnce({ recordset: [] });

    const r = await pushBatch(
      {
        sucursalId: '00000000-0000-0000-0000-000000000001',
        operations: [
          {
            entity: 'consultas',
            id: '00000000-0000-0000-0000-000000000099',
            op: 'create',
            payload: {
              patient_id: '00000000-0000-0000-0000-000000000010',
              consultation_date: '2026-06-01T10:00:00.000Z',
              reason: 'control',
            },
            clientUpdatedAt: '2026-06-04T00:00:00.000Z',
          },
        ],
      },
      TEST_ACTOR,
    );

    expect(r.results[0]!.status).toBe('error');
    expect(r.results[0]!.error).toContain('Paciente no encontrado');
    const validationSql = mockRequestQuery.mock.calls[1]![0] as string;
    expect(validationSql).toContain('sucursal_id = @sucursal_id');
  });

  it('create: clinical_tags se serializa a JSON string para NVARCHAR(MAX)', async () => {
    mockRequestQuery.mockResolvedValueOnce({ recordset: [] }).mockResolvedValueOnce({ rowsAffected: [1] });

    await pushBatch(
      {
        sucursalId: '00000000-0000-0000-0000-000000000001',
        operations: [
          {
            entity: 'pacientes',
            id: '00000000-0000-0000-0000-000000000099',
            op: 'create',
            payload: {
              first_name: 'Ana',
              last_name: 'Pérez',
              birth_date: '1990-05-12T00:00:00.000Z',
              sex: 'female',
              clinical_tags: ['diabetes', 'hipertension'],
            },
            clientUpdatedAt: '2026-06-04T00:00:00.000Z',
          },
        ],
      },
      TEST_ACTOR,
    );

    const inputs = mockRequestInput.mock.calls;
    const tagsCall = inputs.find((c) => (c[0] as string) === 'c_clinical_tags_json');
    expect(tagsCall).toBeDefined();
    expect(tagsCall![2] as string).toBe('["diabetes","hipertension"]');
  });

  it('create: record_status "active" del cliente se traduce a "open" para el CHECK constraint', async () => {
    mockRequestQuery.mockResolvedValueOnce({ recordset: [] }).mockResolvedValueOnce({ rowsAffected: [1] });

    await pushBatch(
      {
        sucursalId: '00000000-0000-0000-0000-000000000001',
        operations: [
          {
            entity: 'pacientes',
            id: '00000000-0000-0000-0000-000000000099',
            op: 'create',
            payload: {
              first_name: 'Ana',
              last_name: 'Pérez',
              birth_date: '1990-05-12T00:00:00.000Z',
              sex: 'female',
              record_status: 'active',
            },
            clientUpdatedAt: '2026-06-04T00:00:00.000Z',
          },
        ],
      },
      TEST_ACTOR,
    );

    const inputs = mockRequestInput.mock.calls;
    const rsCall = inputs.find((c) => (c[0] as string) === 'c_record_status');
    expect(rsCall).toBeDefined();
    expect(rsCall![2]).toBe('open');
  });

  it('update con expectedRowVersion conflictivo devuelve conflict', async () => {
    mockRequestQuery.mockResolvedValueOnce({
      recordset: [{ row_version: Buffer.from([9, 9, 9]), updated_at: new Date('2026-06-03') }],
    });

    const r = await pushBatch(
      {
        sucursalId: '00000000-0000-0000-0000-000000000001',
        operations: [
          {
            entity: 'pacientes',
            id: '00000000-0000-0000-0000-000000000099',
            op: 'update',
            payload: { first_name: 'Ana' },
            clientUpdatedAt: '2026-06-04T00:00:00.000Z',
            expectedRowVersion: 'AAA=',
          },
        ],
      },
      TEST_ACTOR,
    );
    expect(r.results[0]!.status).toBe('conflict');
  });

  it('update con exists devuelve applied y traduce columnas', async () => {
    mockRequestQuery
      // no expectedRowVersion → skip the conflict check
      .mockResolvedValueOnce({ recordset: [{ id: 'x' }] }) // exists
      .mockResolvedValueOnce({ rowsAffected: [1] }); // UPDATE

    const r = await pushBatch(
      {
        sucursalId: '00000000-0000-0000-0000-000000000001',
        operations: [
          {
            entity: 'pacientes',
            id: '00000000-0000-0000-0000-000000000099',
            op: 'update',
            payload: { first_name: 'Ana María' },
            clientUpdatedAt: '2026-06-04T00:00:00.000Z',
          },
        ],
      },
      TEST_ACTOR,
    );
    expect(r.results[0]!.status).toBe('applied');
    const updateSql = mockRequestQuery.mock.calls[1]![0] as string;
    expect(updateSql).toContain('UPDATE pacientes');
    expect(updateSql).toContain('[nombres] = @u_nombres');
    expect(updateSql).toContain('updated_at = SYSUTCDATETIME()');
  });

  it('captura error de operación y lo reporta en results', async () => {
    const time = { recordset: [{ t: new Date('2026-06-04T00:00:00.000Z') }] };
    mockRequestQuery.mockRejectedValueOnce(new Error('DB timeout')).mockResolvedValueOnce(time);

    const r = await pushBatch(
      {
        sucursalId: '00000000-0000-0000-0000-000000000001',
        operations: [
          {
            entity: 'pacientes',
            id: '00000000-0000-0000-0000-000000000010',
            op: 'delete',
            payload: null,
            clientUpdatedAt: '2026-06-04T00:00:00.000Z',
          },
        ],
      },
      TEST_ACTOR,
    );
    expect(r.results[0]!.status).toBe('error');
    expect(r.results[0]!.error).toContain('DB timeout');
  });

  it('update con expectedRowVersion conflictivo devuelve conflict', async () => {
    mockRequestQuery.mockResolvedValueOnce({
      recordset: [{ row_version: Buffer.from([9, 9, 9]), updated_at: new Date('2026-06-03') }],
    });

    const r = await pushBatch(
      {
        sucursalId: '00000000-0000-0000-0000-000000000001',
        operations: [
          {
            entity: 'pacientes',
            id: '00000000-0000-0000-0000-000000000099',
            op: 'update',
            payload: { first_name: 'Ana' },
            clientUpdatedAt: '2026-06-04T00:00:00.000Z',
            expectedRowVersion: 'AAA=',
          },
        ],
      },
      TEST_ACTOR,
    );
    expect(r.results[0]!.status).toBe('conflict');
  });

  it('update con exists devuelve applied y traduce columnas', async () => {
    mockRequestQuery
      // no expectedRowVersion → skip the conflict check
      .mockResolvedValueOnce({ recordset: [{ id: 'x' }] }) // exists
      .mockResolvedValueOnce({ rowsAffected: [1] }); // UPDATE

    const r = await pushBatch(
      {
        sucursalId: '00000000-0000-0000-0000-000000000001',
        operations: [
          {
            entity: 'pacientes',
            id: '00000000-0000-0000-0000-000000000099',
            op: 'update',
            payload: { first_name: 'Ana María' },
            clientUpdatedAt: '2026-06-04T00:00:00.000Z',
          },
        ],
      },
      TEST_ACTOR,
    );
    expect(r.results[0]!.status).toBe('applied');
    const updateSql = mockRequestQuery.mock.calls[1]![0] as string;
    expect(updateSql).toContain('UPDATE pacientes');
    expect(updateSql).toContain('[nombres] = @u_nombres');
    expect(updateSql).toContain('updated_at = SYSUTCDATETIME()');
  });

  it('restore: op=update sobre fila soft-deleted la revive (set deleted_at = NULL)', async () => {
    // La primera query es el "exists" con deleted_at. La fila existe
    // y deleted_at está setteado. La segunda query es el UPDATE que
    // debe incluir `deleted_at = NULL` y NO el filtro `deleted_at IS NULL`.
    mockRequestQuery.mockResolvedValueOnce({ recordset: [{ id: 'x', deleted_at: new Date('2026-06-01') }] }).mockResolvedValueOnce({ rowsAffected: [1] });

    const r = await pushBatch(
      {
        sucursalId: '00000000-0000-0000-0000-000000000001',
        operations: [
          {
            entity: 'pacientes',
            id: '00000000-0000-0000-0000-000000000099',
            op: 'update',
            payload: { first_name: 'Ana María', status: 'active' },
            clientUpdatedAt: '2026-06-04T00:00:00.000Z',
          },
        ],
      },
      TEST_ACTOR,
    );
    expect(r.results[0]!.status).toBe('applied');
    const updateSql = mockRequestQuery.mock.calls[1]![0] as string;
    expect(updateSql).toContain('UPDATE pacientes');
    expect(updateSql).toContain('deleted_at = NULL');
    // El WHERE no debe filtrar por deleted_at (estamos reviviendo)
    expect(updateSql).not.toMatch(/WHERE.*deleted_at IS NULL/i);
  });

  it('update sobre fila no existente devuelve applied con error (idempotente)', async () => {
    mockRequestQuery.mockResolvedValueOnce({ recordset: [] }); // exists vacío
    const r = await pushBatch(
      {
        sucursalId: '00000000-0000-0000-0000-000000000001',
        operations: [
          {
            entity: 'pacientes',
            id: '00000000-0000-0000-0000-000000000099',
            op: 'update',
            payload: { first_name: 'Ana' },
            clientUpdatedAt: '2026-06-04T00:00:00.000Z',
          },
        ],
      },
      TEST_ACTOR,
    );
    expect(r.results[0]!.status).toBe('applied');
    expect(r.results[0]!.error).toContain('not found');
  });

  it('cada operación corre en transacción: commit al aplicar', async () => {
    mockRequestQuery.mockResolvedValueOnce({ rowsAffected: [1] }); // UPDATE delete

    const r = await pushBatch(
      {
        sucursalId: '00000000-0000-0000-0000-000000000001',
        operations: [
          {
            entity: 'pacientes',
            id: '00000000-0000-0000-0000-000000000010',
            op: 'delete',
            payload: null,
            clientUpdatedAt: '2026-06-04T00:00:00.000Z',
          },
        ],
      },
      TEST_ACTOR,
    );

    expect(r.results[0]!.status).toBe('applied');
    expect(mockTransaction).toHaveBeenCalledTimes(1);
    const tx = mockTransaction.mock.results[0]!.value;
    expect(tx.begin).toHaveBeenCalledTimes(1);
    expect(tx.commit).toHaveBeenCalledTimes(1);
    expect(tx.rollback).not.toHaveBeenCalled();
  });

  it('rollback cuando la operación falla a mitad', async () => {
    mockRequestQuery.mockRejectedValueOnce(new Error('DB timeout'));

    const r = await pushBatch(
      {
        sucursalId: '00000000-0000-0000-0000-000000000001',
        operations: [
          {
            entity: 'pacientes',
            id: '00000000-0000-0000-0000-000000000010',
            op: 'delete',
            payload: null,
            clientUpdatedAt: '2026-06-04T00:00:00.000Z',
          },
        ],
      },
      TEST_ACTOR,
    );

    expect(r.results[0]!.status).toBe('error');
    const tx = mockTransaction.mock.results[0]!.value;
    expect(tx.rollback).toHaveBeenCalledTimes(1);
    expect(tx.commit).not.toHaveBeenCalled();
  });

  it('delete con expectedRowVersion conflictivo devuelve conflict', async () => {
    mockRequestQuery.mockResolvedValueOnce({
      recordset: [{ row_version: Buffer.from([9, 9, 9]), updated_at: new Date('2026-06-03') }],
    });

    const r = await pushBatch(
      {
        sucursalId: '00000000-0000-0000-0000-000000000001',
        operations: [
          {
            entity: 'pacientes',
            id: '00000000-0000-0000-0000-000000000010',
            op: 'delete',
            payload: null,
            clientUpdatedAt: '2026-06-04T00:00:00.000Z',
            expectedRowVersion: 'AAA=',
          },
        ],
      },
      TEST_ACTOR,
    );
    expect(r.results[0]!.status).toBe('conflict');
    expect(r.results[0]!.serverRowVersion).toBe(Buffer.from([9, 9, 9]).toString('base64'));
    // no se ejecutó el UPDATE de soft-delete (solo la consulta de versión + la de tiempo final)
    const sqlCalls = mockRequestQuery.mock.calls.map((c) => String(c[0]));
    expect(sqlCalls.some((s) => s.includes('UPDATE pacientes'))).toBe(false);
  });

  it('delete con expectedRowVersion coincidente aplica', async () => {
    const version = Buffer.from([1, 2, 3]).toString('base64');
    mockRequestQuery
      .mockResolvedValueOnce({ recordset: [{ row_version: Buffer.from([1, 2, 3]), updated_at: new Date('2026-06-03') }] })
      .mockResolvedValueOnce({ rowsAffected: [1] });

    const r = await pushBatch(
      {
        sucursalId: '00000000-0000-0000-0000-000000000001',
        operations: [
          {
            entity: 'pacientes',
            id: '00000000-0000-0000-0000-000000000010',
            op: 'delete',
            payload: null,
            clientUpdatedAt: '2026-06-04T00:00:00.000Z',
            expectedRowVersion: version,
          },
        ],
      },
      TEST_ACTOR,
    );
    expect(r.results[0]!.status).toBe('applied');
  });

  it('antropometria: circumferences/skinfolds/bia_json viajan como JSON string', async () => {
    mockRequestQuery
      .mockResolvedValueOnce({ recordset: [] }) // exists → no existe
      .mockResolvedValueOnce({ recordset: [{ id: 'p1' }] }) // guard paciente
      .mockResolvedValueOnce({ rowsAffected: [1] }); // INSERT

    const r = await pushBatch(
      {
        sucursalId: '00000000-0000-0000-0000-000000000001',
        operations: [
          {
            entity: 'antropometrias',
            id: '00000000-0000-0000-0000-000000000099',
            op: 'create',
            payload: {
              patient_id: '00000000-0000-0000-0000-000000000010',
              measured_at: '2026-06-01T00:00:00.000Z',
              weight_kg: 70,
              height_m: 1.7,
              circumferences: { waist: 80, hip: 100 },
              skinfolds: { triceps: 10 },
              bia_json: '{"impedance":500}',
            },
            clientUpdatedAt: '2026-06-04T00:00:00.000Z',
          },
        ],
      },
      TEST_ACTOR,
    );

    expect(r.results[0]!.status).toBe('applied');
    const insertSql = mockRequestQuery.mock.calls[2]![0] as string;
    expect(insertSql).toContain('[circumferences_json]');
    expect(insertSql).toContain('[skinfolds_json]');
    expect(insertSql).toContain('[bia_json]');
    expect(insertSql).not.toContain('[waist_cm]');
    const inputs = mockRequestInput.mock.calls;
    const circCall = inputs.find((c) => (c[0] as string) === 'c_circumferences_json');
    expect(circCall).toBeDefined();
    expect(circCall![2]).toBe('{"waist":80,"hip":100}');
  });

  it('paciente: clave_interna/birth_place/address/nationality/id_type/id_number se sincronizan', async () => {
    mockRequestQuery
      .mockResolvedValueOnce({ recordset: [] }) // exists
      .mockResolvedValueOnce({ rowsAffected: [1] }); // INSERT

    await pushBatch(
      {
        sucursalId: '00000000-0000-0000-0000-000000000001',
        operations: [
          {
            entity: 'pacientes',
            id: '00000000-0000-0000-0000-000000000099',
            op: 'create',
            payload: {
              first_name: 'Ana',
              last_name: 'Pérez',
              birth_date: '1990-05-12T00:00:00.000Z',
              sex: 'female',
              clave_interna: 'CLI-001',
              birth_place: 'CDMX',
              address: 'Av. Siempre Viva 123',
              nationality: 'MX',
              id_type: 'INE',
              id_number: '12345678',
            },
            clientUpdatedAt: '2026-06-04T00:00:00.000Z',
          },
        ],
      },
      TEST_ACTOR,
    );

    const insertSql = mockRequestQuery.mock.calls[1]![0] as string;
    expect(insertSql).toContain('[clave_interna]');
    expect(insertSql).toContain('[birth_place]');
    expect(insertSql).toContain('[address]');
    expect(insertSql).toContain('[nationality]');
    expect(insertSql).toContain('[id_type]');
    expect(insertSql).toContain('[id_number]');
  });

  it('record_status discharged/referred pasan tal cual (roundtrip exacto)', async () => {
    mockRequestQuery.mockResolvedValueOnce({ recordset: [] }).mockResolvedValueOnce({ rowsAffected: [1] });

    await pushBatch(
      {
        sucursalId: '00000000-0000-0000-0000-000000000001',
        operations: [
          {
            entity: 'pacientes',
            id: '00000000-0000-0000-0000-000000000099',
            op: 'create',
            payload: {
              first_name: 'Ana',
              last_name: 'Pérez',
              birth_date: '1990-05-12T00:00:00.000Z',
              sex: 'female',
              record_status: 'referred',
            },
            clientUpdatedAt: '2026-06-04T00:00:00.000Z',
          },
        ],
      },
      TEST_ACTOR,
    );

    const inputs = mockRequestInput.mock.calls;
    const rsCall = inputs.find((c) => (c[0] as string) === 'c_record_status');
    expect(rsCall).toBeDefined();
    expect(rsCall![2]).toBe('referred');
  });
});
