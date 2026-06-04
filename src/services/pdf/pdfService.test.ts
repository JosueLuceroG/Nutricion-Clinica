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

  describe("generateConsultationPdf", () => {
    it("transforma Consultation + Patient en PdfConsultationData con vitals y secciones SOAP", () => {
      const consultation = {
        id: { toString: () => "c1" },
        patientId: { toString: () => "p1" },
        anthropometryId: null,
        labPanelId: null,
        consultationNumber: 3,
        consultationDate: new Date("2026-06-04T10:00:00Z"),
        status: "completed" as const,
        reason: "Control mensual",
        subjective: "Paciente refiere mejora",
        objective: "Sin edema",
        assessment: "Buena adherencia",
        plan: "Continuar plan actual",
        vitals: {
          systolicMmHg: 120,
          diastolicMmHg: 80,
          heartRateBpm: 72,
          temperatureC: 36.5,
          toJSON: () => ({ systolicMmHg: 120, diastolicMmHg: 80, heartRateBpm: 72, temperatureC: 36.5 }),
        },
        nextVisitDate: new Date("2026-07-04T10:00:00Z"),
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };
      const patient = makeMockPatient();
      const data = pdfService.generateConsultationPdf(consultation as unknown as never, patient as never);
      expect(data.patientName).toBe("Mar\u00eda G\u00f3mez L\u00f3pez");
      expect(data.consultationNumber).toBe(3);
      expect(data.status).toBe("completed");
      expect(data.reason).toBe("Control mensual");
      expect(data.vitals.systolicMmHg).toBe(120);
      expect(data.vitals.diastolicMmHg).toBe(80);
      expect(data.vitals.heartRateBpm).toBe(72);
      expect(data.vitals.temperatureC).toBe(36.5);
      expect(data.nextVisitDate).toMatch(/julio/i);
      expect(data.anthropometry).toBeNull();
      expect(data.labPanel).toBeNull();
    });

    it("incluye resumen antropom\u00e9trico y de laboratorio cuando se pasan al servicio", () => {
      const consultation = {
        id: { toString: () => "c2" },
        patientId: { toString: () => "p1" },
        anthropometryId: null,
        labPanelId: null,
        consultationNumber: 4,
        consultationDate: new Date("2026-06-04T10:00:00Z"),
        status: "completed" as const,
        reason: "Control",
        subjective: null,
        objective: null,
        assessment: null,
        plan: null,
        vitals: {
          systolicMmHg: null,
          diastolicMmHg: null,
          heartRateBpm: null,
          temperatureC: null,
          toJSON: () => ({ systolicMmHg: null, diastolicMmHg: null, heartRateBpm: null, temperatureC: null }),
        },
        nextVisitDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };
      const anthropometry = { weightKg: 70, heightCm: 170, bmi: 24.22, measuredAt: new Date("2026-06-01") };
      const labPanel = { glucose: 95, cholesterol: 180, triglycerides: 120, takenAt: new Date("2026-05-30") };
      const data = pdfService.generateConsultationPdf(
        consultation as unknown as never,
        makeMockPatient() as never,
        anthropometry,
        labPanel,
      );
      expect(data.anthropometry?.weightKg).toBe(70);
      expect(data.anthropometry?.bmi).toBeCloseTo(24.22, 2);
      expect(data.labPanel?.glucose).toBe(95);
      expect(data.labPanel?.cholesterol).toBe(180);
      expect(data.labPanel?.triglycerides).toBe(120);
    });
  });

  describe("createConsultationPdfDocument", () => {
    it("genera un PDF v\u00e1lido a partir de PdfConsultationData", () => {
      const data = {
        patientName: "Mar\u00eda G\u00f3mez",
        consultationNumber: 5,
        consultationDate: "4 de junio de 2026",
        status: "completed" as const,
        reason: "Control",
        subjective: null,
        objective: null,
        assessment: null,
        plan: null,
        vitals: { systolicMmHg: 110, diastolicMmHg: 70, heartRateBpm: 68, temperatureC: 36.6 },
        nextVisitDate: null,
        anthropometry: null,
        labPanel: null,
      };
      const doc = pdfService.createConsultationPdfDocument(data);
      expect(doc).toBeDefined();
      expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
    });
  });
});
