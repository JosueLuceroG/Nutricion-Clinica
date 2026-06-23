import { create } from "zustand";
import { persist } from "zustand/middleware";

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
  openAiApiKey: string;
  openAiModel: string;
  subscriptionPlan: SubscriptionPlan;
  pdfBrandingEnabled: boolean;
  clinicDisplayName: string;
  dashboardWidgetIds: DashboardWidgetId[];
  dashboardPremiumKpiOrder: DashboardPremiumKpiId[];
  dashboardPremiumKpiHiddenIds: DashboardPremiumKpiId[];
  clinicalSectionIds: ClinicalSectionId[];
  setLanguage: (lang: PreferencesState["language"]) => void;
  setDateFormat: (format: PreferencesState["dateFormat"]) => void;
  setCurrency: (currency: PreferencesState["currency"]) => void;
  setDecimalPlaces: (decimals: PreferencesState["decimalPlaces"]) => void;
  setUsageMode: (mode: UsageMode) => void;
  setAiEnabled: (enabled: boolean) => void;
  setAiProvider: (provider: AIProviderType) => void;
  setOpenAiApiKey: (key: string) => void;
  setOpenAiModel: (model: string) => void;
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
      openAiApiKey: "",
      openAiModel: "gpt-4o-mini",
      subscriptionPlan: "free",
      pdfBrandingEnabled: true,
      clinicDisplayName: "NutriClinica",
      dashboardWidgetIds: [],
      dashboardPremiumKpiOrder: DEFAULT_DASHBOARD_PREMIUM_KPI_IDS,
      dashboardPremiumKpiHiddenIds: [],
      clinicalSectionIds: DEFAULT_CLINICAL_SECTION_IDS,
      setLanguage: (language) => set({ language }),
      setDateFormat: (dateFormat) => set({ dateFormat }),
      setCurrency: (currency) => set({ currency }),
      setDecimalPlaces: (decimalPlaces) => set({ decimalPlaces }),
      setUsageMode: (usageMode) => set({ usageMode }),
      setAiEnabled: (aiEnabled) => set({ aiEnabled }),
      setAiProvider: (aiProvider) => set({ aiProvider }),
      setOpenAiApiKey: (openAiApiKey) => set({ openAiApiKey }),
      setOpenAiModel: (openAiModel) => set({ openAiModel }),
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
    }),
    { name: "preferences-store" },
  ),
);
