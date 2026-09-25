import type { DashboardPreferences, DashboardScope } from "@app/pages/dashboard/customization/dashboardWidgetTypes";

export type DashboardPreferencesLoadResult =
  | { status: "found"; preferences: DashboardPreferences }
  | { status: "missing" }
  | { status: "invalid"; message: string };

export interface DashboardPreferencesRepository {
  load(scope: DashboardScope): DashboardPreferences | null;
  loadResult(scope: DashboardScope): DashboardPreferencesLoadResult;
  save(scope: DashboardScope, preferences: DashboardPreferences): DashboardPreferences;
  reset(scope: DashboardScope): void;
}
