import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockRequestInput, mockRequestQuery, mockPoolRequest, mockGetPool } = vi.hoisted(() => {
  const mockRequestInput = vi.fn().mockReturnThis();
  const mockRequestQuery = vi.fn();
  const mockPoolRequest = vi.fn(() => ({ input: mockRequestInput, query: mockRequestQuery }));
  return {
    mockRequestInput,
    mockRequestQuery,
    mockPoolRequest,
    mockGetPool: vi.fn(async () => ({ request: mockPoolRequest })),
  };
});

vi.mock('mssql', () => {
  const NVarChar = (n: number) => ({ type: 'NVarChar', length: n });
  const UniqueIdentifier = () => ({ type: 'UniqueIdentifier' });
  const DateTime2 = () => ({ type: 'DateTime2' });
  return { default: { NVarChar, UniqueIdentifier, DateTime2 } };
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
    expect(m.syncSchemaVersion).toBe(1);
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
  it('rechaza since inválido', async () => {
    await expect(pullChanges('s1', new Date('not-a-date'), null)).rejects.toThrow();
  });

  it('retorna cambios vac\u00edos cuando no hay rows', async () => {
    const time = { recordset: [{ t: new Date('2026-06-04T00:00:00.000Z') }] };
    mockRequestQuery
      .mockResolvedValueOnce({ recordset: [] })  // entity 1 pacientes
      .mockResolvedValueOnce({ recordset: [] })  // entity 2 consultas
      .mockResolvedValueOnce({ recordset: [] })  // entity 3 antropometrias
      .mockResolvedValueOnce({ recordset: [] })  // entity 4 lab_panels
      .mockResolvedValueOnce({ recordset: [] })  // entity 5 planes
      .mockResolvedValueOnce(time);                // final time

    const r = await pullChanges('s1', new Date(0), null);
    expect(r.changes).toEqual([]);
    expect(r.hasMore).toBe(false);
  });

  it('convierte rows del DB a SyncPullChange[] con op=update/delete', async () => {
    const time = { recordset: [{ t: new Date('2026-06-04T00:00:00.000Z') }] };
    mockRequestQuery
      .mockResolvedValueOnce({                              // entity 1 pacientes (2 rows)
        recordset: [
          { id: 'a1', row_version: Buffer.from([1, 2, 3]), updated_at: new Date('2026-06-01'), deleted_at: null },
          { id: 'a2', row_version: Buffer.from([4, 5, 6]), updated_at: new Date('2026-06-02'), deleted_at: new Date('2026-06-02') },
        ],
      })
      .mockResolvedValueOnce({ recordset: [{ nombres: 'Ana' }] })  // detail a1
      .mockResolvedValueOnce({ recordset: [{ nombres: 'Beto' }] }) // detail a2
      .mockResolvedValueOnce({ recordset: [] })  // entity 2 consultas
      .mockResolvedValueOnce({ recordset: [] })  // entity 3 antropometrias
      .mockResolvedValueOnce({ recordset: [] })  // entity 4 lab_panels
      .mockResolvedValueOnce({ recordset: [] })  // entity 5 planes
      .mockResolvedValueOnce(time);                // final time

    const r = await pullChanges('s1', new Date(0), null);
    expect(r.changes).toHaveLength(2);
    expect(r.changes[0]!.op).toBe('update');
    expect(r.changes[1]!.op).toBe('delete');
    expect(r.changes[0]!.serverRowVersion).toBeTruthy();
  });
});

describe('syncService.pushBatch', () => {
  it('rechaza batch vac\u00edo no (lo permite zod, pero service itera 0 ops)', async () => {
    const r = await pushBatch({ sucursalId: '00000000-0000-0000-0000-000000000001', operations: [] });
    expect(r.results).toEqual([]);
  });

  it('procesa operaciones y reporta applied/skipped/error', async () => {
    mockRequestQuery
      // delete op 1
      .mockResolvedValueOnce({ rowsAffected: [1] })
      // update op 2: check exists
      .mockResolvedValueOnce({ recordset: [{ id: 'x' }] });

    const r = await pushBatch({
      sucursalId: '00000000-0000-0000-0000-000000000001',
      operations: [
        { entity: 'pacientes', id: '00000000-0000-0000-0000-000000000010', op: 'delete', payload: null, clientUpdatedAt: '2026-06-04T00:00:00.000Z' },
        { entity: 'consultas', id: '00000000-0000-0000-0000-000000000020', op: 'update', payload: {}, clientUpdatedAt: '2026-06-04T00:00:00.000Z' },
      ],
    });

    expect(r.results).toHaveLength(2);
    expect(r.results[0]!.status).toBe('applied');
    expect(r.results[1]!.status).toBe('applied');
  });

  it('captura error de operaci\u00f3n y lo reporta en results', async () => {
    const time = { recordset: [{ t: new Date('2026-06-04T00:00:00.000Z') }] };
    mockRequestQuery
      .mockRejectedValueOnce(new Error('DB timeout'))
      .mockResolvedValueOnce(time);

    const r = await pushBatch({
      sucursalId: '00000000-0000-0000-0000-000000000001',
      operations: [
        { entity: 'pacientes', id: '00000000-0000-0000-0000-000000000010', op: 'delete', payload: null, clientUpdatedAt: '2026-06-04T00:00:00.000Z' },
      ],
    });
    expect(r.results[0]!.status).toBe('error');
    expect(r.results[0]!.error).toContain('DB timeout');
  });
});
