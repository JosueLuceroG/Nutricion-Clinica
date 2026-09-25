import type { QuickNoteId } from "./QuickNoteId";

export const QUICK_NOTES_SCHEMA_VERSION = 1 as const;
export const MAX_QUICK_NOTES = 100;

export const QUICK_NOTE_COLORS = [
  "yellow",
  "blue",
  "green",
  "pink",
  "purple",
  "neutral",
] as const;
export type QuickNoteColor = (typeof QUICK_NOTE_COLORS)[number];

export const QUICK_NOTE_PRIORITIES = [
  "low",
  "normal",
  "high",
  "urgent",
] as const;
export type QuickNotePriority = (typeof QUICK_NOTE_PRIORITIES)[number];

export const QUICK_NOTE_CATEGORIES = [
  "general",
  "patient",
  "consultation",
  "payment",
  "mealPlan",
  "laboratory",
  "followUp",
  "administrative",
] as const;
export type QuickNoteCategory = (typeof QUICK_NOTE_CATEGORIES)[number];

export const QUICK_NOTE_SIZE_DIMENSIONS = {
  compact: { width: 136, height: 124 },
  regular: { width: 160, height: 164 },
} as const;

export const QUICK_NOTE_MIN_DIMENSIONS = { width: 128, height: 112 } as const;
export const QUICK_NOTE_MAX_DIMENSIONS = { width: 520, height: 460 } as const;

export type QuickNoteSizePreset = keyof typeof QUICK_NOTE_SIZE_DIMENSIONS;

export interface QuickNoteSize {
  preset: QuickNoteSizePreset;
  width: number;
  height: number;
}

export interface QuickNotePosition {
  x: number;
  y: number;
  viewportWidth: number;
  viewportHeight: number;
}

export interface QuickNoteReminder {
  reminderAt: string;
  dismissedAt: string | null;
  notifiedAt: string | null;
}

export interface QuickNoteRelatedEntity {
  type: string;
  id: string;
  label?: string;
}

export interface QuickNote {
  id: QuickNoteId;
  title: string;
  content: string;
  color: QuickNoteColor;
  priority: QuickNotePriority;
  category: QuickNoteCategory;
  pinned: boolean;
  minimized: boolean;
  completed: boolean;
  position: QuickNotePosition;
  size: QuickNoteSize;
  reminder: QuickNoteReminder | null;
  relatedEntity: QuickNoteRelatedEntity | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface QuickNotesScope {
  userId: string;
  sucursalId: string | null;
}

export interface QuickNotesPreferences {
  defaultColor: QuickNoteColor;
  defaultPriority: QuickNotePriority;
  defaultCategory: QuickNoteCategory;
  defaultSize: QuickNoteSizePreset;
  showCompleted: boolean;
}

export interface QuickNotesSnapshot {
  schemaVersion: typeof QUICK_NOTES_SCHEMA_VERSION;
  scope: QuickNotesScope;
  notes: QuickNote[];
  preferences: QuickNotesPreferences;
  revision: number;
  updatedAt: string;
}
