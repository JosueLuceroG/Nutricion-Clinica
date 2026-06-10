import type { MealSlot } from "@modules/mealplan/domain/MealSlot";

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

export async function generateMealPlan(input: ChefInput): Promise<ChefResult> {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY as string | undefined;
  if (!apiKey) {
    return { days: [], error: "VITE_OPENAI_API_KEY no configurada en .env" };
  }

  const slots = slotNamesForPrompt(input.timesPerDay);
  const slotsJson = JSON.stringify(slots.map((s) => ({
    slot: s,
    targetKcal: Math.round(input.targetKcal / input.timesPerDay),
  })));

  const prompt = `Eres un nutriólogo experto. Genera un plan de alimentación semanal con las siguientes características:

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

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => "");
      return { days: [], error: `OpenAI API error ${response.status}: ${errBody}` };
    }

    const data = (await response.json()) as { choices: Array<{ message: { content: string } }> };
    const text = data.choices?.[0]?.message?.content ?? "";
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
        kcal: m.kcal,
      })),
    }));
    return { days };
  } catch (err) {
    return { days: [], error: err instanceof Error ? err.message : "Error desconocido" };
  }
}
