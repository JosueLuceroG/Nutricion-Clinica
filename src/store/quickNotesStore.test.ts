import { describe, expect, it } from "vitest";
import {
  createDefaultQuickNotesSnapshot,
  quickNoteIdFrom,
  type QuickNoteId,
  type QuickNotesLoadResult,
  type QuickNotesRepository,
  type QuickNotesScope,
} from "@modules/quick-notes/domain";
import {
  LocalStorageQuickNotesRepository,
  type QuickNotesStorage,
} from "@modules/quick-notes/infrastructure";
import { createQuickNotesStore } from "./quickNotesStore";

class MemoryStorage implements QuickNotesStorage {
  readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

const scope: QuickNotesScope = { userId: "store-user", sucursalId: "branch-1" };
const ids = [
  "01890f47-89ab-7001-8abc-0123456789ab",
  "01890f47-89ab-7002-8abc-0123456789ab",
  "01890f47-89ab-7003-8abc-0123456789ab",
  "01890f47-89ab-7004-8abc-0123456789ab",
  "01890f47-89ab-7005-8abc-0123456789ab",
  "01890f47-89ab-7006-8abc-0123456789ab",
  "01890f47-89ab-7007-8abc-0123456789ab",
].map(quickNoteIdFrom);

function makeIdGenerator(): () => QuickNoteId {
  let index = 0;
  return () => ids[index++]!;
}

function createStore(repository: QuickNotesRepository) {
  return createQuickNotesStore({
    repository,
    generateId: makeIdGenerator(),
    now: () => "2026-07-14T10:00:00.000Z",
    getViewport: () => ({
      width: 1200,
      height: 800,
      safeRect: { left: 200, top: 60, right: 1200, bottom: 770 },
    }),
    autosaveDelayMs: 60_000,
    structuralSaveDelayMs: 60_000,
  });
}

describe("quickNotesStore", () => {
  it("creates, updates, pins, minimizes, completes, and deletes notes", async () => {
    const repository = new LocalStorageQuickNotesRepository(
      () => new MemoryStorage(),
    );
    const store = createStore(repository);
    await store.getState().activateScope(scope);

    const id = store
      .getState()
      .createNote({ title: "First", content: "Draft" })!;
    store.getState().updateNote(id, { title: "Updated", priority: "urgent" });
    store.getState().togglePin(id);
    expect(store.getState().notes[0]).toMatchObject({
      title: "Updated",
      priority: "urgent",
      pinned: true,
    });

    store.getState().toggleMinimize(id);
    expect(store.getState().notes[0]?.minimized).toBe(true);

    store.getState().toggleCompleted(id);
    expect(store.getState().notes[0]).toMatchObject({
      completed: true,
      pinned: false,
    });
    expect(store.getState().notes[0]?.completedAt).not.toBeNull();

    store.getState().deleteNote(id);
    expect(store.getState().notes).toEqual([]);
    await expect(store.getState().flush()).resolves.toBe(true);
  });

  it("keeps no more than five pinned notes expanded", async () => {
    const storage = new MemoryStorage();
    const store = createStore(
      new LocalStorageQuickNotesRepository(() => storage),
    );
    await store.getState().activateScope(scope);

    for (let index = 0; index < 6; index += 1) {
      store.getState().createNote({ title: `Note ${index}`, pinned: true });
    }

    expect(
      store.getState().notes.filter((note) => note.pinned && !note.minimized),
    ).toHaveLength(5);
    expect(store.getState().notes[5]).toMatchObject({
      pinned: true,
      minimized: true,
    });
    await store.getState().flush();
  });

  it("persists changes and reloads them in a new store", async () => {
    const storage = new MemoryStorage();
    const repository = new LocalStorageQuickNotesRepository(() => storage);
    const firstStore = createStore(repository);
    await firstStore.getState().activateScope(scope);
    const id = firstStore
      .getState()
      .createNote({ title: "Persist me", color: "purple" })!;
    firstStore.getState().updateNote(id, { content: "Saved content" });
    await expect(firstStore.getState().flush()).resolves.toBe(true);

    const reloadedStore = createStore(repository);
    await reloadedStore.getState().activateScope(scope);

    expect(reloadedStore.getState().notes).toHaveLength(1);
    expect(reloadedStore.getState().notes[0]).toMatchObject({
      id,
      title: "Persist me",
      content: "Saved content",
      color: "purple",
    });
  });

  it("flushes one scope before switching and keeps scopes isolated", async () => {
    const storage = new MemoryStorage();
    const repository = new LocalStorageQuickNotesRepository(() => storage);
    const store = createStore(repository);
    const otherScope = { userId: "store-user", sucursalId: "branch-2" };

    await store.getState().activateScope(scope);
    store.getState().createNote({ title: "North" });
    await store.getState().activateScope(otherScope);
    expect(store.getState().notes).toEqual([]);
    store.getState().createNote({ title: "South" });
    await store.getState().activateScope(scope);

    expect(store.getState().notes.map((note) => note.title)).toEqual(["North"]);
    await store.getState().flush();
  });

  it("does not apply a stale scope load after a newer activation", async () => {
    const firstScope = { userId: "race-user", sucursalId: "first" };
    const secondScope = { userId: "race-user", sucursalId: "second" };
    const pending = new Map<string, (result: QuickNotesLoadResult) => void>();
    const repository: QuickNotesRepository = {
      load: (requestedScope) =>
        new Promise((resolve) => {
          pending.set(requestedScope.sucursalId!, resolve);
        }),
      save: async (_requestedScope, snapshot) => snapshot,
    };
    const store = createStore(repository);

    const firstActivation = store.getState().activateScope(firstScope);
    const secondActivation = store.getState().activateScope(secondScope);
    const secondSnapshot = createDefaultQuickNotesSnapshot(
      secondScope,
      "2026-07-14T10:00:00.000Z",
    );
    pending.get("second")!({ status: "found", snapshot: secondSnapshot });
    await secondActivation;
    pending.get("first")!({
      status: "found",
      snapshot: createDefaultQuickNotesSnapshot(firstScope),
    });
    await firstActivation;

    expect(store.getState().scope).toEqual(secondScope);
    expect(store.getState().hydrationStatus).toBe("ready");
  });
});
