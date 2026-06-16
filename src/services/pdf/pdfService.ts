import type { MealPlan } from "@modules/mealplan/domain/MealPlan";
import { GroupNutrition, FoodGroupLabel, type FoodGroup } from "@modules/smae/domain/FoodGroup";
import { Food, type FoodId } from "@modules/smae/domain/Food";
import type { Patient } from "@modules/patient/domain/Patient";
import type { Consultation } from "@modules/consultation/domain/Consultation";
import { generateMealPlanPdf, downloadPdf } from "./generators/mealPlanPdf";
import { generateConsultationPdf } from "./generators/consultationPdf";
import type {
  PdfMealPlanData,
  PdfMeal,
  PdfMealExchange,
  PdfFoodInfo,
  PdfConsultationData,
  PdfVitals,
  PdfAnthropometrySummary,
  PdfLabSummary,
  PdfBrandingOptions,
} from "./types";

type FoodLookupFn = (foodId: FoodId) => Food;

function defaultLookup(foodId: FoodId): Food {
  return Food.reconstitute({ id: foodId, group: "verduras" as FoodGroup, name: foodId, shortName: foodId, serving: "1 raci\u00f3n", servingGrams: 100, keywords: [], custom: false });
}

function toPdfFoodInfo(food: Food): PdfFoodInfo {
  const profile = GroupNutrition[food.group];
  return {
    id: food.id,
    name: food.name,
    groupLabel: FoodGroupLabel[food.group],
    serving: food.serving,
    kcalPerServing: profile.kcal,
    proteinGPerServing: profile.proteinG,
    carbsGPerServing: profile.carbsG,
    fatGPerServing: profile.fatG,
  };
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("es-MX", { year: "numeric", month: "long", day: "numeric" });
}

function toPdfVitals(v: Consultation["vitals"]): PdfVitals {
  return {
    systolicMmHg: v.systolicMmHg,
    diastolicMmHg: v.diastolicMmHg,
    heartRateBpm: v.heartRateBpm,
    temperatureC: v.temperatureC,
  };
}

export type AnthropometryForPdf = { weightKg: number | null; heightCm: number | null; bmi: number | null; measuredAt: Date };
export type LabPanelForPdf = { glucose: number | null; cholesterol: number | null; triglycerides: number | null; takenAt: Date };

export const pdfService = {
  generateMealPlanPdf(
    mealPlan: MealPlan,
    patient: Patient,
    lookupFood: FoodLookupFn = defaultLookup,
  ): PdfMealPlanData {
    const meals: PdfMeal[] = mealPlan.meals.map((pm) => {
      const exchanges: PdfMealExchange[] = pm.exchanges.map((ex) => {
        const food = lookupFood(ex.foodId);
        return { food: toPdfFoodInfo(food), count: ex.count };
      });
      return { slot: pm.slot, exchanges };
    });

    return {
      patientName: patient.fullName,
      startDate: formatDate(mealPlan.startDate),
      endDate: mealPlan.endDate ? formatDate(mealPlan.endDate) : null,
      name: mealPlan.name,
      kcalTarget: mealPlan.kcalTarget,
      proteinTargetG: mealPlan.proteinTargetG,
      carbsTargetG: mealPlan.carbsTargetG,
      fatTargetG: mealPlan.fatTargetG,
      meals,
      notes: mealPlan.notes,
    };
  },

  createPdfDocument(data: PdfMealPlanData, branding?: PdfBrandingOptions) {
    return generateMealPlanPdf(data, branding);
  },

  download(data: PdfMealPlanData, fileName?: string, branding?: PdfBrandingOptions) {
    const doc = generateMealPlanPdf(data, branding);
    downloadPdf(doc, fileName ?? `plan-alimentacion-${data.patientName.replace(/\s+/g, "-").toLowerCase()}.pdf`);
  },

  generateConsultationPdf(
    consultation: Consultation,
    patient: Patient,
    anthropometry: AnthropometryForPdf | null = null,
    labPanel: LabPanelForPdf | null = null,
  ): PdfConsultationData {
    const pdfAnthropometry: PdfAnthropometrySummary | null = anthropometry
      ? {
          weightKg: anthropometry.weightKg,
          heightCm: anthropometry.heightCm,
          bmi: anthropometry.bmi,
          measuredAt: formatDate(anthropometry.measuredAt),
        }
      : null;
    const pdfLab: PdfLabSummary | null = labPanel
      ? {
          glucose: labPanel.glucose,
          cholesterol: labPanel.cholesterol,
          triglycerides: labPanel.triglycerides,
          takenAt: formatDate(labPanel.takenAt),
        }
      : null;
    return {
      patientName: patient.fullName,
      consultationNumber: consultation.consultationNumber,
      consultationDate: formatDate(consultation.consultationDate),
      status: consultation.status,
      reason: consultation.reason,
      subjective: consultation.subjective,
      objective: consultation.objective,
      assessment: consultation.assessment,
      plan: consultation.plan,
      vitals: toPdfVitals(consultation.vitals),
      nextVisitDate: consultation.nextVisitDate ? formatDate(consultation.nextVisitDate) : null,
      anthropometry: pdfAnthropometry,
      labPanel: pdfLab,
    };
  },

  createConsultationPdfDocument(data: PdfConsultationData, branding?: PdfBrandingOptions) {
    return generateConsultationPdf(data, branding);
  },

  downloadConsultation(data: PdfConsultationData, fileName?: string, branding?: PdfBrandingOptions) {
    const doc = generateConsultationPdf(data, branding);
    const safeName = patientSafeName(data.patientName);
    downloadPdf(doc, fileName ?? `consulta-${data.consultationNumber}-${safeName}.pdf`);
  },
};

function patientSafeName(name: string): string {
  return name.replace(/\s+/g, "-").toLowerCase();
}

export type PdfService = typeof pdfService;
