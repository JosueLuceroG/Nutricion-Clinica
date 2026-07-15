import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useTheme } from "@app/providers/ThemeProvider";
import { useAuthStore } from "@store/authStore";
import { useCommandPaletteStore } from "@store/commandPaletteStore";
import { usePreferencesStore } from "@store/preferencesStore";
import { useQuickNotesStore } from "@store/quickNotesStore";
import type { DashboardQuickAccessActionId } from "../domain";
import {
  getDashboardQuickAccessAvailability,
  getDashboardQuickAccessDefinition,
} from "./dashboardQuickAccessRegistry";

interface ExecutorOptions {
  onCustomizeDashboard?: () => void;
  dashboardEditing?: boolean;
}

export type DashboardQuickAccessExecutionResult =
  | { status: "executed" }
  | { status: "disabled"; reasonKey?: string };

function currentLocalDateKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function useDashboardQuickAccessExecutor(options: ExecutorOptions = {}) {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const { setTheme } = useTheme();
  const role = useAuthStore((state) => state.user?.rol ?? null);
  const sucursalId = useAuthStore((state) => state.sucursalActivaId);
  const setLanguage = usePreferencesStore((state) => state.setLanguage);
  const setCommandPaletteOpen = useCommandPaletteStore(
    (state) => state.setOpen,
  );
  const openCommandPaletteWithIntent = useCommandPaletteStore(
    (state) => state.openWithIntent,
  );
  const toggleQuickNotes = useQuickNotesStore((state) => state.togglePanel);
  const createQuickNote = useQuickNotesStore((state) => state.beginCreate);

  const executeAction = (
    actionId: DashboardQuickAccessActionId,
  ): DashboardQuickAccessExecutionResult => {
    const definition = getDashboardQuickAccessDefinition(actionId);
    const availability = getDashboardQuickAccessAvailability(definition, {
      role,
      sucursalId,
      dashboardEditing: options.dashboardEditing,
      dashboardCustomizerAvailable: Boolean(options.onCustomizeDashboard),
    });
    if (!availability.enabled) {
      return { status: "disabled", reasonKey: availability.reasonKey };
    }

    const execution = definition.execution;
    if (execution.kind === "navigate") navigate(execution.to);
    if (execution.kind === "agenda-today") {
      navigate(`/agenda?date=${currentLocalDateKey()}`);
    }
    if (execution.kind === "dashboard-customize") {
      options.onCustomizeDashboard?.();
    }
    if (execution.kind === "command-palette") {
      if (execution.intent) openCommandPaletteWithIntent(execution.intent);
      else setCommandPaletteOpen(true);
    }
    if (execution.kind === "quick-notes") {
      if (execution.command === "create") createQuickNote();
      else toggleQuickNotes();
    }
    if (execution.kind === "theme") setTheme(execution.theme);
    if (execution.kind === "language-toggle") {
      const nextLanguage = i18n.language.startsWith("es") ? "en-US" : "es-MX";
      setLanguage(nextLanguage);
      void i18n.changeLanguage(nextLanguage);
    }
    if (execution.kind === "unavailable") {
      return {
        status: "disabled",
        reasonKey: "dashboardQuickAccess.reasons.comingSoon",
      };
    }
    return { status: "executed" };
  };

  return { executeAction };
}
