import { create, type StateCreator } from "zustand";
import { createStore, type StoreApi } from "zustand/vanilla";

export type NotificationTab = "inbox" | "general" | "archived";
export type NotificationAction = "accept" | "reject";
export type NotificationType =
  | "patient_message"
  | "consultation"
  | "nutrition_plan"
  | "document"
  | "clinical_record"
  | "payment"
  | "system";
export type NotificationTone = "teal" | "blue" | "aqua" | "slate";
export type NotificationHydrationStatus = "idle" | "loading" | "ready";

export interface NotificationScope {
  userId: string;
  sucursalId: string | null;
}

export interface DashboardNotification {
  id: string;
  type: NotificationType;
  initials: string;
  tone: NotificationTone;
  personName?: string;
  patientName?: string;
  message: string;
  subject?: string;
  suffix?: string;
  category: string;
  timeAgo: string;
  read: boolean;
  archived: boolean;
  requiresAction?: boolean;
  actions?: NotificationAction[];
}

export interface NotificationStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

export interface NotificationState {
  scope: NotificationScope | null;
  scopeKey: string | null;
  hydrationStatus: NotificationHydrationStatus;
  items: DashboardNotification[];
  activeTab: NotificationTab;
  unread: number;
  activateScope: (scope: NotificationScope) => void;
  deactivateScope: () => void;
  setActiveTab: (tab: NotificationTab) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  archive: (id: string) => void;
  archiveVisible: (tab: NotificationTab) => void;
  resolveAction: (id: string, action: NotificationAction) => void;
  resetMockData: () => void;
  clear: () => void;
}

export const NOTIFICATION_STATE_STORAGE_KEY =
  "nutriclinica.dashboard.notifications";
export const NOTIFICATION_TAB_STORAGE_KEY =
  "nutriclinica.dashboard.notificationTab";
export const NOTIFICATION_STORAGE_PREFIX = "nutriclinica.notifications.v1";
export const NOTIFICATION_LEGACY_MIGRATION_KEY = `${NOTIFICATION_STORAGE_PREFIX}:legacy-migrated`;

export function notificationStorageKey(scope: NotificationScope): string {
  const user = encodeURIComponent(scope.userId);
  const branch =
    scope.sucursalId === null
      ? "none"
      : `id:${encodeURIComponent(scope.sucursalId)}`;
  return `${NOTIFICATION_STORAGE_PREFIX}:user:${user}:branch:${branch}`;
}

const notificationPreviewItems: DashboardNotification[] = [
  {
    id: "patient-message-plan",
    type: "patient_message",
    initials: "AT",
    tone: "teal",
    personName: "Ana Torres",
    patientName: "Ana Torres",
    message: "envió un mensaje sobre su plan de alimentación.",
    category: "Mensaje de paciente",
    timeAgo: "Hace 12 min",
    read: false,
    archived: false,
  },
  {
    id: "patient-message-followup",
    type: "patient_message",
    initials: "CG",
    tone: "blue",
    personName: "Carlos Gómez",
    patientName: "Carlos Gómez",
    message: "respondió en el chat de seguimiento.",
    category: "Chat de seguimiento",
    timeAgo: "Hace 24 min",
    read: false,
    archived: false,
  },
  {
    id: "patient-message-consultation",
    type: "patient_message",
    initials: "ML",
    tone: "aqua",
    personName: "María López",
    patientName: "María López",
    message: "solicitó información sobre su próxima consulta.",
    category: "Mensaje de paciente",
    timeAgo: "Hace 42 min",
    read: false,
    archived: false,
  },
  {
    id: "patient-message-menu",
    type: "patient_message",
    initials: "AV",
    tone: "slate",
    personName: "Andrea Vargas",
    patientName: "Andrea Vargas",
    message: "envió una duda sobre su menú semanal.",
    category: "Menú semanal",
    timeAgo: "Hace 1 hora",
    read: false,
    archived: false,
  },
  {
    id: "consultation-note",
    type: "consultation",
    initials: "JR",
    tone: "blue",
    personName: "Javier Ruiz",
    patientName: "Carlos Gómez",
    message: "dejó una nota en la consulta de ",
    subject: "Carlos Gómez",
    suffix: ".",
    category: "Consulta nutricional",
    timeAgo: "Hace 2 horas",
    read: false,
    archived: false,
  },
  {
    id: "shared-file",
    type: "document",
    initials: "ML",
    tone: "aqua",
    personName: "María López",
    patientName: "María López",
    message: "compartió el archivo ",
    subject: "Bioimpedancia_abril.pdf",
    suffix: " contigo.",
    category: "Documentos",
    timeAgo: "Hace 3 horas",
    read: false,
    archived: false,
    requiresAction: true,
    actions: ["reject", "accept"],
  },
  {
    id: "clinical-record",
    type: "clinical_record",
    initials: "DS",
    tone: "slate",
    personName: "Diego Sánchez",
    patientName: "Andrea Vargas",
    message: "actualizó la ficha clínica de ",
    subject: "Andrea Vargas",
    suffix: ".",
    category: "Ficha clínica",
    timeAgo: "Hace 1 día",
    read: false,
    archived: false,
  },
  {
    id: "today-consultation",
    type: "system",
    initials: "NC",
    tone: "blue",
    personName: "NutriClinica",
    message: "registró una nueva consulta para hoy.",
    category: "Agenda",
    timeAgo: "Hace 1 día",
    read: false,
    archived: false,
  },
  {
    id: "plan-review",
    type: "nutrition_plan",
    initials: "PR",
    tone: "teal",
    personName: "Plan alimenticio",
    message: "pendiente de revisión clínica.",
    category: "Planes",
    timeAgo: "Hace 2 días",
    read: true,
    archived: true,
  },
  {
    id: "payment-review",
    type: "payment",
    initials: "PG",
    tone: "slate",
    personName: "Pagos",
    message: "registró un pago pendiente de validar.",
    category: "Cobros",
    timeAgo: "Hace 2 días",
    read: true,
    archived: true,
  },
];

export function getNotificationDefaults(): DashboardNotification[] {
  return notificationPreviewItems.map((notification) => ({
    ...notification,
    actions: notification.actions ? [...notification.actions] : undefined,
  }));
}

interface NotificationSnapshot {
  items: DashboardNotification[];
  activeTab: NotificationTab;
}

type StorageReadResult =
  | { status: "found"; value: string }
  | { status: "missing" | "unavailable" };

function isNotificationTab(value: unknown): value is NotificationTab {
  return value === "inbox" || value === "general" || value === "archived";
}

function getBrowserStorage(): NotificationStorage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function readStorageValue(
  storage: NotificationStorage | null,
  key: string,
): StorageReadResult {
  if (!storage) return { status: "unavailable" };
  try {
    const value = storage.getItem(key);
    return value === null ? { status: "missing" } : { status: "found", value };
  } catch {
    return { status: "unavailable" };
  }
}

function mergePersistedItems(value: unknown): DashboardNotification[] {
  const defaults = getNotificationDefaults();
  if (!Array.isArray(value)) return defaults;

  const persistedState = new Map<string, Record<string, unknown>>();
  value.forEach((candidate) => {
    if (
      typeof candidate === "object" &&
      candidate !== null &&
      typeof (candidate as { id?: unknown }).id === "string"
    ) {
      persistedState.set(
        (candidate as { id: string }).id,
        candidate as Record<string, unknown>,
      );
    }
  });

  return defaults.map((notification) => {
    const persistedNotification = persistedState.get(notification.id);
    if (!persistedNotification) return notification;
    return {
      ...notification,
      read: persistedNotification.read === true,
      archived: persistedNotification.archived === true,
    };
  });
}

function parseScopedSnapshot(raw: string): NotificationSnapshot {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null) {
      return { items: getNotificationDefaults(), activeTab: "inbox" };
    }
    const value = parsed as { items?: unknown; activeTab?: unknown };
    return {
      items: mergePersistedItems(value.items),
      activeTab: isNotificationTab(value.activeTab) ? value.activeTab : "inbox",
    };
  } catch {
    return { items: getNotificationDefaults(), activeTab: "inbox" };
  }
}

function loadLegacySnapshot(storage: NotificationStorage | null): {
  found: boolean;
  snapshot: NotificationSnapshot;
} {
  const itemResult = readStorageValue(storage, NOTIFICATION_STATE_STORAGE_KEY);
  const tabResult = readStorageValue(storage, NOTIFICATION_TAB_STORAGE_KEY);
  let items = getNotificationDefaults();

  if (itemResult.status === "found") {
    try {
      items = mergePersistedItems(JSON.parse(itemResult.value) as unknown);
    } catch {
      items = getNotificationDefaults();
    }
  }

  return {
    found: itemResult.status === "found" || tabResult.status === "found",
    snapshot: {
      items,
      activeTab:
        tabResult.status === "found" && isNotificationTab(tabResult.value)
          ? tabResult.value
          : "inbox",
    },
  };
}

function getUnreadCount(items: DashboardNotification[]): number {
  return items.filter(
    (notification) => !notification.read && !notification.archived,
  ).length;
}

function saveScopedSnapshot(
  storage: NotificationStorage | null,
  scopeKey: string,
  snapshot: NotificationSnapshot,
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(
      scopeKey,
      JSON.stringify({
        items: snapshot.items.map(({ id, read, archived }) => ({
          id,
          read,
          archived,
        })),
        activeTab: snapshot.activeTab,
      }),
    );
    return true;
  } catch {
    return false;
  }
}

function runWithNotificationLock<T>(
  scopeKey: string,
  operation: () => T,
  complete: (result: T) => void,
): void {
  if (typeof navigator === "undefined" || !navigator.locks) {
    complete(operation());
    return;
  }
  void navigator.locks
    .request(`nutriclinica.notifications:${scopeKey}`, operation)
    .then(complete)
    .catch(() => {
      // The optimistic in-memory update remains usable if locking fails.
    });
}

function completeLegacyMigration(
  storage: NotificationStorage | null,
  scopeKey: string,
): void {
  if (!storage) return;
  try {
    storage.setItem(NOTIFICATION_LEGACY_MIGRATION_KEY, scopeKey);
  } catch {
    // The scoped snapshot is already safe; cleanup remains best-effort.
  }
  try {
    storage.removeItem(NOTIFICATION_STATE_STORAGE_KEY);
  } catch {
    // Legacy cleanup is best-effort after a successful scoped write.
  }
  try {
    storage.removeItem(NOTIFICATION_TAB_STORAGE_KEY);
  } catch {
    // Legacy cleanup is best-effort after a successful scoped write.
  }
}

function createNotificationState(
  storage: NotificationStorage | null,
): StateCreator<NotificationState> {
  let activationRequest = 0;
  let legacyMigrationScopeKey: string | null = null;
  let legacyMigrationPending = false;

  return (set, get) => {
    const scopeIsReady = (scopeKey: string): boolean => {
      const state = get();
      return state.hydrationStatus === "ready" && state.scopeKey === scopeKey;
    };

    const persist = (
      scopeKey: string,
      items: DashboardNotification[],
      activeTab: NotificationTab,
    ): void => {
      const saved = saveScopedSnapshot(storage, scopeKey, { items, activeTab });
      if (
        saved &&
        legacyMigrationPending &&
        legacyMigrationScopeKey === scopeKey
      ) {
        completeLegacyMigration(storage, scopeKey);
        legacyMigrationPending = false;
      }
    };

    const updateItems = (
      update: (items: DashboardNotification[]) => DashboardNotification[],
    ): void => {
      const state = get();
      if (state.hydrationStatus !== "ready" || !state.scopeKey) return;
      const scopeKey = state.scopeKey;
      const fallbackSnapshot = {
        items: state.items,
        activeTab: state.activeTab,
      };
      const optimisticItems = update(state.items);
      set({
        items: optimisticItems,
        unread: getUnreadCount(optimisticItems),
      });
      runWithNotificationLock(
        scopeKey,
        () => {
          const latest = readStorageValue(storage, scopeKey);
          const snapshot =
            latest.status === "found"
              ? parseScopedSnapshot(latest.value)
              : fallbackSnapshot;
          const items = update(snapshot.items);
          persist(scopeKey, items, snapshot.activeTab);
          return items;
        },
        (items) => {
          if (!scopeIsReady(scopeKey)) return;
          set({ items, unread: getUnreadCount(items) });
        },
      );
    };

    const activateScope = (requestedScope: NotificationScope): void => {
      const request = ++activationRequest;
      const scope = { ...requestedScope };
      const scopeKey = notificationStorageKey(scope);
      set({
        scope,
        scopeKey,
        hydrationStatus: "loading",
        items: [],
        activeTab: "inbox",
        unread: 0,
      });

      const scopedResult = readStorageValue(storage, scopeKey);
      if (request !== activationRequest || get().scopeKey !== scopeKey) return;

      let snapshot: NotificationSnapshot = {
        items: getNotificationDefaults(),
        activeTab: "inbox",
      };

      if (scopedResult.status === "found") {
        snapshot = parseScopedSnapshot(scopedResult.value);
      } else if (scopedResult.status === "missing") {
        const migrationResult = readStorageValue(
          storage,
          NOTIFICATION_LEGACY_MIGRATION_KEY,
        );
        if (request !== activationRequest || get().scopeKey !== scopeKey)
          return;

        const canClaimLegacy =
          migrationResult.status === "missing" &&
          (legacyMigrationScopeKey === null ||
            legacyMigrationScopeKey === scopeKey);
        if (canClaimLegacy) {
          const legacy = loadLegacySnapshot(storage);
          if (request !== activationRequest || get().scopeKey !== scopeKey)
            return;
          if (legacy.found) {
            legacyMigrationScopeKey = scopeKey;
            legacyMigrationPending = true;
            snapshot = legacy.snapshot;
            if (saveScopedSnapshot(storage, scopeKey, snapshot)) {
              completeLegacyMigration(storage, scopeKey);
              legacyMigrationPending = false;
            }
          }
        }
      }

      if (request !== activationRequest || get().scopeKey !== scopeKey) return;
      set({
        scope,
        scopeKey,
        hydrationStatus: "ready",
        items: snapshot.items,
        activeTab: snapshot.activeTab,
        unread: getUnreadCount(snapshot.items),
      });
    };

    return {
      scope: null,
      scopeKey: null,
      hydrationStatus: "idle",
      items: [],
      activeTab: "inbox",
      unread: 0,
      activateScope,
      deactivateScope: () => {
        activationRequest += 1;
        set({
          scope: null,
          scopeKey: null,
          hydrationStatus: "idle",
          items: [],
          activeTab: "inbox",
          unread: 0,
        });
      },
      setActiveTab: (activeTab) => {
        const state = get();
        if (state.hydrationStatus !== "ready" || !state.scopeKey) return;
        const scopeKey = state.scopeKey;
        const fallbackItems = state.items;
        set({ activeTab });
        runWithNotificationLock(
          scopeKey,
          () => {
            const latest = readStorageValue(storage, scopeKey);
            const items =
              latest.status === "found"
                ? parseScopedSnapshot(latest.value).items
                : fallbackItems;
            persist(scopeKey, items, activeTab);
            return items;
          },
          (items) => {
            if (!scopeIsReady(scopeKey)) return;
            set({ items, unread: getUnreadCount(items), activeTab });
          },
        );
      },
      markRead: (id) => {
        updateItems((items) =>
          items.map((notification) =>
            notification.id === id
              ? { ...notification, read: true }
              : notification,
          ),
        );
      },
      markAllRead: () => {
        updateItems((items) =>
          items.map((notification) =>
            notification.read ? notification : { ...notification, read: true },
          ),
        );
      },
      archive: (id) => {
        updateItems((items) =>
          items.map((notification) =>
            notification.id === id
              ? { ...notification, read: true, archived: true }
              : notification,
          ),
        );
      },
      archiveVisible: (tab) => {
        if (tab === "archived") return;
        updateItems((items) =>
          items.map((notification) => {
            const visible =
              !notification.archived &&
              (tab === "general" || notification.type === "patient_message");
            return visible
              ? { ...notification, read: true, archived: true }
              : notification;
          }),
        );
      },
      resolveAction: (id, action) => {
        void action;
        updateItems((items) =>
          items.map((notification) =>
            notification.id === id
              ? { ...notification, read: true, archived: true }
              : notification,
          ),
        );
      },
      resetMockData: () => {
        const state = get();
        if (state.hydrationStatus !== "ready" || !state.scopeKey) return;
        const scopeKey = state.scopeKey;
        const items = getNotificationDefaults();
        set({ items, activeTab: "inbox", unread: getUnreadCount(items) });
        runWithNotificationLock(
          scopeKey,
          () => {
            persist(scopeKey, items, "inbox");
            return items;
          },
          (savedItems) => {
            if (!scopeIsReady(scopeKey)) return;
            set({
              items: savedItems,
              activeTab: "inbox",
              unread: getUnreadCount(savedItems),
            });
          },
        );
      },
      clear: () => get().markAllRead(),
    };
  };
}

export function createNotificationStore(
  storage: NotificationStorage | null = getBrowserStorage(),
): StoreApi<NotificationState> {
  return createStore<NotificationState>(createNotificationState(storage));
}

export const useNotificationStore = create<NotificationState>(
  createNotificationState(getBrowserStorage()),
);
