import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useQuickNotesStore } from "@store/quickNotesStore";
import { QuickNotesLayer } from "./QuickNotesLayer";

const translations = vi.hoisted(() => ({
  t: (key: string, values?: Record<string, string | number>) => {
    if (!values) return key;
    return Object.entries(values).reduce(
      (result, [name, value]) => result.replace(`{{${name}}}`, String(value)),
      key,
    );
  },
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: translations.t,
    i18n: { language: "en-US" },
  }),
}));

function renderLayer() {
  return render(
    <MemoryRouter>
      <QuickNotesLayer />
    </MemoryRouter>,
  );
}

describe("QuickNotesLayer", () => {
  beforeEach(async () => {
    await useQuickNotesStore.getState().deactivateScope();
    window.localStorage.clear();
    await useQuickNotesStore.getState().activateScope({
      userId: "quick-notes-ui-user",
      sucursalId: "quick-notes-ui-branch",
    });
    useQuickNotesStore.setState({ panelOpen: true });
  });

  it("creates a pinned note from the empty panel", async () => {
    renderLayer();

    fireEvent.click(
      screen.getByRole("button", { name: "quick_notes.create_first" }),
    );
    fireEvent.change(screen.getByLabelText("quick_notes.title_label"), {
      target: { value: "Call Maria" },
    });
    fireEvent.change(screen.getByLabelText("quick_notes.content_label"), {
      target: { value: "Confirm the follow-up appointment" },
    });
    fireEvent.click(screen.getByLabelText("quick_notes.keep_visible"));
    fireEvent.click(
      screen.getByRole("button", { name: "quick_notes.create_note" }),
    );

    await waitFor(() => {
      const note = useQuickNotesStore.getState().notes[0];
      expect(note?.title).toBe("Call Maria");
      expect(note?.pinned).toBe(true);
    });
    expect(screen.getByDisplayValue("Call Maria")).toBeInTheDocument();
  });

  it("moves, resizes, and completes a pinned note with the keyboard", async () => {
    const id = useQuickNotesStore.getState().createNote({
      title: "Review laboratory",
      content: "Check pending results",
      pinned: true,
    });
    expect(id).not.toBeNull();
    useQuickNotesStore.setState({
      panelOpen: false,
      editorNoteId: null,
    });
    renderLayer();

    const noteBefore = useQuickNotesStore
      .getState()
      .notes.find((note) => note.id === id)!;
    expect(noteBefore.size).toMatchObject({ width: 160, height: 164 });
    fireEvent.keyDown(
      screen.getByRole("button", { name: "quick_notes.move_note" }),
      { key: "ArrowRight" },
    );

    await waitFor(() => {
      const moved = useQuickNotesStore
        .getState()
        .notes.find((note) => note.id === id)!;
      expect(moved.position.x).toBeGreaterThan(noteBefore.position.x);
    });

    fireEvent.keyDown(
      screen.getByRole("button", { name: "quick_notes.resize_note" }),
      { key: "ArrowRight" },
    );
    await waitFor(() => {
      const resized = useQuickNotesStore
        .getState()
        .notes.find((note) => note.id === id)!;
      expect(resized.size.width).toBe(168);
      expect(resized.size.height).toBe(164);
    });

    fireEvent.click(
      screen.getByRole("button", { name: "quick_notes.more_actions" }),
    );
    fireEvent.click(
      screen.getByRole("menuitem", { name: "quick_notes.minimize" }),
    );
    expect(screen.getByText("Review laboratory")).toBeInTheDocument();

    fireEvent.keyDown(
      screen.getByRole("button", { name: "quick_notes.resize_note" }),
      { key: "ArrowLeft" },
    );
    fireEvent.keyDown(
      screen.getByRole("button", { name: "quick_notes.resize_note" }),
      { key: "ArrowDown" },
    );
    await waitFor(() => {
      const minimized = useQuickNotesStore
        .getState()
        .notes.find((note) => note.id === id)!;
      expect(minimized.minimized).toBe(true);
      expect(minimized.size).toMatchObject({ width: 160, height: 164 });
    });

    fireEvent.click(
      screen.getByRole("button", { name: "quick_notes.more_actions" }),
    );
    fireEvent.click(
      screen.getByRole("menuitem", { name: "quick_notes.restore" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "quick_notes.more_actions" }),
    );
    fireEvent.click(
      screen.getByRole("menuitem", { name: "quick_notes.mark_complete" }),
    );
    await waitFor(() => {
      const completed = useQuickNotesStore
        .getState()
        .notes.find((note) => note.id === id)!;
      expect(completed.completed).toBe(true);
      expect(completed.pinned).toBe(false);
    });
    expect(
      screen.queryByDisplayValue("Review laboratory"),
    ).not.toBeInTheDocument();
  });
});
