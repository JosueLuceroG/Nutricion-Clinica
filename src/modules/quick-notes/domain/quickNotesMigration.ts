import type { QuickNotesSnapshot } from "./QuickNote";
import { parseQuickNotesSnapshot } from "./quickNotesSchema";

// Future schema migrations are selected here. V1 intentionally has no legacy formats.
export function migrateQuickNotesSnapshot(
  value: unknown,
): QuickNotesSnapshot | null {
  if (!value || typeof value !== "object" || !("schemaVersion" in value))
    return null;
  return parseQuickNotesSnapshot(value);
}
