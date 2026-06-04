import { describe, it, expect } from "vitest";
import { pdfService } from "./pdfService";
import { Food } from "@modules/smae/domain/Food";
import type { FoodGroup } from "@modules/smae/domain/FoodGroup";
import type { PdfMealPlanData, PdfMeal, PdfFoodInfo } from "./types";

function makeMockMealPlan() {
  return {
    id: { toString: () => "mp1" },
    patientId: { toString: () => "p1" },
    consultationId: null,
    name: "Plan base",
    description: null,
    startDate: new Date("2026-06-01"),
    endDate: new Date("2026-06-30"),
    kcalTarget: 1800,
    proteinTargetG: 67,
    carbsTargetG: 203,
    fatTargetG: 60,
    meals: [
      {
        slot: "breakfast" as const,
        exchanges: [
          { foodId: "cereal-avena", count: 1.5 },
          { foodId: "fruta-platano", count: 1 },
        ],
      },
      {
        slot: "morning-snack" as const,
        exchanges: [],
      },
      {
        slot: "lunch" as const,
        exchanges: [
          { foodId: "aoa-pechuga-pollo", count: 2 },
          { foodId: "cereal-arroz", count: 2 },
          { foodId: "verdura-brocoli", count: 1 },
        ],
      },
      {
        slot: "afternoon-snack" as const,
        exchanges: [
          { foodId: "fruta-manzana", count: 1 },
        ],
      },
      {
        slot: "dinner" as const,
        exchanges: [
          { foodId: "legum-frijol", count: 1 },
          { foodId: "verdura-zanahoria", count: 1.5 },
        ],
      },
    ],
    notes: "Aumentar consumo de agua a 2L diarios.",
    status: "active" as const,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };
}

function makeMockPatient() {
  return {
    id: { toString: () => "p1" },
    firstName: "Mar\u00eda",
    lastName: "G\u00f3mez L\u00f3pez",
    fullName: "Mar\u00eda G\u00f3mez L\u00f3pez",
    birthDate: new Date("1990-05-15"),
    sex: "female" as const,
    email: null,
    phone: null,
    status: "active" as const,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };
}

function makeMockLookup() {
  const foods: Record<string, PdfFoodInfo> = {
    "cereal-avena": { id: "cereal-avena", name: "Avena", groupLabel: "Cereales sin grasa", serving: "1/3 taza cruda", kcalPerServing: 70, proteinGPerServing: 2, carbsGPerServing: 15, fatGPerServing: 0 },
    "fruta-platano": { id: "fruta-platano", name: "Plátano", groupLabel: "Frutas", serving: "1/2 pieza mediana", kcalPerServing: 60, proteinGPerServing: 0, carbsGPerServing: 15, fatGPerServing: 0 },
    "aoa-pechuga-pollo": { id: "aoa-pechuga-pollo", name: "Pechuga de pollo", groupLabel: "AOA muy bajo", serving: "30 g", kcalPerServing: 40, proteinGPerServing: 7, carbsGPerServing: 0, fatGPerServing: 1 },
    "cereal-arroz": { id: "cereal-arroz", name: "Arroz blanco", groupLabel: "Cereales sin grasa", serving: "1/3 taza", kcalPerServing: 70, proteinGPerServing: 2, carbsGPerServing: 15, fatGPerServing: 0 },
    "verdura-brocoli": { id: "verdura-brocoli", name: "Brócoli", groupLabel: "Verduras", serving: "1 taza floretes", kcalPerServing: 25, proteinGPerServing: 2, carbsGPerServing: 5, fatGPerServing: 0 },
    "fruta-manzana": { id: "fruta-manzana", name: "Manzana", groupLabel: "Frutas", serving: "1 pieza mediana", kcalPerServing: 60, proteinGPerServing: 0, carbsGPerServing: 15, fatGPerServing: 0 },
    "legum-frijol": { id: "legum-frijol", name: "Frijol cocido", groupLabel: "Leguminosas", serving: "1/2 taza", kcalPerServing: 80, proteinGPerServing: 4, carbsGPerServing: 14, fatGPerServing: 0.5 },
    "verdura-zanahoria": { id: "verdura-zanahoria", name: "Zanahoria", groupLabel: "Verduras", serving: "1/2 taza picada", kcalPerServing: 25, proteinGPerServing: 2, carbsGPerServing: 5, fatGPerServing: 0 },
  };
  return (id: string) => foods[id] ?? null;
}

function makeMockFoodLookup() {
  const foods = makeMockLookup();
  return (id: string) => {
    const f = foods(id);
    if (!f) return Food.reconstitute({ id, group: "verduras" as FoodGroup, name: id, shortName: id, serving: "1 ración", servingGrams: 100, keywords: [], custom: false });
    return Food.reconstitute({ id: f.id, group: "verduras" as FoodGroup, name: f.name, shortName: f.name, serving: f.serving, servingGrams: 100, keywords: [], custom: false });
  };
}

describe("pdfService", () => {
  describe("generateMealPlanPdf", () => {
    it("generates valid data from MealPlan + Patient", () => {
      const mp = makeMockMealPlan();
      const patient = makeMockPatient();
      const lookup = makeMockFoodLookup();

      const data = pdfService.generateMealPlanPdf(mp as unknown as never, patient as never, lookup);
      expect(data.patientName).toBe("Mar\u00eda G\u00f3mez L\u00f3pez");
      expect(data.kcalTarget).toBe(1800);
      expect(data.meals.length).toBe(5);
      expect(data.meals[0].exchanges.length).toBe(2);
    });
  });

  describe("createPdfDocument", () => {
    it("returns a jsPDF instance", () => {
      const meals: PdfMeal[] = [
        { slot: "breakfast", exchanges: [{ food: { id: "test", name: "Avena", groupLabel: "Cereales", serving: "1/3 taza", kcalPerServing: 70, proteinGPerServing: 2, carbsGPerServing: 15, fatGPerServing: 0 }, count: 1 }] },
        { slot: "morning-snack", exchanges: [] },
        { slot: "lunch", exchanges: [] },
        { slot: "afternoon-snack", exchanges: [] },
        { slot: "dinner", exchanges: [] },
      ];
      const data: PdfMealPlanData = {
        patientName: "Test Patient",
        startDate: "1 Jun 2026",
        endDate: null,
        name: "Test Plan",
        kcalTarget: 1800,
        proteinTargetG: 67,
        carbsTargetG: 203,
        fatTargetG: 60,
        meals,
        notes: null,
      };
      const doc = pdfService.createPdfDocument(data);
      expect(doc).toBeDefined();
      expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
    });
  });
});
