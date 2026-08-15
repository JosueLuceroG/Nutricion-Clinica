import * as React from "react";
import { BellRing, MonitorSmartphone, RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card";
import { Label } from "@components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@components/ui/select";
import { Switch } from "@components/ui/switch";
import { useAuthStore } from "@store/authStore";
import {
  clinicalAlertPreferencesStorageKey,
  useClinicalAlertPreferencesStore,
} from "@store/clinicalAlertPreferencesStore";
import {
  EXPIRING_PLAN_LEAD_OPTIONS,
  PENDING_PAYMENT_LEAD_OPTIONS,
  UNCONFIRMED_APPOINTMENT_LEAD_OPTIONS,
  UPCOMING_CONSULTATION_LEAD_OPTIONS,
  type ClinicalAlertPreferences,
} from "../domain/clinicalAlertPreferences";
import {
  isDesktopNotificationAvailable,
  requestDesktopNotificationPermission,
} from "../infrastructure/desktopNotificationService";

type RuleKey = "upcomingConsultation" | "unconfirmedAppointment" | "expiringPlan" | "pendingPayment";

interface RuleRowProps {
  id: string;
  title: string;
  description: string;
  enabled: boolean;
  lead: number;
  options: readonly number[];
  formatLead: (value: number) => string;
  disabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  onLeadChange: (lead: number) => void;
}

function RuleRow({
  id,
  title,
  description,
  enabled,
  lead,
  options,
  formatLead,
  disabled,
  onEnabledChange,
  onLeadChange,
}: RuleRowProps) {
  return (
    <div className="grid gap-3 rounded-xl border bg-muted/15 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
      <div className="min-w-0 space-y-1">
        <Label htmlFor={id} className="text-sm font-semibold">{title}</Label>
        <p className="text-xs leading-5 text-muted-foreground">{description}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3 sm:justify-end">
        <Select
          value={String(lead)}
          onValueChange={(value) => onLeadChange(Number(value))}
          disabled={disabled || !enabled}
        >
          <SelectTrigger className="w-36" aria-label={title}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((value) => (
              <SelectItem key={value} value={String(value)}>{formatLead(value)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Switch
          id={id}
          checked={enabled}
          onCheckedChange={onEnabledChange}
          disabled={disabled}
          aria-label={title}
        />
      </div>
    </div>
  );
}

export function ClinicalAlertsSettingsCard() {
  const { t } = useTranslation();
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const branchId = useAuthStore((state) => state.sucursalActivaId);
  const scopeKey = useClinicalAlertPreferencesStore((state) => state.scopeKey);
  const hydrationStatus = useClinicalAlertPreferencesStore((state) => state.hydrationStatus);
  const preferences = useClinicalAlertPreferencesStore((state) => state.preferences);
  const error = useClinicalAlertPreferencesStore((state) => state.error);
  const savePreferences = useClinicalAlertPreferencesStore((state) => state.savePreferences);
  const resetPreferences = useClinicalAlertPreferencesStore((state) => state.resetPreferences);
  const [requestingDesktopPermission, setRequestingDesktopPermission] = React.useState(false);
  const expectedScopeKey = userId
    ? clinicalAlertPreferencesStorageKey({ userId, sucursalId: branchId })
    : null;
  const ready = hydrationStatus === "ready" && scopeKey === expectedScopeKey;
  const desktopAvailable = isDesktopNotificationAvailable();

  const save = (next: ClinicalAlertPreferences) => {
    if (!savePreferences(next)) toast.error(t("clinicalAlerts.save_error"));
  };
  const updateRule = (key: RuleKey, patch: Partial<ClinicalAlertPreferences[RuleKey]>) => {
    save({ ...preferences, [key]: { ...preferences[key], ...patch } });
  };
  const toggleDesktop = async (enabled: boolean) => {
    if (!enabled) {
      save({ ...preferences, desktopEnabled: false });
      return;
    }
    if (!desktopAvailable) {
      toast.info(t("clinicalAlerts.desktop_only"));
      return;
    }
    setRequestingDesktopPermission(true);
    try {
      const granted = await requestDesktopNotificationPermission();
      if (!granted) {
        toast.error(t("clinicalAlerts.desktop_permission_denied"));
        return;
      }
      save({ ...preferences, desktopEnabled: true });
      toast.success(t("clinicalAlerts.desktop_enabled"));
    } catch (cause) {
      toast.error(t("clinicalAlerts.desktop_permission_error"), {
        description: cause instanceof Error ? cause.message : String(cause),
      });
    } finally {
      setRequestingDesktopPermission(false);
    }
  };

  return (
    <Card
      data-settings-section="clinical-alerts"
      data-testid="clinical-alerts-settings"
      tabIndex={-1}
      className="scroll-mt-6 focus:outline-none focus:ring-2 focus:ring-primary/40 md:col-span-2"
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BellRing className="h-5 w-5" />
          {t("clinicalAlerts.settings_title")}
        </CardTitle>
        <CardDescription>{t("clinicalAlerts.settings_description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-col gap-3 rounded-xl border border-primary/20 bg-primary/[0.035] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <Label htmlFor="clinical-alerts-enabled" className="font-semibold">
              {t("clinicalAlerts.master_title")}
            </Label>
            <p className="text-sm text-muted-foreground">{t("clinicalAlerts.master_description")}</p>
          </div>
          <Switch
            id="clinical-alerts-enabled"
            checked={preferences.enabled}
            onCheckedChange={(enabled) => save({ ...preferences, enabled })}
            disabled={!ready}
            aria-label={t("clinicalAlerts.master_title")}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-center justify-between gap-4 rounded-xl border p-4">
            <div>
              <Label htmlFor="clinical-alerts-popup">{t("clinicalAlerts.popup_title")}</Label>
              <p className="mt-1 text-xs text-muted-foreground">{t("clinicalAlerts.popup_description")}</p>
            </div>
            <Switch
              id="clinical-alerts-popup"
              checked={preferences.popupEnabled}
              onCheckedChange={(popupEnabled) => save({ ...preferences, popupEnabled })}
              disabled={!ready || !preferences.enabled}
            />
          </div>
          <div className="flex items-center justify-between gap-4 rounded-xl border p-4">
            <div>
              <Label htmlFor="clinical-alerts-desktop" className="flex items-center gap-2">
                <MonitorSmartphone className="h-4 w-4" />
                {t("clinicalAlerts.desktop_title")}
              </Label>
              <p className="mt-1 text-xs text-muted-foreground">
                {desktopAvailable ? t("clinicalAlerts.desktop_description") : t("clinicalAlerts.desktop_only")}
              </p>
            </div>
            <Switch
              id="clinical-alerts-desktop"
              checked={preferences.desktopEnabled}
              onCheckedChange={(enabled) => void toggleDesktop(enabled)}
              disabled={!ready || !preferences.enabled || requestingDesktopPermission || !desktopAvailable}
            />
          </div>
        </div>

        <div className="space-y-3">
          <RuleRow
            id="alert-upcoming-consultation"
            title={t("clinicalAlerts.upcoming_rule_title")}
            description={t("clinicalAlerts.upcoming_rule_description")}
            enabled={preferences.upcomingConsultation.enabled}
            lead={preferences.upcomingConsultation.lead}
            options={UPCOMING_CONSULTATION_LEAD_OPTIONS}
            formatLead={(value) => t("clinicalAlerts.minutes_value", { count: value })}
            disabled={!ready || !preferences.enabled}
            onEnabledChange={(enabled) => updateRule("upcomingConsultation", { enabled })}
            onLeadChange={(lead) => updateRule("upcomingConsultation", { lead })}
          />
          <RuleRow
            id="alert-unconfirmed-appointment"
            title={t("clinicalAlerts.unconfirmed_rule_title")}
            description={t("clinicalAlerts.unconfirmed_rule_description")}
            enabled={preferences.unconfirmedAppointment.enabled}
            lead={preferences.unconfirmedAppointment.lead}
            options={UNCONFIRMED_APPOINTMENT_LEAD_OPTIONS}
            formatLead={(value) => t("clinicalAlerts.hours_value", { count: value })}
            disabled={!ready || !preferences.enabled}
            onEnabledChange={(enabled) => updateRule("unconfirmedAppointment", { enabled })}
            onLeadChange={(lead) => updateRule("unconfirmedAppointment", { lead })}
          />
          <RuleRow
            id="alert-expiring-plan"
            title={t("clinicalAlerts.expiring_plan_rule_title")}
            description={t("clinicalAlerts.expiring_plan_rule_description")}
            enabled={preferences.expiringPlan.enabled}
            lead={preferences.expiringPlan.lead}
            options={EXPIRING_PLAN_LEAD_OPTIONS}
            formatLead={(value) => t("clinicalAlerts.days_value", { count: value })}
            disabled={!ready || !preferences.enabled}
            onEnabledChange={(enabled) => updateRule("expiringPlan", { enabled })}
            onLeadChange={(lead) => updateRule("expiringPlan", { lead })}
          />
          <RuleRow
            id="alert-pending-payment"
            title={t("clinicalAlerts.pending_payment_rule_title")}
            description={t("clinicalAlerts.pending_payment_rule_description")}
            enabled={preferences.pendingPayment.enabled}
            lead={preferences.pendingPayment.lead}
            options={PENDING_PAYMENT_LEAD_OPTIONS}
            formatLead={(value) => value === 0 ? t("clinicalAlerts.immediately") : t("clinicalAlerts.days_value", { count: value })}
            disabled={!ready || !preferences.enabled}
            onEnabledChange={(enabled) => updateRule("pendingPayment", { enabled })}
            onLeadChange={(lead) => updateRule("pendingPayment", { lead })}
          />
        </div>

        {error && <p className="text-sm text-destructive" role="alert">{t("clinicalAlerts.save_error")}: {error}</p>}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <p className="text-xs text-muted-foreground">{t("clinicalAlerts.scope_hint")}</p>
          <Button type="button" variant="outline" onClick={() => resetPreferences()} disabled={!ready}>
            <RotateCcw className="mr-2 h-4 w-4" />
            {t("clinicalAlerts.restore_defaults")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
