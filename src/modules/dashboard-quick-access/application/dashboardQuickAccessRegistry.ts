import {
  Activity,
  BarChart3,
  Bell,
  Calculator,
  CalendarPlus,
  ChefHat,
  ClipboardList,
  FlaskConical,
  Languages,
  LayoutDashboard,
  Monitor,
  Moon,
  Palette,
  Receipt,
  Search,
  Settings,
  SlidersHorizontal,
  Star,
  StickyNote,
  Stethoscope,
  Sun,
  UserPlus,
  Users,
  UtensilsCrossed,
  WalletCards,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { hasModuleAccess } from "@modules/auth/securityService";
import type {
  DashboardQuickAccessActionId,
  DashboardQuickAccessIconId,
} from "../domain";

export type DashboardQuickAccessGroup =
  | "clinical"
  | "patients"
  | "finance"
  | "dashboard"
  | "system"
  | "calculators";

export type DashboardQuickAccessExecution =
  | { kind: "navigate"; to: string }
  | { kind: "agenda-today" }
  | { kind: "dashboard-customize" }
  | { kind: "command-palette"; intent?: "new-consultation" | "new-plan" }
  | { kind: "quick-notes"; command: "toggle" | "create" }
  | {
      kind: "theme";
      theme: "light" | "dark" | "alternative" | "system" | "high-contrast";
    }
  | { kind: "language-toggle" }
  | { kind: "unavailable" };

interface ActionPermission {
  module: string;
  action: "read" | "write";
}

export interface DashboardQuickAccessDefinition {
  id: DashboardQuickAccessActionId;
  group: DashboardQuickAccessGroup;
  labelKey: string;
  descriptionKey: string;
  iconId: DashboardQuickAccessIconId;
  permissions?: ActionPermission[];
  allowedRoles?: readonly string[];
  requiresBranch?: boolean;
  status: "ready" | "contextual" | "unavailable";
  execution: DashboardQuickAccessExecution;
}

export interface DashboardQuickAccessRuntimeContext {
  role: string | null;
  sucursalId: string | null;
  dashboardEditing?: boolean;
  dashboardCustomizerAvailable?: boolean;
}

export interface DashboardQuickAccessAvailability {
  enabled: boolean;
  reasonKey?: string;
}

export const DASHBOARD_QUICK_ACCESS_GROUPS: Array<{
  id: DashboardQuickAccessGroup;
  labelKey: string;
}> = [
  { id: "clinical", labelKey: "dashboardQuickAccess.groups.clinical" },
  { id: "patients", labelKey: "dashboardQuickAccess.groups.patients" },
  { id: "finance", labelKey: "dashboardQuickAccess.groups.finance" },
  { id: "dashboard", labelKey: "dashboardQuickAccess.groups.dashboard" },
  { id: "system", labelKey: "dashboardQuickAccess.groups.system" },
  { id: "calculators", labelKey: "dashboardQuickAccess.groups.calculators" },
];

export const DASHBOARD_QUICK_ACCESS_ICONS: Record<
  DashboardQuickAccessIconId,
  LucideIcon
> = {
  "sliders-horizontal": SlidersHorizontal,
  zap: Zap,
  star: Star,
  stethoscope: Stethoscope,
  users: Users,
  "user-plus": UserPlus,
  "calendar-plus": CalendarPlus,
  calculator: Calculator,
  bell: Bell,
  "wallet-cards": WalletCards,
  settings: Settings,
  "sticky-note": StickyNote,
  search: Search,
  "layout-dashboard": LayoutDashboard,
  "clipboard-list": ClipboardList,
  utensils: UtensilsCrossed,
  "flask-conical": FlaskConical,
  "chef-hat": ChefHat,
  activity: Activity,
  languages: Languages,
  sun: Sun,
  moon: Moon,
  palette: Palette,
  monitor: Monitor,
  receipt: Receipt,
  "bar-chart": BarChart3,
};

const definitions: Record<
  DashboardQuickAccessActionId,
  DashboardQuickAccessDefinition
> = {
  "clinical.consultations.open": {
    id: "clinical.consultations.open",
    group: "clinical",
    labelKey: "dashboardQuickAccess.actions.consultations",
    descriptionKey: "dashboardQuickAccess.descriptions.consultations",
    iconId: "clipboard-list",
    permissions: [{ module: "consultations", action: "read" }],
    status: "ready",
    execution: { kind: "navigate", to: "/consultas" },
  },
  "clinical.consultation.create": {
    id: "clinical.consultation.create",
    group: "clinical",
    labelKey: "dashboardQuickAccess.actions.newConsultation",
    descriptionKey: "dashboardQuickAccess.descriptions.newConsultation",
    iconId: "calendar-plus",
    permissions: [
      { module: "patients", action: "read" },
      { module: "consultations", action: "write" },
    ],
    requiresBranch: true,
    status: "contextual",
    execution: { kind: "command-palette", intent: "new-consultation" },
  },
  "clinical.agenda.today.open": {
    id: "clinical.agenda.today.open",
    group: "clinical",
    labelKey: "dashboardQuickAccess.actions.todayAgenda",
    descriptionKey: "dashboardQuickAccess.descriptions.todayAgenda",
    iconId: "calendar-plus",
    permissions: [{ module: "agenda", action: "read" }],
    status: "ready",
    execution: { kind: "agenda-today" },
  },
  "clinical.mealPlans.open": {
    id: "clinical.mealPlans.open",
    group: "clinical",
    labelKey: "dashboardQuickAccess.actions.mealPlans",
    descriptionKey: "dashboardQuickAccess.descriptions.mealPlans",
    iconId: "utensils",
    permissions: [{ module: "mealplan", action: "read" }],
    status: "ready",
    execution: { kind: "navigate", to: "/planes" },
  },
  "clinical.mealPlan.create": {
    id: "clinical.mealPlan.create",
    group: "clinical",
    labelKey: "dashboardQuickAccess.actions.newMealPlan",
    descriptionKey: "dashboardQuickAccess.descriptions.newMealPlan",
    iconId: "utensils",
    permissions: [
      { module: "patients", action: "read" },
      { module: "mealplan", action: "write" },
    ],
    requiresBranch: true,
    status: "contextual",
    execution: { kind: "command-palette", intent: "new-plan" },
  },
  "clinical.weeklyPlanner.open": {
    id: "clinical.weeklyPlanner.open",
    group: "clinical",
    labelKey: "dashboardQuickAccess.actions.weeklyPlanner",
    descriptionKey: "dashboardQuickAccess.descriptions.weeklyPlanner",
    iconId: "utensils",
    permissions: [{ module: "meal-planner", action: "read" }],
    status: "ready",
    execution: { kind: "navigate", to: "/plan-semanal" },
  },
  "clinical.laboratory.open": {
    id: "clinical.laboratory.open",
    group: "clinical",
    labelKey: "dashboardQuickAccess.actions.laboratory",
    descriptionKey: "dashboardQuickAccess.descriptions.laboratory",
    iconId: "flask-conical",
    permissions: [{ module: "laboratory", action: "read" }],
    status: "ready",
    execution: { kind: "navigate", to: "/laboratorio" },
  },
  "clinical.recipes.open": {
    id: "clinical.recipes.open",
    group: "clinical",
    labelKey: "dashboardQuickAccess.actions.recipes",
    descriptionKey: "dashboardQuickAccess.descriptions.recipes",
    iconId: "chef-hat",
    permissions: [{ module: "recipes", action: "read" }],
    status: "ready",
    execution: { kind: "navigate", to: "/recetas" },
  },
  "clinical.appointment.create": {
    id: "clinical.appointment.create",
    group: "clinical",
    labelKey: "dashboardQuickAccess.actions.newAppointment",
    descriptionKey: "dashboardQuickAccess.descriptions.ownerOnly",
    iconId: "calendar-plus",
    status: "unavailable",
    execution: { kind: "unavailable" },
  },
  "clinical.recipe.create": {
    id: "clinical.recipe.create",
    group: "clinical",
    labelKey: "dashboardQuickAccess.actions.newRecipe",
    descriptionKey: "dashboardQuickAccess.descriptions.ownerOnly",
    iconId: "chef-hat",
    status: "unavailable",
    execution: { kind: "unavailable" },
  },
  "clinical.report.generate": {
    id: "clinical.report.generate",
    group: "clinical",
    labelKey: "dashboardQuickAccess.actions.generateReport",
    descriptionKey: "dashboardQuickAccess.descriptions.ownerOnly",
    iconId: "bar-chart",
    status: "unavailable",
    execution: { kind: "unavailable" },
  },
  "patients.directory.open": {
    id: "patients.directory.open",
    group: "patients",
    labelKey: "dashboardQuickAccess.actions.patients",
    descriptionKey: "dashboardQuickAccess.descriptions.patients",
    iconId: "users",
    permissions: [{ module: "patients", action: "read" }],
    status: "ready",
    execution: { kind: "navigate", to: "/pacientes" },
  },
  "patients.patient.create": {
    id: "patients.patient.create",
    group: "patients",
    labelKey: "dashboardQuickAccess.actions.newPatient",
    descriptionKey: "dashboardQuickAccess.descriptions.newPatient",
    iconId: "user-plus",
    permissions: [{ module: "patients", action: "write" }],
    requiresBranch: true,
    status: "ready",
    execution: { kind: "navigate", to: "/pacientes/nuevo" },
  },
  "patients.import.open": {
    id: "patients.import.open",
    group: "patients",
    labelKey: "dashboardQuickAccess.actions.importPatients",
    descriptionKey: "dashboardQuickAccess.descriptions.importPatients",
    iconId: "users",
    permissions: [{ module: "patients", action: "write" }],
    requiresBranch: true,
    status: "ready",
    execution: { kind: "navigate", to: "/importar" },
  },
  "patients.reminder.send": {
    id: "patients.reminder.send",
    group: "patients",
    labelKey: "dashboardQuickAccess.actions.sendReminder",
    descriptionKey: "dashboardQuickAccess.descriptions.comingSoon",
    iconId: "bell",
    status: "unavailable",
    execution: { kind: "unavailable" },
  },
  "patients.conversation.open": {
    id: "patients.conversation.open",
    group: "patients",
    labelKey: "dashboardQuickAccess.actions.patientConversation",
    descriptionKey: "dashboardQuickAccess.descriptions.comingSoon",
    iconId: "users",
    status: "unavailable",
    execution: { kind: "unavailable" },
  },
  "finance.billing.open": {
    id: "finance.billing.open",
    group: "finance",
    labelKey: "dashboardQuickAccess.actions.billing",
    descriptionKey: "dashboardQuickAccess.descriptions.billing",
    iconId: "wallet-cards",
    allowedRoles: ["admin", "facturacion", "asistente"],
    status: "ready",
    execution: { kind: "navigate", to: "/billing" },
  },
  "finance.payments.open": {
    id: "finance.payments.open",
    group: "finance",
    labelKey: "dashboardQuickAccess.actions.payments",
    descriptionKey: "dashboardQuickAccess.descriptions.payments",
    iconId: "wallet-cards",
    allowedRoles: ["admin", "facturacion", "asistente"],
    status: "ready",
    execution: { kind: "navigate", to: "/billing/payments" },
  },
  "finance.expenses.open": {
    id: "finance.expenses.open",
    group: "finance",
    labelKey: "dashboardQuickAccess.actions.expenses",
    descriptionKey: "dashboardQuickAccess.descriptions.expenses",
    iconId: "receipt",
    allowedRoles: ["admin", "facturacion", "asistente"],
    status: "ready",
    execution: { kind: "navigate", to: "/billing/expenses" },
  },
  "finance.report.open": {
    id: "finance.report.open",
    group: "finance",
    labelKey: "dashboardQuickAccess.actions.financialReport",
    descriptionKey: "dashboardQuickAccess.descriptions.financialReport",
    iconId: "bar-chart",
    allowedRoles: ["admin", "facturacion"],
    status: "ready",
    execution: { kind: "navigate", to: "/billing/report" },
  },
  "finance.payment.register": {
    id: "finance.payment.register",
    group: "finance",
    labelKey: "dashboardQuickAccess.actions.registerPayment",
    descriptionKey: "dashboardQuickAccess.descriptions.ownerOnly",
    iconId: "wallet-cards",
    status: "unavailable",
    execution: { kind: "unavailable" },
  },
  "finance.expense.create": {
    id: "finance.expense.create",
    group: "finance",
    labelKey: "dashboardQuickAccess.actions.newExpense",
    descriptionKey: "dashboardQuickAccess.descriptions.ownerOnly",
    iconId: "receipt",
    status: "unavailable",
    execution: { kind: "unavailable" },
  },
  "finance.receivables.exportCsv": {
    id: "finance.receivables.exportCsv",
    group: "finance",
    labelKey: "dashboardQuickAccess.actions.exportCsv",
    descriptionKey: "dashboardQuickAccess.descriptions.ownerOnly",
    iconId: "receipt",
    status: "unavailable",
    execution: { kind: "unavailable" },
  },
  "dashboard.home.open": {
    id: "dashboard.home.open",
    group: "dashboard",
    labelKey: "dashboardQuickAccess.actions.dashboard",
    descriptionKey: "dashboardQuickAccess.descriptions.dashboard",
    iconId: "layout-dashboard",
    permissions: [{ module: "dashboard", action: "read" }],
    status: "ready",
    execution: { kind: "navigate", to: "/" },
  },
  "dashboard.customize": {
    id: "dashboard.customize",
    group: "dashboard",
    labelKey: "dashboardQuickAccess.actions.customize",
    descriptionKey: "dashboardQuickAccess.descriptions.customize",
    iconId: "sliders-horizontal",
    status: "ready",
    execution: { kind: "dashboard-customize" },
  },
  "dashboard.search.open": {
    id: "dashboard.search.open",
    group: "dashboard",
    labelKey: "dashboardQuickAccess.actions.search",
    descriptionKey: "dashboardQuickAccess.descriptions.search",
    iconId: "search",
    status: "ready",
    execution: { kind: "command-palette" },
  },
  "system.notifications.open": {
    id: "system.notifications.open",
    group: "system",
    labelKey: "dashboardQuickAccess.actions.notifications",
    descriptionKey: "dashboardQuickAccess.descriptions.notifications",
    iconId: "bell",
    status: "ready",
    execution: { kind: "navigate", to: "/notificaciones" },
  },
  "system.quickNotes.toggle": {
    id: "system.quickNotes.toggle",
    group: "system",
    labelKey: "dashboardQuickAccess.actions.quickNotes",
    descriptionKey: "dashboardQuickAccess.descriptions.quickNotes",
    iconId: "sticky-note",
    status: "ready",
    execution: { kind: "quick-notes", command: "toggle" },
  },
  "system.quickNotes.create": {
    id: "system.quickNotes.create",
    group: "system",
    labelKey: "dashboardQuickAccess.actions.newQuickNote",
    descriptionKey: "dashboardQuickAccess.descriptions.newQuickNote",
    iconId: "sticky-note",
    status: "ready",
    execution: { kind: "quick-notes", command: "create" },
  },
  "system.settings.open": {
    id: "system.settings.open",
    group: "system",
    labelKey: "dashboardQuickAccess.actions.settings",
    descriptionKey: "dashboardQuickAccess.descriptions.settings",
    iconId: "settings",
    status: "ready",
    execution: { kind: "navigate", to: "/configuracion" },
  },
  "system.profile.open": {
    id: "system.profile.open",
    group: "system",
    labelKey: "dashboardQuickAccess.actions.profile",
    descriptionKey: "dashboardQuickAccess.descriptions.profile",
    iconId: "users",
    status: "ready",
    execution: { kind: "navigate", to: "/perfil" },
  },
  "system.help.open": {
    id: "system.help.open",
    group: "system",
    labelKey: "dashboardQuickAccess.actions.help",
    descriptionKey: "dashboardQuickAccess.descriptions.help",
    iconId: "star",
    status: "ready",
    execution: { kind: "navigate", to: "/ayuda" },
  },
  "system.language.toggle": {
    id: "system.language.toggle",
    group: "system",
    labelKey: "dashboardQuickAccess.actions.language",
    descriptionKey: "dashboardQuickAccess.descriptions.language",
    iconId: "languages",
    status: "ready",
    execution: { kind: "language-toggle" },
  },
  "system.theme.light": {
    id: "system.theme.light",
    group: "system",
    labelKey: "dashboardQuickAccess.actions.lightTheme",
    descriptionKey: "dashboardQuickAccess.descriptions.theme",
    iconId: "sun",
    status: "ready",
    execution: { kind: "theme", theme: "light" },
  },
  "system.theme.dark": {
    id: "system.theme.dark",
    group: "system",
    labelKey: "dashboardQuickAccess.actions.darkTheme",
    descriptionKey: "dashboardQuickAccess.descriptions.theme",
    iconId: "moon",
    status: "ready",
    execution: { kind: "theme", theme: "dark" },
  },
  "system.theme.alternative": {
    id: "system.theme.alternative",
    group: "system",
    labelKey: "dashboardQuickAccess.actions.alternativeTheme",
    descriptionKey: "dashboardQuickAccess.descriptions.theme",
    iconId: "palette",
    status: "ready",
    execution: { kind: "theme", theme: "alternative" },
  },
  "system.theme.system": {
    id: "system.theme.system",
    group: "system",
    labelKey: "dashboardQuickAccess.actions.systemTheme",
    descriptionKey: "dashboardQuickAccess.descriptions.theme",
    iconId: "monitor",
    status: "ready",
    execution: { kind: "theme", theme: "system" },
  },
  "system.theme.highContrast": {
    id: "system.theme.highContrast",
    group: "system",
    labelKey: "dashboardQuickAccess.actions.highContrastTheme",
    descriptionKey: "dashboardQuickAccess.descriptions.theme",
    iconId: "activity",
    status: "ready",
    execution: { kind: "theme", theme: "high-contrast" },
  },
  "calculators.suite.open": {
    id: "calculators.suite.open",
    group: "calculators",
    labelKey: "dashboardQuickAccess.actions.calculators",
    descriptionKey: "dashboardQuickAccess.descriptions.calculators",
    iconId: "calculator",
    permissions: [{ module: "anthropometry", action: "read" }],
    status: "ready",
    execution: { kind: "navigate", to: "/calculos" },
  },
  "calculators.bmi.open": {
    id: "calculators.bmi.open",
    group: "calculators",
    labelKey: "dashboardQuickAccess.actions.bmi",
    descriptionKey: "dashboardQuickAccess.descriptions.calculator",
    iconId: "calculator",
    permissions: [{ module: "anthropometry", action: "read" }],
    status: "ready",
    execution: { kind: "navigate", to: "/calculos?tool=bmi" },
  },
  "calculators.bmr.open": {
    id: "calculators.bmr.open",
    group: "calculators",
    labelKey: "dashboardQuickAccess.actions.bmr",
    descriptionKey: "dashboardQuickAccess.descriptions.calculator",
    iconId: "calculator",
    permissions: [{ module: "anthropometry", action: "read" }],
    status: "ready",
    execution: { kind: "navigate", to: "/calculos?tool=bmr" },
  },
  "calculators.tdee.open": {
    id: "calculators.tdee.open",
    group: "calculators",
    labelKey: "dashboardQuickAccess.actions.tdee",
    descriptionKey: "dashboardQuickAccess.descriptions.calculator",
    iconId: "activity",
    permissions: [{ module: "anthropometry", action: "read" }],
    status: "ready",
    execution: { kind: "navigate", to: "/calculos?tool=tdee" },
  },
  "calculators.bodyFat.open": {
    id: "calculators.bodyFat.open",
    group: "calculators",
    labelKey: "dashboardQuickAccess.actions.bodyFat",
    descriptionKey: "dashboardQuickAccess.descriptions.calculator",
    iconId: "activity",
    permissions: [{ module: "anthropometry", action: "read" }],
    status: "ready",
    execution: { kind: "navigate", to: "/calculos?tool=body-fat" },
  },
  "calculators.egfr.open": {
    id: "calculators.egfr.open",
    group: "calculators",
    labelKey: "dashboardQuickAccess.actions.egfr",
    descriptionKey: "dashboardQuickAccess.descriptions.calculator",
    iconId: "flask-conical",
    permissions: [{ module: "anthropometry", action: "read" }],
    status: "ready",
    execution: { kind: "navigate", to: "/calculos?tool=egfr" },
  },
  "calculators.homaIr.open": {
    id: "calculators.homaIr.open",
    group: "calculators",
    labelKey: "dashboardQuickAccess.actions.homaIr",
    descriptionKey: "dashboardQuickAccess.descriptions.calculator",
    iconId: "flask-conical",
    permissions: [{ module: "anthropometry", action: "read" }],
    status: "ready",
    execution: { kind: "navigate", to: "/calculos?tool=homa-ir" },
  },
  "calculators.ldl.open": {
    id: "calculators.ldl.open",
    group: "calculators",
    labelKey: "dashboardQuickAccess.actions.ldl",
    descriptionKey: "dashboardQuickAccess.descriptions.calculator",
    iconId: "flask-conical",
    permissions: [{ module: "anthropometry", action: "read" }],
    status: "ready",
    execution: { kind: "navigate", to: "/calculos?tool=ldl" },
  },
};

export const DASHBOARD_QUICK_ACCESS_DEFINITIONS = Object.values(definitions);

export function getDashboardQuickAccessDefinition(
  id: DashboardQuickAccessActionId,
): DashboardQuickAccessDefinition {
  return definitions[id];
}

export function getDashboardQuickAccessAvailability(
  definition: DashboardQuickAccessDefinition,
  context: DashboardQuickAccessRuntimeContext,
): DashboardQuickAccessAvailability {
  if (definition.status === "unavailable") {
    return {
      enabled: false,
      reasonKey: "dashboardQuickAccess.reasons.comingSoon",
    };
  }
  if (definition.requiresBranch && !context.sucursalId) {
    return {
      enabled: false,
      reasonKey: "dashboardQuickAccess.reasons.branchRequired",
    };
  }
  if (
    definition.allowedRoles &&
    (!context.role || !definition.allowedRoles.includes(context.role))
  ) {
    return {
      enabled: false,
      reasonKey: "dashboardQuickAccess.reasons.permissionDenied",
    };
  }
  if (
    definition.permissions?.some(
      (permission) =>
        !context.role ||
        !hasModuleAccess(permission.module, context.role, permission.action),
    )
  ) {
    return {
      enabled: false,
      reasonKey: "dashboardQuickAccess.reasons.permissionDenied",
    };
  }
  if (definition.id === "dashboard.customize" && context.dashboardEditing) {
    return {
      enabled: false,
      reasonKey: "dashboardQuickAccess.reasons.alreadyEditing",
    };
  }
  if (
    definition.id === "dashboard.customize" &&
    context.dashboardCustomizerAvailable === false
  ) {
    return {
      enabled: false,
      reasonKey: "dashboardQuickAccess.reasons.unavailableHere",
    };
  }
  return { enabled: true };
}
