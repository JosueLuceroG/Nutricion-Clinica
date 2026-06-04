import type { MealSlot } from "@modules/mealplan/domain/MealSlot";
import type { ConsultationStatus } from "@modules/consultation/domain/ConsultationStatus";

export interface PdfFoodInfo {
  id: string;
  name: string;
  groupLabel: string;
  serving: string;
  kcalPerServing: number;
  proteinGPerServing: number;
  carbsGPerServing: number;
  fatGPerServing: number;
}

export interface PdfMealExchange {
  food: PdfFoodInfo;
  count: number;
}

export interface PdfMeal {
  slot: MealSlot;
  exchanges: PdfMealExchange[];
}

export interface PdfMealPlanData {
  patientName: string;
  startDate: string;
  endDate: string | null;
  name: string;
  kcalTarget: number;
  proteinTargetG: number;
  carbsTargetG: number;
  fatTargetG: number;
  meals: PdfMeal[];
  notes: string | null;
}

export interface PdfVitals {
  systolicMmHg: number | null;
  diastolicMmHg: number | null;
  heartRateBpm: number | null;
  temperatureC: number | null;
}

export interface PdfAnthropometrySummary {
  weightKg: number | null;
  heightCm: number | null;
  bmi: number | null;
  measuredAt: string;
}

export interface PdfLabSummary {
  glucose: number | null;
  cholesterol: number | null;
  triglycerides: number | null;
  takenAt: string;
}

export interface PdfConsultationData {
  patientName: string;
  consultationNumber: number;
  consultationDate: string;
  status: ConsultationStatus;
  reason: string;
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  plan: string | null;
  vitals: PdfVitals;
  nextVisitDate: string | null;
  anthropometry: PdfAnthropometrySummary | null;
  labPanel: PdfLabSummary | null;
}

