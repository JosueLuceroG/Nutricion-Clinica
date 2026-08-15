import type {
  SyncManifest,
  SyncPullResponse,
  SyncPullChange,
  SyncPullCursors,
  SyncPushBatch,
  SyncPushResponse,
} from "@nutriclinica/shared";
import { httpRequest } from "../api/httpClient.js";

export const syncApi = {
  async manifest(): Promise<SyncManifest> {
    return httpRequest<SyncManifest>("/sync/manifest", {
      skipSucursalHeader: true,
    });
  },
  async pull(params: {
    since: SyncPullCursors | null;
    entities?: string[];
    sucursalId: string;
  }): Promise<SyncPullResponse> {
    return httpRequest<SyncPullResponse>("/sync/pull", {
      query: {
        since: params.since ? JSON.stringify(params.since) : undefined,
        entities: params.entities?.join(","),
      },
      headers: { "X-Sucursal-Id": params.sucursalId },
      skipSucursalHeader: true,
    });
  },
  async push(batch: SyncPushBatch): Promise<SyncPushResponse> {
    return httpRequest<SyncPushResponse>("/sync/push", {
      method: "POST",
      body: batch,
      headers: { "X-Sucursal-Id": batch.sucursalId },
      skipSucursalHeader: true,
    });
  },
};

export type {
  SyncManifest,
  SyncPullResponse,
  SyncPullChange,
  SyncPushBatch,
  SyncPushResponse,
};
