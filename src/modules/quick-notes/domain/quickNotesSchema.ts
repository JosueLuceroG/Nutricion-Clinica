import { z } from "zod";
import {
  MAX_QUICK_NOTES,
  QUICK_NOTE_CATEGORIES,
  QUICK_NOTE_COLORS,
  QUICK_NOTE_PRIORITIES,
  QUICK_NOTES_SCHEMA_VERSION,
  type QuickNote,
  type QuickNotesPreferences,
  type QuickNotesScope,
  type QuickNotesSnapshot,
} from "./QuickNote";
import { QuickNoteIdSchema } from "./QuickNoteId";

const isoDateTimeSchema = z.string().datetime({ offset: true });

export const quickNotesScopeSchema = z
  .object({
    userId: z.string().min(1).max(256),
    sucursalId: z.string().min(1).max(256).nullable(),
  })
  .strict();

export const quickNotePositionSchema = z
  .object({
    x: z.number().finite(),
    y: z.number().finite(),
    viewportWidth: z.number().finite().positive().max(100_000),
    viewportHeight: z.number().finite().positive().max(100_000),
  })
  .strict();

export const quickNoteSizeSchema = z
  .object({
    preset: z.enum(["compact", "regular"]),
    width: z.number().finite().positive().max(5_000),
    height: z.number().finite().positive().max(5_000),
  })
  .strict();

export const quickNoteReminderSchema = z
  .object({
    reminderAt: isoDateTimeSchema,
    dismissedAt: isoDateTimeSchema.nullable(),
    notifiedAt: isoDateTimeSchema.nullable(),
  })
  .strict();

export const quickNoteRelatedEntitySchema = z
  .object({
    type: z.string().min(1).max(80),
    id: z.string().min(1).max(256),
    label: z.string().max(160).optional(),
  })
  .strict();

export const quickNoteSchema = z
  .object({
    id: QuickNoteIdSchema,
    title: z.string().max(120),
    content: z.string().max(5_000),
    color: z.enum(QUICK_NOTE_COLORS),
    priority: z.enum(QUICK_NOTE_PRIORITIES),
    category: z.enum(QUICK_NOTE_CATEGORIES),
    pinned: z.boolean(),
    minimized: z.boolean(),
    completed: z.boolean(),
    position: quickNotePositionSchema,
    size: quickNoteSizeSchema,
    reminder: quickNoteReminderSchema.nullable(),
    relatedEntity: quickNoteRelatedEntitySchema.nullable(),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
    completedAt: isoDateTimeSchema.nullable(),
  })
  .strict()
  .superRefine((note, context) => {
    if (note.completed !== (note.completedAt !== null)) {
      context.addIssue({
        code: "custom",
        path: ["completedAt"],
        message: "completedAt must be set exactly when the note is completed",
      });
    }
  });

export const quickNotesPreferencesSchema = z
  .object({
    defaultColor: z.enum(QUICK_NOTE_COLORS),
    defaultPriority: z.enum(QUICK_NOTE_PRIORITIES),
    defaultCategory: z.enum(QUICK_NOTE_CATEGORIES),
    defaultSize: z.enum(["compact", "regular"]),
    showCompleted: z.boolean(),
  })
  .strict();

export const quickNotesSnapshotSchema = z
  .object({
    schemaVersion: z.literal(QUICK_NOTES_SCHEMA_VERSION),
    scope: quickNotesScopeSchema,
    notes: z.array(quickNoteSchema).max(MAX_QUICK_NOTES),
    preferences: quickNotesPreferencesSchema,
    revision: z.number().int().nonnegative(),
    updatedAt: isoDateTimeSchema,
  })
  .strict()
  .superRefine((snapshot, context) => {
    const ids = snapshot.notes.map((note) => note.id);
    if (new Set(ids).size !== ids.length) {
      context.addIssue({
        code: "custom",
        path: ["notes"],
        message: "Quick note IDs must be unique",
      });
    }
  });

export const DEFAULT_QUICK_NOTES_PREFERENCES: Readonly<QuickNotesPreferences> =
  {
    defaultColor: "yellow",
    defaultPriority: "normal",
    defaultCategory: "general",
    defaultSize: "regular",
    showCompleted: false,
  };

export function createDefaultQuickNotesPreferences(): QuickNotesPreferences {
  return { ...DEFAULT_QUICK_NOTES_PREFERENCES };
}

export function createDefaultQuickNotesSnapshot(
  scope: QuickNotesScope,
  now = new Date().toISOString(),
): QuickNotesSnapshot {
  return quickNotesSnapshotSchema.parse({
    schemaVersion: QUICK_NOTES_SCHEMA_VERSION,
    scope,
    notes: [],
    preferences: createDefaultQuickNotesPreferences(),
    revision: 0,
    updatedAt: now,
  }) as QuickNotesSnapshot;
}

export function parseQuickNote(value: unknown): QuickNote | null {
  const result = quickNoteSchema.safeParse(value);
  return result.success ? (result.data as QuickNote) : null;
}

export function parseQuickNotesScope(value: unknown): QuickNotesScope | null {
  const result = quickNotesScopeSchema.safeParse(value);
  return result.success ? result.data : null;
}

export function parseQuickNotesSnapshot(
  value: unknown,
): QuickNotesSnapshot | null {
  const result = quickNotesSnapshotSchema.safeParse(value);
  return result.success ? (result.data as QuickNotesSnapshot) : null;
}
