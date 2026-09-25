import {
  QuickNotesRepositoryError,
  migrateQuickNotesSnapshot,
  parseQuickNotesSnapshot,
  type QuickNotesRepository,
  type QuickNotesScope,
  type QuickNotesSnapshot,
} from "../domain";

export const QUICK_NOTES_STORAGE_PREFIX = "nutriclinica.quick-notes.v1";

export interface QuickNotesStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export type QuickNotesStorageSupplier = () => QuickNotesStorage | null;

function scopesEqual(first: QuickNotesScope, second: QuickNotesScope): boolean {
  return (
    first.userId === second.userId && first.sucursalId === second.sucursalId
  );
}

export function quickNotesStorageKey(scope: QuickNotesScope): string {
  const user = encodeURIComponent(scope.userId);
  const branch =
    scope.sucursalId === null
      ? "none"
      : `id:${encodeURIComponent(scope.sucursalId)}`;
  return `${QUICK_NOTES_STORAGE_PREFIX}:user:${user}:branch:${branch}`;
}

function defaultStorageSupplier(): QuickNotesStorage | null {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? `${fallback}: ${error.message}` : fallback;
}

export class LocalStorageQuickNotesRepository implements QuickNotesRepository {
  constructor(
    private readonly storageSupplier: QuickNotesStorageSupplier = defaultStorageSupplier,
  ) {}

  async load(scope: QuickNotesScope) {
    let storage: QuickNotesStorage | null;
    try {
      storage = this.storageSupplier();
    } catch (error) {
      return {
        status: "unavailable" as const,
        message: errorMessage(error, "Quick Notes storage is unavailable"),
      };
    }
    if (!storage) {
      return {
        status: "unavailable" as const,
        message: "Quick Notes storage is unavailable",
      };
    }

    let raw: string | null;
    try {
      raw = storage.getItem(quickNotesStorageKey(scope));
    } catch (error) {
      return {
        status: "unavailable" as const,
        message: errorMessage(error, "Quick Notes storage could not be read"),
      };
    }
    if (raw === null) return { status: "missing" as const };

    let value: unknown;
    try {
      value = JSON.parse(raw) as unknown;
    } catch (error) {
      return {
        status: "invalid" as const,
        message: errorMessage(error, "Stored Quick Notes JSON is malformed"),
        raw,
      };
    }

    const snapshot =
      parseQuickNotesSnapshot(value) ?? migrateQuickNotesSnapshot(value);
    if (!snapshot) {
      return {
        status: "invalid" as const,
        message: "Stored Quick Notes data is invalid",
        raw,
      };
    }
    if (!scopesEqual(scope, snapshot.scope)) {
      return {
        status: "invalid" as const,
        message: "Stored Quick Notes scope does not match its key",
        raw,
      };
    }
    return { status: "found" as const, snapshot };
  }

  async save(
    scope: QuickNotesScope,
    snapshot: QuickNotesSnapshot,
  ): Promise<QuickNotesSnapshot> {
    const parsed = parseQuickNotesSnapshot(snapshot);
    if (!parsed || !scopesEqual(scope, parsed.scope)) {
      throw new QuickNotesRepositoryError(
        "invalid",
        "Quick Notes snapshot is invalid for this scope",
      );
    }

    let storage: QuickNotesStorage | null;
    try {
      storage = this.storageSupplier();
    } catch (error) {
      throw new QuickNotesRepositoryError(
        "unavailable",
        errorMessage(error, "Quick Notes storage is unavailable"),
        { cause: error },
      );
    }
    if (!storage) {
      throw new QuickNotesRepositoryError(
        "unavailable",
        "Quick Notes storage is unavailable",
      );
    }

    try {
      storage.setItem(quickNotesStorageKey(scope), JSON.stringify(parsed));
    } catch (error) {
      throw new QuickNotesRepositoryError(
        "unavailable",
        errorMessage(error, "Quick Notes storage could not be written"),
        { cause: error },
      );
    }
    return parsed;
  }
}

export const localStorageQuickNotesRepository =
  new LocalStorageQuickNotesRepository();
