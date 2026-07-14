import * as React from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock3,
  Copy,
  LoaderCircle,
  Maximize2,
  Minimize2,
  MoreVertical,
  Pencil,
  Pin,
  PinOff,
  Plus,
  RotateCcw,
  Search,
  StickyNote,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@components/ui/button";
import { ConfirmDialog } from "@components/layout/ConfirmDialog";
import {
  QUICK_NOTE_CATEGORIES,
  QUICK_NOTE_COLORS,
  QUICK_NOTE_MAX_DIMENSIONS,
  QUICK_NOTE_MIN_DIMENSIONS,
  QUICK_NOTE_PRIORITIES,
  type QuickNote,
  type QuickNoteCategory,
  type QuickNoteColor,
  type QuickNoteId,
  type QuickNotePriority,
  type QuickNoteSizePreset,
} from "../domain";
import { createQuickNoteSize, type QuickNotesSafeRect } from "../application";
import { useQuickNotesStore } from "@store/quickNotesStore";
import { cn } from "@utils/cn";
import "./quickNotes.css";

const MOBILE_QUERY = "(max-width: 767px)";

function readSafeRect(): QuickNotesSafeRect {
  const width = Math.max(1, window.innerWidth);
  const height = Math.max(1, window.innerHeight);
  const workspace =
    document.querySelector<HTMLElement>(".nc-dashboard-main") ??
    document.querySelector<HTMLElement>("#main-content");
  const header = document.querySelector<HTMLElement>(
    "[data-quick-notes-header]",
  );
  const statusBar = document.querySelector<HTMLElement>(
    "[data-quick-notes-status-bar]",
  );
  const workspaceRect = workspace?.getBoundingClientRect();
  const headerRect = header?.getBoundingClientRect();
  const statusRect = statusBar?.getBoundingClientRect();

  return {
    left: Math.max(0, workspaceRect?.left ?? 0),
    top: Math.max(0, workspaceRect?.top ?? 0, headerRect?.bottom ?? 0),
    right: Math.min(width, workspaceRect?.right ?? width),
    bottom: Math.min(
      height,
      workspaceRect?.bottom ?? height,
      statusRect?.top ?? height,
    ),
  };
}

function useMobileLayout(): boolean {
  const [mobile, setMobile] = React.useState(
    () =>
      typeof window !== "undefined" && window.matchMedia(MOBILE_QUERY).matches,
  );

  React.useEffect(() => {
    const media = window.matchMedia(MOBILE_QUERY);
    const update = () => setMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return mobile;
}

function useQuickNotesSafeRect(routeKey: string): QuickNotesSafeRect {
  const [safeRect, setSafeRect] = React.useState<QuickNotesSafeRect>(() => ({
    left: 0,
    top: 0,
    right: typeof window === "undefined" ? 1280 : window.innerWidth,
    bottom: typeof window === "undefined" ? 800 : window.innerHeight,
  }));

  React.useLayoutEffect(() => {
    const update = () => {
      const next = readSafeRect();
      setSafeRect((current) =>
        current.left === next.left &&
        current.top === next.top &&
        current.right === next.right &&
        current.bottom === next.bottom
          ? current
          : next,
      );
    };
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    const mutationObserver =
      typeof MutationObserver === "undefined"
        ? null
        : new MutationObserver(() => registerTargets());
    const registerTargets = (): boolean => {
      const workspace = document.querySelector<HTMLElement>(
        routeKey === "/" ? ".nc-dashboard-main" : "#main-content",
      );
      const header = document.querySelector<HTMLElement>(
        "[data-quick-notes-header]",
      );
      const statusBar = document.querySelector<HTMLElement>(
        "[data-quick-notes-status-bar]",
      );
      if (!workspace || !header || !statusBar) return false;
      [workspace, header, statusBar].forEach((element) =>
        observer?.observe(element),
      );
      mutationObserver?.disconnect();
      update();
      return true;
    };
    const frame = window.requestAnimationFrame(() => {
      if (!registerTargets()) {
        mutationObserver?.observe(document.body, {
          childList: true,
          subtree: true,
        });
      }
      update();
    });
    window.addEventListener("resize", update);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", update);
      observer?.disconnect();
      mutationObserver?.disconnect();
    };
  }, [routeKey]);

  return safeRect;
}

interface QuickNoteDraft {
  title: string;
  content: string;
  color: QuickNoteColor;
  priority: QuickNotePriority;
  category: QuickNoteCategory;
  size: QuickNoteSizePreset;
  pinned: boolean;
}

function QuickNoteEditor({ note }: { note: QuickNote | null }) {
  const { t } = useTranslation();
  const preferences = useQuickNotesStore((state) => state.preferences);
  const createNote = useQuickNotesStore((state) => state.createNote);
  const updateNote = useQuickNotesStore((state) => state.updateNote);
  const cancelCreate = useQuickNotesStore((state) => state.cancelCreate);
  const cancelEdit = useQuickNotesStore((state) => state.cancelEdit);
  const [draft, setDraft] = React.useState<QuickNoteDraft>(() => ({
    title: note?.title ?? "",
    content: note?.content ?? "",
    color: note?.color ?? preferences.defaultColor,
    priority: note?.priority ?? preferences.defaultPriority,
    category: note?.category ?? preferences.defaultCategory,
    size: note?.size.preset ?? preferences.defaultSize,
    pinned: note?.pinned ?? false,
  }));
  const canSave =
    draft.title.trim().length > 0 || draft.content.trim().length > 0;

  const closeEditor = () => {
    if (note) cancelEdit();
    else cancelCreate();
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSave) return;
    const input = {
      title: draft.title.trim(),
      content: draft.content.trim(),
      color: draft.color,
      priority: draft.priority,
      category: draft.category,
      size: draft.size,
      pinned: draft.pinned,
    };
    if (note) {
      updateNote(note.id, { ...input, size: createQuickNoteSize(draft.size) });
      cancelEdit();
      return;
    }
    if (createNote(input)) cancelEdit();
  };

  return (
    <form className="qn-editor" onSubmit={submit} data-quick-notes-editor="">
      <div className="qn-editor__heading">
        <button
          type="button"
          className="qn-icon-button"
          onClick={closeEditor}
          aria-label={t("quick_notes.back_to_notes")}
        >
          <ArrowLeft aria-hidden="true" />
        </button>
        <div>
          <span>
            {note ? t("quick_notes.edit_note") : t("quick_notes.new_note")}
          </span>
          <small>{t("quick_notes.private_hint")}</small>
        </div>
      </div>

      <label className="qn-field">
        <span>{t("quick_notes.title_label")}</span>
        <input
          autoFocus
          value={draft.title}
          maxLength={120}
          onChange={(event) =>
            setDraft((current) => ({ ...current, title: event.target.value }))
          }
          placeholder={t("quick_notes.title_placeholder")}
        />
      </label>

      <label
        className="qn-field qn-field--grow"
        htmlFor="quick-note-content-input"
      >
        <span>{t("quick_notes.content_label")}</span>
        <textarea
          id="quick-note-content-input"
          value={draft.content}
          maxLength={5000}
          onChange={(event) =>
            setDraft((current) => ({ ...current, content: event.target.value }))
          }
          placeholder={t("quick_notes.content_placeholder")}
          aria-label={t("quick_notes.content_label")}
          aria-describedby="quick-note-character-count"
        />
        <small id="quick-note-character-count">
          {t("quick_notes.character_count", { count: draft.content.length })}
        </small>
      </label>

      <fieldset className="qn-color-fieldset">
        <legend>{t("quick_notes.color_label")}</legend>
        <div className="qn-color-options">
          {QUICK_NOTE_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              className="qn-color-option"
              data-color={color}
              data-selected={draft.color === color || undefined}
              onClick={() => setDraft((current) => ({ ...current, color }))}
              aria-label={t(`quick_notes.colors.${color}`)}
              aria-pressed={draft.color === color}
            >
              {draft.color === color && <Check aria-hidden="true" />}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="qn-editor__grid">
        <label className="qn-field">
          <span>{t("quick_notes.category_label")}</span>
          <select
            value={draft.category}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                category: event.target.value as QuickNoteCategory,
              }))
            }
          >
            {QUICK_NOTE_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {t(`quick_notes.categories.${category}`)}
              </option>
            ))}
          </select>
        </label>

        <label className="qn-field">
          <span>{t("quick_notes.priority_label")}</span>
          <select
            value={draft.priority}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                priority: event.target.value as QuickNotePriority,
              }))
            }
          >
            {QUICK_NOTE_PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {t(`quick_notes.priorities.${priority}`)}
              </option>
            ))}
          </select>
        </label>

        <label className="qn-field">
          <span>{t("quick_notes.size_label")}</span>
          <select
            value={draft.size}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                size: event.target.value as QuickNoteSizePreset,
              }))
            }
          >
            <option value="compact">{t("quick_notes.sizes.compact")}</option>
            <option value="regular">{t("quick_notes.sizes.regular")}</option>
          </select>
        </label>

        <label className="qn-pin-toggle">
          <input
            type="checkbox"
            checked={draft.pinned}
            disabled={note?.completed}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                pinned: event.target.checked,
              }))
            }
          />
          <Pin aria-hidden="true" />
          <span>{t("quick_notes.keep_visible")}</span>
        </label>
      </div>

      <div className="qn-editor__footer">
        <Button type="button" variant="ghost" onClick={closeEditor}>
          {t("common.cancel")}
        </Button>
        <Button type="submit" disabled={!canSave}>
          {note ? t("common.save") : t("quick_notes.create_note")}
        </Button>
      </div>
    </form>
  );
}

interface QuickNotesPanelProps {
  mobile: boolean;
  panelRef: React.RefObject<HTMLElement | null>;
  requestDelete: (id: QuickNoteId) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => void;
}

function QuickNotesPanel({
  mobile,
  panelRef,
  requestDelete,
  onKeyDown,
}: QuickNotesPanelProps) {
  const { t, i18n } = useTranslation();
  const notes = useQuickNotesStore((state) => state.notes);
  const preferences = useQuickNotesStore((state) => state.preferences);
  const hydrationStatus = useQuickNotesStore((state) => state.hydrationStatus);
  const persistenceStatus = useQuickNotesStore(
    (state) => state.persistenceStatus,
  );
  const error = useQuickNotesStore((state) => state.error);
  const editorNoteId = useQuickNotesStore((state) => state.editorNoteId);
  const creating = useQuickNotesStore((state) => state.creating);
  const closePanel = useQuickNotesStore((state) => state.closePanel);
  const beginCreate = useQuickNotesStore((state) => state.beginCreate);
  const beginEdit = useQuickNotesStore((state) => state.beginEdit);
  const duplicateNote = useQuickNotesStore((state) => state.duplicateNote);
  const togglePin = useQuickNotesStore((state) => state.togglePin);
  const toggleCompleted = useQuickNotesStore((state) => state.toggleCompleted);
  const updatePreferences = useQuickNotesStore(
    (state) => state.updatePreferences,
  );
  const retry = useQuickNotesStore((state) => state.retry);
  const [query, setQuery] = React.useState("");
  const deferredQuery = React.useDeferredValue(query);
  const [category, setCategory] = React.useState<"all" | QuickNoteCategory>(
    "all",
  );
  const searchRef = React.useRef<HTMLInputElement>(null);
  const editingNote = editorNoteId
    ? (notes.find((note) => note.id === editorNoteId) ?? null)
    : null;
  const normalizedQuery = deferredQuery.trim().toLocaleLowerCase(i18n.language);
  const visibleNotes = notes
    .filter((note) => preferences.showCompleted || !note.completed)
    .filter((note) => category === "all" || note.category === category)
    .filter(
      (note) =>
        !normalizedQuery ||
        `${note.title} ${note.content}`
          .toLocaleLowerCase(i18n.language)
          .includes(normalizedQuery),
    )
    .sort(
      (first, second) =>
        new Date(second.updatedAt).getTime() -
        new Date(first.updatedAt).getTime(),
    );
  const activeCount = notes.filter((note) => !note.completed).length;

  React.useEffect(() => {
    if (!creating && !editorNoteId)
      window.requestAnimationFrame(() => searchRef.current?.focus());
  }, [creating, editorNoteId]);

  React.useEffect(() => {
    if (editorNoteId && !editingNote)
      useQuickNotesStore.getState().cancelEdit();
  }, [editingNote, editorNoteId]);

  const persistenceLabel =
    persistenceStatus === "saving"
      ? t("quick_notes.saving")
      : persistenceStatus === "pending"
        ? t("quick_notes.pending_save")
        : persistenceStatus === "error"
          ? t("quick_notes.save_error")
          : t("quick_notes.saved");

  return (
    <aside
      id="quick-notes-panel"
      ref={panelRef}
      className="qn-panel"
      role="dialog"
      aria-modal={mobile || undefined}
      aria-labelledby="quick-notes-title"
      aria-describedby="quick-notes-description"
      onKeyDown={onKeyDown}
      lang={i18n.language}
    >
      <header className="qn-panel__header">
        <div className="qn-panel__identity">
          <span className="qn-panel__mark">
            <StickyNote aria-hidden="true" />
          </span>
          <div>
            <div className="qn-panel__title-line">
              <h2 id="quick-notes-title">{t("quick_notes.title")}</h2>
              {activeCount > 0 && <span>{activeCount}</span>}
            </div>
            <p id="quick-notes-description">{t("quick_notes.description")}</p>
          </div>
        </div>
        <button
          type="button"
          className="qn-icon-button"
          onClick={closePanel}
          aria-label={t("quick_notes.close_panel")}
        >
          <X aria-hidden="true" />
        </button>
      </header>

      {creating || editingNote ? (
        <QuickNoteEditor key={editingNote?.id ?? "new"} note={editingNote} />
      ) : (
        <>
          <div className="qn-panel__tools">
            <label className="qn-search">
              <Search aria-hidden="true" />
              <input
                ref={searchRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("quick_notes.search_placeholder")}
                aria-label={t("quick_notes.search_placeholder")}
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label={t("quick_notes.clear_search")}
                >
                  <X aria-hidden="true" />
                </button>
              )}
            </label>
            <div className="qn-panel__filters">
              <select
                value={category}
                onChange={(event) =>
                  setCategory(event.target.value as "all" | QuickNoteCategory)
                }
                aria-label={t("quick_notes.filter_category")}
              >
                <option value="all">{t("quick_notes.all_categories")}</option>
                {QUICK_NOTE_CATEGORIES.map((item) => (
                  <option key={item} value={item}>
                    {t(`quick_notes.categories.${item}`)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className={cn(
                  "qn-filter-toggle",
                  preferences.showCompleted && "qn-filter-toggle--active",
                )}
                onClick={() =>
                  updatePreferences({
                    showCompleted: !preferences.showCompleted,
                  })
                }
                aria-pressed={preferences.showCompleted}
              >
                <CheckCircle2 aria-hidden="true" />
                <span>{t("quick_notes.completed")}</span>
              </button>
            </div>
          </div>

          <div className="qn-panel__content">
            {hydrationStatus === "loading" && (
              <div className="qn-state">
                <LoaderCircle className="qn-spin" aria-hidden="true" />
                <p>{t("quick_notes.loading")}</p>
              </div>
            )}
            {hydrationStatus === "error" && (
              <div className="qn-state qn-state--error">
                <AlertCircle aria-hidden="true" />
                <h3>{t("quick_notes.load_error")}</h3>
                {error && <p>{error}</p>}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void retry()}
                >
                  <RotateCcw aria-hidden="true" />
                  {t("common.retry")}
                </Button>
              </div>
            )}
            {hydrationStatus === "ready" && visibleNotes.length === 0 && (
              <div className="qn-state">
                <span className="qn-state__illustration">
                  <StickyNote aria-hidden="true" />
                </span>
                <h3>
                  {normalizedQuery || category !== "all"
                    ? t("quick_notes.no_results")
                    : t("quick_notes.empty_title")}
                </h3>
                <p>
                  {normalizedQuery || category !== "all"
                    ? t("quick_notes.no_results_hint")
                    : t("quick_notes.empty_description")}
                </p>
                {!normalizedQuery && category === "all" && (
                  <Button size="sm" onClick={beginCreate}>
                    <Plus aria-hidden="true" />
                    {t("quick_notes.create_first")}
                  </Button>
                )}
              </div>
            )}
            {hydrationStatus === "ready" && visibleNotes.length > 0 && (
              <div className="qn-list" role="list">
                {visibleNotes.map((note) => (
                  <article
                    key={note.id}
                    className="qn-list-card"
                    data-color={note.color}
                    data-completed={note.completed || undefined}
                    role="listitem"
                  >
                    <button
                      type="button"
                      className="qn-list-card__body"
                      onClick={() => beginEdit(note.id)}
                    >
                      <span className="qn-list-card__meta">
                        <span
                          className="qn-priority-dot"
                          data-priority={note.priority}
                        />
                        {t(`quick_notes.categories.${note.category}`)}
                        <span aria-hidden="true">·</span>
                        {new Intl.DateTimeFormat(i18n.language, {
                          day: "2-digit",
                          month: "short",
                        }).format(new Date(note.updatedAt))}
                      </span>
                      <strong>{note.title || t("quick_notes.untitled")}</strong>
                      <span className="qn-list-card__excerpt">
                        {note.content || t("quick_notes.no_content")}
                      </span>
                    </button>
                    <div className="qn-list-card__actions">
                      <button
                        type="button"
                        onClick={() => toggleCompleted(note.id)}
                        aria-label={
                          note.completed
                            ? t("quick_notes.reopen")
                            : t("quick_notes.mark_complete")
                        }
                        title={
                          note.completed
                            ? t("quick_notes.reopen")
                            : t("quick_notes.mark_complete")
                        }
                      >
                        {note.completed ? (
                          <RotateCcw aria-hidden="true" />
                        ) : (
                          <CheckCircle2 aria-hidden="true" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => togglePin(note.id)}
                        disabled={note.completed}
                        aria-label={
                          note.pinned
                            ? t("quick_notes.unpin")
                            : t("quick_notes.pin")
                        }
                        title={
                          note.pinned
                            ? t("quick_notes.unpin")
                            : t("quick_notes.pin")
                        }
                      >
                        {note.pinned ? (
                          <PinOff aria-hidden="true" />
                        ) : (
                          <Pin aria-hidden="true" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => duplicateNote(note.id)}
                        aria-label={t("quick_notes.duplicate")}
                        title={t("quick_notes.duplicate")}
                      >
                        <Copy aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => requestDelete(note.id)}
                        aria-label={t("common.delete")}
                        title={t("common.delete")}
                      >
                        <Trash2 aria-hidden="true" />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>

          <footer className="qn-panel__footer">
            <span
              className={cn(
                persistenceStatus === "error" && "qn-panel__save-status--error",
              )}
              role="status"
              aria-live="polite"
            >
              {persistenceStatus === "saving" && (
                <LoaderCircle className="qn-spin" aria-hidden="true" />
              )}
              {persistenceStatus !== "saving" && <Check aria-hidden="true" />}
              {persistenceLabel}
            </span>
            <Button size="sm" onClick={beginCreate}>
              <Plus aria-hidden="true" />
              {t("quick_notes.new_note")}
            </Button>
          </footer>
        </>
      )}
    </aside>
  );
}

interface FloatingQuickNoteProps {
  note: QuickNote;
  safeRect: QuickNotesSafeRect;
  requestDelete: (id: QuickNoteId) => void;
}

function FloatingQuickNote({
  note,
  safeRect,
  requestDelete,
}: FloatingQuickNoteProps) {
  const { t, i18n } = useTranslation();
  const updateNote = useQuickNotesStore((state) => state.updateNote);
  const moveNote = useQuickNotesStore((state) => state.moveNote);
  const bringToFront = useQuickNotesStore((state) => state.bringToFront);
  const togglePin = useQuickNotesStore((state) => state.togglePin);
  const toggleMinimize = useQuickNotesStore((state) => state.toggleMinimize);
  const toggleCompleted = useQuickNotesStore((state) => state.toggleCompleted);
  const beginEdit = useQuickNotesStore((state) => state.beginEdit);
  const dragSession = React.useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    noteX: number;
    noteY: number;
  } | null>(null);
  const resizeSession = React.useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    width: number;
    height: number;
  } | null>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = React.useState(false);
  const [resizing, setResizing] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);

  React.useEffect(() => {
    if (!menuOpen) return;
    const closeMenu = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        menuRef.current?.contains(event.target)
      )
        return;
      setMenuOpen(false);
    };
    const closeMenuWithEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("pointerdown", closeMenu);
    window.addEventListener("keydown", closeMenuWithEscape);
    return () => {
      window.removeEventListener("pointerdown", closeMenu);
      window.removeEventListener("keydown", closeMenuWithEscape);
    };
  }, [menuOpen]);

  const moveBy = (deltaX: number, deltaY: number) => {
    moveNote(
      note.id,
      {
        x: note.position.x + deltaX,
        y: note.position.y + deltaY,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      },
      safeRect,
    );
  };

  const resizeTo = (requestedWidth: number, requestedHeight: number) => {
    const availableWidth = Math.max(1, safeRect.right - note.position.x - 8);
    const availableHeight = Math.max(1, safeRect.bottom - note.position.y - 8);
    const minimumWidth = Math.min(
      QUICK_NOTE_MIN_DIMENSIONS.width,
      availableWidth,
    );
    const minimumHeight = Math.min(
      QUICK_NOTE_MIN_DIMENSIONS.height,
      availableHeight,
    );
    const maximumWidth = Math.max(
      minimumWidth,
      Math.min(QUICK_NOTE_MAX_DIMENSIONS.width, availableWidth),
    );
    const maximumHeight = Math.max(
      minimumHeight,
      Math.min(QUICK_NOTE_MAX_DIMENSIONS.height, availableHeight),
    );
    updateNote(note.id, {
      size: {
        ...note.size,
        width: Math.round(
          Math.min(maximumWidth, Math.max(minimumWidth, requestedWidth)),
        ),
        height: Math.round(
          Math.min(maximumHeight, Math.max(minimumHeight, requestedHeight)),
        ),
      },
    });
  };

  const updatedTime = new Intl.DateTimeFormat(i18n.language, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(note.updatedAt));

  return (
    <article
      className="qn-floating-note"
      data-color={note.color}
      data-minimized={note.minimized || undefined}
      data-dragging={dragging || undefined}
      data-resizing={resizing || undefined}
      style={{
        left: note.position.x,
        top: note.position.y,
        width: note.size.width,
        height: note.minimized ? 40 : note.size.height,
      }}
      onPointerDown={() => bringToFront(note.id)}
    >
      <header className="qn-floating-note__header">
        <button
          type="button"
          className="qn-floating-note__grabber"
          aria-label={t("quick_notes.move_note")}
          title={t("quick_notes.move_note")}
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);
            dragSession.current = {
              pointerId: event.pointerId,
              startX: event.clientX,
              startY: event.clientY,
              noteX: note.position.x,
              noteY: note.position.y,
            };
            setDragging(true);
          }}
          onPointerMove={(event) => {
            const session = dragSession.current;
            if (!session || session.pointerId !== event.pointerId) return;
            moveNote(
              note.id,
              {
                x: session.noteX + event.clientX - session.startX,
                y: session.noteY + event.clientY - session.startY,
                viewportWidth: window.innerWidth,
                viewportHeight: window.innerHeight,
              },
              safeRect,
            );
          }}
          onPointerUp={(event) => {
            if (dragSession.current?.pointerId !== event.pointerId) return;
            dragSession.current = null;
            setDragging(false);
            if (event.currentTarget.hasPointerCapture(event.pointerId))
              event.currentTarget.releasePointerCapture(event.pointerId);
          }}
          onPointerCancel={() => {
            dragSession.current = null;
            setDragging(false);
          }}
          onKeyDown={(event) => {
            const distance = event.shiftKey ? 48 : 12;
            if (event.key === "ArrowLeft") moveBy(-distance, 0);
            else if (event.key === "ArrowRight") moveBy(distance, 0);
            else if (event.key === "ArrowUp") moveBy(0, -distance);
            else if (event.key === "ArrowDown") moveBy(0, distance);
            else return;
            event.preventDefault();
          }}
        >
          <Pin aria-hidden="true" />
        </button>
        {note.minimized && (
          <span className="qn-floating-note__minimized-title">
            {note.title || t("quick_notes.untitled")}
          </span>
        )}
        <span
          className="qn-priority-dot"
          data-priority={note.priority}
          title={t(`quick_notes.priorities.${note.priority}`)}
        />
        <div className="qn-floating-note__menu-wrap" ref={menuRef}>
          <button
            type="button"
            className="qn-floating-note__menu-trigger"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={t("quick_notes.more_actions")}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
          >
            <MoreVertical aria-hidden="true" />
          </button>
          {menuOpen && (
            <div className="qn-floating-note__menu" role="menu">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  beginEdit(note.id);
                }}
              >
                <Pencil aria-hidden="true" />
                <span>{t("quick_notes.details")}</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => toggleCompleted(note.id)}
              >
                <CheckCircle2 aria-hidden="true" />
                <span>{t("quick_notes.mark_complete")}</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => togglePin(note.id)}
              >
                <PinOff aria-hidden="true" />
                <span>{t("quick_notes.unpin")}</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  toggleMinimize(note.id);
                }}
              >
                {note.minimized ? (
                  <Maximize2 aria-hidden="true" />
                ) : (
                  <Minimize2 aria-hidden="true" />
                )}
                <span>
                  {note.minimized
                    ? t("quick_notes.restore")
                    : t("quick_notes.minimize")}
                </span>
              </button>
              <button
                type="button"
                role="menuitem"
                className="qn-floating-note__menu-delete"
                onClick={() => {
                  setMenuOpen(false);
                  requestDelete(note.id);
                }}
              >
                <Trash2 aria-hidden="true" />
                <span>{t("common.delete")}</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {!note.minimized && (
        <div className="qn-floating-note__body" data-quick-notes-editor="">
          <textarea
            className="qn-floating-note__title"
            rows={2}
            value={note.title}
            maxLength={120}
            onChange={(event) =>
              updateNote(note.id, { title: event.target.value })
            }
            placeholder={t("quick_notes.title_placeholder")}
            aria-label={t("quick_notes.title_label")}
          />
          <textarea
            className="qn-floating-note__content"
            value={note.content}
            maxLength={5000}
            onChange={(event) =>
              updateNote(note.id, { content: event.target.value })
            }
            placeholder={t("quick_notes.content_placeholder")}
            aria-label={t("quick_notes.content_label")}
          />
        </div>
      )}

      {!note.minimized && (
        <footer className="qn-floating-note__footer">
          <span className="qn-floating-note__updated">
            <Clock3 aria-hidden="true" />
            {updatedTime}
          </span>
        </footer>
      )}
      <button
        type="button"
        className="qn-floating-note__resizer"
        aria-label={t("quick_notes.resize_note")}
        title={t("quick_notes.resize_note")}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          resizeSession.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            width: note.size.width,
            height: note.size.height,
          };
          setResizing(true);
        }}
        onPointerMove={(event) => {
          const session = resizeSession.current;
          if (!session || session.pointerId !== event.pointerId) return;
          resizeTo(
            session.width + event.clientX - session.startX,
            note.minimized
              ? session.height
              : session.height + event.clientY - session.startY,
          );
        }}
        onPointerUp={(event) => {
          if (resizeSession.current?.pointerId !== event.pointerId) return;
          resizeSession.current = null;
          setResizing(false);
          if (event.currentTarget.hasPointerCapture(event.pointerId))
            event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={() => {
          resizeSession.current = null;
          setResizing(false);
        }}
        onKeyDown={(event) => {
          const distance = event.shiftKey ? 32 : 8;
          if (event.key === "ArrowLeft")
            resizeTo(note.size.width - distance, note.size.height);
          else if (event.key === "ArrowRight")
            resizeTo(note.size.width + distance, note.size.height);
          else if (!note.minimized && event.key === "ArrowUp")
            resizeTo(note.size.width, note.size.height - distance);
          else if (!note.minimized && event.key === "ArrowDown")
            resizeTo(note.size.width, note.size.height + distance);
          else return;
          event.preventDefault();
        }}
      >
        <Maximize2 aria-hidden="true" />
      </button>
    </article>
  );
}

function MobilePinnedNotes({
  notes,
  bottom,
}: {
  notes: QuickNote[];
  bottom: number;
}) {
  const { t } = useTranslation();
  const beginEdit = useQuickNotesStore((state) => state.beginEdit);

  return (
    <div
      className="qn-mobile-pins"
      style={{ bottom }}
      aria-label={t("quick_notes.pinned_notes")}
    >
      {notes.map((note) => (
        <button
          key={note.id}
          type="button"
          data-color={note.color}
          onClick={() => beginEdit(note.id)}
        >
          <StickyNote aria-hidden="true" />
          <span>{note.title || t("quick_notes.untitled")}</span>
        </button>
      ))}
    </div>
  );
}

export function QuickNotesLayer() {
  const { t } = useTranslation();
  const location = useLocation();
  const mobile = useMobileLayout();
  const workspaceSafeRect = useQuickNotesSafeRect(location.pathname);
  const noteSafeRect = React.useMemo<QuickNotesSafeRect>(
    () => ({
      left: 0,
      top: 0,
      right: Math.max(workspaceSafeRect.right, window.innerWidth),
      bottom: Math.max(workspaceSafeRect.bottom, window.innerHeight),
    }),
    [workspaceSafeRect.bottom, workspaceSafeRect.right],
  );
  const notes = useQuickNotesStore((state) => state.notes);
  const panelOpen = useQuickNotesStore((state) => state.panelOpen);
  const closePanel = useQuickNotesStore((state) => state.closePanel);
  const deleteNote = useQuickNotesStore((state) => state.deleteNote);
  const moveNote = useQuickNotesStore((state) => state.moveNote);
  const [deleteId, setDeleteId] = React.useState<QuickNoteId | null>(null);
  const panelRef = React.useRef<HTMLElement>(null);
  const hadOpenPanel = React.useRef(false);
  const pinnedNotes = notes.filter((note) => note.pinned && !note.completed);
  const pinnedGeometryKey = pinnedNotes
    .map((note) => `${note.id}:${note.size.preset}`)
    .join("|");

  React.useEffect(() => {
    if (panelOpen) {
      hadOpenPanel.current = true;
      return;
    }
    if (!hadOpenPanel.current) return;
    hadOpenPanel.current = false;
    const visibleTrigger = [
      ...document.querySelectorAll<HTMLButtonElement>(
        "[data-quick-notes-trigger]",
      ),
    ].find((trigger) => trigger.offsetParent !== null);
    visibleTrigger?.focus();
  }, [panelOpen]);

  React.useEffect(() => {
    const state = useQuickNotesStore.getState();
    for (const note of state.notes) {
      if (!note.pinned || note.completed) continue;
      moveNote(
        note.id,
        {
          ...note.position,
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
        },
        noteSafeRect,
      );
    }
  }, [moveNote, noteSafeRect, pinnedGeometryKey]);

  React.useEffect(() => {
    if (!panelOpen || deleteId) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      closePanel();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [closePanel, deleteId, panelOpen]);

  const trapMobileFocus = (event: React.KeyboardEvent<HTMLElement>) => {
    if (!mobile || event.key !== "Tab") return;
    const focusable = [
      ...event.currentTarget.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ].filter((element) => element.offsetParent !== null);
    if (focusable.length === 0) return;
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return createPortal(
    <div
      className="qn-layer"
      style={
        {
          "--qn-safe-left": `${workspaceSafeRect.left}px`,
          "--qn-safe-top": `${workspaceSafeRect.top}px`,
          "--qn-safe-right-gap": `${Math.max(0, window.innerWidth - workspaceSafeRect.right)}px`,
          "--qn-safe-bottom-gap": `${Math.max(0, window.innerHeight - workspaceSafeRect.bottom)}px`,
        } as React.CSSProperties
      }
    >
      {!mobile &&
        pinnedNotes.map((note) => (
          <FloatingQuickNote
            key={note.id}
            note={note}
            safeRect={noteSafeRect}
            requestDelete={setDeleteId}
          />
        ))}
      {mobile && pinnedNotes.length > 0 && !panelOpen && (
        <MobilePinnedNotes
          notes={pinnedNotes}
          bottom={Math.max(
            8,
            window.innerHeight - workspaceSafeRect.bottom + 8,
          )}
        />
      )}
      {panelOpen && (
        <>
          <button
            type="button"
            className="qn-panel-backdrop"
            onClick={closePanel}
            aria-label={t("quick_notes.close_panel")}
          />
          <QuickNotesPanel
            mobile={mobile}
            panelRef={panelRef}
            requestDelete={setDeleteId}
            onKeyDown={trapMobileFocus}
          />
        </>
      )}
      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
        title={t("quick_notes.delete_title")}
        description={t("quick_notes.delete_description")}
        confirmLabel={t("common.delete")}
        onConfirm={() => {
          if (deleteId) deleteNote(deleteId);
          setDeleteId(null);
        }}
      />
    </div>,
    document.body,
  );
}
