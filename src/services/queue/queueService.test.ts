import 'fake-indexeddb/auto';
import Dexie, { type Table } from 'dexie';
import { describe, it, expect, beforeEach } from 'vitest';
import { createQueueService, type QueueItem, type QueueService } from './queueService.js';

function makeStore() {
  const dbName = `test-action-queue-${Date.now()}-${Math.random()}`;
  const db = new Dexie(dbName);
  db.version(1).stores({
    action_queue: 'id, status, next_retry_at, created_at, type',
  });
  return { store: { action_queue: db.table('action_queue') as Table<QueueItem, string> }, db };
}

describe('QueueService', () => {
  let service: QueueService;
  let store: { action_queue: Table<QueueItem, string> };

  beforeEach(() => {
    const created = makeStore();
    store = created.store;
    service = createQueueService(store);
  });

  it('enqueue returns id and creates pending item', async () => {
    const id = await service.enqueue({ type: 'test', payload: { foo: 1 } });
    expect(id).toBeTruthy();
    expect(typeof id).toBe('string');

    const items = await store.action_queue.toArray();
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe(id);
    expect(items[0].type).toBe('test');
    expect(items[0].payload).toBe('{"foo":1}');
    expect(items[0].status).toBe('pending');
    expect(items[0].retry_count).toBe(0);
    expect(items[0].max_retries).toBe(3);
    expect(items[0].last_error).toBeNull();
    expect(items[0].next_retry_at).toBeNull();
    expect(items[0].created_at).toBeTruthy();
    expect(items[0].updated_at).toBeTruthy();
  });

  it('enqueue respects custom max_retries', async () => {
    const id = await service.enqueue({ type: 'test', payload: {}, max_retries: 5 });
    const item = await store.action_queue.get(id);
    expect(item!.max_retries).toBe(5);
  });

  it('dequeue returns pending items and marks them processing', async () => {
    const id1 = await service.enqueue({ type: 'a', payload: {} });
    const id2 = await service.enqueue({ type: 'b', payload: {} });

    const items = await service.dequeue(10);
    expect(items).toHaveLength(2);
    expect(items[0].status).toBe('processing');
    expect(items[1].status).toBe('processing');

    const stored = await store.action_queue.toArray();
    expect(stored.find((i) => i.id === id1)!.status).toBe('processing');
    expect(stored.find((i) => i.id === id2)!.status).toBe('processing');
  });

  it('dequeue respects batchSize', async () => {
    await service.enqueue({ type: 'a', payload: {} });
    await service.enqueue({ type: 'b', payload: {} });
    await service.enqueue({ type: 'c', payload: {} });

    const batch = await service.dequeue(2);
    expect(batch).toHaveLength(2);
  });

  it('dequeue skips items with future next_retry_at', async () => {
    const id = await service.enqueue({ type: 'test', payload: {} });
    await store.action_queue.update(id, { next_retry_at: new Date(Date.now() + 86_400_000).toISOString() });

    const items = await service.dequeue(10);
    expect(items).toHaveLength(0);
  });

  it('dequeue returns empty when no items', async () => {
    const items = await service.dequeue();
    expect(items).toHaveLength(0);
  });

  it('markCompleted sets status to completed', async () => {
    const id = await service.enqueue({ type: 'test', payload: {} });
    await service.markCompleted(id);

    const item = await store.action_queue.get(id);
    expect(item!.status).toBe('completed');
    expect(item!.last_error).toBeNull();
  });

  it('markFailed increments retry_count and sets next_retry_at', async () => {
    const id = await service.enqueue({ type: 'test', payload: {} });
    await service.markFailed(id, 'connection timeout');

    const item = await store.action_queue.get(id);
    expect(item!.status).toBe('failed');
    expect(item!.last_error).toBe('connection timeout');
    expect(item!.retry_count).toBe(1);
    expect(item!.next_retry_at).toBeTruthy();
  });

  it('markFailed is noop for missing item', async () => {
    await expect(service.markFailed('nonexistent', 'err')).resolves.toBeUndefined();
  });

  it('retryFailed resets expired failed items to pending', async () => {
    const id = await service.enqueue({ type: 'test', payload: {} });
    await service.markFailed(id, 'err');

    await store.action_queue.update(id, { next_retry_at: new Date('2020-01-01').toISOString() });

    const count = await service.retryFailed();
    expect(count).toBe(1);

    const item = await store.action_queue.get(id);
    expect(item!.status).toBe('pending');
  });

  it('retryFailed skips items with future next_retry_at', async () => {
    const id = await service.enqueue({ type: 'test', payload: {} });
    await service.markFailed(id, 'err');

    const count = await service.retryFailed();
    expect(count).toBe(0);
  });

  it('retryFailed skips items that exceeded max_retries', async () => {
    const id = await service.enqueue({ type: 'test', payload: {}, max_retries: 2 });

    await service.markFailed(id, 'err1');
    await store.action_queue.update(id, { next_retry_at: new Date('2020-01-01').toISOString() });
    await service.retryFailed();

    await service.markFailed(id, 'err2');
    await store.action_queue.update(id, { next_retry_at: new Date('2020-01-01').toISOString() });
    await service.retryFailed();

    await service.markFailed(id, 'err3');
    await store.action_queue.update(id, { next_retry_at: new Date('2020-01-01').toISOString() });
    const count = await service.retryFailed();
    expect(count).toBe(0);

    const item = await store.action_queue.get(id);
    expect(item!.status).toBe('failed');
    expect(item!.retry_count).toBe(3);
  });

  it('retryFailed returns 0 when no failed items', async () => {
    const count = await service.retryFailed();
    expect(count).toBe(0);
  });

  it('counts returns correct numbers for each status', async () => {
    await service.enqueue({ type: 't', payload: {} });
    const p2 = await service.enqueue({ type: 't', payload: {} });
    const p3 = await service.enqueue({ type: 't', payload: {} });
    await service.enqueue({ type: 't', payload: {} });

    await service.dequeue(1);
    await service.markCompleted(p2);
    await service.markFailed(p3, 'err');

    const c = await service.counts();
    expect(c.pending).toBe(1);
    expect(c.processing).toBe(1);
    expect(c.failed).toBe(1);
    expect(c.completed).toBe(1);
  });
});
