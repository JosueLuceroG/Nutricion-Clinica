import { create, type StoreApi, type UseBoundStore } from "zustand";
import {
  clampNoteToViewport,
  createCascadedDefaultPosition,
  createFullViewportSafeRect,
  createQuickNoteSize,
  normalizeQuickNoteSize,
  normalizePersistedQuickNoteGeometry,
  type QuickNotesSafeRect,
  type QuickNotesViewport,
} from "@modules/quick-notes/application";
import {
  MAX_QUICK_NOTES,
  createDefaultQuickNotesPreferences,
  createDefaultQuickNotesSnapshot,
  createQuickNoteId,
  parseQuickNote,
  parseQuickNotesSnapshot,
  type QuickNote,
  type QuickNoteCategory,
  type QuickNoteColor,
  type QuickNoteId,
  type QuickNotePosition,
  type QuickNotePriority,
  type QuickNoteRelatedEntity,
  type QuickNoteReminder,
  type QuickNotesPreferences,
  type QuickNotesLoadResult,
  type QuickNotesRepository,
  type QuickNotesScope,
  type QuickNoteSize,
  type QuickNoteSizePreset,
} from "@modules/quick-notes/domain";
import {
  localStorageQuickNotesRepository,
  quickNotesStorageKey,
} from "@modules/quick-notes/infrastructure";

export type QuickNotesHydrationStatus = "idle" | "loading" | "ready" | "error";
export type QuickNotesPersistenceStatus =
  | "idle"
  | "pending"
  | "saving"
  | "saved"
  | "error";

export interface QuickNotesViewportContext extends QuickNotesViewport {
  safeRect: QuickNotesSafeRect;
}

export interface CreateQuickNoteInput {
  title?: string;
  content?: string;
  color?: QuickNoteColor;
  priority?: QuickNotePriority;
  category?: QuickNoteCategory;
  pinned?: boolean;
  minimized?: boolean;
  position?: QuickNotePosition;
  size?: QuickNoteSize | QuickNoteSizePreset;
  reminder?: QuickNoteReminder | null;
  relatedEntity?: QuickNoteRelatedEntity | null;
}

export type UpdateQuickNoteInput = Partial<
  Pick<
    QuickNote,
    | "title"
    | "content"
    | "color"
    | "priority"
    | "category"
    | "pinned"
    | "minimized"
    | "completed"
    | "position"
    | "size"
    | "reminder"
    | "relatedEntity"
  >
>;

export interface QuickNotesStoreState {
  scope: QuickNotesScope | null;
  scopeKey: string | null;
  notes: QuickNote[];
  preferences: QuickNotesPreferences;
  hydrationStatus: QuickNotesHydrationStatus;
  persistenceStatus: QuickNotesPersistenceStatus;
  error: string | null;
  panelOpen: boolean;
  editorNoteId: QuickNoteId | null;
  creating: boolean;
  activateScope: (scope: QuickNotesScope) => Promise<void>;
  deactivateScope: () => Promise<void>;
  togglePanel: () => void;
  openPanel: () => void;
  closePanel: () => void;
  beginCreate: () => void;
  cancelCreate: () => void;
  beginEdit: (id: QuickNoteId) => void;
  cancelEdit: () => void;
  createNote: (input?: CreateQuickNoteInput) => QuickNoteId | null;
  updateNote: (id: QuickNoteId, input: UpdateQuickNoteInput) => void;
  deleteNote: (id: QuickNoteId) => void;
  duplicateNote: (id: QuickNoteId) => QuickNoteId | null;
  togglePin: (id: QuickNoteId) => void;
  toggleMinimize: (id: QuickNoteId) => void;
  toggleCompleted: (id: QuickNoteId) => void;
  setColor: (id: QuickNoteId, color: QuickNoteColor) => void;
  moveNote: (
    id: QuickNoteId,
    position: QuickNotePosition,
    safeRect?: QuickNotesSafeRect,
  ) => void;
  bringToFront: (id: QuickNoteId) => void;
  updatePreferences: (preferences: Partial<QuickNotesPreferences>) => void;
  save: () => Promise<boolean>;
  flush: () => Promise<boolean>;
  retry: () => Promise<boolean>;
}

export interface QuickNotesStoreDependencies {
  repository?: QuickNotesRepository;
  now?: () => Date | string;
  generateId?: () => QuickNoteId;
  getViewport?: () => QuickNotesViewportContext;
  autosaveDelayMs?: number;
  structuralSaveDelayMs?: number;
}

const MAX_EXPANDED_PINNED_NOTES = 5;

function defaultViewportContext(): QuickNotesViewportContext {
  const width =
    typeof window === "undefined" ? 1280 : Math.max(1, window.innerWidth);
  const height =
    typeof window === "undefined" ? 800 : Math.max(1, window.innerHeight);
  const viewport = { width, height };
  return { ...viewport, safeRect: createFullViewportSafeRect(viewport) };
}

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function normalizeLoadedNotes(
  notes: QuickNote[],
  viewport: QuickNotesViewportContext,
): QuickNote[] {
  let expandedPinned = 0;
  return notes.map((note) => {
    const geometry = normalizePersistedQuickNoteGeometry(
      note.position,
      note.size,
      viewport,
      viewport.safeRect,
    );
    const pinned = note.completed ? false : note.pinned;
    let minimized = note.minimized;
    if (pinned && !minimized) {
      if (expandedPinned >= MAX_EXPANDED_PINNED_NOTES) minimized = true;
      else expandedPinned += 1;
    }
    return { ...note, ...geometry, pinned, minimized };
  });
}

export function createQuickNotesStore(
  dependencies: QuickNotesStoreDependencies = {},
): UseBoundStore<StoreApi<QuickNotesStoreState>> {
  const repository =
    dependencies.repository ?? localStorageQuickNotesRepository;
  const now = dependencies.now ?? (() => new Date());
  const generateId = dependencies.generateId ?? createQuickNoteId;
  const getViewport = dependencies.getViewport ?? defaultViewportContext;
  const autosaveDelayMs = dependencies.autosaveDelayMs ?? 400;
  const structuralSaveDelayMs = dependencies.structuralSaveDelayMs ?? 0;

  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  let activeSave: Promise<boolean> | null = null;
  let dirty = false;
  let mutationVersion = 0;
  let persistedRevision = 0;
  let loadRequest = 0;

  const timestamp = (): string => {
    const value = now();
    return typeof value === "string" ? value : value.toISOString();
  };

  const store = create<QuickNotesStoreState>((set, get) => {
    const clearSaveTimer = (): void => {
      if (saveTimer !== null) clearTimeout(saveTimer);
      saveTimer = null;
    };

    const persistOnce = async (): Promise<boolean> => {
      const state = get();
      if (!dirty) return true;
      if (!state.scope || state.hydrationStatus !== "ready") return false;

      const scope = state.scope;
      const scopeKey = state.scopeKey;
      const capturedMutationVersion = mutationVersion;
      const snapshot = createDefaultQuickNotesSnapshot(scope, timestamp());
      snapshot.notes = state.notes;
      snapshot.preferences = state.preferences;
      snapshot.revision = persistedRevision + 1;

      set({ persistenceStatus: "saving", error: null });
      try {
        const saved = await repository.save(scope, snapshot);
        if (get().scopeKey !== scopeKey) return true;
        persistedRevision = saved.revision;
        if (mutationVersion === capturedMutationVersion) {
          dirty = false;
          set({ persistenceStatus: "saved", error: null });
        } else {
          set({ persistenceStatus: "pending" });
        }
        return true;
      } catch (error) {
        if (get().scopeKey === scopeKey) {
          set({ persistenceStatus: "error", error: messageFrom(error) });
        }
        return false;
      }
    };

    const persist = async (): Promise<boolean> => {
      clearSaveTimer();
      if (activeSave) {
        const succeeded = await activeSave;
        if (!succeeded || !dirty) return succeeded;
        return persist();
      }

      const operation = persistOnce();
      activeSave = operation;
      const succeeded = await operation;
      if (activeSave === operation) activeSave = null;
      if (succeeded && dirty) return persist();
      return succeeded;
    };

    const schedulePersistence = (delay: number): void => {
      clearSaveTimer();
      saveTimer = setTimeout(
        () => {
          saveTimer = null;
          void persist();
        },
        Math.max(0, delay),
      );
    };

    const commitNotes = (
      notes: QuickNote[],
      delay: number,
      stateUpdate: Partial<QuickNotesStoreState> = {},
    ): void => {
      dirty = true;
      mutationVersion += 1;
      set({
        ...stateUpdate,
        notes,
        persistenceStatus: "pending",
        error: null,
      });
      schedulePersistence(delay);
    };

    const currentViewport = (): QuickNotesViewportContext => {
      try {
        return getViewport();
      } catch {
        return defaultViewportContext();
      }
    };

    const replaceNote = (
      id: QuickNoteId,
      updater: (note: QuickNote, notes: QuickNote[]) => QuickNote | null,
      delay: number,
    ): void => {
      const state = get();
      if (state.hydrationStatus !== "ready") return;
      const noteIndex = state.notes.findIndex((note) => note.id === id);
      if (noteIndex < 0) return;
      const replacement = updater(state.notes[noteIndex]!, state.notes);
      if (!replacement) return;
      const parsed = parseQuickNote(replacement);
      if (!parsed) {
        set({ error: "The Quick Note update is invalid" });
        return;
      }
      const notes = [...state.notes];
      notes[noteIndex] = parsed;
      commitNotes(notes, delay);
    };

    const activateScope = async (scope: QuickNotesScope): Promise<void> => {
      const existing = get();
      const nextScopeKey = quickNotesStorageKey(scope);
      if (
        existing.scopeKey === nextScopeKey &&
        existing.hydrationStatus === "ready"
      )
        return;

      const request = ++loadRequest;
      if (existing.hydrationStatus === "ready" && dirty && !(await persist()))
        return;
      if (request !== loadRequest) return;

      clearSaveTimer();
      dirty = false;
      persistedRevision = 0;
      set({
        scope: { ...scope },
        scopeKey: nextScopeKey,
        notes: [],
        preferences: createDefaultQuickNotesPreferences(),
        hydrationStatus: "loading",
        persistenceStatus: "idle",
        error: null,
        panelOpen: false,
        editorNoteId: null,
        creating: false,
      });

      let result: QuickNotesLoadResult;
      try {
        result = await repository.load(scope);
      } catch (error) {
        if (request === loadRequest && get().scopeKey === nextScopeKey) {
          set({
            hydrationStatus: "error",
            persistenceStatus: "error",
            error: messageFrom(error),
          });
        }
        return;
      }
      if (request !== loadRequest || get().scopeKey !== nextScopeKey) return;

      if (result.status === "invalid" || result.status === "unavailable") {
        set({
          hydrationStatus: "error",
          persistenceStatus: result.status === "unavailable" ? "error" : "idle",
          error: result.message,
        });
        return;
      }

      const snapshot =
        result.status === "found"
          ? result.snapshot
          : createDefaultQuickNotesSnapshot(scope, timestamp());
      const viewport = currentViewport();
      const notes = normalizeLoadedNotes(snapshot.notes, viewport);
      persistedRevision = snapshot.revision;
      const geometryChanged =
        JSON.stringify(notes) !== JSON.stringify(snapshot.notes);
      dirty = geometryChanged;
      if (geometryChanged) mutationVersion += 1;
      set({
        notes,
        preferences: { ...snapshot.preferences },
        hydrationStatus: "ready",
        persistenceStatus: geometryChanged ? "pending" : "idle",
        error: null,
      });
      if (geometryChanged) schedulePersistence(autosaveDelayMs);
    };

    return {
      scope: null,
      scopeKey: null,
      notes: [],
      preferences: createDefaultQuickNotesPreferences(),
      hydrationStatus: "idle",
      persistenceStatus: "idle",
      error: null,
      panelOpen: false,
      editorNoteId: null,
      creating: false,

      activateScope,

      deactivateScope: async () => {
        const request = ++loadRequest;
        if (get().hydrationStatus === "ready" && dirty && !(await persist()))
          return;
        if (request !== loadRequest) return;
        clearSaveTimer();
        dirty = false;
        persistedRevision = 0;
        set({
          scope: null,
          scopeKey: null,
          notes: [],
          preferences: createDefaultQuickNotesPreferences(),
          hydrationStatus: "idle",
          persistenceStatus: "idle",
          error: null,
          panelOpen: false,
          editorNoteId: null,
          creating: false,
        });
      },

      togglePanel: () =>
        set((state) => ({
          panelOpen: !state.panelOpen,
          ...(!state.panelOpen ? {} : { editorNoteId: null, creating: false }),
        })),
      openPanel: () => set({ panelOpen: true }),
      closePanel: () =>
        set({ panelOpen: false, editorNoteId: null, creating: false }),
      beginCreate: () =>
        set({ panelOpen: true, creating: true, editorNoteId: null }),
      cancelCreate: () => set({ creating: false }),
      beginEdit: (id) => {
        if (!get().notes.some((note) => note.id === id)) return;
        set({ panelOpen: true, editorNoteId: id, creating: false });
      },
      cancelEdit: () => set({ editorNoteId: null }),

      createNote: (input = {}) => {
        const state = get();
        if (state.hydrationStatus !== "ready") return null;
        if (state.notes.length >= MAX_QUICK_NOTES) {
          set({
            error: `A scope cannot contain more than ${MAX_QUICK_NOTES} Quick Notes`,
          });
          return null;
        }

        const id = generateId();
        if (state.notes.some((note) => note.id === id)) {
          set({ error: "The generated Quick Note ID already exists" });
          return null;
        }
        const viewport = currentViewport();
        const requestedSize =
          typeof input.size === "string"
            ? createQuickNoteSize(input.size)
            : (input.size ??
              createQuickNoteSize(state.preferences.defaultSize));
        const size = normalizeQuickNoteSize(requestedSize);
        const geometry = input.position
          ? normalizePersistedQuickNoteGeometry(
              input.position,
              size,
              viewport,
              viewport.safeRect,
            )
          : {
              size,
              position: createCascadedDefaultPosition(
                state.notes.length,
                size,
                viewport,
                viewport.safeRect,
              ),
            };
        const expandedPinned = state.notes.filter(
          (note) => note.pinned && !note.minimized,
        ).length;
        const pinned = input.pinned ?? false;
        const createdAt = timestamp();
        const note = parseQuickNote({
          id,
          title: input.title ?? "",
          content: input.content ?? "",
          color: input.color ?? state.preferences.defaultColor,
          priority: input.priority ?? state.preferences.defaultPriority,
          category: input.category ?? state.preferences.defaultCategory,
          pinned,
          minimized:
            (input.minimized ?? false) ||
            (pinned && expandedPinned >= MAX_EXPANDED_PINNED_NOTES),
          completed: false,
          ...geometry,
          reminder: input.reminder ?? null,
          relatedEntity: input.relatedEntity ?? null,
          createdAt,
          updatedAt: createdAt,
          completedAt: null,
        });
        if (!note) {
          set({ error: "The Quick Note is invalid" });
          return null;
        }
        commitNotes([...state.notes, note], structuralSaveDelayMs, {
          creating: false,
          editorNoteId: note.id,
          panelOpen: true,
        });
        return note.id;
      },

      updateNote: (id, input) => {
        replaceNote(
          id,
          (note, notes) => {
            let candidate: QuickNote = { ...note, ...input };
            if (input.completed !== undefined) {
              candidate = {
                ...candidate,
                completedAt: input.completed ? timestamp() : null,
                pinned: input.completed ? false : candidate.pinned,
              };
            }
            if (candidate.completed) candidate.pinned = false;

            if (input.position || input.size) {
              const viewport = currentViewport();
              const geometry = normalizePersistedQuickNoteGeometry(
                candidate.position,
                candidate.size,
                viewport,
                viewport.safeRect,
              );
              candidate = { ...candidate, ...geometry };
            }
            const otherExpandedPins = notes.filter(
              (item) => item.id !== id && item.pinned && !item.minimized,
            ).length;
            if (
              candidate.pinned &&
              !candidate.minimized &&
              otherExpandedPins >= MAX_EXPANDED_PINNED_NOTES
            ) {
              candidate.minimized = true;
            }

            const comparable = { ...candidate, updatedAt: note.updatedAt };
            if (JSON.stringify(comparable) === JSON.stringify(note))
              return null;
            return { ...candidate, updatedAt: timestamp() };
          },
          autosaveDelayMs,
        );
      },

      deleteNote: (id) => {
        const state = get();
        const notes = state.notes.filter((note) => note.id !== id);
        if (notes.length === state.notes.length) return;
        commitNotes(notes, structuralSaveDelayMs, {
          editorNoteId: state.editorNoteId === id ? null : state.editorNoteId,
        });
      },

      duplicateNote: (id) => {
        const state = get();
        const source = state.notes.find((note) => note.id === id);
        if (!source || state.notes.length >= MAX_QUICK_NOTES) return null;
        const duplicateId = generateId();
        if (state.notes.some((note) => note.id === duplicateId)) {
          set({ error: "The generated Quick Note ID already exists" });
          return null;
        }
        const viewport = currentViewport();
        const geometry = normalizePersistedQuickNoteGeometry(
          {
            ...source.position,
            x: source.position.x + 28,
            y: source.position.y + 28,
          },
          source.size,
          viewport,
          viewport.safeRect,
        );
        const createdAt = timestamp();
        const duplicate = parseQuickNote({
          ...source,
          ...geometry,
          id: duplicateId,
          pinned: false,
          minimized: false,
          completed: false,
          completedAt: null,
          reminder: source.reminder ? { ...source.reminder } : null,
          relatedEntity: source.relatedEntity
            ? { ...source.relatedEntity }
            : null,
          createdAt,
          updatedAt: createdAt,
        });
        if (!duplicate) return null;
        commitNotes([...state.notes, duplicate], structuralSaveDelayMs, {
          editorNoteId: duplicate.id,
          panelOpen: true,
        });
        return duplicate.id;
      },

      togglePin: (id) => {
        replaceNote(
          id,
          (note, notes) => {
            if (note.completed) return null;
            const pinned = !note.pinned;
            const expandedPinned = notes.filter(
              (item) => item.id !== id && item.pinned && !item.minimized,
            ).length;
            return {
              ...note,
              pinned,
              minimized:
                pinned && expandedPinned >= MAX_EXPANDED_PINNED_NOTES
                  ? true
                  : note.minimized,
              updatedAt: timestamp(),
            };
          },
          structuralSaveDelayMs,
        );
      },

      toggleMinimize: (id) => {
        replaceNote(
          id,
          (note, notes) => {
            const minimized = !note.minimized;
            if (!minimized && note.pinned) {
              const expandedPinned = notes.filter(
                (item) => item.id !== id && item.pinned && !item.minimized,
              ).length;
              if (expandedPinned >= MAX_EXPANDED_PINNED_NOTES) {
                set({
                  error: `Only ${MAX_EXPANDED_PINNED_NOTES} pinned notes can be expanded`,
                });
                return null;
              }
            }
            return { ...note, minimized, updatedAt: timestamp() };
          },
          structuralSaveDelayMs,
        );
      },

      toggleCompleted: (id) => {
        replaceNote(
          id,
          (note) => {
            const completed = !note.completed;
            const updatedAt = timestamp();
            return {
              ...note,
              completed,
              pinned: completed ? false : note.pinned,
              completedAt: completed ? updatedAt : null,
              updatedAt,
            };
          },
          structuralSaveDelayMs,
        );
      },

      setColor: (id, color) => {
        replaceNote(
          id,
          (note) =>
            note.color === color
              ? null
              : { ...note, color, updatedAt: timestamp() },
          structuralSaveDelayMs,
        );
      },

      moveNote: (id, position, safeRect) => {
        replaceNote(
          id,
          (note) => {
            const viewport = {
              width: position.viewportWidth,
              height: position.viewportHeight,
            };
            const rect = safeRect ?? createFullViewportSafeRect(viewport);
            const nextPosition = clampNoteToViewport(position, note.size, rect);
            if (JSON.stringify(nextPosition) === JSON.stringify(note.position))
              return null;
            return { ...note, position: nextPosition, updatedAt: timestamp() };
          },
          autosaveDelayMs,
        );
      },

      bringToFront: (id) => {
        const state = get();
        const index = state.notes.findIndex((note) => note.id === id);
        if (index < 0 || index === state.notes.length - 1) return;
        const notes = [...state.notes];
        const [note] = notes.splice(index, 1);
        notes.push(note!);
        commitNotes(notes, autosaveDelayMs);
      },

      updatePreferences: (preferences) => {
        const state = get();
        if (state.hydrationStatus !== "ready") return;
        const next = { ...state.preferences, ...preferences };
        const probe = createDefaultQuickNotesSnapshot(
          state.scope!,
          timestamp(),
        );
        probe.preferences = next;
        if (!parseQuickNotesSnapshot(probe)) {
          set({ error: "The Quick Notes preferences are invalid" });
          return;
        }
        if (JSON.stringify(next) === JSON.stringify(state.preferences)) return;
        dirty = true;
        mutationVersion += 1;
        set({ preferences: next, persistenceStatus: "pending", error: null });
        schedulePersistence(autosaveDelayMs);
      },

      save: persist,
      flush: persist,
      retry: async () => {
        const state = get();
        if (state.hydrationStatus === "error" && state.scope) {
          await activateScope(state.scope);
          return get().hydrationStatus === "ready";
        }
        if (dirty) return persist();
        return true;
      },
    };
  });

  return store;
}

export const useQuickNotesStore = createQuickNotesStore();
