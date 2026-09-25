import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PatientRecordNumberConfig } from "@modules/patient/application/patientRecordNumber";

export type UsageMode = "beginner" | "normal";
export type SubscriptionPlan = "free" | "premium";
export type DashboardWidgetId =
  | "activePatients"
  | "consultationsThisMonth"
  | "activePlans"
  | "pendingSync"
  | "pendingPayments"
  | "incomeThisMonth"
  | "pendingPaymentsCount";

export const DEFAULT_DASHBOARD_WIDGET_IDS: DashboardWidgetId[] = [
  "activePatients",
  "consultationsThisMonth",
  "activePlans",
  "pendingSync",
  "pendingPayments",
  "incomeThisMonth",
  "pendingPaymentsCount",
];

export type DashboardPremiumKpiId =
  | "activePatients"
  | "consultationsToday"
  | "incomeThisMonth"
  | "pendingPayments";

export const DEFAULT_DASHBOARD_PREMIUM_KPI_IDS: DashboardPremiumKpiId[] = [
  "activePatients",
  "consultationsToday",
  "incomeThisMonth",
  "pendingPayments",
];

export type ClinicalSectionId =
  | "allergies"
  | "medications"
  | "clinicalEvents"
  | "familyHistory"
  | "personalHistory"
  | "habits"
  | "physicalActivity"
  | "dietHistory"
  | "intolerances"
  | "surgeries"
  | "hospitalizations"
  | "supplements"
  | "foodFrequency"
  | "giSymptoms"
  | "aiConsent";

export const DEFAULT_CLINICAL_SECTION_IDS: ClinicalSectionId[] = [
  "allergies",
  "medications",
  "clinicalEvents",
  "familyHistory",
  "personalHistory",
  "habits",
  "physicalActivity",
  "dietHistory",
  "intolerances",
  "surgeries",
  "hospitalizations",
  "supplements",
  "foodFrequency",
  "giSymptoms",
  "aiConsent",
];

export type AIProviderType = "ollama" | "openai";

export interface PreferencesState {
  language: "es-MX" | "en-US";
  dateFormat: "dd/MM/yyyy" | "MM/dd/yyyy" | "yyyy-MM-dd";
  currency: "MXN" | "USD" | "EUR";
  decimalPlaces: 1 | 2;
  usageMode: UsageMode;
  aiEnabled: boolean;
  aiProvider: AIProviderType;
  subscriptionPlan: SubscriptionPlan;
  pdfBrandingEnabled: boolean;
  clinicDisplayName: string;
  dashboardWidgetIds: DashboardWidgetId[];
  dashboardPremiumKpiOrder: DashboardPremiumKpiId[];
  dashboardPremiumKpiHiddenIds: DashboardPremiumKpiId[];
  clinicalSectionIds: ClinicalSectionId[];
  patientRecordNumberConfig: PatientRecordNumberConfig | null;
  patientRecordNumberNextSequence: number;
  setLanguage: (lang: PreferencesState["language"]) => void;
  setDateFormat: (format: PreferencesState["dateFormat"]) => void;
  setCurrency: (currency: PreferencesState["currency"]) => void;
  setDecimalPlaces: (decimals: PreferencesState["decimalPlaces"]) => void;
  setUsageMode: (mode: UsageMode) => void;
  setAiEnabled: (enabled: boolean) => void;
  setAiProvider: (provider: AIProviderType) => void;
  setSubscriptionPlan: (plan: SubscriptionPlan) => void;
  setPdfBrandingEnabled: (enabled: boolean) => void;
  setClinicDisplayName: (name: string) => void;
  setDashboardWidgetIds: (ids: DashboardWidgetId[]) => void;
  resetDashboardWidgets: () => void;
  setDashboardPremiumKpiOrder: (ids: DashboardPremiumKpiId[]) => void;
  setDashboardPremiumKpiHiddenIds: (ids: DashboardPremiumKpiId[]) => void;
  resetDashboardPremiumKpis: () => void;
  setClinicalSectionIds: (ids: ClinicalSectionId[]) => void;
  resetClinicalSections: () => void;
  setPatientRecordNumberConfig: (
    config: PatientRecordNumberConfig | null,
  ) => void;
  advancePatientRecordNumberSequence: () => void;
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      language: "es-MX",
      dateFormat: "dd/MM/yyyy",
      currency: "MXN",
      decimalPlaces: 1,
      usageMode: "normal",
      aiEnabled: false,
      aiProvider: "ollama",
      subscriptionPlan: "free",
      pdfBrandingEnabled: true,
      clinicDisplayName: "NutriClinica",
      dashboardWidgetIds: [],
      dashboardPremiumKpiOrder: DEFAULT_DASHBOARD_PREMIUM_KPI_IDS,
      dashboardPremiumKpiHiddenIds: [],
      clinicalSectionIds: DEFAULT_CLINICAL_SECTION_IDS,
      patientRecordNumberConfig: null,
      patientRecordNumberNextSequence: 1,
      setLanguage: (language) => set({ language }),
      setDateFormat: (dateFormat) => set({ dateFormat }),
      setCurrency: (currency) => set({ currency }),
      setDecimalPlaces: (decimalPlaces) => set({ decimalPlaces }),
      setUsageMode: (usageMode) => set({ usageMode }),
      setAiEnabled: (aiEnabled) => set({ aiEnabled }),
      setAiProvider: (aiProvider) => set({ aiProvider }),
      setSubscriptionPlan: (subscriptionPlan) => set({ subscriptionPlan }),
      setPdfBrandingEnabled: (pdfBrandingEnabled) => set({ pdfBrandingEnabled }),
      setClinicDisplayName: (clinicDisplayName) => set({ clinicDisplayName }),
      setDashboardWidgetIds: (dashboardWidgetIds) => set({ dashboardWidgetIds }),
      resetDashboardWidgets: () => set({ dashboardWidgetIds: DEFAULT_DASHBOARD_WIDGET_IDS }),
      setDashboardPremiumKpiOrder: (dashboardPremiumKpiOrder) => set({ dashboardPremiumKpiOrder }),
      setDashboardPremiumKpiHiddenIds: (dashboardPremiumKpiHiddenIds) => set({ dashboardPremiumKpiHiddenIds }),
      resetDashboardPremiumKpis: () => set({
        dashboardPremiumKpiOrder: DEFAULT_DASHBOARD_PREMIUM_KPI_IDS,
        dashboardPremiumKpiHiddenIds: [],
      }),
      setClinicalSectionIds: (clinicalSectionIds) => set({ clinicalSectionIds }),
      resetClinicalSections: () => set({ clinicalSectionIds: DEFAULT_CLINICAL_SECTION_IDS }),
      setPatientRecordNumberConfig: (patientRecordNumberConfig) =>
        set({ patientRecordNumberConfig }),
      advancePatientRecordNumberSequence: () =>
        set((state) => ({
          patientRecordNumberNextSequence:
            Math.max(1, state.patientRecordNumberNextSequence) + 1,
        })),
    }),
    { name: "preferences-store" },
  ),
);
