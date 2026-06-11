import { describe, it, expect } from "vitest";
import { RecipeIdSchema, createRecipeId, recipeIdFrom, recipeIdFromUnsafe } from "./RecipeId";
import {
  RecipeCategorySchema, RecipeCategoryLabel,
  RecipeDifficultySchema, RecipeDifficultyLabel,
  RecipeStatusSchema, RecipeStatusLabel,
  AllergenSchema, AllergenLabel,
  RECIPE_CATEGORIES,
} from "./RecipeTypes";
import {
  RecipeSchema, Recipe, RecipeIngredient, RecipeStep,
  calculateNutrition, deriveAllergensFromFoods,
  type FoodNutrition,
} from "./Recipe";
import { RecipeNotFoundError } from "./RecipeRepository";

describe("RecipeId", () => {
  it("genera un UUID válido", () => {
    const id = createRecipeId();
    expect(RecipeIdSchema.safeParse(id).success).toBe(true);
  });

  it("from acepta un UUID válido", () => {
    const uuid = crypto.randomUUID();
    const id = recipeIdFrom(uuid);
    expect(id).toBe(uuid);
  });

  it("from rechaza un UUID inválido", () => {
    expect(() => recipeIdFrom("no-es-uuid")).toThrow();
  });

  it("fromUnsafe no valida", () => {
    const id = recipeIdFromUnsafe("cualquier-cosa");
    expect(id).toBe("cualquier-cosa");
  });
});

describe("RecipeTypes", () => {
  it("tiene labels para todas las categorías", () => {
    const values = RecipeCategorySchema.options;
    for (const v of values) {
      expect(RecipeCategoryLabel[v]).toBeDefined();
      expect(RecipeCategoryLabel[v].length).toBeGreaterThan(0);
    }
  });

  it("RECIPE_CATEGORIES contiene todas las categorías", () => {
    expect([...RECIPE_CATEGORIES].sort()).toEqual([...RecipeCategorySchema.options].sort());
  });

  it("tiene labels para todas las dificultades", () => {
    const values = RecipeDifficultySchema.options;
    for (const v of values) {
      expect(RecipeDifficultyLabel[v]).toBeDefined();
      expect(RecipeDifficultyLabel[v].length).toBeGreaterThan(0);
    }
  });

  it("tiene labels para todos los estados", () => {
    const values = RecipeStatusSchema.options;
    for (const v of values) {
      expect(RecipeStatusLabel[v]).toBeDefined();
      expect(RecipeStatusLabel[v].length).toBeGreaterThan(0);
    }
  });

  it("tiene labels para todos los alérgenos", () => {
    const values = AllergenSchema.options;
    for (const v of values) {
      expect(AllergenLabel[v]).toBeDefined();
      expect(AllergenLabel[v].length).toBeGreaterThan(0);
    }
  });

  it("exhaustividad: todas las categorías tienen label", () => {
    expect(Object.keys(RecipeCategoryLabel).sort()).toEqual(
      [...RecipeCategorySchema.options].sort(),
    );
  });
});

describe("Recipe", () => {
  const validProps = () => ({
    id: createRecipeId().toString(),
    name: "Ensalada de pollo",
    description: "Ensalada fresca con pollo y verduras",
    category: "plato_fuerte" as const,
    cuisine: "mexicana",
    difficulty: "facil" as const,
    prepTimeMin: 15,
    cookTimeMin: 20,
    servings: 4,
    servingUnit: "plato",
    servingWeightG: 250,
    ingredients: [
      { equivalentId: "pollo-pechuga", name: "Pechuga de pollo", quantity: 200, unit: "g", orderIndex: 0, isOptional: false },
      { equivalentId: "lechuga", name: "Lechuga", quantity: 100, unit: "g", orderIndex: 1, isOptional: false },
    ],
    steps: [
      { orderIndex: 0, description: "Cocinar el pollo", durationMin: 20 },
      { orderIndex: 1, description: "Mezclar con verduras", durationMin: 5 },
    ],
    notes: "Servir frío",
    photoPaths: [],
    tags: ["saludable", "rápido"],
    allergens: [],
    costTotal: 80,
    costPerServing: 20,
    currency: "MXN",
    status: "draft" as const,
    currentVersion: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  it("acepta props válidos en el schema", () => {
    const result = RecipeSchema.safeParse(validProps());
    expect(result.success).toBe(true);
  });

  it("rechaza name vacío", () => {
    const result = RecipeSchema.safeParse({ ...validProps(), name: "" });
    expect(result.success).toBe(false);
  });

  it("rechaza category inválida", () => {
    const result = RecipeSchema.safeParse({ ...validProps(), category: "guisado" });
    expect(result.success).toBe(false);
  });

  it("rechaza difficulty inválida", () => {
    const result = RecipeSchema.safeParse({ ...validProps(), difficulty: "experto" });
    expect(result.success).toBe(false);
  });

  it("rechaza status inválido", () => {
    const result = RecipeSchema.safeParse({ ...validProps(), status: "eliminado" });
    expect(result.success).toBe(false);
  });

  it("rechaza servings no positivo", () => {
    const result = RecipeSchema.safeParse({ ...validProps(), servings: 0 });
    expect(result.success).toBe(false);
  });

  it("valida ingredientes - quantity debe ser positive", () => {
    const result = RecipeSchema.safeParse({
      ...validProps(),
      ingredients: [{ equivalentId: "test", name: "Test", quantity: 0, unit: "g", orderIndex: 0, isOptional: false }],
    });
    expect(result.success).toBe(false);
  });

  it("valida pasos - description requerida", () => {
    const result = RecipeSchema.safeParse({
      ...validProps(),
      steps: [{ orderIndex: 0, description: "", durationMin: 5 }],
    });
    expect(result.success).toBe(false);
  });

  it("aplica defaults para campos opcionales", () => {
    const result = RecipeSchema.parse({
      ...validProps(),
      description: undefined,
      cuisine: undefined,
      notes: undefined,
      ingredients: undefined,
      steps: undefined,
    });
    expect(result.description).toBe("");
    expect(result.cuisine).toBe("mexicana");
    expect(result.notes).toBe("");
    expect(result.ingredients).toEqual([]);
    expect(result.steps).toEqual([]);
  });

  it("create asigna draft, version 1, costos 0 y timestamps", () => {
    const recipe = Recipe.create({
      id: createRecipeId().toString(),
      name: "Tacos de pescado",
      description: "",
      category: "plato_fuerte",
      cuisine: "mexicana",
      difficulty: "media",
      prepTimeMin: 0,
      cookTimeMin: 0,
      servings: 4,
      servingUnit: "porción",
      notes: "",
      currency: "MXN",
      ingredients: [],
      steps: [],
      photoPaths: [],
      tags: [],
      allergens: [],
    });
    expect(recipe.status).toBe("draft");
    expect(recipe.currentVersion).toBe(1);
    expect(recipe.costTotal).toBe(0);
    expect(recipe.costPerServing).toBe(0);
    expect(recipe.createdAt).toBeGreaterThan(0);
    expect(recipe.updatedAt).toBeGreaterThan(0);
  });

  it("create acepta status explícito", () => {
    const recipe = Recipe.create({
      id: createRecipeId().toString(),
      name: "Smoothie",
      description: "",
      category: "bebida",
      cuisine: "mexicana",
      difficulty: "facil",
      prepTimeMin: 0,
      cookTimeMin: 0,
      servings: 2,
      servingUnit: "porción",
      notes: "",
      currency: "MXN",
      ingredients: [],
      steps: [],
      photoPaths: [],
      tags: [],
      allergens: [],
      status: "active",
    });
    expect(recipe.status).toBe("active");
  });

  it("reconstitute restaura desde props", () => {
    const props = validProps();
    const recipe = Recipe.reconstitute(props);
    expect(recipe.id).toBe(props.id);
    expect(recipe.name).toBe("Ensalada de pollo");
    expect(recipe.category).toBe("plato_fuerte");
    expect(recipe.difficulty).toBe("facil");
    expect(recipe.servings).toBe(4);
  });

  it("toProps devuelve copia de las props", () => {
    const original = Recipe.reconstitute(validProps());
    const props = original.toProps();
    expect(props.id).toBe(original.id);
    expect(props.name).toBe(original.name);
    expect(props.ingredients).toHaveLength(2);
    expect(props.steps).toHaveLength(2);
  });

  it("totalTimeMin suma prep y cook", () => {
    const recipe = Recipe.reconstitute(validProps());
    expect(recipe.totalTimeMin).toBe(35);
  });

  it("ingredients devuelve instancias de RecipeIngredient", () => {
    const recipe = Recipe.reconstitute(validProps());
    const ings = recipe.ingredients;
    expect(ings).toHaveLength(2);
    expect(ings[0]).toBeInstanceOf(RecipeIngredient);
    expect(ings[0].name).toBe("Pechuga de pollo");
  });

  it("steps devuelve instancias de RecipeStep", () => {
    const recipe = Recipe.reconstitute(validProps());
    const steps = recipe.steps;
    expect(steps).toHaveLength(2);
    expect(steps[0]).toBeInstanceOf(RecipeStep);
    expect(steps[0].description).toBe("Cocinar el pollo");
  });

  it("publish cambia estado a active e incrementa version", () => {
    const recipe = Recipe.reconstitute(validProps());
    const published = recipe.publish();
    expect(published.status).toBe("active");
    expect(published.currentVersion).toBe(2);
  });

  it("archive cambia estado a archived", () => {
    const recipe = Recipe.reconstitute(validProps());
    const archived = recipe.archive();
    expect(archived.status).toBe("archived");
  });

  it("scale ajusta porciones e ingredientes proporcionalmente", () => {
    const recipe = Recipe.reconstitute(validProps());
    const scaled = recipe.scale(2);
    expect(scaled.servings).toBe(2);
    expect(scaled.ingredients[0].quantity).toBe(100);
    expect(scaled.costTotal).toBe(40);
    expect(scaled.costPerServing).toBe(20);
  });

  it("scale mantiene costo por porción consistente", () => {
    const recipe = Recipe.reconstitute(validProps());
    const scaled8 = recipe.scale(8);
    expect(scaled8.servings).toBe(8);
    expect(scaled8.ingredients[0].quantity).toBe(400);
    expect(scaled8.costTotal).toBe(160);
    expect(scaled8.costPerServing).toBe(20);
  });

  it("with actualiza campos y updatedAt", () => {
    const recipe = Recipe.reconstitute({ ...validProps(), updatedAt: 1 });
    const updated = recipe.with({ name: "Nueva receta", notes: "Actualizada" });
    expect(updated.name).toBe("Nueva receta");
    expect(updated.notes).toBe("Actualizada");
    expect(updated.updatedAt).toBeGreaterThan(recipe.updatedAt);
  });
});

describe("RecipeIngredient", () => {
  it("create construye ingrediente válido", () => {
    const ing = RecipeIngredient.create({
      equivalentId: "eq-001",
      name: "Tomate",
      quantity: 2,
      unit: "pieza",
      orderIndex: 0,
      isOptional: false,
    });
    expect(ing.name).toBe("Tomate");
    expect(ing.quantity).toBe(2);
    expect(ing.weightG).toBeUndefined();
  });

  it("reconstitute restaura ingrediente", () => {
    const ing = RecipeIngredient.reconstitute({
      equivalentId: "eq-001",
      name: "Cebolla",
      quantity: 1,
      unit: "pieza",
      orderIndex: 0,
      isOptional: true,
    });
    expect(ing.isOptional).toBe(true);
    expect(ing.name).toBe("Cebolla");
  });
});

describe("RecipeStep", () => {
  it("create construye paso válido", () => {
    const step = RecipeStep.create({
      orderIndex: 0,
      description: "Hervir agua",
      durationMin: 10,
    });
    expect(step.description).toBe("Hervir agua");
    expect(step.durationMin).toBe(10);
  });

  it("reconstitute restaura paso", () => {
    const step = RecipeStep.reconstitute({
      orderIndex: 1,
      description: "Agregar sal",
      temperature: "media",
    });
    expect(step.temperature).toBe("media");
  });
});

describe("calculateNutrition", () => {
  const foodLookup = (id: string): FoodNutrition | null => {
    const db: Record<string, FoodNutrition> = {
      "pollo-pechuga": { kcal: 165, proteinG: 31, carbsG: 0, fatG: 3.6, servingGrams: 100 },
      "aguacate": { kcal: 160, proteinG: 2, carbsG: 8.5, fatG: 14.7, servingGrams: 100 },
    };
    return db[id] ?? null;
  };

  it("calcula nutrición de ingredientes", () => {
    const ings = [
      RecipeIngredient.create({ equivalentId: "pollo-pechuga", name: "Pollo", quantity: 200, unit: "g", weightG: 200, orderIndex: 0, isOptional: false }),
    ];
    const result = calculateNutrition(ings, foodLookup);
    expect(result.kcal).toBe(330);
    expect(result.proteinG).toBe(62);
    expect(result.carbsG).toBe(0);
  });

  it("retorna 0 para ingredientes sin equivalentId", () => {
    const ings = [
      RecipeIngredient.create({ equivalentId: "", name: "Secreto", quantity: 1, unit: "pizca", weightG: 10, orderIndex: 0, isOptional: false }),
    ];
    const result = calculateNutrition(ings, foodLookup);
    expect(result.kcal).toBe(0);
    expect(result.proteinG).toBe(0);
  });

  it("retorna 0 para ingrediente no encontrado", () => {
    const ings = [
      RecipeIngredient.create({ equivalentId: "no-existe", name: "Misterio", quantity: 1, unit: "pz", orderIndex: 0, isOptional: false }),
    ];
    const result = calculateNutrition(ings, foodLookup);
    expect(result.kcal).toBe(0);
  });
});

describe("deriveAllergensFromFoods", () => {
  const foodLookup = (id: string): { group: string; keywords: readonly string[] } | null => {
    const db: Record<string, { group: string; keywords: readonly string[] }> = {
      "leche-entera": { group: "leche-lacteos", keywords: ["leche", "lactosa"] },
      "huevo": { group: "aoa-proteinas", keywords: ["huevo"] },
      "pan": { group: "cereales", keywords: ["harina", "gluten"] },
      "soya": { group: "leguminosas", keywords: ["soya"] },
    };
    return db[id] ?? null;
  };

  it("deriva alérgenos según grupo alimenticio", () => {
    const ings = [
      RecipeIngredient.create({ equivalentId: "leche-entera", name: "Leche", quantity: 1, unit: "taza", orderIndex: 0, isOptional: false }),
    ];
    const allergens = deriveAllergensFromFoods(ings, foodLookup);
    expect(allergens).toContain("leche");
  });

  it("deriva alérgeno de huevo cuando keywords contienen huevo", () => {
    const ings = [
      RecipeIngredient.create({ equivalentId: "huevo", name: "Huevo", quantity: 2, unit: "pz", orderIndex: 0, isOptional: false }),
    ];
    const allergens = deriveAllergensFromFoods(ings, foodLookup);
    expect(allergens).toContain("huevo");
  });

  it("deriva gluten cuando keywords contienen gluten", () => {
    const ings = [
      RecipeIngredient.create({ equivalentId: "pan", name: "Pan", quantity: 1, unit: "rebanada", orderIndex: 0, isOptional: false }),
    ];
    const allergens = deriveAllergensFromFoods(ings, foodLookup);
    expect(allergens).toContain("gluten");
  });

  it("deriva soya cuando keywords contienen soya", () => {
    const ings = [
      RecipeIngredient.create({ equivalentId: "soya", name: "Soya", quantity: 1, unit: "pz", orderIndex: 0, isOptional: false }),
    ];
    const allergens = deriveAllergensFromFoods(ings, foodLookup);
    expect(allergens).toContain("soya");
  });

  it("retorna arreglo vacío si no hay coincidencias", () => {
    const ings = [
      RecipeIngredient.create({ equivalentId: "no-existe", name: "Nada", quantity: 1, unit: "pz", orderIndex: 0, isOptional: false }),
    ];
    const allergens = deriveAllergensFromFoods(ings, foodLookup);
    expect(allergens).toEqual([]);
  });

  it("no duplica alérgenos", () => {
    const ings = [
      RecipeIngredient.create({ equivalentId: "leche-entera", name: "Leche", quantity: 1, unit: "taza", orderIndex: 0, isOptional: false }),
      RecipeIngredient.create({ equivalentId: "leche-entera", name: "Leche", quantity: 1, unit: "taza", orderIndex: 1, isOptional: false }),
    ];
    const allergens = deriveAllergensFromFoods(ings, foodLookup);
    expect(allergens.filter((a) => a === "leche")).toHaveLength(1);
  });
});

describe("RecipeRepository - error classes", () => {
  it("RecipeNotFoundError tiene el mensaje correcto", () => {
    const id = createRecipeId();
    const error = new RecipeNotFoundError(id);
    expect(error.message).toContain(id);
    expect(error.name).toBe("RecipeNotFoundError");
    expect(error.id).toBe(id);
    expect(error).toBeInstanceOf(Error);
  });
});
