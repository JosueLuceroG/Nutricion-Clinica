import { z } from "zod";
import { FoodGroupSchema, GroupNutrition } from "./FoodGroup";

/**
 * Catálogo de alimentos. Cada alimento es inmutable.
 * ID = slug estable, sin espacios, minúsculas, sin acentos críticos.
 *
 * Los valores nutrimentales se derivan del GRUPO al que pertenece
 * (perfil canónico SMAE 5ª edición). El alimento individual solo
 * describe su NOMBRE, ración y gramaje.
 */
export const FoodIdSchema = z
  .string()
  .min(2, "ID de alimento inválido")
  .regex(/^[a-z0-9-]+$/, "Solo minúsculas, dígitos y guiones");

export type FoodId = z.infer<typeof FoodIdSchema>;

export interface FoodProps {
  id: FoodId;
  group: z.infer<typeof FoodGroupSchema>;
  name: string;
  shortName: string;
  serving: string;
  servingGrams: number;
}

export class Food {
  private constructor(private readonly props: FoodProps) {}

  get id(): FoodId {
    return this.props.id;
  }
  get group(): FoodProps["group"] {
    return this.props.group;
  }
  get name(): string {
    return this.props.name;
  }
  get shortName(): string {
    return this.props.shortName;
  }
  get serving(): string {
    return this.props.serving;
  }
  get servingGrams(): number {
    return this.props.servingGrams;
  }

  get nutrition(): { kcal: number; proteinG: number; carbsG: number; fatG: number } {
    return GroupNutrition[this.props.group];
  }

  toProps(): FoodProps {
    return { ...this.props };
  }

  static create(props: FoodProps): Food {
    if (!props.name.trim()) throw new Error("Nombre de alimento requerido.");
    if (props.servingGrams <= 0) throw new Error("Gramos por ración deben ser positivos.");
    return new Food({ ...props, name: props.name.trim(), shortName: props.shortName.trim() });
  }
}

export const FoodSchema = z.object({
  id: FoodIdSchema,
  group: FoodGroupSchema,
  name: z.string().min(1),
  shortName: z.string().min(1),
  serving: z.string().min(1),
  servingGrams: z.number().positive(),
});

export const getFood = (id: FoodId): Food | null => {
  return FOOD_CATALOG[id] ?? null;
};

export const getAllFoods = (): Food[] => Object.values(FOOD_CATALOG);

export const getFoodsByGroup = (): Record<FoodProps["group"], Food[]> => {
  const grouped = {} as Record<FoodProps["group"], Food[]>;
  for (const food of Object.values(FOOD_CATALOG)) {
    if (!grouped[food.group]) grouped[food.group] = [];
    grouped[food.group].push(food);
  }
  return grouped;
};

/**
 * Catálogo SMAE 5ª edición — alimentos representativos por grupo.
 * Para cada grupo se incluyen entre 1-6 alimentos de uso común en México.
 *
 * Para agregar más alimentos al catálogo, basta con añadir entradas aquí
 * (el sistema los hace disponibles en todos los planes).
 */
const FOOD_CATALOG_RAW: FoodProps[] = [
  // ── Verduras ─────────────────────────────────────────
  { id: "verdura-acelga", group: "verduras", name: "Acelga", shortName: "Acelga", serving: "1 taza de hojas crudas", servingGrams: 50 },
  { id: "verdura-brocoli", group: "verduras", name: "Brócoli", shortName: "Brócoli", serving: "1 taza de floretes cocidos", servingGrams: 90 },
  { id: "verdura-espinaca", group: "verduras", name: "Espinaca", shortName: "Espinaca", serving: "1 taza de hojas crudas", servingGrams: 50 },
  { id: "verdura-jitomate", group: "verduras", name: "Jitomate", shortName: "Jitomate", serving: "1 pieza mediana", servingGrams: 120 },
  { id: "verdura-zanahoria", group: "verduras", name: "Zanahoria", shortName: "Zanahoria", serving: "1/2 taza picada", servingGrams: 60 },
  { id: "verdura-nopales", group: "verduras", name: "Nopales", shortName: "Nopales", serving: "1 taza cocida", servingGrams: 100 },
  { id: "verdura-calabacita", group: "verduras", name: "Calabacita", shortName: "Calabacita", serving: "1 taza cocida", servingGrams: 100 },

  // ── Frutas ───────────────────────────────────────────
  { id: "fruta-manzana", group: "frutas", name: "Manzana", shortName: "Manzana", serving: "1 pieza mediana", servingGrams: 130 },
  { id: "fruta-platano", group: "frutas", name: "Plátano", shortName: "Plátano", serving: "1/2 pieza mediana", servingGrams: 70 },
  { id: "fruta-naranja", group: "frutas", name: "Naranja", shortName: "Naranja", serving: "1 pieza mediana", servingGrams: 130 },
  { id: "fruta-papaya", group: "frutas", name: "Papaya", shortName: "Papaya", serving: "1 taza picada", servingGrams: 140 },
  { id: "fruta-fresa", group: "frutas", name: "Fresa", shortName: "Fresa", serving: "1 taza entera", servingGrams: 150 },
  { id: "fruta-mango", group: "frutas", name: "Mango", shortName: "Mango", serving: "1/2 pieza", servingGrams: 100 },

  // ── Cereales sin grasa ──────────────────────────────
  { id: "cereal-tortilla-maiz", group: "cereales-sin-grasa", name: "Tortilla de maíz", shortName: "Tortilla", serving: "1 pieza (30g)", servingGrams: 30 },
  { id: "cereal-arroz", group: "cereales-sin-grasa", name: "Arroz blanco cocido", shortName: "Arroz", serving: "1/3 taza", servingGrams: 60 },
  { id: "cereal-pan-blanco", group: "cereales-sin-grasa", name: "Pan blanco", shortName: "Pan blanco", serving: "1 rebanada (25g)", servingGrams: 25 },
  { id: "cereal-avena", group: "cereales-sin-grasa", name: "Avena", shortName: "Avena", serving: "1/3 taza cruda", servingGrams: 27 },
  { id: "cereal-papa", group: "cereales-sin-grasa", name: "Papa cocida", shortName: "Papa", serving: "1/2 pieza", servingGrams: 80 },

  // ── Cereales con grasa ──────────────────────────────
  { id: "cereal-bolillo", group: "cereales-con-grasa", name: "Bolillo", shortName: "Bolillo", serving: "1/3 pieza (25g)", servingGrams: 25 },
  { id: "cereal-pan-tostado", group: "cereales-con-grasa", name: "Pan tostado", shortName: "Pan tostado", serving: "1 rebanada", servingGrams: 25 },

  // ── Leguminosas ─────────────────────────────────────
  { id: "legum-frijol", group: "leguminosas", name: "Frijol cocido", shortName: "Frijol", serving: "1/2 taza", servingGrams: 90 },
  { id: "legum-lenteja", group: "leguminosas", name: "Lenteja cocida", shortName: "Lenteja", serving: "1/2 taza", servingGrams: 90 },
  { id: "legum-garbanzo", group: "leguminosas", name: "Garbanzo cocido", shortName: "Garbanzo", serving: "1/2 taza", servingGrams: 90 },

  // ── AOA: muy bajo aporte ────────────────────────────
  { id: "aoa-pechuga-pollo", group: "aoa-muy-bajo", name: "Pechuga de pollo sin piel", shortName: "Pechuga pollo", serving: "30 g", servingGrams: 30 },
  { id: "aoa-pescado-blanco", group: "aoa-muy-bajo", name: "Pescado blanco (tilapia, huachinango)", shortName: "Pescado", serving: "30 g", servingGrams: 30 },

  // ── AOA: bajo aporte ────────────────────────────────
  { id: "aoa-huevo", group: "aoa-bajo", name: "Huevo entero", shortName: "Huevo", serving: "1 pieza (50g)", servingGrams: 50 },
  { id: "aoa-queso-panela", group: "aoa-bajo", name: "Queso panela", shortName: "Queso panela", serving: "30 g", servingGrams: 30 },

  // ── AOA: moderado aporte ────────────────────────────
  { id: "aoa-bistec-res", group: "aoa-moderado", name: "Bistec de res", shortName: "Bistec res", serving: "30 g", servingGrams: 30 },

  // ── AOA: alto aporte ────────────────────────────────
  { id: "aoa-queso-amarillo", group: "aoa-alto", name: "Queso amarillo", shortName: "Queso amarillo", serving: "30 g", servingGrams: 30 },

  // ── Leches ──────────────────────────────────────────
  { id: "leche-descremada", group: "leche-descremada", name: "Leche descremada", shortName: "Leche desc.", serving: "1 taza (240ml)", servingGrams: 240 },
  { id: "leche-semidescremada", group: "leche-semidescremada", name: "Leche semidescremada", shortName: "Leche semi.", serving: "1 taza (240ml)", servingGrams: 240 },
  { id: "leche-entera", group: "leche-entera", name: "Leche entera", shortName: "Leche entera", serving: "1 taza (240ml)", servingGrams: 240 },

  // ── Aceites sin proteína ────────────────────────────
  { id: "aceite-oliva", group: "aceites-sin-proteina", name: "Aceite de oliva", shortName: "Aceite oliva", serving: "1 cucharadita (5ml)", servingGrams: 5 },
  { id: "aceite-aguacate", group: "aceites-sin-proteina", name: "Aguacate", shortName: "Aguacate", serving: "1/3 pieza mediana", servingGrams: 35 },

  // ── Aceites con proteína ────────────────────────────
  { id: "aceite-nueces", group: "aceites-con-proteina", name: "Nueces", shortName: "Nueces", serving: "1 cucharada (10g)", servingGrams: 10 },

  // ── Azúcares sin grasa ──────────────────────────────
  { id: "azucar-miel", group: "azucares-sin-grasa", name: "Miel de abeja", shortName: "Miel", serving: "2 cucharaditas", servingGrams: 10 },

  // ── Azúcares con grasa ──────────────────────────────
  { id: "azucar-chocolate", group: "azucares-con-grasa", name: "Chocolate amargo (70%)", shortName: "Chocolate", serving: "1 cuadrito (10g)", servingGrams: 10 },
];

const FOOD_CATALOG: Record<FoodId, Food> = Object.fromEntries(
  FOOD_CATALOG_RAW.map((p) => [p.id, Food.create(p)]),
) as Record<FoodId, Food>;
