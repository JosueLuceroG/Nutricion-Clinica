import type {
  DashboardQuickAccessScope,
  DashboardQuickAccessSnapshot,
} from "./DashboardQuickAccess";

export type DashboardQuickAccessLoadResult =
  | { status: "found"; snapshot: DashboardQuickAccessSnapshot }
  | { status: "missing" }
  | { status: "invalid"; message: string; raw: string }
  | { status: "unavailable"; message: string };

export interface DashboardQuickAccessRepository {
  load(
    scope: DashboardQuickAccessScope,
  ): Promise<DashboardQuickAccessLoadResult>;
  save(
    scope: DashboardQuickAccessScope,
    snapshot: DashboardQuickAccessSnapshot,
  ): Promise<DashboardQuickAccessSnapshot>;
}

export class DashboardQuickAccessRepositoryError extends Error {
  constructor(
    public readonly code: "invalid" | "unavailable" | "conflict",
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "DashboardQuickAccessRepositoryError";
  }
}
