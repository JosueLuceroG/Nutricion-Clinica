import Dexie, { type Table } from 'dexie';
import { nextBackoffMs } from '../sync/backoff.js';

export interface QueueItem {
  id: string;
  type: string;
  payload: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  retry_count: number;
  max_retries: number;
  last_error: string | null;
  next_retry_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface QueueInput {
  type: string;
  payload: unknown;
  max_retries?: number;
}

class ActionQueueDB extends Dexie {
  action_queue!: Table<QueueItem, string>;

  constructor(name = 'action_queue_db') {
    super(name);
    this.version(1).stores({
      action_queue: 'id, status, next_retry_at, created_at, type',
    });
  }
}

export function createQueueService(db?: { action_queue: Table<QueueItem, string> }) {
  const table = db?.action_queue ?? new ActionQueueDB().action_queue;

  return {
    async enqueue(input: QueueInput): Promise<string> {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const item: QueueItem = {
        id,
        type: input.type,
        payload: JSON.stringify(input.payload),
        status: 'pending',
        retry_count: 0,
        max_retries: input.max_retries ?? 3,
        last_error: null,
        next_retry_at: null,
        created_at: now,
        updated_at: now,
      };
      await table.add(item);
      return id;
    },

    async dequeue(batchSize = 10): Promise<QueueItem[]> {
      const now = new Date().toISOString();
      const pending = await table
        .where('status')
        .equals('pending')
        .filter((item) => item.next_retry_at === null || item.next_retry_at <= now)
        .limit(batchSize)
        .toArray();

      if (pending.length === 0) return [];

      const ids = pending.map((item) => item.id);
      const updatedAt = new Date().toISOString();
      await table.where('id').anyOf(ids).modify({ status: 'processing', updated_at: updatedAt });

      return pending.map((item) => ({ ...item, status: 'processing' as const, updated_at: updatedAt }));
    },

    async markCompleted(id: string): Promise<void> {
      await table.update(id, {
        status: 'completed',
        last_error: null,
        updated_at: new Date().toISOString(),
      });
    },

    async markFailed(id: string, error: string): Promise<void> {
      const current = await table.get(id);
      if (!current) return;
      await table.update(id, {
        status: 'failed',
        last_error: error,
        retry_count: current.retry_count + 1,
        next_retry_at: new Date(Date.now() + nextBackoffMs(current.retry_count)).toISOString(),
        updated_at: new Date().toISOString(),
      });
    },

    async retryFailed(): Promise<number> {
      const now = new Date().toISOString();
      const failed = await table
        .where('status')
        .equals('failed')
        .filter((item) => item.retry_count < item.max_retries)
        .toArray();

      let count = 0;
      for (const item of failed) {
        if (item.next_retry_at && item.next_retry_at > now) continue;
        await table.update(item.id, {
          status: 'pending',
          updated_at: now,
        });
        count++;
      }
      return count;
    },

    async counts() {
      const [pending, processing, failed, completed] = await Promise.all([
        table.where('status').equals('pending').count(),
        table.where('status').equals('processing').count(),
        table.where('status').equals('failed').count(),
        table.where('status').equals('completed').count(),
      ]);
      return { pending, processing, failed, completed };
    },
  };
}

export const queueService = createQueueService();

export type QueueService = typeof queueService;
