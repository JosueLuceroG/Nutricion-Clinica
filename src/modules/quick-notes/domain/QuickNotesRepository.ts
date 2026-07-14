import type { QuickNotesScope, QuickNotesSnapshot } from "./QuickNote";

export type QuickNotesLoadResult =
  | { status: "found"; snapshot: QuickNotesSnapshot }
  | { status: "missing" }
  | { status: "invalid"; message: string; raw: string }
  | { status: "unavailable"; message: string };

export interface QuickNotesRepository {
  load(scope: QuickNotesScope): Promise<QuickNotesLoadResult>;
  save(
    scope: QuickNotesScope,
    snapshot: QuickNotesSnapshot,
  ): Promise<QuickNotesSnapshot>;
}

export class QuickNotesRepositoryError extends Error {
  constructor(
    public readonly code: "invalid" | "unavailable",
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "QuickNotesRepositoryError";
  }
}
