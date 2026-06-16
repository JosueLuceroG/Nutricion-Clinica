import { type ComponentType } from "react";
import { Users, Calendar, UtensilsCrossed, Activity, AlertCircle, DollarSign } from "lucide-react";
import { type DashboardWidgetId } from "@store/preferencesStore";
import { type DashboardKpis } from "./useDashboardKpis";

export interface WidgetDefinition {
  id: DashboardWidgetId;
  labelKey: string;
  hintKey: string;
  icon: ComponentType<{ className?: string }>;
  to: string;
  value: (data: DashboardKpis) => number | null;
  total?: (data: DashboardKpis) => number | null;
  formatHint?: (data: DashboardKpis, t: (key: string) => string, fmt: (n: number) => string) => string;
}

export const WIDGET_DEFINITIONS: WidgetDefinition[] = [
  {
    id: "activePatients",
    labelKey: "billing.active_patients",
    hintKey: "dashboard.total_registered",
    icon: Users,
    to: "/pacientes",
    value: (d) => d.totalActivePatients,
    total: (d) => d.totalPatients,
  },
  {
    id: "consultationsThisMonth",
    labelKey: "dashboard.consultations_this_month",
    hintKey: "dashboard.current_month_agenda",
    icon: Calendar,
    to: "/consultas",
    value: (d) => d.consultationsThisMonth,
  },
  {
    id: "activePlans",
    labelKey: "dashboard.active_plans",
    hintKey: "dashboard.in_follow_up",
    icon: UtensilsCrossed,
    to: "/planes",
    value: (d) => d.activePlans,
  },
  {
    id: "pendingSync",
    labelKey: "dashboard.pending_sync",
    hintKey: "dashboard.unsent_changes",
    icon: Activity,
    to: "/configuracion",
    value: (d) => d.pendingSync,
  },
  {
    id: "pendingPayments",
    labelKey: "billing.pending_collection",
    hintKey: "billing.no_pending",
    icon: AlertCircle,
    to: "/billing",
    value: (d) => d.pendingPaymentsAmount,
    formatHint: (d, _t, fmt) => d.pendingPaymentsAmount > 0 ? fmt(d.pendingPaymentsAmount) : _t("billing.no_pending"),
  },
  {
    id: "incomeThisMonth",
    labelKey: "billing.income_this_month",
    hintKey: "billing.no_pending",
    icon: DollarSign,
    to: "/billing/report",
    value: (d) => d.incomeThisMonth,
  },
  {
    id: "pendingPaymentsCount",
    labelKey: "billing.pending",
    hintKey: "billing.pending_consultations",
    icon: Calendar,
    to: "/billing",
    value: (d) => (d.pendingPayments > 0 ? d.pendingPayments : 0),
  },
];

export const WIDGET_MAP = Object.fromEntries(
  WIDGET_DEFINITIONS.map((w) => [w.id, w]),
) as Record<DashboardWidgetId, WidgetDefinition>;
