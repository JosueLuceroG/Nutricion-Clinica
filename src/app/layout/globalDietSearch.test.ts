import { describe, expect, it } from "vitest";
import { Search } from "lucide-react";
import {
  filterAndRankGlobalSearch,
  parseGlobalSearch,
} from "./globalSearchEngine";
import type {
  GlobalSearchPlanFood,
  GlobalSearchResult,
} from "./globalSearchTypes";

function planResult(
  id: string,
  title: string,
  options: {
    kcal?: number;
    proteinG?: number;
    carbsG?: number;
    fatG?: number;
    foods?: GlobalSearchPlanFood[];
    freeText?: string;
    patient?: string;
    status?: string;
    completeFoodIndex?: boolean;
  } = {},
): GlobalSearchResult {
  const kcal = options.kcal ?? 2300;
  return {
    id,
    kind: "plan",
    category: "plans",
    title,
    subtitle: `${options.patient ?? "María López"} · ${kcal} kcal`,
    searchableText: [
      title,
      options.freeText,
      ...(options.foods ?? []).map((food) => food.searchText),
    ]
      .filter(Boolean)
      .join(" "),
    icon: Search,
    tone: "green",
    fields: {
      patient: options.patient ?? "María López",
      status: options.status ?? "active",
    },
    planMetadata: {
      kcalTarget: kcal,
      proteinTargetG: options.proteinG ?? 120,
      carbsTargetG: options.carbsG ?? 300,
      fatTargetG: options.fatG ?? 70,
      foods: options.foods ?? [],
      freeText: options.freeText ?? title,
      completeFoodIndex: options.completeFoodIndex ?? true,
    },
  };
}

function food(
  id: string,
  mealSlot: GlobalSearchPlanFood["mealSlot"],
  searchText: string,
): GlobalSearchPlanFood {
  return { id, mealSlot, searchText };
}

describe("global diet search", () => {
  it.each([
    "dieta hipocalórica",
    "plan hipocalórico",
    "plan alimentario hipocalórico",
    "plan alimenticio hipocalórico",
    "plan nutricional hipocalórico",
    "menú hipocalórico",
    "menú diario hipocalórico",
    "régimen hipocalórico",
    "régimen alimentario hipocalórico",
    "esquema alimentario hipocalórico",
    "alimentación hipocalórica",
    "propuesta nutricional hipocalórica",
  ])("reconoce el sinónimo de plan en %s", (query) => {
    const parsed = parseGlobalSearch(query);
    expect(parsed.category).toBe("plans");
    expect(parsed.text).toMatch(/^hipocaloric[oa]$/);
    expect(parsed.errors).toEqual([]);
  });

  it("interpreta calorías, inclusiones, frecuencia diaria y exclusiones", () => {
    expect(
      parseGlobalSearch(
        "dieta de 2300 kcal con carne, pollo 2 veces al día y sin pescado",
      ),
    ).toEqual({
      text: "",
      category: "plans",
      filters: {
        planKcal: { min: 2300, max: 2300 },
        foodIncludes: [
          { term: "carne" },
          { term: "pollo", minMealSlots: 2, period: "day" },
        ],
        foodExcludes: [{ term: "pescado" }],
      },
      errors: [],
    });
  });

  it("admite la frase equivalente en inglés", () => {
    const parsed = parseGlobalSearch(
      "diet 2300 kcal with chicken two times per day and without fish",
    );
    expect(parsed.category).toBe("plans");
    expect(parsed.filters.planKcal).toEqual({ min: 2300, max: 2300 });
    expect(parsed.filters.foodIncludes).toEqual([
      { term: "chicken", minMealSlots: 2, period: "day" },
    ]);
    expect(parsed.filters.foodExcludes).toEqual([{ term: "fish" }]);
  });

  it("normaliza unidades y errores menores", () => {
    expect(parseGlobalSearch("deita de 2300 kc").filters.planKcal).toEqual({
      min: 2300,
      max: 2300,
    });
    expect(parseGlobalSearch("menú de 1800 calorías").filters.planKcal).toEqual(
      { min: 1800, max: 1800 },
    );
    expect(
      parseGlobalSearch("régimen de 2000 kilocalorías").filters.planKcal,
    ).toEqual({ min: 2000, max: 2000 });
  });

  it("interpreta rangos y límites calóricos", () => {
    expect(
      parseGlobalSearch("dieta entre 1800 y 2000 calorías").filters.planKcal,
    ).toEqual({ min: 1800, max: 2000 });
    expect(
      parseGlobalSearch("plan menos de 1600 kcal").filters.planKcal,
    ).toEqual({ max: 1600, maxExclusive: true });
    expect(parseGlobalSearch("menú más de 2400 kcal").filters.planKcal).toEqual(
      { min: 2400, minExclusive: true },
    );
    expect(
      parseGlobalSearch("alimentación aproximadamente 2200 kcal").filters
        .planKcal,
    ).toEqual({ min: 2090, max: 2310 });
  });

  it("interpreta macronutrientes cuantitativos", () => {
    const parsed = parseGlobalSearch(
      "alimentación con 120 g de proteína, 280 g de carbohidratos y 70 g de grasa",
    );
    expect(parsed.category).toBe("plans");
    expect(parsed.filters.proteinG).toEqual({ min: 120, max: 120 });
    expect(parsed.filters.carbsG).toEqual({ min: 280, max: 280 });
    expect(parsed.filters.fatG).toEqual({ min: 70, max: 70 });
    expect(parsed.filters.foodIncludes).toBeUndefined();
  });

  it("interpreta paciente, estado, alimentos y tiempos de comida", () => {
    const parsed = parseGlobalSearch(
      "régimen activo para María López con fruta en el desayuno y sin carne en la cena",
    );
    expect(parsed.filters.status).toBe("active");
    expect(parsed.filters.patient).toBe("maria lopez");
    expect(parsed.filters.foodIncludes).toEqual([
      { term: "fruta", mealSlots: ["breakfast"] },
    ]);
    expect(parsed.filters.foodExcludes).toEqual([
      { term: "carne", mealSlots: ["dinner"] },
    ]);
  });

  it("combina listas de inclusiones y exclusiones relacionadas", () => {
    const parsed = parseGlobalSearch(
      "plan con huevo y aguacate sin lácteos, gluten ni nueces",
    );
    expect(parsed.filters.foodIncludes).toEqual([
      { term: "huevo" },
      { term: "aguacate" },
    ]);
    expect(parsed.filters.foodExcludes).toEqual([
      { term: "lacteos" },
      { term: "gluten" },
      { term: "nueces" },
    ]);
  });

  it("aplica todas las condiciones como requisitos obligatorios", () => {
    const chickenBreakfast = food(
      "aoa-pechuga-pollo",
      "breakfast",
      "Pechuga de pollo pollo proteína",
    );
    const chickenLunch = food(
      "aoa-pechuga-pollo",
      "lunch",
      "Pechuga de pollo pollo proteína",
    );
    const beefLunch = food(
      "aoa-bistec-res",
      "lunch",
      "Bistec de res carne res",
    );
    const fishDinner = food(
      "aoa-pescado-blanco",
      "dinner",
      "Pescado blanco tilapia huachinango",
    );
    const results = [
      planResult("safe", "Plan seguro", {
        foods: [chickenBreakfast, chickenLunch, beefLunch],
      }),
      planResult("fish", "Plan con pescado", {
        foods: [chickenBreakfast, chickenLunch, beefLunch, fishDinner],
      }),
      planResult("one-chicken", "Plan con poco pollo", {
        foods: [chickenBreakfast, beefLunch],
      }),
      planResult("wrong-kcal", "Plan de otras calorías", {
        kcal: 2200,
        foods: [chickenBreakfast, chickenLunch, beefLunch],
      }),
    ];

    expect(
      filterAndRankGlobalSearch(
        results,
        "dieta de 2300 kc con carne, pollo 2 veces al día y sin pescado",
        "all",
      ).map((result) => result.id),
    ).toEqual(["safe"]);
  });

  it("mantiene exclusiones estrictas cuando hay alimentos sin resolver", () => {
    const unresolved = planResult("unresolved", "Plan incompleto", {
      completeFoodIndex: false,
    });
    expect(
      filterAndRankGlobalSearch(
        [unresolved],
        "dieta de 2300 kcal sin pescado",
        "all",
      ),
    ).toEqual([]);
  });

  it("tolera errores menores en términos alimentarios", () => {
    const fish = planResult("fish", "Plan marino", {
      foods: [
        food(
          "aoa-pescado-blanco",
          "lunch",
          "Pescado blanco tilapia huachinango",
        ),
      ],
    });
    expect(
      filterAndRankGlobalSearch(
        [fish],
        "dieta de 2300 kcal sin pescdao",
        "all",
      ),
    ).toEqual([]);
  });

  it("resuelve conceptos alimentarios mediante sinónimos", () => {
    const dairy = planResult("dairy", "Plan con queso", {
      foods: [
        food("aoa-queso-panela", "breakfast", "Queso panela fresco mexicano"),
      ],
    });
    expect(
      filterAndRankGlobalSearch(
        [dairy],
        "régimen de 2300 kcal sin lácteos",
        "all",
      ),
    ).toEqual([]);
  });

  it("solo acepta frecuencia semanal cuando está escrita en el plan", () => {
    const fishFood = food(
      "aoa-pescado-blanco",
      "lunch",
      "Pescado blanco tilapia huachinango",
    );
    const explicit = planResult("explicit", "Plan semanal", {
      foods: [fishFood],
      freeText: "Incluye pescado 3 veces por semana",
    });
    const implicit = planResult("implicit", "Plan diario", {
      foods: [fishFood],
      freeText: "Incluye pescado",
    });
    expect(
      filterAndRankGlobalSearch(
        [explicit, implicit],
        "plan con pescado 3 veces por semana",
        "all",
      ).map((result) => result.id),
    ).toEqual(["explicit"]);
  });

  it("busca clasificaciones clínicas solo como texto explícito", () => {
    const results = [
      planResult("labeled", "Dieta hipocalórica"),
      planResult("unlabeled", "Plan general", { kcal: 1200 }),
    ];
    expect(
      filterAndRankGlobalSearch(results, "dieta hipocalórica", "all").map(
        (result) => result.id,
      ),
    ).toEqual(["labeled"]);
  });
});
