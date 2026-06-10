import { z } from "zod";
import { RecipeIdSchema, type RecipeId } from "./RecipeId";
import {
  RecipeCategorySchema, type RecipeCategory,
  RecipeDifficultySchema, type RecipeDifficulty,
  RecipeStatusSchema, type RecipeStatus,
  AllergenSchema, type Allergen,
} from "./RecipeTypes";

export const RecipeIngredientSchema = z.object({
  equivalentId: z.string().min(1),
  name: z.string().min(1),
  quantity: z.number().positive(),
  unit: z.string().default("pieza"),
  weightG: z.number().positive().optional(),
  orderIndex: z.number().int().min(0),
  isOptional: z.boolean().default(false),
});
export type RecipeIngredientProps = z.infer<typeof RecipeIngredientSchema>;

export class RecipeIngredient {
  private constructor(public readonly props: RecipeIngredientProps) {}
  get equivalentId(): string { return this.props.equivalentId; }
  get name(): string { return this.props.name; }
  get quantity(): number { return this.props.quantity; }
  get unit(): string { return this.props.unit; }
  get weightG(): number | undefined { return this.props.weightG; }
  get orderIndex(): number { return this.props.orderIndex; }
  get isOptional(): boolean { return this.props.isOptional; }
  static create(props: RecipeIngredientProps): RecipeIngredient {
    return new RecipeIngredient(props);
  }
  static reconstitute(props: RecipeIngredientProps): RecipeIngredient {
    return new RecipeIngredient(props);
  }
}

export const RecipeStepSchema = z.object({
  orderIndex: z.number().int().min(0),
  description: z.string().min(1, "Descripción requerida"),
  durationMin: z.number().int().positive().optional(),
  temperature: z.string().optional(),
  photoPath: z.string().optional(),
});
export type RecipeStepProps = z.infer<typeof RecipeStepSchema>;

export class RecipeStep {
  private constructor(public readonly props: RecipeStepProps) {}
  get orderIndex(): number { return this.props.orderIndex; }
  get description(): string { return this.props.description; }
  get durationMin(): number | undefined { return this.props.durationMin; }
  get temperature(): string | undefined { return this.props.temperature; }
  get photoPath(): string | undefined { return this.props.photoPath; }
  static create(props: RecipeStepProps): RecipeStep {
    return new RecipeStep(props);
  }
  static reconstitute(props: RecipeStepProps): RecipeStep {
    return new RecipeStep(props);
  }
}

export const RecipeSchema = z.object({
  id: RecipeIdSchema,
  name: z.string().min(1, "Nombre requerido").max(200),
  description: z.string().max(1000).default(""),
  category: RecipeCategorySchema,
  subcategory: z.string().max(100).optional(),
  cuisine: z.string().max(100).default("mexicana"),
  difficulty: RecipeDifficultySchema,
  prepTimeMin: z.number().int().min(0).default(0),
  cookTimeMin: z.number().int().min(0).default(0),
  servings: z.number().int().positive().default(4),
  servingUnit: z.string().default("porción"),
  servingWeightG: z.number().positive().optional(),
  ingredients: z.array(RecipeIngredientSchema).default([]),
  steps: z.array(RecipeStepSchema).default([]),
  notes: z.string().max(2000).default(""),
  photoPaths: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  allergens: z.array(AllergenSchema).default([]),
  costTotal: z.number().min(0).default(0),
  costPerServing: z.number().min(0).default(0),
  currency: z.string().default("MXN"),
  status: RecipeStatusSchema,
  currentVersion: z.number().int().positive().default(1),
  createdAt: z.number().int().positive(),
  updatedAt: z.number().int().positive(),
});
export type RecipeProps = z.infer<typeof RecipeSchema>;

export class Recipe {
  private constructor(private readonly props: RecipeProps) {}

  get id(): RecipeId { return this.props.id as RecipeId; }
  get name(): string { return this.props.name; }
  get description(): string { return this.props.description; }
  get category(): RecipeCategory { return this.props.category; }
  get subcategory(): string | undefined { return this.props.subcategory; }
  get cuisine(): string { return this.props.cuisine; }
  get difficulty(): RecipeDifficulty { return this.props.difficulty; }
  get prepTimeMin(): number { return this.props.prepTimeMin; }
  get cookTimeMin(): number { return this.props.cookTimeMin; }
  get totalTimeMin(): number { return this.props.prepTimeMin + this.props.cookTimeMin; }
  get servings(): number { return this.props.servings; }
  get servingUnit(): string { return this.props.servingUnit; }
  get servingWeightG(): number | undefined { return this.props.servingWeightG; }
  get ingredients(): readonly RecipeIngredient[] {
    return this.props.ingredients.map(RecipeIngredient.reconstitute);
  }
  get steps(): readonly RecipeStep[] {
    return this.props.steps.map(RecipeStep.reconstitute);
  }
  get notes(): string { return this.props.notes; }
  get photoPaths(): readonly string[] { return this.props.photoPaths; }
  get tags(): readonly string[] { return this.props.tags; }
  get allergens(): readonly Allergen[] { return this.props.allergens as Allergen[]; }
  get costTotal(): number { return this.props.costTotal; }
  get costPerServing(): number { return this.props.costPerServing; }
  get currency(): string { return this.props.currency; }
  get status(): RecipeStatus { return this.props.status; }
  get currentVersion(): number { return this.props.currentVersion; }
  get createdAt(): number { return this.props.createdAt; }
  get updatedAt(): number { return this.props.updatedAt; }

  toProps(): RecipeProps {
    return {
      ...this.props,
      ingredients: this.props.ingredients.map((i) => ({ ...i })),
      steps: this.props.steps.map((s) => ({ ...s })),
      photoPaths: [...this.props.photoPaths],
      tags: [...this.props.tags],
      allergens: [...this.props.allergens],
    };
  }

  static create(props: Omit<RecipeProps, "createdAt" | "updatedAt" | "currentVersion" | "costTotal" | "costPerServing" | "status"> & { status?: RecipeStatus }): Recipe {
    return new Recipe({
      ...props,
      status: props.status ?? "draft",
      currentVersion: 1,
      costTotal: 0,
      costPerServing: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  }

  static reconstitute(props: RecipeProps): Recipe {
    return new Recipe(props);
  }

  with(updates: Partial<RecipeProps>): Recipe {
    return Recipe.reconstitute({ ...this.props, ...updates, updatedAt: Date.now() });
  }

  publish(): Recipe {
    return this.with({ status: "active", currentVersion: this.props.currentVersion + 1 });
  }

  archive(): Recipe {
    return this.with({ status: "archived" });
  }

  scale(targetServings: number): Recipe {
    const ratio = targetServings / this.props.servings;
    return Recipe.reconstitute({
      ...this.props,
      servings: targetServings,
      costTotal: Math.round(this.props.costTotal * ratio * 100) / 100,
      costPerServing: targetServings > 0 ? Math.round(this.props.costTotal * ratio / targetServings * 100) / 100 : 0,
      ingredients: this.props.ingredients.map((i) => ({
        ...i,
        quantity: Math.round(i.quantity * ratio * 100) / 100,
        weightG: i.weightG ? Math.round(i.weightG * ratio) : undefined,
      })),
      updatedAt: Date.now(),
    });
  }
}

export interface FoodNutrition {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  servingGrams: number;
}

export function calculateNutrition(
  ingredients: RecipeIngredient[],
  foodLookup: (equivalentId: string) => FoodNutrition | null,
): { kcal: number; proteinG: number; carbsG: number; fatG: number } {
  const total = { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 };
  for (const ing of ingredients) {
    if (!ing.equivalentId) continue;
    const food = foodLookup(ing.equivalentId);
    if (!food) continue;
    const servings = (ing.weightG ?? 0) > 0
      ? (ing.weightG ?? 0) / food.servingGrams
      : ing.quantity;
    total.kcal += servings * food.kcal;
    total.proteinG += servings * food.proteinG;
    total.carbsG += servings * food.carbsG;
    total.fatG += servings * food.fatG;
  }
  return total;
}

export function deriveAllergensFromFoods(
  ingredients: RecipeIngredient[],
  foodLookup: (equivalentId: string) => { group: string; keywords: readonly string[] } | null,
): string[] {
  const found = new Set<string>();
  for (const ing of ingredients) {
    if (!ing.equivalentId) continue;
    const food = foodLookup(ing.equivalentId);
    if (!food) continue;
    if (food.group.startsWith("leche-")) found.add("leche");
    if (food.group.startsWith("aoa-")) {
      if (food.keywords.some((k) => k.includes("huevo"))) found.add("huevo");
      if (food.keywords.some((k) => k.includes("pescado"))) found.add("pescado");
      if (food.keywords.some((k) => k.includes("mariscos"))) found.add("mariscos");
    }
    if (food.keywords.some((k) => k.includes("gluten"))) found.add("gluten");
    if (food.keywords.some((k) => k.includes("soya"))) found.add("soya");
    if (food.keywords.some((k) => k.includes("cacahuate"))) found.add("cacahuate");
    if (food.keywords.some((k) => k.includes("nueces") || k === "nuez")) found.add("nueces");
    if (food.keywords.some((k) => k.includes("sesamo"))) found.add("sesamo");
  }
  return Array.from(found);
}
