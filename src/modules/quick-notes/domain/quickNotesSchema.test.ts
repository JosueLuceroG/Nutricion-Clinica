import { describe, expect, it } from "vitest";
import { createQuickNoteSize } from "../application";
import { quickNoteIdFrom } from "./QuickNoteId";
import {
  createDefaultQuickNotesSnapshot,
  parseQuickNotesSnapshot,
} from "./quickNotesSchema";

const scope = { userId: "schema-user", sucursalId: null };
const firstId = quickNoteIdFrom("01890f47-89ab-7def-8abc-0123456789ab");

function validSnapshot() {
  const snapshot = createDefaultQuickNotesSnapshot(
    scope,
    "2026-07-14T10:00:00.000Z",
  );
  snapshot.notes.push({
    id: firstId,
    title: "Call patient",
    content: "Review laboratory results",
    color: "yellow",
    priority: "normal",
    category: "patient",
    pinned: false,
    minimized: false,
    completed: false,
    position: { x: 8, y: 8, viewportWidth: 1280, viewportHeight: 800 },
    size: createQuickNoteSize("regular"),
    reminder: null,
    relatedEntity: { type: "patient", id: "patient-1" },
    createdAt: "2026-07-14T10:00:00.000Z",
    updatedAt: "2026-07-14T10:00:00.000Z",
    completedAt: null,
  });
  return snapshot;
}

describe("quickNotesSnapshotSchema", () => {
  it("parses a strict v1 snapshot", () => {
    expect(parseQuickNotesSnapshot(validSnapshot())).not.toBeNull();
  });

  it("rejects malformed timestamps, unknown fields, and oversized text", () => {
    const invalidDate = validSnapshot();
    invalidDate.notes[0]!.updatedAt = "yesterday";
    expect(parseQuickNotesSnapshot(invalidDate)).toBeNull();

    const unknownField = { ...validSnapshot(), unexpected: true };
    expect(parseQuickNotesSnapshot(unknownField)).toBeNull();

    const oversized = validSnapshot();
    oversized.notes[0]!.title = "x".repeat(121);
    expect(parseQuickNotesSnapshot(oversized)).toBeNull();
  });

  it("rejects duplicate note IDs", () => {
    const snapshot = validSnapshot();
    snapshot.notes.push({ ...snapshot.notes[0]! });
    expect(parseQuickNotesSnapshot(snapshot)).toBeNull();
  });
});
