import { v7 as uuidv7 } from "uuid";
import { z } from "zod";

declare const quickNoteIdBrand: unique symbol;

export type QuickNoteId = string & {
  readonly [quickNoteIdBrand]: "QuickNoteId";
};

export const QUICK_NOTE_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const QuickNoteIdSchema = z
  .string()
  .regex(QUICK_NOTE_ID_PATTERN, "QuickNoteId must be a UUIDv7")
  .transform((value) => value as QuickNoteId);

export function createQuickNoteId(): QuickNoteId {
  return uuidv7() as QuickNoteId;
}

export function quickNoteIdFrom(value: string): QuickNoteId {
  return QuickNoteIdSchema.parse(value);
}
