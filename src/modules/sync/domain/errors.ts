export class SyncConflictError extends Error {
  constructor(
    public readonly entity: string,
    public readonly entityId: string,
    public readonly serverRowVersion: string,
    public readonly serverUpdatedAt: string,
  ) {
    super(`Sync conflict on ${entity}:${entityId}`);
    this.name = 'SyncConflictError';
  }
}

export class SyncAuthError extends Error {
  constructor(message = 'No autenticado para sincronizar') {
    super(message);
    this.name = 'SyncAuthError';
  }
}

export class SyncSchemaMismatchError extends Error {
  constructor(public readonly serverVersion: number, public readonly clientVersion: number) {
    super(`Schema mismatch: server=${serverVersion} client=${clientVersion}`);
    this.name = 'SyncSchemaMismatchError';
  }
}
