export const DASHBOARD_QUICK_ACCESS_SCHEMA_VERSION = 1 as const;

export const DASHBOARD_QUICK_ACCESS_ACTION_IDS = [
  "clinical.consultations.open",
  "clinical.consultation.create",
  "clinical.agenda.today.open",
  "clinical.mealPlans.open",
  "clinical.mealPlan.create",
  "clinical.weeklyPlanner.open",
  "clinical.laboratory.open",
  "clinical.recipes.open",
  "clinical.appointment.create",
  "clinical.recipe.create",
  "clinical.report.generate",
  "patients.directory.open",
  "patients.patient.create",
  "patients.import.open",
  "patients.reminder.send",
  "patients.conversation.open",
  "finance.billing.open",
  "finance.payments.open",
  "finance.expenses.open",
  "finance.report.open",
  "finance.payment.register",
  "finance.expense.create",
  "finance.receivables.exportCsv",
  "dashboard.home.open",
  "dashboard.customize",
  "dashboard.search.open",
  "system.notifications.open",
  "system.quickNotes.toggle",
  "system.quickNotes.create",
  "system.settings.open",
  "system.profile.open",
  "system.help.open",
  "system.language.toggle",
  "system.theme.light",
  "system.theme.dark",
  "system.theme.alternative",
  "system.theme.system",
  "system.theme.highContrast",
  "calculators.suite.open",
  "calculators.bmi.open",
  "calculators.bmr.open",
  "calculators.tdee.open",
  "calculators.bodyFat.open",
  "calculators.egfr.open",
  "calculators.homaIr.open",
  "calculators.ldl.open",
] as const;

export type DashboardQuickAccessActionId =
  (typeof DASHBOARD_QUICK_ACCESS_ACTION_IDS)[number];

export const DASHBOARD_QUICK_ACCESS_ICON_IDS = [
  "sliders-horizontal",
  "zap",
  "star",
  "stethoscope",
  "users",
  "user-plus",
  "calendar-plus",
  "calculator",
  "bell",
  "wallet-cards",
  "settings",
  "sticky-note",
  "search",
  "layout-dashboard",
  "clipboard-list",
  "utensils",
  "flask-conical",
  "chef-hat",
  "activity",
  "languages",
  "sun",
  "moon",
  "palette",
  "monitor",
  "receipt",
  "bar-chart",
] as const;

export type DashboardQuickAccessIconId =
  (typeof DASHBOARD_QUICK_ACCESS_ICON_IDS)[number];

export interface DashboardQuickAccessScope {
  userId: string;
  sucursalId: string | null;
}

export interface DashboardQuickAccessConfig {
  mode: "direct" | "menu";
  buttonLabel: string | null;
  buttonIconId: DashboardQuickAccessIconId | null;
  primaryActionId: DashboardQuickAccessActionId;
  secondaryActionIds: DashboardQuickAccessActionId[];
}

export interface DashboardQuickAccessSnapshot {
  schemaVersion: typeof DASHBOARD_QUICK_ACCESS_SCHEMA_VERSION;
  scope: DashboardQuickAccessScope;
  config: DashboardQuickAccessConfig;
  revision: number;
  updatedAt: string;
}
