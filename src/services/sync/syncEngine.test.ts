import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SyncEngine, type SyncEngineDeps } from './syncEngine.js';
import { SyncQueueRepository } from './syncQueueRepository.js';
import { NutriClinicaDB } from '@services/db/dexieSchema';
import { useAuthStore } from '@store/authStore';
import { useSyncStore } from '@store/syncStore';
// Los imports se referencian solo dentro de vi.mock factories (hoisted);
// TS marca "no used" para los imports est\u00e1ticos.
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
  let lastPullAt: string | null;
  const api = { manifest: mockManifest, pull: mockPull, push: mockPush };

  beforeEach(async () => {
    vi.resetAllMocks();
    db = new NutriClinicaDB(`test-engine-${Date.now()}-${Math.random()}`);
    await db.sync_queue.clear();
    queue = new SyncQueueRepository(db.sync_queue);
    lastPullAt = null;

    authGetState.mockReturnValue({ token: 'tok', sucursalActivaId: 'suc-1' });
    syncGetState.mockReturnValue({ sucursalId: 'suc-1' });

    const deps: SyncEngineDeps = {
      db,
      queue,
      getLastPullAt: () => lastPullAt,
      setLastPullAt: (iso: string) => { lastPullAt = iso; },
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
    expect(lastPullAt).toBe('2026-06-04T00:00:01.000Z');
  });

  it('pull: op=delete elimina del Dexie', async () => {
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
    expect(await db.patients.get('p1')).toBeUndefined();
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
    const before = await queue.listAll();
    mockPull.mockResolvedValueOnce({ serverTime: 't', changes: [], hasMore: false, nextSince: 't' });
    mockPush.mockResolvedValueOnce({
      results: [{ entity: 'pacientes', id: 'p1', status: 'conflict', error: 'row_version mismatch' }],
      serverTime: 't2',
    });
    try {
      await engine.sync();
    } catch (e) {
      console.error('SYNC THREW:', e);
      throw e;
    }
    const after = await queue.listAll();
    console.log('BEFORE:', before.length, 'AFTER:', after.length, 'STATUSES:', after.map(i => i.status));
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
});
