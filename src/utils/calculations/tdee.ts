/**
 * TDEE — Total Daily Energy Expenditure.
 *
 * TDEE = BMR × factor de actividad
 *
 * Factores (sedentario → extremadamente activo) según Harris-Benedict:
 *   - 1.2   Sedentario (poco o nada de ejercicio)
 *   - 1.375 Ligeramente activo (ejercicio ligero 1-3 días/semana)
 *   - 1.55  Moderadamente activo (ejercicio moderado 3-5 días/semana)
 *   - 1.725 Muy activo (ejercicio intenso 6-7 días/semana)
 *   - 1.9   Extremadamente activo (ejercicio muy intenso, trabajo físico)
 */
export type ActivityFactor = 1.2 | 1.375 | 1.55 | 1.725 | 1.9;

export const ActivityLevel = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  veryActive: 1.9,
} as const satisfies Record<string, ActivityFactor>;

export type ActivityLevelKey = keyof typeof ActivityLevel;

export const ActivityLevelLabel: Record<ActivityLevelKey, string> = {
  sedentary: "Sedentario",
  light: "Ligeramente activo",
  moderate: "Moderadamente activo",
  active: "Muy activo",
  veryActive: "Extremadamente activo",
};

export const ActivityLevelDescription: Record<ActivityLevelKey, string> = {
  sedentary: "Trabajo de oficina, poco o nada de ejercicio",
  light: "Ejercicio ligero 1-3 días/semana",
  moderate: "Ejercicio moderado 3-5 días/semana",
  active: "Ejercicio intenso 6-7 días/semana",
  veryActive: "Ejercicio muy intenso diario o trabajo físico",
};

export const calculateTDEE = (bmrKcal: number, factor: ActivityFactor): number => {
  if (!Number.isFinite(bmrKcal) || bmrKcal <= 0) {
    throw new RangeError("El BMR debe ser un número positivo.");
  }
  if (!Object.values(ActivityLevel).includes(factor)) {
    throw new RangeError(`Factor de actividad inválido: ${factor}`);
  }
  return Math.round(bmrKcal * factor);
};

/**
 * Distribución de kcal en macronutrientes según % objetivos.
 */
export type MacroDistribution = {
  carbsPct: number;
  proteinPct: number;
  fatPct: number;
};

export interface MacroGrams {
  carbsG: number;
  proteinG: number;
  fatG: number;
  kcalFromCarbs: number;
  kcalFromProtein: number;
  kcalFromFat: number;
}

const KCAL_PER_GRAM = {
  carbs: 4,
  protein: 4,
  fat: 9,
} as const;

export const distributionToGrams = (
  totalKcal: number,
  distribution: MacroDistribution,
): MacroGrams => {
  const { carbsPct, proteinPct, fatPct } = distribution;
  const total = carbsPct + proteinPct + fatPct;
  if (Math.abs(total - 100) > 0.01) {
    throw new RangeError(
      `La distribución de macronutrientes debe sumar 100% (recibido: ${total}%).`,
    );
  }
  for (const [name, pct] of Object.entries(distribution)) {
    if (pct < 0 || pct > 100) {
      throw new RangeError(`Porcentaje de ${name} fuera de rango: ${pct}%`);
    }
  }

  const kcalFromCarbs = (totalKcal * carbsPct) / 100;
  const kcalFromProtein = (totalKcal * proteinPct) / 100;
  const kcalFromFat = (totalKcal * fatPct) / 100;

  return {
    carbsG: Math.round(kcalFromCarbs / KCAL_PER_GRAM.carbs),
    proteinG: Math.round(kcalFromProtein / KCAL_PER_GRAM.protein),
    fatG: Math.round(kcalFromFat / KCAL_PER_GRAM.fat),
    kcalFromCarbs: Math.round(kcalFromCarbs),
    kcalFromProtein: Math.round(kcalFromProtein),
    kcalFromFat: Math.round(kcalFromFat),
  };
};
