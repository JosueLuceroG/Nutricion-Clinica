import * as React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { db } from "@services/db";
import { rowMatchesSucursal } from "@services/tenancy/sucursalScope";
import { useAuthStore } from "@store/authStore";
import { usePreferencesStore } from "@store/preferencesStore";
import {
  clinicalAlertPreferencesStorageKey,
  useClinicalAlertPreferencesStore,
} from "@store/clinicalAlertPreferencesStore";
import {
  notificationStorageKey,
  useNotificationStore,
  type DashboardNotification,
  type NotificationTone,
  type NotificationType,
} from "@store/notificationStore";
import { buildClinicalAlertCandidates } from "../domain/buildClinicalAlerts";
import { sendDesktopNotification } from "../infrastructure/desktopNotificationService";
import { canonicalSyncId } from "@nutriclinica/shared";

const ALERT_CLOCK_INTERVAL_MS = 30_000;
const MAX_IMMEDIATE_POPUPS = 3;

function toLocalDateKey(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "NC";
}

export function ClinicalAlertController() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const authBranchId = useAuthStore((state) => state.sucursalActivaId);
  const branchId = authBranchId ? canonicalSyncId(authBranchId) : null;
  const currency = usePreferencesStore((state) => state.currency);
  const preferenceScopeKey = useClinicalAlertPreferencesStore((state) => state.scopeKey);
  const preferenceHydrationStatus = useClinicalAlertPreferencesStore((state) => state.hydrationStatus);
  const preferences = useClinicalAlertPreferencesStore((state) => state.preferences);
  const activatePreferenceScope = useClinicalAlertPreferencesStore((state) => state.activateScope);
  const deactivatePreferenceScope = useClinicalAlertPreferencesStore((state) => state.deactivateScope);
  const notificationScopeKey = useNotificationStore((state) => state.scopeKey);
  const notificationHydrationStatus = useNotificationStore((state) => state.hydrationStatus);
  const syncClinicalAlerts = useNotificationStore((state) => state.syncClinicalAlerts);
  const [clock, setClock] = React.useState(() => Date.now());
  const expectedPreferenceScopeKey = userId
    ? clinicalAlertPreferencesStorageKey({ userId, sucursalId: branchId })
    : null;
  const expectedNotificationScopeKey = userId
    ? notificationStorageKey({ userId, sucursalId: branchId })
    : null;
  const scopesReady =
    preferenceHydrationStatus === "ready" &&
    preferenceScopeKey === expectedPreferenceScopeKey &&
    notificationHydrationStatus === "ready" &&
    notificationScopeKey === expectedNotificationScopeKey;
  const clockDateKey = toLocalDateKey(new Date(clock));
  const maximumAppointmentLeadDays = Math.ceil(
    Math.max(
      preferences.upcomingConsultation.lead / (24 * 60),
      preferences.unconfirmedAppointment.lead / 24,
    ),
  );

  React.useLayoutEffect(() => {
    if (!userId) {
      deactivatePreferenceScope();
      return;
    }
    activatePreferenceScope({ userId, sucursalId: branchId });
  }, [activatePreferenceScope, branchId, deactivatePreferenceScope, userId]);

  React.useEffect(() => {
    const interval = window.setInterval(() => setClock(Date.now()), ALERT_CLOCK_INTERVAL_MS);
    const refreshClock = () => setClock(Date.now());
    window.addEventListener("focus", refreshClock);
    document.addEventListener("visibilitychange", refreshClock);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshClock);
      document.removeEventListener("visibilitychange", refreshClock);
    };
  }, []);

  React.useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      const state = useClinicalAlertPreferencesStore.getState();
      if (!state.scope || event.key !== state.scopeKey) return;
      state.activateScope(state.scope);
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const rows = useLiveQuery(async () => {
    if (!scopesReady || !branchId) return null;
    if (!preferences.enabled) {
      return { patients: [], appointments: [], mealPlans: [], consultations: [] };
    }

    const queryStart = new Date(`${clockDateKey}T00:00:00`);
    const [patients, appointments, mealPlans, consultations] = await Promise.all([
      db.patients.filter((row) => row.deleted_at === null && rowMatchesSucursal(row, branchId)).toArray(),
      db.appointments
        .where("date")
        .between(
          clockDateKey,
          toLocalDateKey(addDays(queryStart, maximumAppointmentLeadDays + 1)),
          true,
          true,
        )
        .filter((row) => rowMatchesSucursal({ sucursal_id: row.office_id }, branchId))
        .toArray(),
      db.meal_plans.filter((row) => row.deleted_at === null && rowMatchesSucursal(row, branchId)).toArray(),
      db.consultations.filter((row) => row.deleted_at === null && rowMatchesSucursal(row, branchId)).toArray(),
    ]);
    return { patients, appointments, mealPlans, consultations };
  }, [branchId, clockDateKey, maximumAppointmentLeadDays, preferences.enabled, scopesReady]);

  const notifications = React.useMemo(() => {
    if (!rows || !branchId || !scopesReady) return null;
    const now = new Date(clock);
    const candidates = buildClinicalAlertCandidates({
      now,
      branchId,
      preferences,
      patients: rows.patients,
      appointments: rows.appointments,
      mealPlans: rows.mealPlans,
      consultations: rows.consultations,
    });
    const locale = i18n.language || "es-MX";
    const timeFormatter = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" });
    const currencyFormatter = new Intl.NumberFormat(locale, { style: "currency", currency });

    return candidates.map((candidate): DashboardNotification => {
      let type: NotificationType = "system";
      let tone: NotificationTone = "blue";
      let title = t("clinicalAlerts.upcoming_title");
      let message = t("clinicalAlerts.upcoming_message", {
        patient: candidate.patientName,
        time: timeFormatter.format(new Date(candidate.occursAt)),
        minutes: candidate.minutesUntil ?? 0,
      });
      let category = t("clinicalAlerts.category_agenda");
      let timeAgo = t("clinicalAlerts.in_minutes", { count: candidate.minutesUntil ?? 0 });

      if (candidate.kind === "unconfirmed-appointment") {
        type = "consultation";
        tone = "aqua";
        title = t("clinicalAlerts.unconfirmed_title");
        message = t("clinicalAlerts.unconfirmed_message", {
          patient: candidate.patientName,
          hours: candidate.hoursUntil ?? 0,
        });
        timeAgo = t("clinicalAlerts.in_hours", { count: candidate.hoursUntil ?? 0 });
      } else if (candidate.kind === "expiring-plan") {
        type = "nutrition_plan";
        tone = "teal";
        title = (candidate.daysUntil ?? 0) < 0
          ? t("clinicalAlerts.expired_plan_title")
          : t("clinicalAlerts.expiring_plan_title");
        message = (candidate.daysUntil ?? 0) < 0
          ? t("clinicalAlerts.expired_plan_message", { patient: candidate.patientName })
          : t("clinicalAlerts.expiring_plan_message", {
              patient: candidate.patientName,
              days: candidate.daysUntil ?? 0,
            });
        category = t("clinicalAlerts.category_plans");
        timeAgo = (candidate.daysUntil ?? 0) < 0
          ? t("clinicalAlerts.overdue")
          : t("clinicalAlerts.in_days", { count: candidate.daysUntil ?? 0 });
      } else if (candidate.kind === "pending-payment") {
        type = "payment";
        tone = "slate";
        title = t("clinicalAlerts.pending_payment_title");
        message = t("clinicalAlerts.pending_payment_message", {
          patient: candidate.patientName,
          amount: currencyFormatter.format(candidate.remainingAmount ?? 0),
        });
        category = t("clinicalAlerts.category_billing");
        timeAgo = t("clinicalAlerts.pending");
      }

      return {
        id: candidate.id,
        type,
        initials: initials(candidate.patientName),
        tone,
        personName: title,
        patientName: candidate.patientName,
        message,
        category,
        timeAgo,
        read: false,
        archived: false,
        source: "clinical-alert",
        targetRoute: candidate.targetRoute,
        occursAt: candidate.occursAt,
      };
    });
  }, [branchId, clock, currency, i18n.language, preferences, rows, scopesReady, t]);

  React.useEffect(() => {
    if (!notifications || !scopesReady) return;
    const existingAlerts = useNotificationStore.getState().items
      .filter((notification) => notification.source === "clinical-alert");
    const existingIds = new Set(existingAlerts.map((notification) => notification.id));
    const newNotifications = notifications.filter((notification) => !existingIds.has(notification.id));
    const notificationsChanged =
      existingAlerts.length !== notifications.length ||
      notifications.some((notification) => {
        const existing = existingAlerts.find((item) => item.id === notification.id);
        return !existing ||
          existing.message !== notification.message ||
          existing.timeAgo !== notification.timeAgo ||
          existing.targetRoute !== notification.targetRoute;
      });
    if (notificationsChanged) syncClinicalAlerts(notifications);
    if (newNotifications.length === 0) return;

    newNotifications.slice(0, MAX_IMMEDIATE_POPUPS).forEach((notification) => {
      if (preferences.popupEnabled) {
        toast.warning(notification.personName, {
          id: notification.id,
          description: notification.message,
          duration: 12_000,
          position: "top-center",
          action: notification.targetRoute
            ? { label: t("clinicalAlerts.view"), onClick: () => navigate(notification.targetRoute!) }
            : undefined,
        });
      }
      if (preferences.desktopEnabled) {
        void sendDesktopNotification(notification.personName ?? "NutriClinica", notification.message).catch(() => undefined);
      }
    });

    if (preferences.popupEnabled && newNotifications.length > MAX_IMMEDIATE_POPUPS) {
      toast.info(t("clinicalAlerts.more_alerts_title"), {
        description: t("clinicalAlerts.more_alerts_message", {
          count: newNotifications.length - MAX_IMMEDIATE_POPUPS,
        }),
        position: "top-center",
        action: { label: t("clinicalAlerts.view"), onClick: () => navigate("/notificaciones") },
      });
    }
  }, [navigate, notifications, preferences.desktopEnabled, preferences.popupEnabled, scopesReady, syncClinicalAlerts, t]);

  return null;
}
