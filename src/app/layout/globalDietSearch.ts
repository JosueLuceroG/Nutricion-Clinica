import type {
  GlobalSearchFoodConstraint,
  GlobalSearchMealSlot,
  GlobalSearchNumericFilter,
  GlobalSearchPlanMetadata,
  GlobalSearchResult,
  ParsedGlobalSearch,
  ParsedGlobalSearchFilters,
} from "./globalSearchTypes";

type NormalizeSearchText = (value: string) => string;

const DIET_ALIASES = [
  "propuesta nutricional",
  "propuestas nutricionales",
  "prescripcion dietetica",
  "prescripciones dieteticas",
  "programa alimentario",
  "programas alimentarios",
  "programa nutricional",
  "programas nutricionales",
  "protocolo alimentario",
  "protocolos alimentarios",
  "esquema alimentario",
  "esquemas alimentarios",
  "esquema nutricional",
  "esquemas nutricionales",
  "regimen alimentario",
  "regimenes alimentarios",
  "regimen nutricional",
  "regimenes nutricionales",
  "pauta alimentaria",
  "pautas alimentarias",
  "pauta nutricional",
  "pautas nutricionales",
  "plan de alimentacion",
  "planes de alimentacion",
  "plan alimentario",
  "planes alimentarios",
  "plan alimenticio",
  "planes alimenticios",
  "plan nutricional",
  "planes nutricionales",
  "menu alimentario",
  "menus alimentarios",
  "menu nutricional",
  "menus nutricionales",
  "menu diario",
  "menus diarios",
  "alimentacion",
  "alimentaciones",
  "dietas",
  "dieta",
  "planes",
  "plan",
  "menus",
  "menu",
  "regimenes",
  "regimen",
  "meal plans",
  "meal plan",
  "nutrition plans",
  "nutrition plan",
  "eating plans",
  "eating plan",
  "menus",
  "menu",
  "diets",
  "diet",
] as const;

const CALORIE_UNIT =
  "(?:kcal|kc|cal|calorias?|kilocalorias?|calories?|kilocalories?)";

const NUMBER_WORDS: Record<string, number> = {
  un: 1,
  una: 1,
  uno: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
};

const NUMBER_LABELS: Record<number, string[]> = {
  1: ["1", "un", "una", "uno", "one"],
  2: ["2", "dos", "two"],
  3: ["3", "tres", "three"],
  4: ["4", "cuatro", "four"],
  5: ["5", "cinco", "five"],
  6: ["6", "seis", "six"],
  7: ["7", "siete", "seven"],
};

const SLOT_ALIASES: Array<{
  pattern: RegExp;
  slots: GlobalSearchMealSlot[];
}> = [
  {
    pattern: /(?:en|para)\s+(?:el\s+)?(?:desayuno|breakfast)\b/,
    slots: ["breakfast"],
  },
  {
    pattern: /(?:en|para)\s+(?:la\s+)?(?:comida|almuerzo|lunch|mediodia)\b/,
    slots: ["lunch"],
  },
  {
    pattern: /(?:en|para)\s+(?:la\s+)?(?:cena|dinner)\b/,
    slots: ["dinner"],
  },
  {
    pattern:
      /(?:en|para)\s+(?:la\s+)?(?:colacion matutina|colacion de la manana|snack matutino|morning snack)\b/,
    slots: ["morning-snack"],
  },
  {
    pattern:
      /(?:en|para)\s+(?:la\s+)?(?:colacion vespertina|colacion de la tarde|snack vespertino|afternoon snack)\b/,
    slots: ["afternoon-snack"],
  },
  {
    pattern: /(?:en|para)\s+(?:la\s+)?(?:colacion|colaciones|snack)\b/,
    slots: ["morning-snack", "afternoon-snack"],
  },
];

const FOOD_CONCEPT_ALIASES: Record<string, string[]> = {
  pescado: [
    "pescado",
    "pescados",
    "atun",
    "salmon",
    "tilapia",
    "huachinango",
    "bacalao",
    "sardina",
    "trucha",
    "fish",
    "tuna",
    "salmon",
    "cod",
    "sardine",
    "trout",
  ],
  pollo: ["pollo", "pechuga", "ave", "aves", "chicken", "poultry"],
  carne: [
    "carne",
    "carnes",
    "res",
    "bistec",
    "ternera",
    "cerdo",
    "puerco",
    "lomo",
    "cordero",
    "meat",
    "beef",
    "pork",
    "lamb",
  ],
  lacteos: [
    "lacteo",
    "lacteos",
    "leche",
    "lactosa",
    "queso",
    "yogur",
    "yogurt",
    "dairy",
  ],
  gluten: ["gluten", "trigo", "cebada", "centeno"],
  nueces: [
    "nuez",
    "nueces",
    "almendra",
    "almendras",
    "avellana",
    "avellanas",
    "cacahuate",
    "cacahuates",
    "fruto seco",
    "frutos secos",
    "nut",
    "nuts",
  ],
  huevo: ["huevo", "huevos", "egg", "eggs"],
  frutas: ["fruta", "frutas", "frutal", "fruit", "fruits"],
  verduras: [
    "verdura",
    "verduras",
    "vegetal",
    "vegetales",
    "hortaliza",
    "vegetable",
    "vegetables",
  ],
  cereales: ["cereal", "cereales", "grano", "granos", "grain", "grains"],
  leguminosas: [
    "leguminosa",
    "leguminosas",
    "legumbre",
    "legumbres",
    "legume",
    "legumes",
  ],
  aceites: ["aceite", "aceites", "grasa", "grasas"],
  azucares: ["azucar", "azucares", "dulce", "dulces", "endulzante"],
};

const FOOD_FILLER_WORDS =
  /^(?:(?:de|del|la|el|los|las|alimento|alimentos|comida|comidas|food|foods)\s+)+/;
const LIST_SEPARATOR = "dietlistseparator";

function removeMatch(value: string, match: RegExpMatchArray): string {
  const start = match.index ?? 0;
  return `${value.slice(0, start)} ${value.slice(start + match[0].length)}`;
}

function compact(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .replace(/^(?:de|y|e|ni)\s+|\s+(?:y|e|ni)$/g, "")
    .trim();
}

function boundedEditDistance(left: string, right: string): number {
  if (left === right) return 0;
  const rows = Array.from({ length: left.length + 1 }, (_, index) => index);
  for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
    let previousDiagonal = rows[0] ?? 0;
    rows[0] = rightIndex;
    for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
      const previousRow = rows[leftIndex] ?? 0;
      const substitution =
        previousDiagonal +
        (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1);
      rows[leftIndex] = Math.min(
        (rows[leftIndex] ?? 0) + 1,
        (rows[leftIndex - 1] ?? 0) + 1,
        substitution,
      );
      previousDiagonal = previousRow;
    }
  }
  return rows[left.length] ?? Math.max(left.length, right.length);
}

function findDietRemainder(query: string): string | null {
  for (const alias of DIET_ALIASES) {
    if (query === alias) return "";
    if (query.startsWith(`${alias} `)) return query.slice(alias.length + 1);
  }

  const [firstWord = "", ...remaining] = query.split(" ");
  const shortAliases = ["dieta", "plan", "menu", "regimen", "alimentacion"];
  const closeAlias = shortAliases.some(
    (alias) => boundedEditDistance(firstWord, alias) <= 2,
  );
  return closeAlias ? remaining.join(" ") : null;
}

function parseNumber(value: string): number | null {
  if (/^\d+$/.test(value)) return Number(value);
  return NUMBER_WORDS[value] ?? null;
}

function extractNumericFilter(
  source: string,
  unitPattern: string,
): { rest: string; filter?: GlobalSearchNumericFilter } {
  const patterns: Array<{
    regex: RegExp;
    build: (match: RegExpMatchArray) => GlobalSearchNumericFilter;
  }> = [
    {
      regex: new RegExp(
        `\\bentre\\s+(\\d+)\\s*(?:${unitPattern})?\\s+(?:y|a)\\s+(\\d+)\\s*(?:${unitPattern})\\b`,
      ),
      build: (match) => ({ min: Number(match[1]), max: Number(match[2]) }),
    },
    {
      regex: new RegExp(
        `\\b(?:aprox(?:imadamente)?|alrededor de|cerca de)\\s+(\\d+)\\s*(?:${unitPattern})\\b`,
      ),
      build: (match) => ({
        min: Number(match[1]) * 0.95,
        max: Number(match[1]) * 1.05,
      }),
    },
    {
      regex: new RegExp(
        `\\b(?:menos de|menor a|hasta|maximo)\\s+(\\d+)\\s*(?:${unitPattern})\\b`,
      ),
      build: (match) => ({ max: Number(match[1]), maxExclusive: true }),
    },
    {
      regex: new RegExp(
        `\\b(?:mas de|mayor a|desde|minimo)\\s+(\\d+)\\s*(?:${unitPattern})\\b`,
      ),
      build: (match) => ({ min: Number(match[1]), minExclusive: true }),
    },
    {
      regex: new RegExp(`\\b(?:de\\s+)?(\\d+)\\s*(?:${unitPattern})\\b`),
      build: (match) => ({ min: Number(match[1]), max: Number(match[1]) }),
    },
  ];

  for (const candidate of patterns) {
    const match = source.match(candidate.regex);
    if (!match) continue;
    return { rest: removeMatch(source, match), filter: candidate.build(match) };
  }
  return { rest: source };
}

function extractMacroFilter(
  source: string,
  aliases: string,
): { rest: string; filter?: GlobalSearchNumericFilter } {
  const subject = `(?:${aliases})`;
  const patterns: Array<{
    regex: RegExp;
    build: (match: RegExpMatchArray) => GlobalSearchNumericFilter;
  }> = [
    {
      regex: new RegExp(
        `\\bentre\\s+(\\d+)\\s*(?:g|gr|gramos)?\\s+(?:y|a)\\s+(\\d+)\\s*(?:g|gr|gramos)\\s+(?:de\\s+)?${subject}\\b`,
      ),
      build: (match) => ({ min: Number(match[1]), max: Number(match[2]) }),
    },
    {
      regex: new RegExp(
        `\\b(?:aprox(?:imadamente)?|alrededor de|cerca de)\\s+(\\d+)\\s*(?:g|gr|gramos)\\s+(?:de\\s+)?${subject}\\b`,
      ),
      build: (match) => ({
        min: Number(match[1]) * 0.95,
        max: Number(match[1]) * 1.05,
      }),
    },
    {
      regex: new RegExp(
        `\\b(?:menos de|hasta|maximo)\\s+(\\d+)\\s*(?:g|gr|gramos)\\s+(?:de\\s+)?${subject}\\b`,
      ),
      build: (match) => ({ max: Number(match[1]), maxExclusive: true }),
    },
    {
      regex: new RegExp(
        `\\b(?:mas de|desde|minimo)\\s+(\\d+)\\s*(?:g|gr|gramos)\\s+(?:de\\s+)?${subject}\\b`,
      ),
      build: (match) => ({ min: Number(match[1]), minExclusive: true }),
    },
    {
      regex: new RegExp(
        `\\b(\\d+)\\s*(?:g|gr|gramos)\\s+(?:de\\s+)?${subject}\\b`,
      ),
      build: (match) => ({ min: Number(match[1]), max: Number(match[1]) }),
    },
    {
      regex: new RegExp(
        `\\b${subject}\\s+(?:de\\s+)?(\\d+)\\s*(?:g|gr|gramos)\\b`,
      ),
      build: (match) => ({ min: Number(match[1]), max: Number(match[1]) }),
    },
  ];

  for (const candidate of patterns) {
    const match = source.match(candidate.regex);
    if (!match) continue;
    return { rest: removeMatch(source, match), filter: candidate.build(match) };
  }
  return { rest: source };
}

function parseFoodConstraint(value: string): GlobalSearchFoodConstraint | null {
  let remaining = compact(value).replace(FOOD_FILLER_WORDS, "");
  if (!remaining) return null;

  let mealSlots: GlobalSearchMealSlot[] | undefined;
  for (const alias of SLOT_ALIASES) {
    const match = remaining.match(alias.pattern);
    if (!match) continue;
    mealSlots = alias.slots;
    remaining = removeMatch(remaining, match);
    break;
  }

  let minMealSlots: number | undefined;
  let period: "day" | "week" | undefined;
  const frequency = remaining.match(
    /\b(\d+|un|una|uno|dos|tres|cuatro|cinco|seis|siete|one|two|three|four|five|six|seven)\s+(?:veces?|times?)(?:\s+(?:al|por|per)\s+(dia|semana|day|week))?\b/,
  );
  if (frequency?.[1]) {
    minMealSlots = parseNumber(frequency[1]) ?? undefined;
    period = ["semana", "week"].includes(frequency[2] ?? "") ? "week" : "day";
    remaining = removeMatch(remaining, frequency);
  }

  const term = compact(remaining).replace(FOOD_FILLER_WORDS, "");
  if (!term) return null;
  return {
    term,
    ...(mealSlots ? { mealSlots } : {}),
    ...(minMealSlots ? { minMealSlots, period } : {}),
  };
}

function splitFoodList(value: string): string[] {
  return value
    .replace(/\s+(?:y|e|ni|and|nor)\s*$/g, "")
    .split(
      new RegExp(
        `\\s*(?:,|;|\\b${LIST_SEPARATOR}\\b|\\by\\b|\\be\\b|\\bni\\b|\\band\\b|\\bnor\\b)\\s*`,
      ),
    )
    .map(compact)
    .filter(Boolean);
}

function extractFoodClauses(source: string): {
  rest: string;
  includes: GlobalSearchFoodConstraint[];
  excludes: GlobalSearchFoodConstraint[];
} {
  const controls = [...source.matchAll(/\b(con|sin|with|without)\b/g)];
  if (controls.length === 0) {
    const standalone = parseFoodConstraint(source);
    return standalone?.minMealSlots
      ? { rest: "", includes: [standalone], excludes: [] }
      : { rest: source, includes: [], excludes: [] };
  }

  const includes: GlobalSearchFoodConstraint[] = [];
  const excludes: GlobalSearchFoodConstraint[] = [];
  let rest = source.slice(0, controls[0]?.index ?? 0);

  controls.forEach((control, index) => {
    const start = (control.index ?? 0) + control[0].length;
    const end = controls[index + 1]?.index ?? source.length;
    const target = ["sin", "without"].includes(control[1] ?? "")
      ? excludes
      : includes;
    for (const part of splitFoodList(source.slice(start, end))) {
      const constraint = parseFoodConstraint(part);
      if (constraint) target.push(constraint);
    }
  });

  rest = compact(rest);
  return { rest, includes, excludes };
}

export function parseNaturalDietSearch(
  rawQuery: string,
  normalize: NormalizeSearchText,
): ParsedGlobalSearch | null {
  const normalized = normalize(
    rawQuery.replace(/[,;]/g, ` ${LIST_SEPARATOR} `),
  );
  let rest = findDietRemainder(normalized);
  if (rest === null) return null;

  const filters: ParsedGlobalSearchFilters = {};
  rest = rest.replace(/^de\s+(?!\d)/, "");

  const calorie = extractNumericFilter(rest, CALORIE_UNIT);
  rest = calorie.rest;
  if (calorie.filter) filters.planKcal = calorie.filter;

  const protein = extractMacroFilter(rest, "proteinas?|protein");
  rest = protein.rest;
  if (protein.filter) filters.proteinG = protein.filter;

  const carbs = extractMacroFilter(
    rest,
    "carbohidratos?|carbos?|hidratos de carbono|carbohydrates?|carbs?",
  );
  rest = carbs.rest;
  if (carbs.filter) filters.carbsG = carbs.filter;

  const fat = extractMacroFilter(rest, "grasas?|lipidos?|fats?");
  rest = fat.rest;
  if (fat.filter) filters.fatG = fat.filter;

  const statusMatch = rest.match(
    /\b(activos?|activas?|active|borradores?|draft|completados?|completadas?|completed|cancelados?|canceladas?|cancelled)\b/,
  );
  if (statusMatch) {
    const status = statusMatch[1] ?? "";
    filters.status = status.startsWith("activ")
      ? "active"
      : status.startsWith("borr") || status === "draft"
        ? "draft"
        : status.startsWith("complet")
          ? "completed"
          : "cancelled";
    rest = removeMatch(rest, statusMatch);
  }

  const patientMatch = rest.match(
    /\b(?:para|for)\s+(.+?)(?=\s+(?:con|sin|with|without|entre|menos|mas|aprox|alrededor|cerca)\b|$)/,
  );
  if (patientMatch?.[1]) {
    filters.patient = compact(patientMatch[1]);
    rest = removeMatch(rest, patientMatch);
  }

  const foodClauses = extractFoodClauses(compact(rest));
  rest = foodClauses.rest;
  if (foodClauses.includes.length > 0)
    filters.foodIncludes = foodClauses.includes;
  if (foodClauses.excludes.length > 0)
    filters.foodExcludes = foodClauses.excludes;

  return {
    text: compact(rest),
    category: "plans",
    filters,
    errors: [],
  };
}

function matchesNumber(
  value: number,
  filter?: GlobalSearchNumericFilter,
): boolean {
  if (!filter) return true;
  if (filter.min !== undefined) {
    if (filter.minExclusive ? value <= filter.min : value < filter.min)
      return false;
  }
  if (filter.max !== undefined) {
    if (filter.maxExclusive ? value >= filter.max : value > filter.max)
      return false;
  }
  return true;
}

function conceptVariants(term: string): string[] {
  for (const [canonical, aliases] of Object.entries(FOOD_CONCEPT_ALIASES)) {
    if (
      term === canonical ||
      aliases.some(
        (alias) =>
          term === alias ||
          (Math.min(term.length, alias.length) >= 5 &&
            boundedEditDistance(term, alias) <= 2),
      )
    ) {
      return aliases;
    }
  }
  return [term];
}

function textMatchesVariant(text: string, variant: string): boolean {
  if (text.includes(variant)) return true;
  const words = text.split(/[^a-z0-9]+/).filter(Boolean);
  return variant
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .every((token) =>
      words.some(
        (word) =>
          word.startsWith(token) ||
          token.startsWith(word) ||
          (Math.min(word.length, token.length) >= 5 &&
            boundedEditDistance(word, token) <= 2),
      ),
    );
}

function foodMatchesConstraint(
  food: GlobalSearchPlanMetadata["foods"][number],
  constraint: GlobalSearchFoodConstraint,
  normalize: NormalizeSearchText,
): boolean {
  if (constraint.mealSlots && !constraint.mealSlots.includes(food.mealSlot))
    return false;
  const text = normalize(food.searchText);
  return conceptVariants(normalize(constraint.term)).some((variant) =>
    textMatchesVariant(text, variant),
  );
}

function matchesWeeklyFrequency(
  metadata: GlobalSearchPlanMetadata,
  constraint: GlobalSearchFoodConstraint,
  normalize: NormalizeSearchText,
): boolean {
  const text = normalize(metadata.freeText);
  const frequency = constraint.minMealSlots ?? 1;
  const numberLabels = NUMBER_LABELS[frequency] ?? [String(frequency)];
  const hasFrequency = numberLabels.some(
    (label) =>
      text.includes(`${label} vez por semana`) ||
      text.includes(`${label} veces por semana`) ||
      text.includes(`${label} time per week`) ||
      text.includes(`${label} times per week`),
  );
  const hasTerm = conceptVariants(normalize(constraint.term)).some((variant) =>
    textMatchesVariant(text, variant),
  );
  return hasFrequency && hasTerm;
}

function matchesFoodInclusion(
  metadata: GlobalSearchPlanMetadata,
  constraint: GlobalSearchFoodConstraint,
  normalize: NormalizeSearchText,
): boolean {
  const matchingFoods = metadata.foods.filter((food) =>
    foodMatchesConstraint(food, constraint, normalize),
  );
  if (matchingFoods.length === 0) return false;
  if (!constraint.minMealSlots) return true;
  if (constraint.period === "week")
    return matchesWeeklyFrequency(metadata, constraint, normalize);
  return (
    new Set(matchingFoods.map((food) => food.mealSlot)).size >=
    constraint.minMealSlots
  );
}

export function matchesNaturalDietFilters(
  result: GlobalSearchResult,
  filters: ParsedGlobalSearchFilters,
  normalize: NormalizeSearchText,
): boolean {
  const hasPlanFilters = Boolean(
    filters.planKcal ||
    filters.proteinG ||
    filters.carbsG ||
    filters.fatG ||
    filters.foodIncludes?.length ||
    filters.foodExcludes?.length,
  );
  if (!hasPlanFilters) return true;
  const metadata = result.planMetadata;
  if (!metadata) return false;
  if (!matchesNumber(metadata.kcalTarget, filters.planKcal)) return false;
  if (!matchesNumber(metadata.proteinTargetG, filters.proteinG)) return false;
  if (!matchesNumber(metadata.carbsTargetG, filters.carbsG)) return false;
  if (!matchesNumber(metadata.fatTargetG, filters.fatG)) return false;
  if (
    filters.foodIncludes &&
    !filters.foodIncludes.every((constraint) =>
      matchesFoodInclusion(metadata, constraint, normalize),
    )
  )
    return false;
  if (filters.foodExcludes?.length) {
    if (!metadata.completeFoodIndex) return false;
    if (
      filters.foodExcludes.some((constraint) =>
        metadata.foods.some((food) =>
          foodMatchesConstraint(food, constraint, normalize),
        ),
      )
    )
      return false;
  }
  return true;
}

export function hasNaturalDietFilters(
  filters: ParsedGlobalSearchFilters,
): boolean {
  return Boolean(
    filters.planKcal ||
    filters.proteinG ||
    filters.carbsG ||
    filters.fatG ||
    filters.foodIncludes?.length ||
    filters.foodExcludes?.length,
  );
}
