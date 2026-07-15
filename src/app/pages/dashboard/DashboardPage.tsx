import * as React from "react";
import { useSearchParams } from "react-router-dom";
import { ClipboardCheck, RefreshCcw, Settings, Sparkles, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";
import { useDashboardKpis, type DashboardKpis, type DashboardRecentPayment } from "@app/hooks/useDashboardKpis";
import { useUnsavedChangesGuard } from "@hooks/useUnsavedChangesGuard";
import { AppointmentTypeLabel } from "@modules/agenda/domain/AppointmentType";
import { BILLING_REPORT_ROLES } from "@modules/auth/authRoles";
import { hasModuleAccess } from "@modules/auth/securityService";
import { useAuthStore } from "@store/authStore";
import { useDashboardLayoutStore } from "@store/dashboardLayoutStore";
import { usePreferencesStore } from "@store/preferencesStore";
import { ConfirmDialog } from "@components/layout/ConfirmDialog";
import { AlertsAndPendingCard } from "./AlertsAndPendingCard";
import { DashboardShell } from "./DashboardShell";
import {
  type DashboardAlertItem,
  type DashboardKpiItem,
  type ActivitySummaryItem,
  type FinancialSummaryData,
  type WeeklyActivityPoint,
  dashboardAlerts,
  dashboardKpis,
  financialSummary,
  quickActions,
  weeklyActivitySummary,
} from "./dashboardMockData";
import { FinancialSummaryCard } from "./FinancialSummaryCard";
import { KpiCard } from "./KpiCard";
import { QuickActionsCard } from "./QuickActionsCard";
import { RecentPaymentsCard } from "./RecentPaymentsCard";
import { UpcomingConsultationsCard } from "./UpcomingConsultationsCard";
import { WeeklyActivityCard } from "./WeeklyActivityCard";
import { CustomKpiBuilder } from "./customization/CustomKpiBuilder";
import { DashboardEditToolbar } from "./customization/DashboardEditToolbar";
import { DashboardPresetDialog } from "./customization/DashboardPresetDialog";
import { EditableDashboardGrid } from "./customization/EditableDashboardGrid";
import { WidgetConfigDialog } from "./customization/WidgetConfigDialog";
import { WidgetLibraryPanel } from "./customization/WidgetLibraryPanel";
import { evaluateCustomKpi, getCustomKpiField } from "./customization/dashboardMetricEngine";
import { createDefaultDashboardPreferences } from "./customization/dashboardPresets";
import { DASHBOARD_WIDGET_ICONS, getDashboardWidgetDefinition } from "./customization/dashboardWidgetRegistry";
import type { CustomKpiConfig, CustomKpiSource, DashboardPreferences, DashboardWidgetDefinition, DashboardWidgetInstance } from "./customization/dashboardWidgetTypes";

const avatarTones = ["warm", "cool", "rose", "slate"] as const;
const paymentAvatarTones = ["warm", "cool", "rose"] as const;
const weekDayLabels = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const emptyWeeklyActivity: WeeklyActivityPoint[] = weekDayLabels.map((day) => ({
  day,
  consultas: 0,
  nuevos: 0,
}));

function money(value: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(value);
}

function percentageTrend(current: number, previous: number): { label?: string; tone: "up" | "down" | "neutral" } {
  if (current === 0 && previous === 0) return { tone: "neutral" };
  if (previous === 0) return { label: "Nuevo", tone: "up" };
  const change = Math.round(((current - previous) / previous) * 100);
  if (change > 0) return { label: `↑ ${change}%`, tone: "up" };
  if (change < 0) return { label: `↓ ${Math.abs(change)}%`, tone: "down" };
  return { label: "0%", tone: "neutral" };
}

function currentMonthRangeLabel(now = new Date()): string {
  const month = new Intl.DateTimeFormat("es-MX", { month: "short" }).format(now).replace(".", "");
  return `Del 1 al ${now.getDate()} de ${month}`;
}

function initialsFromName(name: string): string {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return initials || "PX";
}

function buildLiveKpis(data: DashboardKpis | null): DashboardKpiItem[] {
  const [patients, consultations, income, pending] = dashboardKpis;

  if (!data) {
    return [
      {
        ...patients!,
        label: "Pacientes activos",
        value: "--",
        trend: undefined,
        hint: "Esperando datos reales",
      },
      {
        ...consultations!,
        label: "Consultas de hoy",
        value: "--",
        trend: undefined,
        hint: "Esperando datos reales",
      },
      {
        ...income!,
        label: "Ingresos del mes",
        value: money(0),
        trend: undefined,
        hint: "Sin datos cargados",
      },
      {
        ...pending!,
        label: "Pendiente de cobro",
        value: money(0),
        trend: undefined,
        hint: "Sin datos cargados",
      },
    ];
  }

  const patientTrend = percentageTrend(data.newPatientsThisMonth, data.newPatientsPreviousMonth);
  const incomeTrend = percentageTrend(data.incomeThisMonth, data.incomePreviousMonth);

  return [
    {
      ...patients!,
      label: "Pacientes activos",
      value: data.totalActivePatients.toString(),
      trend: patientTrend.label,
      trendTone: patientTrend.tone,
      hint: `${data.newPatientsThisMonth} nuevos este mes · ${data.totalPatients} registrados`,
    },
    {
      ...consultations!,
      label: "Consultas realizadas hoy",
      value: data.consultationsToday.toString(),
      trend: undefined,
      hint: `${data.scheduledConsultationsToday} citas en agenda`,
    },
    {
      ...income!,
      label: "Ingresos del mes",
      value: money(data.incomeThisMonth),
      trend: incomeTrend.label,
      trendTone: incomeTrend.tone,
      hint: currentMonthRangeLabel(),
    },
    {
      ...pending!,
      label: "Saldo pendiente total",
      value: money(data.pendingPaymentsAmount),
      trend: undefined,
      hint: `${data.pendingPayments} consultas con saldo`,
    },
  ];
}

function buildLiveAlerts(data: DashboardKpis | null, role: string | null): DashboardAlertItem[] {
  if (!data) return [];
  const [pendingPayment, unconfirmed, expiring] = dashboardAlerts;

  const alerts: DashboardAlertItem[] = [];
  if (canViewFinancialData(role)) alerts.push({
      ...pendingPayment!,
      title: `${data.pendingPayments} consultas pendientes de cobro`,
      detail: `Total: ${money(data.pendingPaymentsAmount)}`,
      count: data.pendingPayments > 0 ? "›" : "0",
      actionTo: "/billing",
    });
  if (role && hasModuleAccess("agenda", role)) alerts.push({
      ...unconfirmed!,
      title: `${data.unconfirmedAppointments.length} citas sin confirmar`,
      detail: "Requieren confirmación",
      count: data.unconfirmedAppointments.length.toString(),
    });
  if (role && hasModuleAccess("mealplan", role)) alerts.push({
      ...expiring!,
      title: `${data.expiringPlans.length} planes por vencer`,
      detail: "Próximos 7 días",
      count: data.expiringPlans.length.toString(),
    });
  return alerts;
}

function buildLiveFinancialSummary(data: DashboardKpis | null): FinancialSummaryData {
  const [paid, pending, average] = financialSummary.items;

  if (!data) {
    return {
      total: money(0),
      trend: "Sin datos cargados",
      objective: "Esperando datos reales",
      collectionRate: "0%",
      sparkline: [],
      items: [
        {
          ...paid!,
          value: money(0),
          detail: "Pagos liquidados este mes",
          percent: 0,
        },
        {
          ...pending!,
          value: money(0),
          detail: "Consultas pendientes",
          percent: 0,
        },
        {
          ...average!,
          value: money(0),
          detail: "Sin pagos este mes",
          percent: 0,
        },
      ],
    };
  }

  const totalOperational = data.incomeThisMonth + data.pendingPaymentsAmountThisMonth;
  const collectionPercent = totalOperational > 0
    ? Math.round((data.incomeThisMonth / totalOperational) * 100)
    : 0;
  const averageTicket = data.paymentsThisMonth > 0
    ? data.incomeThisMonth / data.paymentsThisMonth
    : 0;
  const incomeTrend = percentageTrend(data.incomeThisMonth, data.incomePreviousMonth);

  return {
    total: money(totalOperational),
    trend: incomeTrend.label ? `${incomeTrend.label} vs. mes anterior` : "Sin variación mensual",
    objective: totalOperational > 0 ? `${collectionPercent}% recuperado este mes` : "Sin cobros registrados este mes",
    collectionRate: `${collectionPercent}%`,
    sparkline: data.incomeActivity,
    items: [
      {
        ...paid!,
        value: money(data.incomeThisMonth),
        detail: `${data.paymentsThisMonth} pagos liquidados este mes`,
        percent: collectionPercent,
      },
      {
        ...pending!,
        value: money(data.pendingPaymentsAmountThisMonth),
        detail: `${data.pendingPaymentsThisMonth} consultas pendientes este mes`,
        percent: Math.max(0, 100 - collectionPercent),
      },
      {
        ...average!,
        value: money(averageTicket),
        detail: `${data.paymentsThisMonth} pagos registrados este mes`,
        percent: 0,
      },
    ],
  };
}

function appointmentTimeLabel(date: string, time: string): string {
  return new Intl.DateTimeFormat("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(`${date}T${time}:00`));
}

function appointmentStatusLabel(status: string) {
  if (status === "in_progress") return "En curso" as const;
  if (status === "confirmed") return "Confirmada" as const;
  return "Pendiente" as const;
}

function buildLiveUpcomingConsultations(data: DashboardKpis | null) {
  if (!data) return [];
  if (data.upcomingAppointments.length > 0) {
    return data.upcomingAppointments
      .slice(0, 4)
      .map((appointment, index) => {
        const patientName = data.patientNamesById[appointment.patientId] ??
          `Paciente ${appointment.patientId.slice(0, 6)}`;

        return {
          time: appointmentTimeLabel(appointment.date, appointment.startTime),
          patient: patientName,
          type: appointment.reason || AppointmentTypeLabel[appointment.type],
          status: appointmentStatusLabel(appointment.status),
          avatar: initialsFromName(patientName),
          avatarTone: avatarTones[index % avatarTones.length] ?? "warm",
        };
      });
  }

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  return [...data.upcomingConsultations]
    .filter((consultation) =>
      consultation.status === "in-progress" || consultation.consultationDate.getTime() >= startOfToday,
    )
    .sort((a, b) => a.consultationDate.getTime() - b.consultationDate.getTime())
    .slice(0, 4)
    .map((consultation, index) => {
      const patientName = data.patientNamesById[consultation.patientId.toString()] ??
        `Paciente ${consultation.patientId.toString().slice(0, 6)}`;
      const time = new Intl.DateTimeFormat("es-MX", {
        hour: "2-digit",
        minute: "2-digit",
      }).format(consultation.consultationDate);

      return {
        time,
        patient: patientName,
        type: consultation.reason || `Consulta #${consultation.consultationNumber}`,
        status: consultation.status === "in-progress" ? "En curso" as const : "Confirmada" as const,
        avatar: initialsFromName(patientName),
        avatarTone: avatarTones[index % avatarTones.length] ?? "warm",
      };
    });
}

function paymentStatusLabel(status: DashboardRecentPayment["paymentStatus"]) {
  if (status === "paid") return "Pagado" as const;
  if (status === "partial") return "Parcial" as const;
  return "Pendiente" as const;
}

function paymentMethodLabel(method: DashboardRecentPayment["paymentMethod"]) {
  if (method === "cash") return "Efectivo";
  if (method === "card") return "Tarjeta";
  if (method === "transfer") return "Transferencia";
  if (method === "other") return "Otro";
  return "Sin metodo";
}

function paymentDateLabel(date: Date | null) {
  if (!date) return "Sin fecha";
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date).replace(".", "");
}

function buildLiveRecentPayments(data: DashboardKpis | null) {
  if (!data) return [];

  return data.recentPayments.map((payment, index) => {
    const date = payment.paidAt ?? payment.consultationDate;
    return {
      patient: payment.patientName,
      concept: payment.concept,
      amount: money(payment.amountPaid),
      date: paymentDateLabel(date),
      method: paymentMethodLabel(payment.paymentMethod),
      status: paymentStatusLabel(payment.paymentStatus),
      avatar: initialsFromName(payment.patientName),
      avatarTone: paymentAvatarTones[index % paymentAvatarTones.length] ?? "warm",
    };
  });
}

function buildLiveWeeklyActivity(data: DashboardKpis | null): WeeklyActivityPoint[] {
  if (!data) return emptyWeeklyActivity;
  return data.weeklyActivity;
}

function buildLiveMonthlyActivity(data: DashboardKpis | null): WeeklyActivityPoint[] {
  if (!data) return [];
  return data.monthlyActivity;
}

function busiestConsultationPeriod(points: WeeklyActivityPoint[]): string {
  const busiest = points.reduce<WeeklyActivityPoint | null>(
    (current, point) => !current || point.consultas > current.consultas ? point : current,
    null,
  );
  return busiest && busiest.consultas > 0 ? busiest.day : "--";
}

function buildLiveWeeklyActivitySummary(data: DashboardKpis | null): ActivitySummaryItem[] {
  const [consultations, newPatients, period] = weeklyActivitySummary;
  if (!data) {
    return [
      {
        ...consultations!,
        value: "0",
      },
      {
        ...newPatients!,
        value: "0",
      },
      {
        ...period!,
        value: "--",
        label: "Día con más consultas",
      },
    ];
  }

  const totalConsultations = data.weeklyActivity.reduce((sum, item) => sum + item.consultas, 0);
  const totalNewPatients = data.weeklyActivity.reduce((sum, item) => sum + item.nuevos, 0);

  return [
    {
      ...consultations!,
      value: totalConsultations.toString(),
    },
    {
      ...newPatients!,
      value: totalNewPatients.toString(),
    },
    {
      ...period!,
      value: busiestConsultationPeriod(data.weeklyActivity),
      label: "Día con más consultas",
    },
  ];
}

function buildLiveMonthlyActivitySummary(data: DashboardKpis | null): ActivitySummaryItem[] {
  const [consultations, newPatients, period] = weeklyActivitySummary;
  const monthlyData = data?.monthlyActivity ?? [];
  return [
    {
      ...consultations!,
      value: monthlyData.reduce((sum, item) => sum + item.consultas, 0).toString(),
    },
    {
      ...newPatients!,
      value: monthlyData.reduce((sum, item) => sum + item.nuevos, 0).toString(),
    },
    {
      ...period!,
      value: busiestConsultationPeriod(monthlyData),
      label: "Semana con más consultas",
    },
  ];
}

function buildAdditionalKpi(
  widget: DashboardWidgetInstance,
  data: DashboardKpis | null,
  customKpis: CustomKpiConfig[],
): DashboardKpiItem {
  const definition = getDashboardWidgetDefinition(widget.definitionId);
  const Icon = DASHBOARD_WIDGET_ICONS[definition.iconKey] ?? Sparkles;
  const title = widget.config.title || definition.name;
  const tone = widget.config.tone ?? definition.tone;

  if (widget.definitionId === "customKpi") {
    const custom = customKpis.find((item) => item.id === widget.config.customKpiId);
    const result = custom
      ? evaluateCustomKpi(custom, data)
      : { value: 0, formattedValue: "--", hint: "Configuración no disponible" };
    return {
      id: widget.instanceId,
      label: widget.config.title || custom?.name || "KPI personalizado",
      value: result.formattedValue,
      hint: result.hint,
      trend: result.trend,
      trendTone: result.trendTone,
      progress: custom?.visualization === "progress" || custom?.visualization === "percentage" ? result.value : undefined,
      visualization: custom?.visualization,
      tone: widget.config.tone ?? custom?.tone ?? "purple",
      icon: custom ? (DASHBOARD_WIDGET_ICONS[custom.iconKey] ?? Sparkles) : Sparkles,
    };
  }

  if (widget.definitionId === "newPatientsThisMonth") {
    return { id: widget.instanceId, label: title, value: data?.newPatientsThisMonth.toString() ?? "--", hint: "Altas registradas este mes", tone, icon: Icon, to: "/pacientes" };
  }
  if (widget.definitionId === "consultationsThisMonth") {
    return { id: widget.instanceId, label: title, value: data?.consultationsThisMonth.toString() ?? "--", hint: "Consultas completadas este mes", tone, icon: ClipboardCheck, to: "/consultas" };
  }
  if (widget.definitionId === "activePlans") {
    return { id: widget.instanceId, label: title, value: data?.activePlans.toString() ?? "--", hint: `${data?.expiringPlans.length ?? 0} por vencer en 7 días`, tone, icon: UtensilsCrossed, to: "/planes" };
  }
  return { id: widget.instanceId, label: title, value: data?.pendingSync.toString() ?? "--", hint: "Cambios locales pendientes", tone, icon: RefreshCcw };
}

function canUseDashboardDefinition(definition: DashboardWidgetDefinition, role: string | null): boolean {
  if (!definition.requiredModule) return true;
  if (!role) return false;
  if (definition.requiredModule === "billing") {
    return canViewFinancialData(role);
  }
  return hasModuleAccess(definition.requiredModule, role);
}

function canViewFinancialData(role: string | null): boolean {
  return Boolean(role && (BILLING_REPORT_ROLES as readonly string[]).includes(role));
}

function canUseCustomKpiSource(source: CustomKpiSource, role: string | null): boolean {
  if (!role) return false;
  const moduleBySource: Record<CustomKpiConfig["source"], string | null> = {
    patients: "patients",
    consultations: "consultations",
    payments: "billing",
    plans: "mealplan",
    agenda: "agenda",
    system: null,
  };
  const module = moduleBySource[source];
  if (!module) return true;
  if (module === "billing") return canViewFinancialData(role);
  return hasModuleAccess(module, role);
}

function canUseCustomKpi(config: CustomKpiConfig, role: string | null): boolean {
  const field = getCustomKpiField(config.source, config.valueField);
  return Boolean(field && canUseCustomKpiSource(field.source, role));
}

function canUseQuickAction(path: string, role: string | null): boolean {
  if (!role) return false;
  if (path.startsWith("/billing")) return canViewFinancialData(role);
  if (path.startsWith("/pacientes")) return hasModuleAccess("patients", role);
  if (path.startsWith("/consultas")) return hasModuleAccess("consultations", role);
  if (path.startsWith("/planes")) return hasModuleAccess("mealplan", role);
  if (path.startsWith("/plan-semanal")) return hasModuleAccess("meal-planner", role);
  return true;
}

function filterPreferencesByAccess(
  preferences: DashboardPreferences,
  role: string | null,
): DashboardPreferences {
  const allowedCustomIds = new Set(preferences.customKpis.filter((config) => canUseCustomKpi(config, role)).map((config) => config.id));
  const widgets = preferences.widgets.filter((widget) => {
    const definition = getDashboardWidgetDefinition(widget.definitionId);
    if (!canUseDashboardDefinition(definition, role)) return false;
    return widget.definitionId !== "customKpi" || Boolean(widget.config.customKpiId && allowedCustomIds.has(widget.config.customKpiId));
  });
  const ids = new Set(widgets.map((widget) => widget.instanceId));
  return {
    ...preferences,
    widgets,
    customKpis: preferences.customKpis.filter((config) => allowedCustomIds.has(config.id)),
    layout: preferences.layout.filter((item) => ids.has(item.i)),
    smallScreenOrder: preferences.smallScreenOrder.filter((id) => ids.has(id)),
  };
}

export function DashboardPage() {
  const { data, loading, error } = useDashboardKpis();
  const [searchParams, setSearchParams] = useSearchParams();
  const [libraryOpen, setLibraryOpen] = React.useState(false);
  const [highlightedWidgetId, setHighlightedWidgetId] = React.useState<string | null>(null);
  const [presetsOpen, setPresetsOpen] = React.useState(false);
  const [customKpiOpen, setCustomKpiOpen] = React.useState(false);
  const [customKpiEditInstanceId, setCustomKpiEditInstanceId] = React.useState<string | null>(null);
  const [customKpiLibraryEditId, setCustomKpiLibraryEditId] = React.useState<string | null>(null);
  const [customKpiDeleteId, setCustomKpiDeleteId] = React.useState<string | null>(null);
  const [configWidgetId, setConfigWidgetId] = React.useState<string | null>(null);
  const [confirmCancelOpen, setConfirmCancelOpen] = React.useState(false);
  const [confirmResetOpen, setConfirmResetOpen] = React.useState(false);
  const userId = useAuthStore((state) => state.user?.id ?? "local");
  const role = useAuthStore((state) => state.user?.rol ?? null);
  const sucursalId = useAuthStore((state) => state.sucursalActivaId);
  const legacyKpiOrder = usePreferencesStore((state) => state.dashboardPremiumKpiOrder);
  const legacyHiddenKpiIds = usePreferencesStore((state) => state.dashboardPremiumKpiHiddenIds);
  const saved = useDashboardLayoutStore((state) => state.saved);
  const draft = useDashboardLayoutStore((state) => state.draft);
  const isEditing = useDashboardLayoutStore((state) => state.isEditing);
  const isDirty = useDashboardLayoutStore((state) => state.isDirty);
  const layoutError = useDashboardLayoutStore((state) => state.error);
  const hydrate = useDashboardLayoutStore((state) => state.hydrate);
  const beginEditing = useDashboardLayoutStore((state) => state.beginEditing);
  const cancelEditing = useDashboardLayoutStore((state) => state.cancelEditing);
  const saveDraft = useDashboardLayoutStore((state) => state.saveDraft);
  const applyPreset = useDashboardLayoutStore((state) => state.applyPreset);
  const updateLayout = useDashboardLayoutStore((state) => state.updateLayout);
  const addWidget = useDashboardLayoutStore((state) => state.addWidget);
  const updateWidget = useDashboardLayoutStore((state) => state.updateWidget);
  const setWidgetSize = useDashboardLayoutStore((state) => state.setWidgetSize);
  const setRowsMode = useDashboardLayoutStore((state) => state.setRowsMode);
  const adjustMinRows = useDashboardLayoutStore((state) => state.adjustMinRows);
  const moveWidgetInOrder = useDashboardLayoutStore((state) => state.moveWidgetInOrder);
  const duplicateWidget = useDashboardLayoutStore((state) => state.duplicateWidget);
  const toggleWidgetHidden = useDashboardLayoutStore((state) => state.toggleWidgetHidden);
  const removeWidget = useDashboardLayoutStore((state) => state.removeWidget);
  const addCustomKpi = useDashboardLayoutStore((state) => state.addCustomKpi);
  const removeCustomKpi = useDashboardLayoutStore((state) => state.removeCustomKpi);
  const scope = React.useMemo(() => ({ userId, sucursalId }), [sucursalId, userId]);

  React.useEffect(() => {
    hydrate(scope, { kpiOrder: legacyKpiOrder, hiddenKpiIds: legacyHiddenKpiIds });
  }, [hydrate, legacyHiddenKpiIds, legacyKpiOrder, scope]);

  React.useEffect(() => {
    if (!saved || searchParams.get("customize") !== "1") return;
    beginEditing();
    setLibraryOpen(false);
    const next = new URLSearchParams(searchParams);
    next.delete("customize");
    setSearchParams(next, { replace: true });
  }, [beginEditing, saved, searchParams, setSearchParams]);

  useUnsavedChangesGuard(isEditing && isDirty, "Tienes cambios sin guardar en el dashboard. ¿Deseas salir?");

  React.useEffect(() => {
    if (!highlightedWidgetId) return;
    let animationFrame = 0;
    let attempts = 0;
    let settleFrames = 0;
    const revealHighlightedWidget = () => {
      const widget = Array.from(document.querySelectorAll<HTMLElement>("[data-dashboard-widget-id]"))
        .find((element) => element.dataset.dashboardWidgetId === highlightedWidgetId);
      if (!widget) {
        attempts += 1;
        if (attempts < 12) animationFrame = window.requestAnimationFrame(revealHighlightedWidget);
        return;
      }
      if (settleFrames < 12) {
        settleFrames += 1;
        animationFrame = window.requestAnimationFrame(revealHighlightedWidget);
        return;
      }

      let scrollContainer = widget.parentElement;
      while (scrollContainer) {
        const overflowY = window.getComputedStyle(scrollContainer).overflowY;
        if (/auto|scroll/.test(overflowY) && scrollContainer.scrollHeight > scrollContainer.clientHeight) break;
        scrollContainer = scrollContainer.parentElement;
      }
      const scrollRoot = scrollContainer ?? document.scrollingElement as HTMLElement | null;
      if (!scrollRoot) return;

      const widgetRect = widget.getBoundingClientRect();
      const scrollRootRect = scrollRoot.getBoundingClientRect();
      const toolbarRect = document.querySelector<HTMLElement>(".nc-dashboard-edit-toolbar")?.getBoundingClientRect();
      const libraryRect = document.querySelector<HTMLElement>(".nc-dashboard-widget-library")?.getBoundingClientRect();
      const visibleTop = Math.max(scrollRootRect.top + 20, (toolbarRect?.bottom ?? 0) + 18);
      const overlapsLibrary = Boolean(libraryRect
        && widgetRect.left < libraryRect.right
        && widgetRect.right > libraryRect.left);
      const visibleBottom = overlapsLibrary && libraryRect
        ? Math.max(visibleTop + 80, libraryRect.top - 18)
        : Math.min(scrollRootRect.bottom - 24, window.innerHeight - 24);
      const availableHeight = visibleBottom - visibleTop;
      const desiredTop = visibleTop + Math.max(0, (availableHeight - Math.min(widgetRect.height, availableHeight)) / 2);
      const maxScroll = Math.max(0, scrollRoot.scrollHeight - scrollRoot.clientHeight);
      const nextScroll = Math.max(0, Math.min(maxScroll, scrollRoot.scrollTop + widgetRect.top - desiredTop));

      scrollRoot.scrollTo({
        top: nextScroll,
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      });
    };
    animationFrame = window.requestAnimationFrame(revealHighlightedWidget);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [highlightedWidgetId]);

  const fallbackPreferences = React.useMemo(
    () => createDefaultDashboardPreferences(scope, { kpiOrder: legacyKpiOrder, hiddenKpiIds: legacyHiddenKpiIds }),
    [legacyHiddenKpiIds, legacyKpiOrder, scope],
  );
  const preferences = (isEditing ? draft : saved) ?? fallbackPreferences;
  const visiblePreferences = React.useMemo(
    () => filterPreferencesByAccess(preferences, role),
    [preferences, role],
  );
  const liveKpis = buildLiveKpis(data);
  const liveAlerts = buildLiveAlerts(data, role);
  const liveFinancialSummary = buildLiveFinancialSummary(data);
  const liveUpcomingConsultations = buildLiveUpcomingConsultations(data);
  const liveRecentPayments = buildLiveRecentPayments(data);
  const liveWeeklyActivity = buildLiveWeeklyActivity(data);
  const liveMonthlyActivity = buildLiveMonthlyActivity(data);
  const liveWeeklyActivitySummary = buildLiveWeeklyActivitySummary(data);
  const liveMonthlyActivitySummary = buildLiveMonthlyActivitySummary(data);
  const liveQuickActions = quickActions.filter((action) => canUseQuickAction(action.to, role));
  const canUseKpiSource = React.useCallback(
    (source: CustomKpiSource) => canUseCustomKpiSource(source, role),
    [role],
  );

  const startEditing = () => {
    if (isEditing) return;
    beginEditing();
    setLibraryOpen(false);
  };

  const renderWidget = (widget: DashboardWidgetInstance) => {
    const definition = getDashboardWidgetDefinition(widget.definitionId);
    const title = widget.config.title || definition.name;
    const limit = widget.config.limit ?? 6;
    if (definition.kind === "kpi" || definition.kind === "customKpi") {
      const live = liveKpis.find((item) => item.id === widget.definitionId);
      const item = live
        ? { ...live, id: widget.instanceId, label: title, tone: widget.config.tone ?? live.tone }
        : buildAdditionalKpi(widget, data, visiblePreferences.customKpis);
      return <KpiCard item={item} />;
    }
    if (definition.kind === "upcomingConsultations") return <UpcomingConsultationsCard title={title} items={liveUpcomingConsultations.slice(0, limit)} />;
    if (definition.kind === "weeklyActivity") return (
      <WeeklyActivityCard
        title={title}
        weeklyData={liveWeeklyActivity}
        monthlyData={liveMonthlyActivity}
        weeklySummary={liveWeeklyActivitySummary}
        monthlySummary={liveMonthlyActivitySummary}
      />
    );
    if (definition.kind === "alerts") return <AlertsAndPendingCard title={title} alerts={liveAlerts.slice(0, limit)} />;
    if (definition.kind === "financialSummary") return <FinancialSummaryCard title={title} summary={liveFinancialSummary} />;
    if (definition.kind === "recentPayments") return <RecentPaymentsCard title={title} payments={liveRecentPayments.slice(0, limit)} />;
    return <QuickActionsCard title={title} actions={liveQuickActions.slice(0, limit)} />;
  };

  const revealWidgetInGrid = (instanceId: string) => {
    setHighlightedWidgetId(instanceId);
    window.setTimeout(() => {
      setHighlightedWidgetId((current) => current === instanceId ? null : current);
    }, 2200);
  };

  const handleAddWidget = (definitionId: DashboardWidgetInstance["definitionId"], customKpiId?: string) => {
    const existing = draft?.widgets.find((widget) => widget.definitionId === definitionId && (definitionId !== "customKpi" || widget.config.customKpiId === customKpiId));
    if (existing?.hidden) {
      toggleWidgetHidden(existing.instanceId);
      revealWidgetInGrid(existing.instanceId);
      toast.success("Widget mostrado nuevamente");
      return;
    }
    const previousIds = new Set(draft?.widgets.map((widget) => widget.instanceId));
    addWidget(definitionId, customKpiId);
    const addedWidget = [...(useDashboardLayoutStore.getState().draft?.widgets ?? [])]
      .reverse()
      .find((widget) => !previousIds.has(widget.instanceId)
        && widget.definitionId === definitionId
        && (definitionId !== "customKpi" || widget.config.customKpiId === customKpiId));
    if (addedWidget) revealWidgetInGrid(addedWidget.instanceId);
    toast.success("Widget agregado al dashboard");
  };

  const configuredWidget = configWidgetId
    ? visiblePreferences.widgets.find((widget) => widget.instanceId === configWidgetId) ?? null
    : null;
  const customKpiEditWidget = customKpiEditInstanceId
    ? visiblePreferences.widgets.find((widget) => widget.instanceId === customKpiEditInstanceId) ?? null
    : null;
  const customKpiInitialConfig = visiblePreferences.customKpis.find((config) =>
    config.id === (customKpiEditWidget?.config.customKpiId ?? customKpiLibraryEditId),
  ) ?? null;
  const customKpiDeleteConfig = (draft?.customKpis ?? visiblePreferences.customKpis)
    .find((config) => config.id === customKpiDeleteId) ?? null;

  const openWidgetConfiguration = (instanceId: string) => {
    const widget = visiblePreferences.widgets.find((item) => item.instanceId === instanceId);
    if (widget?.definitionId === "customKpi") {
      setCustomKpiEditInstanceId(instanceId);
      setCustomKpiOpen(true);
      return;
    }
    setConfigWidgetId(instanceId);
  };

  return (
    <DashboardShell
      onCustomizeKpis={startEditing}
      dashboardEditing={isEditing}
    >
      <h1 className="sr-only">Dashboard</h1>

      {(loading || error) && (
        <div className={`nc-dashboard-data-status${error ? " nc-dashboard-data-status--error" : ""}`} role={error ? "alert" : "status"}>
          {error
            ? "No se pudieron cargar los datos reales; se muestran valores vacíos."
            : "Actualizando métricas reales del consultorio..."}
        </div>
      )}

      {isEditing ? (
        <DashboardEditToolbar
          dirty={isDirty}
          rowsMode={preferences.grid.rowsMode}
          minRows={preferences.grid.minRows}
          onOpenLibrary={() => setLibraryOpen(true)}
          onOpenPresets={() => setPresetsOpen(true)}
          onReset={() => setConfirmResetOpen(true)}
          onRowsModeChange={setRowsMode}
          onAdjustRows={adjustMinRows}
          onCancel={() => {
            setLibraryOpen(false);
            if (isDirty) setConfirmCancelOpen(true);
            else cancelEditing();
          }}
          onSave={() => {
            if (saveDraft()) {
              setLibraryOpen(false);
              toast.success("Dashboard personalizado guardado");
            }
          }}
        />
      ) : (
        <div className="nc-dashboard-kpi-action-row">
          <button type="button" className="nc-dashboard-kpi-action" onClick={startEditing}>
            <Settings size={14} strokeWidth={2} aria-hidden="true" />
            <span>Reordenar / ocultar métricas</span>
          </button>
        </div>
      )}

      {layoutError && <div className="nc-dashboard-data-status nc-dashboard-data-status--error" role="alert">{layoutError}</div>}

      <div className="nc-dashboard-editor-canvas" data-library-open={libraryOpen || undefined}>
        <EditableDashboardGrid
          preferences={visiblePreferences}
          editing={isEditing}
          highlightedWidgetId={highlightedWidgetId}
          renderWidget={renderWidget}
          onLayoutChange={updateLayout}
          onConfigure={openWidgetConfiguration}
          onDuplicate={duplicateWidget}
          onHide={toggleWidgetHidden}
          onRemove={removeWidget}
          onMove={moveWidgetInOrder}
        />

        <WidgetLibraryPanel
          open={libraryOpen}
          widgets={draft?.widgets ?? visiblePreferences.widgets}
          customKpis={(draft?.customKpis ?? visiblePreferences.customKpis).filter((config) => canUseCustomKpi(config, role))}
          canUseDefinition={(definition) => canUseDashboardDefinition(definition, role)}
          onOpenChange={setLibraryOpen}
          onAdd={handleAddWidget}
          onCreateCustom={() => {
            setCustomKpiEditInstanceId(null);
            setCustomKpiLibraryEditId(null);
            setCustomKpiOpen(true);
          }}
          onEditCustom={(customKpiId) => {
            setLibraryOpen(false);
            setCustomKpiEditInstanceId(null);
            setCustomKpiLibraryEditId(customKpiId);
            window.setTimeout(() => setCustomKpiOpen(true), 0);
          }}
          onDeleteCustom={(customKpiId) => {
            setLibraryOpen(false);
            setCustomKpiDeleteId(customKpiId);
          }}
        />
      </div>

      <WidgetConfigDialog
        widget={configuredWidget}
        position={configuredWidget
          ? visiblePreferences.layout.find((position) => position.i === configuredWidget.instanceId) ?? null
          : null}
        onOpenChange={(open) => { if (!open) setConfigWidgetId(null); }}
        onSave={(instanceId, config, size) => {
          updateWidget(instanceId, config);
          if (size) setWidgetSize(instanceId, size);
        }}
      />

      <DashboardPresetDialog
        open={presetsOpen}
        activePresetId={visiblePreferences.activePresetId}
        onOpenChange={setPresetsOpen}
        onApply={applyPreset}
      />

      <CustomKpiBuilder
        open={customKpiOpen}
        initialConfig={customKpiInitialConfig}
        canUseSource={canUseKpiSource}
        onOpenChange={(open) => {
          setCustomKpiOpen(open);
          if (!open) {
            setCustomKpiEditInstanceId(null);
            setCustomKpiLibraryEditId(null);
          }
        }}
        onCreate={(config) => {
          addCustomKpi(config);
          if (customKpiEditInstanceId) {
            setWidgetSize(customKpiEditInstanceId, config.size);
            toast.success("KPI personalizado actualizado");
          } else if (customKpiLibraryEditId) {
            toast.success("KPI personalizado actualizado");
          } else {
            const previousIds = new Set(useDashboardLayoutStore.getState().draft?.widgets.map((widget) => widget.instanceId));
            addWidget("customKpi", config.id, config.size);
            const addedWidget = [...(useDashboardLayoutStore.getState().draft?.widgets ?? [])]
              .reverse()
              .find((widget) => !previousIds.has(widget.instanceId) && widget.config.customKpiId === config.id);
            if (addedWidget) revealWidgetInGrid(addedWidget.instanceId);
            toast.success("KPI personalizado agregado");
          }
        }}
      />

      <ConfirmDialog
        open={Boolean(customKpiDeleteConfig)}
        onOpenChange={(open) => { if (!open) setCustomKpiDeleteId(null); }}
        title="¿Eliminar este KPI personalizado?"
        description={customKpiDeleteConfig
          ? `${customKpiDeleteConfig.name} y sus widgets asociados se eliminarán del borrador.`
          : undefined}
        confirmLabel="Eliminar KPI"
        tone="warning"
        onConfirm={() => {
          if (customKpiDeleteId) removeCustomKpi(customKpiDeleteId);
          setCustomKpiDeleteId(null);
        }}
      />

      <ConfirmDialog
        open={confirmCancelOpen}
        onOpenChange={setConfirmCancelOpen}
        title="¿Descartar los cambios?"
        description="El dashboard volverá a la última configuración guardada."
        confirmLabel="Descartar cambios"
        tone="warning"
        onConfirm={() => {
          cancelEditing();
          setConfirmCancelOpen(false);
        }}
      />

      <ConfirmDialog
        open={confirmResetOpen}
        onOpenChange={setConfirmResetOpen}
        title="¿Restaurar el dashboard predeterminado?"
        description="Se reemplazará el acomodo del borrador. Tus KPIs personalizados seguirán disponibles en la biblioteca."
        confirmLabel="Restaurar"
        tone="warning"
        onConfirm={() => {
          applyPreset("default");
          setConfirmResetOpen(false);
        }}
      />
    </DashboardShell>
  );
}
