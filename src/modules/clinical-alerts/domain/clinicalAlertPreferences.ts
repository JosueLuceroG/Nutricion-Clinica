export interface ClinicalAlertRule {
  enabled: boolean;
  lead: number;
}

export interface ClinicalAlertPreferences {
  enabled: boolean;
  popupEnabled: boolean;
  desktopEnabled: boolean;
  upcomingConsultation: ClinicalAlertRule;
  unconfirmedAppointment: ClinicalAlertRule;
  expiringPlan: ClinicalAlertRule;
  pendingPayment: ClinicalAlertRule;
}

export const UPCOMING_CONSULTATION_LEAD_OPTIONS = [5, 10, 15, 30, 45, 60, 120, 1_440] as const;
export const UNCONFIRMED_APPOINTMENT_LEAD_OPTIONS = [1, 2, 4, 8, 12, 24, 48] as const;
export const EXPIRING_PLAN_LEAD_OPTIONS = [1, 3, 5, 7, 14, 30] as const;
export const PENDING_PAYMENT_LEAD_OPTIONS = [0, 1, 3, 7, 14, 30] as const;

export const DEFAULT_CLINICAL_ALERT_PREFERENCES: ClinicalAlertPreferences = {
  enabled: true,
  popupEnabled: true,
  desktopEnabled: false,
  upcomingConsultation: { enabled: true, lead: 10 },
  unconfirmedAppointment: { enabled: true, lead: 24 },
  expiringPlan: { enabled: true, lead: 7 },
  pendingPayment: { enabled: true, lead: 0 },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseRule(
  value: unknown,
  fallback: ClinicalAlertRule,
  validLeads: readonly number[],
): ClinicalAlertRule {
  if (!isRecord(value)) return { ...fallback };
  const lead = typeof value.lead === "number" && validLeads.includes(value.lead)
    ? value.lead
    : fallback.lead;
  return {
    enabled: typeof value.enabled === "boolean" ? value.enabled : fallback.enabled,
    lead,
  };
}

export function createDefaultClinicalAlertPreferences(): ClinicalAlertPreferences {
  return {
    ...DEFAULT_CLINICAL_ALERT_PREFERENCES,
    upcomingConsultation: { ...DEFAULT_CLINICAL_ALERT_PREFERENCES.upcomingConsultation },
    unconfirmedAppointment: { ...DEFAULT_CLINICAL_ALERT_PREFERENCES.unconfirmedAppointment },
    expiringPlan: { ...DEFAULT_CLINICAL_ALERT_PREFERENCES.expiringPlan },
    pendingPayment: { ...DEFAULT_CLINICAL_ALERT_PREFERENCES.pendingPayment },
  };
}

export function parseClinicalAlertPreferences(value: unknown): ClinicalAlertPreferences {
  const fallback = createDefaultClinicalAlertPreferences();
  if (!isRecord(value)) return fallback;

  return {
    enabled: typeof value.enabled === "boolean" ? value.enabled : fallback.enabled,
    popupEnabled: typeof value.popupEnabled === "boolean" ? value.popupEnabled : fallback.popupEnabled,
    desktopEnabled: typeof value.desktopEnabled === "boolean" ? value.desktopEnabled : fallback.desktopEnabled,
    upcomingConsultation: parseRule(
      value.upcomingConsultation,
      fallback.upcomingConsultation,
      UPCOMING_CONSULTATION_LEAD_OPTIONS,
    ),
    unconfirmedAppointment: parseRule(
      value.unconfirmedAppointment,
      fallback.unconfirmedAppointment,
      UNCONFIRMED_APPOINTMENT_LEAD_OPTIONS,
    ),
    expiringPlan: parseRule(
      value.expiringPlan,
      fallback.expiringPlan,
      EXPIRING_PLAN_LEAD_OPTIONS,
    ),
    pendingPayment: parseRule(
      value.pendingPayment,
      fallback.pendingPayment,
      PENDING_PAYMENT_LEAD_OPTIONS,
    ),
  };
}
