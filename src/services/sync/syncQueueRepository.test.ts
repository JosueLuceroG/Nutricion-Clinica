import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { SyncQueueRepository } from './syncQueueRepository.js';
import { NutriClinicaDB } from '@services/db/dexieSchema';

describe('SyncQueueRepository', () => {
  let db: NutriClinicaDB;
  let repo: SyncQueueRepository;

  beforeEach(async () => {
    db = new NutriClinicaDB(`test-syncq-${Date.now()}-${Math.random()}`);
    await db.sync_queue.clear();
    repo = new SyncQueueRepository(db.sync_queue);
  });

  it('enqueue crea item con status=pending', async () => {
    const item = await repo.enqueue({
      entity: 'pacientes',
      entityId: 'p1',
      op: 'create',
      payload: { nombres: 'Ana' },
    });
    expect(item.status).toBe('pending');
    expect(item.retryCount).toBe(0);
    expect(item.entity).toBe('pacientes');
    expect(item.entityId).toBe('p1');
    expect(item.op).toBe('create');
    expect(item.payload).toBe('{"nombres":"Ana"}');
    expect(item.enqueuedAt).toBeTruthy();
  });

  it('listPending excluye applied y conflict', async () => {
    const a = await repo.enqueue({ entity: 'pacientes', entityId: 'a', op: 'create', payload: {} });
    const b = await repo.enqueue({ entity: 'pacientes', entityId: 'b', op: 'create', payload: {} });
    const c = await repo.enqueue({ entity: 'pacientes', entityId: 'c', op: 'create', payload: {} });
    await repo.markApplied(a.id);
    await repo.markConflict(c.id, 'row_version mismatch');

    const pending = await repo.listPending();
    expect(pending.map((i) => i.entityId).sort()).toEqual([b.entityId]);
  });

  it('countPending suma pending + error', async () => {
    await repo.enqueue({ entity: 'pacientes', entityId: '1', op: 'create', payload: {} });
    const err = await repo.enqueue({ entity: 'pacientes', entityId: '2', op: 'create', payload: {} });
    await repo.markError(err.id, 'boom');
    expect(await repo.countPending()).toBe(2);
  });

  it('countConflicts solo cuenta conflict', async () => {
    const c = await repo.enqueue({ entity: 'pacientes', entityId: 'c', op: 'update', payload: {} });
    await repo.markConflict(c.id, 'mismatch');
    const a = await repo.enqueue({ entity: 'pacientes', entityId: 'a', op: 'create', payload: {} });
    await repo.markApplied(a.id);
    expect(await repo.countConflicts()).toBe(1);
  });

  it('markError incrementa retryCount', async () => {
    const item = await repo.enqueue({ entity: 'pacientes', entityId: 'x', op: 'create', payload: {} });
    await repo.markError(item.id, 'timeout');
    await repo.markError(item.id, 'timeout 2');
    const all = await repo.listAll();
    expect(all[0]!.retryCount).toBe(2);
    expect(all[0]!.lastError).toBe('timeout 2');
  });

  it('resolveConflict local \u2192 status=pending (reintenta)', async () => {
    const c = await repo.enqueue({ entity: 'pacientes', entityId: 'c', op: 'update', payload: {} });
    await repo.markConflict(c.id, 'mismatch');
    await repo.resolveConflict(c.id, 'local');
    const items = await repo.listAll();
    expect(items[0]!.status).toBe('pending');
  });

  it('resolveConflict remote \u2192 status=applied (descarta local)', async () => {
    const c = await repo.enqueue({ entity: 'pacientes', entityId: 'c', op: 'update', payload: {} });
    await repo.markConflict(c.id, 'mismatch');
    await repo.resolveConflict(c.id, 'remote');
    const items = await repo.listAll();
    expect(items[0]!.status).toBe('applied');
  });

  it('clearApplied borra solo applied', async () => {
    const a = await repo.enqueue({ entity: 'pacientes', entityId: 'a', op: 'create', payload: {} });
    const b = await repo.enqueue({ entity: 'pacientes', entityId: 'b', op: 'create', payload: {} });
    await repo.markApplied(a.id);
    const deleted = await repo.clearApplied();
    expect(deleted).toBe(1);
    const remaining = await repo.listAll();
    expect(remaining.map((i) => i.entityId)).toEqual([b.entityId]);
  });
});
