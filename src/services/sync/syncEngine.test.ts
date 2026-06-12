import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SyncEngine, type SyncEngineDeps } from './syncEngine.js';
import { SyncQueueRepository } from './syncQueueRepository.js';
import { NutriClinicaDB } from '@services/db/dexieSchema';
import { useAuthStore } from '@store/authStore';
import { useSyncStore } from '@store/syncStore';
void useAuthStore; void useSyncStore;
import { HttpError, NetworkError } from '../api/httpClient.js';
import { SYNC_SCHEMA_VERSION } from '@nutriclinica/shared';


const { mockManifest, mockPull, mockPush } = vi.hoisted(() => ({
  mockManifest: vi.fn(),
  mockPull: vi.fn(),
  mockPush: vi.fn(),
}));

vi.mock('./syncApiClient.js', () => ({
  syncApi: {
    manifest: mockManifest,
    pull: mockPull,
    push: mockPush,
  },
}));

const authGetState = vi.fn();
const syncGetState = vi.fn();

vi.mock('@store/authStore', () => ({
  useAuthStore: { getState: () => authGetState() },
}));
vi.mock('@store/syncStore', () => {
  const setStatus = vi.fn();
  const setLastSync = vi.fn();
  const setPendingChanges = vi.fn();
  const setLastError = vi.fn();
  const setSucursalId = vi.fn();
  return {
    useSyncStore: {
      getState: () => ({
        ...syncGetState(),
        setStatus,
        setLastSync,
        setPendingChanges,
        setLastError,
        setSucursalId,
      }),
    },
  };
});

describe('SyncEngine', () => {
  let db: NutriClinicaDB;
  let queue: SyncQueueRepository;
  let engine: SyncEngine;
  let lastPullAtBySucursal: Record<string, string | null>;
  const api = { manifest: mockManifest, pull: mockPull, push: mockPush };

  beforeEach(async () => {
    vi.resetAllMocks();
    db = new NutriClinicaDB(`test-engine-${Date.now()}-${Math.random()}`);
    await db.sync_queue.clear();
    queue = new SyncQueueRepository(db.sync_queue);
    lastPullAtBySucursal = { 'suc-1': null };

    authGetState.mockReturnValue({ token: 'tok', sucursalActivaId: 'suc-1' });
    syncGetState.mockReturnValue({ sucursalId: 'suc-1' });

    const deps: SyncEngineDeps = {
      db,
      queue,
      getLastPullAt: (sucursalId: string) => lastPullAtBySucursal[sucursalId] ?? null,
      setLastPullAt: (sucursalId: string, iso: string) => { lastPullAtBySucursal[sucursalId] = iso; },
      api,
      onProgress: vi.fn(),
    };
    engine = new SyncEngine(deps);

    mockManifest.mockResolvedValue({
      apiVersion: 'v1',
      syncSchemaVersion: SYNC_SCHEMA_VERSION,
      serverTime: '2026-06-04T00:00:00.000Z',
      entities: ['pacientes'],
      maxBatchSize: 500,
      supportsDelta: true,
    });
  });

  it('no-op si no hay token', async () => {
    authGetState.mockReturnValue({ token: null, sucursalActivaId: 'suc-1' });
    await expect(engine.sync()).rejects.toThrow();
    expect(mockManifest).not.toHaveBeenCalled();
  });

  it('lanza si schema version no coincide', async () => {
    mockManifest.mockResolvedValueOnce({
      apiVersion: 'v1',
      syncSchemaVersion: 999,
      serverTime: '2026-06-04T00:00:00.000Z',
      entities: [],
      maxBatchSize: 500,
      supportsDelta: true,
    });
    await expect(engine.sync()).rejects.toThrow(/Schema mismatch/);
  });

  it('pull: aplica cambios al Dexie local', async () => {
    mockPull.mockResolvedValueOnce({
      serverTime: '2026-06-04T00:00:01.000Z',
      changes: [
        { entity: 'pacientes', id: 'p1', op: 'update', payload: { id: 'p1', first_name: 'Ana' }, serverUpdatedAt: '2026-06-04T00:00:01.000Z', serverRowVersion: 'AAA' },
      ],
      hasMore: false,
      nextSince: '2026-06-04T00:00:01.000Z',
    });
    mockPush.mockResolvedValueOnce({ results: [], serverTime: '2026-06-04T00:00:02.000Z' });
    await engine.sync();
    const stored = await db.patients.get('p1');
    expect(stored).toBeTruthy();
    expect((stored as { first_name: string }).first_name).toBe('Ana');
    expect((stored as { sucursal_id: string | null }).sucursal_id).toBe('suc-1');
    expect(lastPullAtBySucursal['suc-1']).toBe('2026-06-04T00:00:01.000Z');
  });

  it('guarda lastPullAt por sucursal activa', async () => {
    lastPullAtBySucursal = { 'suc-1': '2026-06-01T00:00:00.000Z', 'suc-2': null };
    syncGetState.mockReturnValue({ sucursalId: 'suc-2' });
    authGetState.mockReturnValue({ token: 'tok', sucursalActivaId: 'suc-2' });
    mockPull.mockResolvedValueOnce({
      serverTime: '2026-06-04T00:00:01.000Z',
      changes: [],
      hasMore: false,
      nextSince: '2026-06-04T00:00:01.000Z',
    });
    mockPush.mockResolvedValueOnce({ results: [], serverTime: '2026-06-04T00:00:02.000Z' });

    await engine.sync();

    expect(mockPull).toHaveBeenCalledWith({ since: null, sucursalId: 'suc-2' });
    expect(lastPullAtBySucursal['suc-1']).toBe('2026-06-01T00:00:00.000Z');
    expect(lastPullAtBySucursal['suc-2']).toBe('2026-06-04T00:00:01.000Z');
  });

  it('pull: op=delete hace soft-delete local (preserva la fila con deleted_at)', async () => {
    await db.patients.put({ id: 'p1', first_name: 'X' } as unknown as Parameters<typeof db.patients.put>[0]);
    mockPull.mockResolvedValueOnce({
      serverTime: '2026-06-04T00:00:01.000Z',
      changes: [
        { entity: 'pacientes', id: 'p1', op: 'delete', payload: null, serverUpdatedAt: '2026-06-04T00:00:01.000Z', serverRowVersion: 'AAA' },
      ],
      hasMore: false,
      nextSince: '2026-06-04T00:00:01.000Z',
    });
    mockPush.mockResolvedValueOnce({ results: [], serverTime: '2026-06-04T00:00:02.000Z' });
    await engine.sync();
    const stored = await db.patients.get('p1');
    expect(stored).toBeTruthy();
    expect((stored as { deleted_at: string | null }).deleted_at).toBeTruthy();
  });

  it('pull: op=delete sobre fila inexistente es idempotente (no falla)', async () => {
    mockPull.mockResolvedValueOnce({
      serverTime: '2026-06-04T00:00:01.000Z',
      changes: [
        { entity: 'pacientes', id: 'p-doesnt-exist', op: 'delete', payload: null, serverUpdatedAt: '2026-06-04T00:00:01.000Z', serverRowVersion: 'AAA' },
      ],
      hasMore: false,
      nextSince: '2026-06-04T00:00:01.000Z',
    });
    mockPush.mockResolvedValueOnce({ results: [], serverTime: '2026-06-04T00:00:02.000Z' });
    await expect(engine.sync()).resolves.toBeUndefined();
  });

  it('push: items pending se env\u00edan y marcan applied', async () => {
    await queue.enqueue({ entity: 'pacientes', entityId: 'p1', op: 'create', payload: { id: 'p1', first_name: 'Ana' } });
    await queue.enqueue({ entity: 'pacientes', entityId: 'p2', op: 'update', payload: { id: 'p2', first_name: 'Beto' } });
    mockPull.mockResolvedValueOnce({ serverTime: 't', changes: [], hasMore: false, nextSince: 't' });
    mockPush.mockResolvedValueOnce({
      results: [
        { entity: 'pacientes', id: 'p1', status: 'applied' },
        { entity: 'pacientes', id: 'p2', status: 'applied' },
      ],
      serverTime: 't2',
    });
    await engine.sync();
    const remaining = await queue.listAll();
    expect(remaining.filter((i) => i.status === 'applied')).toHaveLength(0);
  });

  it('push: conflict se preserva para resoluci\u00f3n manual', async () => {
    await queue.enqueue({ entity: 'pacientes', entityId: 'p1', op: 'update', payload: {} });
    mockPull.mockResolvedValueOnce({ serverTime: 't', changes: [], hasMore: false, nextSince: 't' });
    mockPush.mockResolvedValueOnce({
      results: [{ entity: 'pacientes', id: 'p1', status: 'conflict', error: 'row_version mismatch' }],
      serverTime: 't2',
    });
    try {
      await engine.sync();
    } catch {
      // expected — conflict is preserved
    }
    const conflicts = await queue.countConflicts();
    expect(conflicts).toBe(1);
  });

  it('push: error transitorio (NetworkError) reintenta', async () => {
    await queue.enqueue({ entity: 'pacientes', entityId: 'p1', op: 'create', payload: {} });
    mockPull.mockResolvedValueOnce({ serverTime: 't', changes: [], hasMore: false, nextSince: 't' });
    mockPush.mockRejectedValueOnce(new NetworkError('boom'));
    mockPush.mockResolvedValueOnce({
      results: [{ entity: 'pacientes', id: 'p1', status: 'applied' }],
      serverTime: 't2',
    });
    await engine.sync();
    expect(mockPush).toHaveBeenCalledTimes(2);
  });

  it('push: 5xx reintenta, 4xx no', async () => {
    await queue.enqueue({ entity: 'pacientes', entityId: 'p1', op: 'create', payload: {} });
    mockPull.mockResolvedValueOnce({ serverTime: 't', changes: [], hasMore: false, nextSince: 't' });
    mockPush.mockRejectedValueOnce(new HttpError(500, 'server error'));
    mockPush.mockResolvedValueOnce({ results: [{ entity: 'pacientes', id: 'p1', status: 'applied' }], serverTime: 't2' });
    await engine.sync();
    expect(mockPush).toHaveBeenCalledTimes(2);
    vi.clearAllMocks();
    await queue.enqueue({ entity: 'pacientes', entityId: 'p2', op: 'create', payload: {} });
    mockPush.mockRejectedValue(new HttpError(400, 'bad'));
    await expect(engine.sync()).rejects.toThrow();
  });

  it('no se ejecuta concurrentemente (re-entrante devuelve la misma inFlight)', async () => {
    let resolvePull: (v: unknown) => void = () => undefined;
    mockPull.mockReturnValueOnce(new Promise((resolve) => { resolvePull = resolve; }));
    const p1 = engine.sync();
    const p2 = engine.sync();
    // p2 debe ser la misma ejecuci\u00f3n que p1.
    resolvePull({ serverTime: 't', changes: [], hasMore: false, nextSince: 't' });
    await Promise.all([p1, p2]);
    expect(mockManifest).toHaveBeenCalledTimes(1);
    expect(mockPull).toHaveBeenCalledTimes(1);
  });

  it('no se ejecuta concurrentemente: con items pending ambos completan', async () => {
    await queue.enqueue({ entity: 'pacientes', entityId: 'p1', op: 'create', payload: {} });
    mockPull.mockResolvedValueOnce({ serverTime: 't', changes: [], hasMore: false, nextSince: 't' });
    mockPush.mockResolvedValueOnce({ results: [{ entity: 'pacientes', id: 'p1', status: 'applied' }], serverTime: 't2' });
    const p1 = engine.sync();
    const p2 = engine.sync();
    await Promise.all([p1, p2]);
    expect(mockManifest).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledTimes(1);
  });

  describe('toLocalRow — JSON columns del pull se guardan como strings en Dexie', () => {
    it('consultas: vitals={object} se almacena como vitals_json: string', async () => {
      await db.patients.put({
        id: 'pid-1', first_name: 'Test', last_name: 'Pac',
        clinical_tags: '[]', status: 'active', created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(), deleted_at: null,
      } as unknown as Parameters<typeof db.patients.put>[0]);
      mockPull.mockResolvedValueOnce({
        serverTime: 't1', changes: [
          {
            entity: 'consultas', id: 'c1', op: 'update',
            payload: {
              id: 'c1', patient_id: 'pid-1', consultation_date: '2026-06-07T00:00:00.000Z',
              consultation_number: 1, reason: 'test', subjective: null, objective: null,
              assessment: null, plan: null, status: 'completed',
              anthropometry_id: null, lab_panel_id: null, next_visit_date: null,
              cost: 0, paid: false, payment_method: null, paid_at: null,
              reference: null, invoice_number: null, billing_notes: null,
              vitals: { systolicMmHg: 120, diastolicMmHg: 80, heartRateBpm: 72, temperatureC: 36.5 },
              deleted_at: null, created_at: 't0', updated_at: 't0',
            },
            serverUpdatedAt: 't0', serverRowVersion: 'AAA',
          },
        ],
        hasMore: false, nextSince: 't1',
      });
      mockPush.mockResolvedValueOnce({ results: [], serverTime: 't2' });
      await engine.sync();
      const row = await db.consultations.get('c1');
      expect(row).toBeTruthy();
      const r = row as unknown as Record<string, unknown>;
      expect(r.vitals_json).toBeTypeOf('string');
      expect(r.vitals).toBeUndefined();
      const parsed = JSON.parse(r.vitals_json as string);
      expect(parsed.systolicMmHg).toBe(120);
      expect(parsed.diastolicMmHg).toBe(80);
    });

    it('consultas: vitals=null se almacena como vitals_json: null', async () => {
      await db.patients.put({
        id: 'pid-2', first_name: 'Test', last_name: 'Pac',
        clinical_tags: '[]', status: 'active', created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(), deleted_at: null,
      } as unknown as Parameters<typeof db.patients.put>[0]);
      mockPull.mockResolvedValueOnce({
        serverTime: 't1', changes: [
          {
            entity: 'consultas', id: 'c2', op: 'update',
            payload: {
              id: 'c2', patient_id: 'pid-2', consultation_date: '2026-06-07T00:00:00.000Z',
              consultation_number: 2, reason: 'test', subjective: null, objective: null,
              assessment: null, plan: null, status: 'completed',
              anthropometry_id: null, lab_panel_id: null, next_visit_date: null,
              cost: 0, paid: false, payment_method: null, paid_at: null,
              reference: null, invoice_number: null, billing_notes: null,
              vitals: null,
              deleted_at: null, created_at: 't0', updated_at: 't0',
            },
            serverUpdatedAt: 't0', serverRowVersion: 'AAA',
          },
        ],
        hasMore: false, nextSince: 't1',
      });
      mockPush.mockResolvedValueOnce({ results: [], serverTime: 't2' });
      await engine.sync();
      const row = await db.consultations.get('c2');
      expect(row).toBeTruthy();
      const r = row as unknown as Record<string, unknown>;
      expect(r.vitals_json).toBeNull();
      expect(r.vitals).toBeUndefined();
    });

    it(`pacientes: clinical_tags=string[] → clinical_tags: "string[]"`, async () => {
      mockPull.mockResolvedValueOnce({
        serverTime: 't1', changes: [
          {
            entity: 'pacientes', id: 'p-tag', op: 'update',
            payload: {
              id: 'p-tag', first_name: 'Tag', last_name: 'Test',
              clinical_tags: ['embarazado', 'diabético'],
              status: 'active', deleted_at: null, created_at: 't0', updated_at: 't0',
            },
            serverUpdatedAt: 't0', serverRowVersion: 'AAA',
          },
        ],
        hasMore: false, nextSince: 't1',
      });
      mockPush.mockResolvedValueOnce({ results: [], serverTime: 't2' });
      await engine.sync();
      const row = await db.patients.get('p-tag');
      expect(row).toBeTruthy();
      const r = row as unknown as Record<string, unknown>;
      expect(r.clinical_tags).toBeTypeOf('string');
      const parsed = JSON.parse(r.clinical_tags as string);
      expect(parsed).toEqual(['embarazado', 'diabético']);
    });

    it('pacientes: clinical_tags=[] (vacío) → clinical_tags: "[]"', async () => {
      mockPull.mockResolvedValueOnce({
        serverTime: 't1', changes: [
          {
            entity: 'pacientes', id: 'p-empty', op: 'update',
            payload: {
              id: 'p-empty', first_name: 'Empty', last_name: 'Tags',
              clinical_tags: [],
              status: 'active', deleted_at: null, created_at: 't0', updated_at: 't0',
            },
            serverUpdatedAt: 't0', serverRowVersion: 'AAA',
          },
        ],
        hasMore: false, nextSince: 't1',
      });
      mockPush.mockResolvedValueOnce({ results: [], serverTime: 't2' });
      await engine.sync();
      const row = await db.patients.get('p-empty');
      expect(row).toBeTruthy();
      const r = row as unknown as Record<string, unknown>;
      expect(r.clinical_tags).toBe('[]');
    });

    it('planes_alimenticios: meals=[{slot,...}] → meals_json: string', async () => {
      await db.patients.put({
        id: 'pid-3', first_name: 'Meal', last_name: 'Plan',
        clinical_tags: '[]', status: 'active', created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(), deleted_at: null,
      } as unknown as Parameters<typeof db.patients.put>[0]);
      mockPull.mockResolvedValueOnce({
        serverTime: 't1', changes: [
          {
            entity: 'planes_alimenticios', id: 'mp1', op: 'update',
            payload: {
              id: 'mp1', patient_id: 'pid-3', start_date: '2026-06-07T00:00:00.000Z',
              end_date: null, status: 'active', total_daily_calories: 2000,
              meals: [
                { slot: 'desayuno', exchanges: [{ foodId: 'a1b2c3d4-0000-0000-0000-000000000001', count: 2 }] },
              ],
              deleted_at: null, created_at: 't0', updated_at: 't0',
            },
            serverUpdatedAt: 't0', serverRowVersion: 'AAA',
          },
        ],
        hasMore: false, nextSince: 't1',
      });
      mockPush.mockResolvedValueOnce({ results: [], serverTime: 't2' });
      await engine.sync();
      const row = await db.meal_plans.get('mp1');
      expect(row).toBeTruthy();
      const r = row as unknown as Record<string, unknown>;
      expect(r.meals_json).toBeTypeOf('string');
      expect(r.meals).toBeUndefined();
      const parsed = JSON.parse(r.meals_json as string);
      expect(parsed[0].slot).toBe('desayuno');
      expect(parsed[0].exchanges[0].foodId).toBe('a1b2c3d4-0000-0000-0000-000000000001');
    });

    it('lab_panels: results como array se almacena tal cual (el mapper ya lo lee como array)', async () => {
      await db.patients.put({
        id: 'pid-4', first_name: 'Lab', last_name: 'Panel',
        clinical_tags: '[]', status: 'active', created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(), deleted_at: null,
      } as unknown as Parameters<typeof db.patients.put>[0]);
      mockPull.mockResolvedValueOnce({
        serverTime: 't1', changes: [
          {
            entity: 'lab_panels', id: 'lp1', op: 'update',
            payload: {
              id: 'lp1', patient_id: 'pid-4', taken_at: '2026-06-07T00:00:00.000Z',
              lab_name: null, notes: null,
              results: [
                { labPanelId: 'lp1', test: 'GLUCOSA', value: 95, unit: 'mg/dL' },
              ],
              deleted_at: null, created_at: 't0', updated_at: 't0',
            },
            serverUpdatedAt: 't0', serverRowVersion: 'AAA',
          },
        ],
        hasMore: false, nextSince: 't1',
      });
      mockPush.mockResolvedValueOnce({ results: [], serverTime: 't2' });
      await engine.sync();
      const row = await db.lab_panels.get('lp1');
      expect(row).toBeTruthy();
      const r = row as unknown as Record<string, unknown>;
      expect(Array.isArray(r.results)).toBe(true);
      expect((r.results as Array<{test: string}>)[0].test).toBe('GLUCOSA');
    });
  });
});
