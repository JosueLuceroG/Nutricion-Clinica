import type { SyncManifest, SyncPullResponse, SyncPullChange, SyncPushBatch, SyncPushResponse } from '@nutriclinica/shared';
import { httpRequest } from '../api/httpClient.js';

export const syncApi = {
  async manifest(): Promise<SyncManifest> {
    return httpRequest<SyncManifest>('/sync/manifest', { skipSucursalHeader: true });
  },
  async pull(params: { since: string | null; entities?: string[]; sucursalId: string }): Promise<SyncPullResponse> {
    return httpRequest<SyncPullResponse>('/sync/pull', {
      query: { since: params.since ?? undefined, entities: params.entities?.join(',') },
    });
  },
  async push(batch: SyncPushBatch): Promise<SyncPushResponse> {
    return httpRequest<SyncPushResponse>('/sync/push', { method: 'POST', body: batch });
  },
};

export type { SyncManifest, SyncPullResponse, SyncPullChange, SyncPushBatch, SyncPushResponse };
