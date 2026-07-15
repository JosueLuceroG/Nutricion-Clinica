import { describe, expect, it } from "vitest";
import {
  createNotificationStore,
  NOTIFICATION_LEGACY_MIGRATION_KEY,
  NOTIFICATION_STATE_STORAGE_KEY,
  NOTIFICATION_TAB_STORAGE_KEY,
  notificationStorageKey,
  type NotificationScope,
  type NotificationStorage,
} from "./notificationStore";

class MemoryStorage implements NotificationStorage {
  readonly values = new Map<string, string>();
  onGet: ((key: string) => void) | null = null;
  blockedSetKey: string | null = null;

  getItem(key: string): string | null {
    this.onGet?.(key);
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (key === this.blockedSetKey) throw new Error("Write failed");
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

const firstScope: NotificationScope = {
  userId: "user/one",
  sucursalId: "branch:a",
};
const secondScope: NotificationScope = {
  userId: "user/one",
  sucursalId: "branch:b",
};

function readScopedPayload(storage: MemoryStorage, scope: NotificationScope) {
  return JSON.parse(storage.getItem(notificationStorageKey(scope))!) as {
    items: Array<Record<string, unknown>>;
    activeTab: string;
  };
}

describe("notificationStore", () => {
  it("starts empty and ignores actions until a scope is ready", () => {
    const storage = new MemoryStorage();
    const store = createNotificationStore(storage);

    store.getState().markAllRead();
    store.getState().setActiveTab("general");
    store.getState().resetMockData();

    expect(store.getState()).toMatchObject({
      scope: null,
      scopeKey: null,
      hydrationStatus: "idle",
      items: [],
      activeTab: "inbox",
      unread: 0,
    });
    expect(storage.values.size).toBe(0);
  });

  it("isolates notification state by user and branch", () => {
    const storage = new MemoryStorage();
    const store = createNotificationStore(storage);
    expect(notificationStorageKey(firstScope)).toBe(
      "nutriclinica.notifications.v1:user:user%2Fone:branch:id:branch%3Aa",
    );

    store.getState().activateScope(firstScope);
    expect(store.getState()).toMatchObject({
      scope: firstScope,
      scopeKey: notificationStorageKey(firstScope),
      hydrationStatus: "ready",
      unread: 8,
    });
    store.getState().markRead("patient-message-plan");
    store.getState().setActiveTab("general");

    store.getState().activateScope(secondScope);
    expect(store.getState()).toMatchObject({
      scope: secondScope,
      activeTab: "inbox",
      unread: 8,
    });
    store.getState().archive("shared-file");

    store.getState().activateScope(firstScope);
    expect(store.getState()).toMatchObject({
      scope: firstScope,
      activeTab: "general",
      unread: 7,
    });
    expect(
      store.getState().items.find((item) => item.id === "shared-file"),
    ).toMatchObject({
      read: false,
      archived: false,
    });

    store.getState().activateScope(secondScope);
    expect(
      store.getState().items.find((item) => item.id === "shared-file"),
    ).toMatchObject({
      read: true,
      archived: true,
    });
  });

  it("does not let a reentrant stale activation overwrite the latest scope", () => {
    const storage = new MemoryStorage();
    const store = createNotificationStore(storage);
    let switched = false;
    storage.onGet = (key) => {
      if (!switched && key === notificationStorageKey(firstScope)) {
        switched = true;
        store.getState().activateScope(secondScope);
      }
    };

    store.getState().activateScope(firstScope);

    expect(store.getState()).toMatchObject({
      scope: secondScope,
      scopeKey: notificationStorageKey(secondScope),
      hydrationStatus: "ready",
      unread: 8,
    });
  });

  it("migrates legacy compact data once into the first authenticated scope", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      NOTIFICATION_STATE_STORAGE_KEY,
      JSON.stringify([
        { id: "patient-message-plan", read: true, archived: false },
        { id: "shared-file", read: false, archived: true },
      ]),
    );
    storage.setItem(NOTIFICATION_TAB_STORAGE_KEY, "general");
    const store = createNotificationStore(storage);

    store.getState().activateScope(firstScope);

    expect(store.getState()).toMatchObject({ activeTab: "general", unread: 6 });
    expect(storage.getItem(NOTIFICATION_STATE_STORAGE_KEY)).toBeNull();
    expect(storage.getItem(NOTIFICATION_TAB_STORAGE_KEY)).toBeNull();
    expect(storage.getItem(NOTIFICATION_LEGACY_MIGRATION_KEY)).toBe(
      notificationStorageKey(firstScope),
    );
    const migrated = readScopedPayload(storage, firstScope);
    expect(migrated.activeTab).toBe("general");
    expect(migrated.items[0]).toEqual({
      id: "patient-message-plan",
      read: true,
      archived: false,
    });
    expect(Object.keys(migrated.items[0]!)).toEqual(["id", "read", "archived"]);

    storage.setItem(
      NOTIFICATION_STATE_STORAGE_KEY,
      JSON.stringify([
        { id: "patient-message-plan", read: true, archived: true },
      ]),
    );
    store.getState().activateScope(secondScope);
    expect(store.getState()).toMatchObject({ activeTab: "inbox", unread: 8 });
  });

  it("keeps legacy data usable and intact until a scoped write succeeds", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      NOTIFICATION_STATE_STORAGE_KEY,
      JSON.stringify([
        { id: "patient-message-plan", read: true, archived: false },
      ]),
    );
    storage.setItem(NOTIFICATION_TAB_STORAGE_KEY, "archived");
    storage.blockedSetKey = notificationStorageKey(firstScope);
    const store = createNotificationStore(storage);

    store.getState().activateScope(firstScope);

    expect(store.getState()).toMatchObject({
      hydrationStatus: "ready",
      activeTab: "archived",
      unread: 7,
    });
    expect(storage.getItem(NOTIFICATION_STATE_STORAGE_KEY)).not.toBeNull();
    expect(storage.getItem(NOTIFICATION_TAB_STORAGE_KEY)).toBe("archived");
    expect(storage.getItem(NOTIFICATION_LEGACY_MIGRATION_KEY)).toBeNull();

    storage.blockedSetKey = null;
    store.getState().markRead("shared-file");
    expect(storage.getItem(notificationStorageKey(firstScope))).not.toBeNull();
    expect(storage.getItem(NOTIFICATION_STATE_STORAGE_KEY)).toBeNull();
    expect(storage.getItem(NOTIFICATION_TAB_STORAGE_KEY)).toBeNull();
  });

  it("derives unread and persists all notification actions in compact form", () => {
    const storage = new MemoryStorage();
    const store = createNotificationStore(storage);
    store.getState().activateScope(firstScope);

    store.getState().markRead("patient-message-plan");
    expect(store.getState().unread).toBe(7);
    store.getState().archive("consultation-note");
    expect(store.getState().unread).toBe(6);
    store.getState().resolveAction("shared-file", "accept");
    expect(store.getState().unread).toBe(5);
    store.getState().archiveVisible("inbox");
    expect(store.getState().unread).toBe(2);
    store.getState().markAllRead();
    expect(store.getState().unread).toBe(0);
    expect(store.getState().items.every((item) => item.read)).toBe(true);

    const persisted = readScopedPayload(storage, firstScope);
    expect(persisted.items).toHaveLength(10);
    expect(
      persisted.items.every(
        (item) => Object.keys(item).join(",") === "id,read,archived",
      ),
    ).toBe(true);
  });

  it("resets only the active scope and deactivates without stale data", () => {
    const storage = new MemoryStorage();
    const store = createNotificationStore(storage);
    store.getState().activateScope(firstScope);
    store.getState().archive("patient-message-plan");
    store.getState().setActiveTab("archived");
    const changedFirstScope = readScopedPayload(storage, firstScope);

    store.getState().activateScope(secondScope);
    store.getState().markRead("shared-file");
    store.getState().resetMockData();

    expect(store.getState()).toMatchObject({
      scope: secondScope,
      activeTab: "inbox",
      unread: 8,
    });
    expect(readScopedPayload(storage, firstScope)).toEqual(changedFirstScope);
    expect(readScopedPayload(storage, secondScope).activeTab).toBe("inbox");

    store.getState().deactivateScope();
    expect(store.getState()).toMatchObject({
      scope: null,
      scopeKey: null,
      hydrationStatus: "idle",
      items: [],
      unread: 0,
    });
  });
});
