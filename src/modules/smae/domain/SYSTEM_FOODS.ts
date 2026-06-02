/**
 * Catálogo del sistema: 30 alimentos representativos del SMAE 5ª edición
 * agrupados por las 16 categorías canónicas. Inmutables, no se persisten.
 *
 * Los alimentos personalizados (custom=true) viven en IndexedDB
 * (Dexie, tabla `smae_custom_foods`, migración v3).
 */
import { Food, type FoodProps } from "./Food";

const SYSTEM_FOODS_RAW: FoodProps[] = [
  // ── Verduras ─────────────────────────────────────────
  { id: "verdura-acelga", group: "verduras", name: "Acelga", shortName: "Acelga", serving: "1 taza de hojas crudas", servingGrams: 50, keywords: ["hoja", "verde", "cocida"], custom: false },
  { id: "verdura-brocoli", group: "verduras", name: "Brócoli", shortName: "Brócoli", serving: "1 taza de floretes cocidos", servingGrams: 90, keywords: ["florete", "verde", "cocido"], custom: false },
  { id: "verdura-espinaca", group: "verduras", name: "Espinaca", shortName: "Espinaca", serving: "1 taza de hojas crudas", servingGrams: 50, keywords: ["hoja", "verde", "cocida"], custom: false },
  { id: "verdura-jitomate", group: "verduras", name: "Jitomate", shortName: "Jitomate", serving: "1 pieza mediana", servingGrams: 120, keywords: ["rojo", "tomate", "ensalada"], custom: false },
  { id: "verdura-zanahoria", group: "verduras", name: "Zanahoria", shortName: "Zanahoria", serving: "1/2 taza picada", servingGrams: 60, keywords: ["naranja", "cruda", "cocida"], custom: false },
  { id: "verdura-nopales", group: "verduras", name: "Nopales", shortName: "Nopales", serving: "1 taza cocida", servingGrams: 100, keywords: ["mexicano", "asado", "verde"], custom: false },
  { id: "verdura-calabacita", group: "verduras", name: "Calabacita", shortName: "Calabacita", serving: "1 taza cocida", servingGrams: 100, keywords: ["calabaza", "verde", "cocida"], custom: false },

  // ── Frutas ───────────────────────────────────────────
  { id: "fruta-manzana", group: "frutas", name: "Manzana", shortName: "Manzana", serving: "1 pieza mediana", servingGrams: 130, keywords: ["roja", "verde", "cruda"], custom: false },
  { id: "fruta-platano", group: "frutas", name: "Plátano", shortName: "Plátano", serving: "1/2 pieza mediana", servingGrams: 70, keywords: ["maduro", "tropical", "energía"], custom: false },
  { id: "fruta-naranja", group: "frutas", name: "Naranja", shortName: "Naranja", serving: "1 pieza mediana", servingGrams: 130, keywords: ["cítrica", "jugo", "vitamina c"], custom: false },
  { id: "fruta-papaya", group: "frutas", name: "Papaya", shortName: "Papaya", serving: "1 taza picada", servingGrams: 140, keywords: ["tropical", "digestiva", "mexicana"], custom: false },
  { id: "fruta-fresa", group: "frutas", name: "Fresa", shortName: "Fresa", serving: "1 taza entera", servingGrams: 150, keywords: ["roja", "dulce", "temporada"], custom: false },
  { id: "fruta-mango", group: "frutas", name: "Mango", shortName: "Mango", serving: "1/2 pieza", servingGrams: 100, keywords: ["tropical", "maduro", "mexicano"], custom: false },

  // ── Cereales sin grasa ──────────────────────────────
  { id: "cereal-tortilla-maiz", group: "cereales-sin-grasa", name: "Tortilla de maíz", shortName: "Tortilla", serving: "1 pieza (30g)", servingGrams: 30, keywords: ["maíz", "mexicana", "antojo", "básica"], custom: false },
  { id: "cereal-arroz", group: "cereales-sin-grasa", name: "Arroz blanco cocido", shortName: "Arroz", serving: "1/3 taza", servingGrams: 60, keywords: ["blanco", "cocido", "guarnición"], custom: false },
  { id: "cereal-pan-blanco", group: "cereales-sin-grasa", name: "Pan blanco", shortName: "Pan blanco", serving: "1 rebanada (25g)", servingGrams: 25, keywords: ["rebanada", "básico", "desayuno"], custom: false },
  { id: "cereal-avena", group: "cereales-sin-grasa", name: "Avena", shortName: "Avena", serving: "1/3 taza cruda", servingGrams: 27, keywords: ["hojuela", "fibra", "desayuno"], custom: false },
  { id: "cereal-papa", group: "cereales-sin-grasa", name: "Papa cocida", shortName: "Papa", serving: "1/2 pieza", servingGrams: 80, keywords: ["cocida", "puré", "guarnición"], custom: false },

  // ── Cereales con grasa ──────────────────────────────
  { id: "cereal-bolillo", group: "cereales-con-grasa", name: "Bolillo", shortName: "Bolillo", serving: "1/3 pieza (25g)", servingGrams: 25, keywords: ["pan", "mexicano", "tortas"], custom: false },
  { id: "cereal-pan-tostado", group: "cereales-con-grasa", name: "Pan tostado", shortName: "Pan tostado", serving: "1 rebanada", servingGrams: 25, keywords: ["crujiente", "desayuno"], custom: false },

  // ── Leguminosas ─────────────────────────────────────
  { id: "legum-frijol", group: "leguminosas", name: "Frijol cocido", shortName: "Frijol", serving: "1/2 taza", servingGrams: 90, keywords: ["negro", "mexicano", "básico", "proteína"], custom: false },
  { id: "legum-lenteja", group: "leguminosas", name: "Lenteja cocida", shortName: "Lenteja", serving: "1/2 taza", servingGrams: 90, keywords: ["proteína", "hierro", "sopa"], custom: false },
  { id: "legum-garbanzo", group: "leguminosas", name: "Garbanzo cocido", shortName: "Garbanzo", serving: "1/2 taza", servingGrams: 90, keywords: ["proteína", "mediterráneo", "ensalada"], custom: false },

  // ── AOA: muy bajo aporte ────────────────────────────
  { id: "aoa-pechuga-pollo", group: "aoa-muy-bajo", name: "Pechuga de pollo sin piel", shortName: "Pechuga pollo", serving: "30 g", servingGrams: 30, keywords: ["pollo", "proteína", "magra", "plancha"], custom: false },
  { id: "aoa-pescado-blanco", group: "aoa-muy-bajo", name: "Pescado blanco (tilapia, huachinango)", shortName: "Pescado", serving: "30 g", servingGrams: 30, keywords: ["tilapia", "huachinango", "proteína", "omega"], custom: false },

  // ── AOA: bajo aporte ────────────────────────────────
  { id: "aoa-huevo", group: "aoa-bajo", name: "Huevo entero", shortName: "Huevo", serving: "1 pieza (50g)", servingGrams: 50, keywords: ["proteína", "desayuno", "básico"], custom: false },
  { id: "aoa-queso-panela", group: "aoa-bajo", name: "Queso panela", shortName: "Queso panela", serving: "30 g", servingGrams: 30, keywords: ["queso", "fresco", "mexicano"], custom: false },

  // ── AOA: moderado aporte ────────────────────────────
  { id: "aoa-bistec-res", group: "aoa-moderado", name: "Bistec de res", shortName: "Bistec res", serving: "30 g", servingGrams: 30, keywords: ["res", "plancha", "hierro"], custom: false },

  // ── AOA: alto aporte ────────────────────────────────
  { id: "aoa-queso-amarillo", group: "aoa-alto", name: "Queso amarillo", shortName: "Queso amarillo", serving: "30 g", servingGrams: 30, keywords: ["queso", "procesado", "graso"], custom: false },

  // ── Leches ──────────────────────────────────────────
  { id: "leche-descremada", group: "leche-descremada", name: "Leche descremada", shortName: "Leche desc.", serving: "1 taza (240ml)", servingGrams: 240, keywords: ["light", "baja en grasa", "calcio"], custom: false },
  { id: "leche-semidescremada", group: "leche-semidescremada", name: "Leche semidescremada", shortName: "Leche semi.", serving: "1 taza (240ml)", servingGrams: 240, keywords: ["media grasa", "calcio"], custom: false },
  { id: "leche-entera", group: "leche-entera", name: "Leche entera", shortName: "Leche entera", serving: "1 taza (240ml)", servingGrams: 240, keywords: ["completa", "calcio", "niños"], custom: false },

  // ── Aceites sin proteína ────────────────────────────
  { id: "aceite-oliva", group: "aceites-sin-proteina", name: "Aceite de oliva", shortName: "Aceite oliva", serving: "1 cucharadita (5ml)", servingGrams: 5, keywords: ["extra virgen", "mediterráneo", "grasa buena"], custom: false },
  { id: "aceite-aguacate", group: "aceites-sin-proteina", name: "Aguacate", shortName: "Aguacate", serving: "1/3 pieza mediana", servingGrams: 35, keywords: ["mexicano", "grasa buena", "guacamole"], custom: false },

  // ── Aceites con proteína ────────────────────────────
  { id: "aceite-nueces", group: "aceites-con-proteina", name: "Nueces", shortName: "Nueces", serving: "1 cucharada (10g)", servingGrams: 10, keywords: ["nuez", "omega 3", "fruto seco"], custom: false },

  // ── Azúcares sin grasa ──────────────────────────────
  { id: "azucar-miel", group: "azucares-sin-grasa", name: "Miel de abeja", shortName: "Miel", serving: "2 cucharaditas", servingGrams: 10, keywords: ["endulzante", "natural"], custom: false },

  // ── Azúcares con grasa ──────────────────────────────
  { id: "azucar-chocolate", group: "azucares-con-grasa", name: "Chocolate amargo (70%)", shortName: "Chocolate", serving: "1 cuadrito (10g)", servingGrams: 10, keywords: ["amargo", "cacao", "antojo"], custom: false },
];

const SYSTEM_FOODS_MAP: ReadonlyMap<string, Food> = new Map(
  SYSTEM_FOODS_RAW.map((p) => [p.id, Food.create(p)] as const),
);

export const SYSTEM_FOODS: readonly Food[] = Array.from(SYSTEM_FOODS_MAP.values());

export const getSystemFoods = (): readonly Food[] => SYSTEM_FOODS;

export const getSystemFoodById = (id: string): Food | null => SYSTEM_FOODS_MAP.get(id) ?? null;

export const getSystemFoodsByGroup = (): ReadonlyMap<string, readonly Food[]> => {
  const out = new Map<string, Food[]>();
  for (const food of SYSTEM_FOODS) {
    const list = out.get(food.group) ?? [];
    list.push(food);
    out.set(food.group, list);
  }
  return out;
};
