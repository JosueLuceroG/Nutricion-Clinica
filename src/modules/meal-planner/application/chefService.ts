import type { MealSlot } from "@modules/mealplan/domain/MealSlot";
import { smaeService } from "@services/smaeService";
import type { Food } from "@modules/smae/domain";
import { aiClient } from "@services/ai/AIClient";

const SLOT_NAMES: Record<MealSlot, string> = {
  breakfast: "Desayuno",
  "morning-snack": "Colación matutina",
  lunch: "Comida",
  "afternoon-snack": "Colación vespertina",
  dinner: "Cena",
};

export type { MealSlot };

interface ChefInput {
  targetKcal: number;
  targetProteinPct: number;
  targetFatPct: number;
  targetCarbPct: number;
  timesPerDay: number;
  restrictions: string[];
  preferences: string;
  daysCount: number;
}

interface MealSuggestion {
  slot: MealSlot;
  foods: string[];
  foodIds: string[];
  kcal: number;
}

interface DaySuggestion {
  dayNumber: number;
  meals: MealSuggestion[];
  totalKcal: number;
}

interface ChefResult {
  days: DaySuggestion[];
  error?: string;
}

type ProgressCallback = (text: string) => void;

function slotNamesForPrompt(count: number): string[] {
  const all = Object.values(SLOT_NAMES);
  if (count <= 3) return all.slice(0, count);
  if (count === 4) return [all[0], all[1], all[2], all[4]];
  return all;
}

function mapSlotLabelToKey(label: string): MealSlot {
  const entry = Object.entries(SLOT_NAMES).find(([, v]) => v === label);
  return (entry?.[0] ?? "breakfast") as MealSlot;
}

function buildPrompt(input: ChefInput): string {
  const slots = slotNamesForPrompt(input.timesPerDay);
  const slotsJson = JSON.stringify(slots.map((s) => ({
    slot: s,
    targetKcal: Math.round(input.targetKcal / input.timesPerDay),
  })));

  return `Eres un nutriólogo experto. Genera un plan de alimentación semanal con las siguientes características:

- Calorías objetivo: ${input.targetKcal} kcal
- Distribución: ${input.targetProteinPct}% proteína, ${input.targetFatPct}% grasa, ${input.targetCarbPct}% carbohidratos
- Comidas al día: ${input.timesPerDay}
- Días a generar: ${input.daysCount}
- Restricciones: ${input.restrictions.length > 0 ? input.restrictions.join(", ") : "Ninguna"}
- Preferencias: ${input.preferences || "Ninguna"}

Tiempos de comida y calorías objetivo por tiempo:
${slotsJson}

Responde exclusivamente en formato JSON válido (sin markdown, sin explicación adicional):
{
  "days": [
    {
      "dayNumber": 1,
      "meals": [
        { "slot": "Desayuno", "foods": ["Ejemplo 1", "Ejemplo 2"], "kcal": 450 },
        { "slot": "Colación matutina", "foods": ["Ejemplo"], "kcal": 150 }
      ],
      "totalKcal": ${input.targetKcal}
    }
  ]
}

Cada día debe sumar aproximadamente ${input.targetKcal} kcal. Usa los nombres de slot exactamente como están en la lista de arriba. Los alimentos deben ser variados, realistas y adaptados a las restricciones/preferencias. Usa nombres de alimentos en español.`;
}

function parseJsonResponse(text: string): ChefResult {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return { days: [], error: "No se pudo extraer JSON de la respuesta" };
  }
  const parsed = JSON.parse(jsonMatch[0]) as { days: Array<{ dayNumber: number; meals: Array<{ slot: string; foods: string[]; kcal: number }>; totalKcal: number }> };
  if (!parsed.days || !Array.isArray(parsed.days)) {
    return { days: [], error: "Respuesta con formato inesperado" };
  }
  const days: DaySuggestion[] = parsed.days.map((d) => ({
    dayNumber: d.dayNumber,
    totalKcal: d.totalKcal,
    meals: d.meals.map((m) => ({
      slot: mapSlotLabelToKey(m.slot),
      foods: m.foods,
      foodIds: m.foods,
      kcal: m.kcal,
    })),
  }));
  return { days };
}

let smaeFoodCache: Food[] | null = null;

async function ensureSmaeCache(): Promise<Food[]> {
  if (smaeFoodCache) return smaeFoodCache;
  smaeFoodCache = await smaeService.search({});
  return smaeFoodCache;
}

async function enrichWithSmaeFoodIds(result: ChefResult): Promise<ChefResult> {
  if (!result.days?.length) return result;
  try {
    const allFoods = await ensureSmaeCache();
    return {
      ...result,
      days: result.days.map((day) => ({
        ...day,
        meals: day.meals.map((meal) => ({
          ...meal,
          foodIds: meal.foods.map((name) => {
            const normalizedQ = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            const matched = allFoods.find((f) => {
              const haystack = [f.name, f.shortName, ...f.keywords].map(
                (s) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""),
              );
              return haystack.some((h) => h.includes(normalizedQ) || normalizedQ.includes(h));
            });
            return matched?.id ?? name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
          }),
        })),
      })),
    };
  } catch {
    return result;
  }
}

export async function generateMealPlan(input: ChefInput, onProgress?: ProgressCallback): Promise<ChefResult> {
  const prompt = buildPrompt(input);
  const result = await generateWithBackendAi(prompt, onProgress);

  return enrichWithSmaeFoodIds(result);
}

async function generateWithBackendAi(prompt: string, onProgress?: ProgressCallback): Promise<ChefResult> {
  try {
    const response = await aiClient.complete({
      model: "gpt-4o-mini",
      systemPrompt: "Eres un nutriólogo experto. Responde solo con JSON válido para generar planes de alimentación.",
      userPrompt: prompt,
      temperature: 0.7,
      maxTokens: 4000,
    });
    onProgress?.(response.content);
    return parseJsonResponse(response.content);
  } catch (err) {
    return { days: [], error: err instanceof Error ? err.message : "Error desconocido" };
  }
}

