import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { NutriClinicaDB } from '@services/db/dexieSchema';
import { SyncQueueRepository } from '@services/sync/syncQueueRepository';
import { reconcileAllPendingChanges, startSync, stopSync, resetSyncEngine } from '@services/sync/syncBootstrap';
import { useAuthStore } from '@store/authStore';

function uuid(): string {
  return crypto.randomUUID();
}

describe('reconcileAllPendingChanges', () => {
  let db: NutriClinicaDB;

  beforeEach(async () => {
    db = new NutriClinicaDB(`test-reconcile-${Math.random().toString(36).slice(2)}`);
    await db.open();
    await db.sync_queue.clear();
  });

  afterEach(async () => {
    await db.delete();
  });

  it('encola pacientes existentes que no están en sync_queue', async () => {
    const p1 = uuid();
    const p2 = uuid();
    await db.patients.bulkAdd([
      { id: p1, first_name: 'Ana', last_name: 'Pérez' } as never,
      { id: p2, first_name: 'Beto', last_name: 'Gómez' } as never,
    ]);

    const result = await reconcileAllPendingChanges(db);

    expect(result.scanned).toBe(2);
    expect(result.enqueued).toBe(2);
    expect(result.byEntity.pacientes).toBe(2);

    const items = await db.sync_queue.toArray();
    expect(items.length).toBe(2);
    const ids = items.map((i) => i.entityId).sort();
    expect(ids).toEqual([p1, p2].sort());
    for (const item of items) {
      expect(item.entity).toBe('pacientes');
      expect(item.op).toBe('create');
    }
  });

  it('NO duplica items que ya están en sync_queue (en cualquier estado)', async () => {
    const p1 = uuid();
    const p2 = uuid();
    await db.patients.bulkAdd([
      { id: p1, first_name: 'Ana' } as never,
      { id: p2, first_name: 'Beto' } as never,
    ]);
    // p1 ya tiene item en cola con estado `syncing` (push en curso)
    const queue = new SyncQueueRepository(db.sync_queue);
    await queue.enqueue({
      entity: 'pacientes',
      entityId: p1,
      op: 'create',
      payload: { id: p1, first_name: 'Ana' },
    });
    const inFlight = (await db.sync_queue.toArray())[0];
    await db.sync_queue.update(inFlight.id, { status: 'syncing' });

    const result = await reconcileAllPendingChanges(db);

    expect(result.scanned).toBe(2);
    expect(result.enqueued).toBe(1);
    expect(result.byEntity.pacientes).toBe(1);
    const items = await db.sync_queue.toArray();
    expect(items.length).toBe(2);
    const p2Item = items.find((i) => i.entityId === p2);
    expect(p2Item).toBeDefined();
    expect(p2Item?.status).toBe('pending');
  });

  it('es idempotente: correrlo 2 veces encola solo la primera vez', async () => {
    await db.patients.add({ id: uuid(), first_name: 'Ana' } as never);
    await db.consultations.add({ id: uuid(), patient_id: uuid() } as never);

    const first = await reconcileAllPendingChanges(db);
    const second = await reconcileAllPendingChanges(db);

    expect(first.enqueued).toBe(2);
    expect(second.enqueued).toBe(0);
    expect(second.scanned).toBe(2);
    const items = await db.sync_queue.toArray();
    expect(items.length).toBe(2);
  });

  it('reconoce múltiples entidades (pacientes + consultas)', async () => {
    const pid = uuid();
    const cid = uuid();
    await db.patients.add({ id: pid, first_name: 'Ana' } as never);
    await db.consultations.add({ id: cid, patient_id: pid } as never);

    const result = await reconcileAllPendingChanges(db);

    expect(result.enqueued).toBe(2);
    expect(result.byEntity.pacientes).toBe(1);
    expect(result.byEntity.consultas).toBe(1);
  });

  it('devuelve scanned=0 si no hay datos en ninguna tabla', async () => {
    const result = await reconcileAllPendingChanges(db);
    expect(result.scanned).toBe(0);
    expect(result.enqueued).toBe(0);
    expect(result.byEntity).toEqual({});
  });

  it('NO encola filas con deleted_at (soft-deleted localmente)', async () => {
    const activeId = uuid();
    const deletedId = uuid();
    await db.patients.bulkAdd([
      { id: activeId, first_name: 'Ana' } as never,
      { id: deletedId, first_name: 'Beto', deleted_at: '2026-06-01T00:00:00.000Z' } as never,
    ]);

    const result = await reconcileAllPendingChanges(db);

    expect(result.scanned).toBe(1);
    expect(result.enqueued).toBe(1);
    const items = await db.sync_queue.toArray();
    expect(items.length).toBe(1);
    expect(items[0]!.entityId).toBe(activeId);
  });
});

describe('startSync / stopSync — cleanup de subs Zustand', () => {
  let db: NutriClinicaDB;

  beforeEach(async () => {
    db = new NutriClinicaDB(`test-startstop-${Math.random().toString(36).slice(2)}`);
    await db.open();
    await db.sync_queue.clear();
    useAuthStore.setState({
      token: 't',
      user: null,
      sucursales: [],
      sucursalActivaId: null,
      isAuthenticated: false,
    });
  });

  afterEach(async () => {
    stopSync();
    resetSyncEngine();
    useAuthStore.setState({ isAuthenticated: false });
    await db.delete();
  });

  it('startSync idempotente: el handler de sucursal corre UNA vez por cambio de estado (no N veces)', async () => {
    // Simulamos el bug original: en StrictMode dev, useEffect hace
    // mount→unmount→mount. El primer cleanup llama stopSync() que sólo
    // limpiaba el interval, dejando las suscripciones de Zustand vivas.
    // El segundo startSync añadía OTRA copia de los handlers. Resultado:
    // cambiar sucursalActivaId disparaba 2 actualizaciones a syncStore.
    //
    // Con el fix, startSync limpia sus suscripciones previas antes de
    // re-registrarlas. Verificamos que tras el ciclo mount/unmount/mount,
    // el handler corre EXACTAMENTE 1 vez por cambio.
    const { useSyncStore } = await import('@store/syncStore');
    useSyncStore.getState().setSucursalId(null);

    // Primer mount.
    startSync(db, { intervalMs: 0, runOnStart: false });
    // Simular unmount (cleanup de useEffect).
    stopSync();
    // Segundo mount (StrictMode).
    startSync(db, { intervalMs: 0, runOnStart: false });

    // Spy: contamos cuántas veces setSucursalId del syncStore se llama.
    const setSyncSucursal = vi.spyOn(useSyncStore.getState(), 'setSucursalId');
    // Dispara el handler.
    useAuthStore.setState({ sucursalActivaId: 's-1' });
    useAuthStore.setState({ sucursalActivaId: 's-2' });
    useAuthStore.setState({ sucursalActivaId: 's-3' });
    // 3 cambios → 3 invocaciones del handler (no 6).
    expect(setSyncSucursal).toHaveBeenCalledTimes(3);
    setSyncSucursal.mockRestore();
  });

  it('stopSync limpia interval y suscripciones (sin crash tras varios ciclos)', () => {
    for (let i = 0; i < 10; i++) {
      startSync(db, { intervalMs: 0, runOnStart: false });
      stopSync();
    }
    expect(true).toBe(true);
  });

  it('start/stop repetido no acumula setInterval handles', () => {
    const setSpy = vi.spyOn(globalThis, 'setInterval');
    const clearSpy = vi.spyOn(globalThis, 'clearInterval');
    for (let i = 0; i < 5; i++) {
      startSync(db, { intervalMs: 30_000, runOnStart: false });
      stopSync();
    }
    expect(setSpy.mock.calls.length).toBeGreaterThanOrEqual(5);
    expect(clearSpy.mock.calls.length).toBeGreaterThanOrEqual(4);
    setSpy.mockRestore();
    clearSpy.mockRestore();
  });
});
