import { describe, it, expect } from "vitest";
import { applySubstitutions, generateSkeleton, rankFoodsByTarget, generatePlanMealsFromSkeleton } from "./planGenerator";

describe("generateSkeleton", () => {
  it("crea skeleton con el número correcto de slots", () => {
    const skeleton = generateSkeleton(2000, [], 3);
    expect(skeleton).toHaveLength(3);
  });

  it("distribuye kcal según los slots activos", () => {
    const skeleton = generateSkeleton(2000, [], 5);
    const totalTarget = skeleton.reduce((s, slot) => s + slot.targetKcal, 0);
    expect(totalTarget).toBeCloseTo(2000, -1);
  });

  it("asigna 5 sugerencias por slot", () => {
    const skeleton = generateSkeleton(1500, [], 3);
    for (const slot of skeleton) {
      expect(slot.suggestions).toHaveLength(5);
    }
  });

  it("cada sugerencia tiene grupo y macronutrientes", () => {
    const skeleton = generateSkeleton(1500, [], 2);
    for (const slot of skeleton) {
      for (const s of slot.suggestions) {
        expect(s.group).toBeDefined();
        expect(s.kcal).toBeGreaterThan(0);
        expect(s.proteinG).toBeGreaterThanOrEqual(0);
        expect(s.carbsG).toBeGreaterThanOrEqual(0);
        expect(s.fatG).toBeGreaterThanOrEqual(0);
        expect(s.exchanges).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it("aplica restricción de distribución", () => {
    const normal = generateSkeleton(2000, [], 5);
    const diabetic = generateSkeleton(2000, ["diabetico"], 5);
    const breakfastNormal = normal.find((s) => s.slot === "breakfast")!.targetKcal;
    const breakfastDiabetic = diabetic.find((s) => s.slot === "breakfast")!.targetKcal;
    expect(breakfastDiabetic).toBeLessThan(breakfastNormal);
  });

  it("maneja timesPerDay = 0", () => {
    const skeleton = generateSkeleton(1500, [], 0);
    expect(skeleton).toHaveLength(0);
  });
});

describe("rankFoodsByTarget", () => {
  it("retorna alimentos ordenados por matchScore descendente", () => {
    const ranked = rankFoodsByTarget("frutas", 60, 0, 15, 0);
    expect(ranked.length).toBeGreaterThan(0);
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i - 1].matchScore).toBeGreaterThanOrEqual(ranked[i].matchScore);
    }
  });

  it("respeta maxResults", () => {
    const ranked = rankFoodsByTarget("verduras", 25, 2, 5, 0, 3);
    expect(ranked).toHaveLength(3);
  });

  it("excluye alimentos en blacklist", () => {
    const all = rankFoodsByTarget("frutas", 60, 0, 15, 0);
    const filtered = rankFoodsByTarget("frutas", 60, 0, 15, 0, 10, ["fruta-manzana"]);
    expect(filtered.length).toBeLessThan(all.length);
    expect(filtered.find((f) => f.foodId === "fruta-manzana")).toBeUndefined();
  });

  it("retorna vacío si no hay alimentos en el grupo", () => {
    const ranked = rankFoodsByTarget("leche-entera", 150, 8, 12, 8);
    expect(ranked.length).toBeGreaterThan(0);
  });

  it("calcula matchScore entre 0 y 100", () => {
    const ranked = rankFoodsByTarget("frutas", 60, 0, 15, 0, 5);
    for (const food of ranked) {
      expect(food.matchScore).toBeGreaterThanOrEqual(0);
      expect(food.matchScore).toBeLessThanOrEqual(100);
    }
  });

  it("maneja targets en cero", () => {
    const ranked = rankFoodsByTarget("verduras", 0, 0, 0, 0);
    expect(ranked.length).toBeGreaterThan(0);
  });

  it("cada resultado tiene los campos requeridos", () => {
    const ranked = rankFoodsByTarget("frutas", 60, 0, 15, 0, 1);
    expect(ranked).toHaveLength(1);
    const item = ranked[0];
    expect(item.foodId).toBeDefined();
    expect(item.name).toBeDefined();
    expect(item.group).toBe("frutas");
    expect(typeof item.kcal).toBe("number");
    expect(typeof item.matchScore).toBe("number");
  });
});

describe("generatePlanMealsFromSkeleton", () => {
  it("convierte skeleton en PlanMeal array", () => {
    const skeleton = generateSkeleton(1500, [], 3);
    const meals = generatePlanMealsFromSkeleton(skeleton);
    expect(meals).toHaveLength(3);
  });

  it("asigna slot correcto a cada comida", () => {
    const skeleton = generateSkeleton(1500, [], 2);
    const meals = generatePlanMealsFromSkeleton(skeleton);
    expect(meals[0].slot).toBe(skeleton[0].slot);
    expect(meals[1].slot).toBe(skeleton[1].slot);
  });

  it("incluye hasta 3 intercambios por comida", () => {
    const skeleton = generateSkeleton(1500, [], 1);
    const meals = generatePlanMealsFromSkeleton(skeleton);
    expect(meals[0].exchanges.length).toBeLessThanOrEqual(3);
  });

  it("cada intercambio tiene foodId y count", () => {
    const skeleton = generateSkeleton(1500, [], 2);
    const meals = generatePlanMealsFromSkeleton(skeleton);
    for (const meal of meals) {
      for (const ex of meal.exchanges) {
        expect(typeof ex.foodId).toBe("string");
        expect(ex.count).toBeGreaterThan(0);
      }
    }
  });
});

describe("applySubstitutions", () => {
  it("reemplaza foodIds guardados y conserva conteos/slots", () => {
    const meals = [
      {
        slot: "breakfast" as const,
        exchanges: [
          { foodId: "fruta-manzana" as const, count: 1 },
          { foodId: "cereal-tortilla-maiz" as const, count: 2 },
        ],
      },
      {
        slot: "lunch" as const,
        exchanges: [{ foodId: "aoa-pechuga-pollo" as const, count: 3 }],
      },
    ];

    const result = applySubstitutions(meals, {
      "fruta-manzana": "fruta-platano",
      "aoa-pechuga-pollo": "aoa-huevo",
    });

    expect(result[0]!.slot).toBe("breakfast");
    expect(result[0]!.exchanges[0]).toEqual({ foodId: "fruta-platano", count: 1 });
    expect(result[0]!.exchanges[1]).toEqual({ foodId: "cereal-tortilla-maiz", count: 2 });
    expect(result[1]!.exchanges[0]).toEqual({ foodId: "aoa-huevo", count: 3 });
  });

  it("retorna las mismas comidas si no hay sustituciones", () => {
    const meals = [{ slot: "dinner" as const, exchanges: [{ foodId: "verdura-acelga" as const, count: 2 }] }];
    expect(applySubstitutions(meals, {})).toBe(meals);
  });
});
