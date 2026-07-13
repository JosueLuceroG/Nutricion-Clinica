import type {
  GlobalSearchCategory,
  GlobalSearchResult,
  ParsedGlobalSearch,
} from "./globalSearchTypes";

const OPERATOR_PATTERN =
  /(?:^|\s)(paciente|patient|tel|phone|correo|email|fecha|date|estado|status|consulta|consultation|plan|lab|laboratorio|laboratory|receta|recipe|calor[ií]as|calories|kcal|tipo|type):(?:"([^"]+)"|(\S+))/gi;

const OPERATOR_ALIASES: Record<string, string> = {
  patient: "paciente",
  phone: "tel",
  email: "correo",
  date: "fecha",
  status: "estado",
  consultation: "consulta",
  laboratorio: "lab",
  laboratory: "lab",
  recipe: "receta",
  "calorías": "calorias",
  calories: "calorias",
  kcal: "calorias",
  type: "tipo",
};

const STATUS_ALIASES: Record<string, string> = {
  activo: "active",
  activa: "active",
  active: "active",
  inactivo: "inactive",
  inactive: "inactive",
  archivado: "archived",
  archivada: "archived",
  archived: "archived",
  fallecido: "deceased",
  deceased: "deceased",
  agendada: "scheduled",
  agendado: "scheduled",
  programada: "scheduled",
  scheduled: "scheduled",
  confirmada: "confirmed",
  confirmed: "confirmed",
  "en curso": "in-progress",
  "in progress": "in-progress",
  "in-progress": "in-progress",
  in_progress: "in-progress",
  completada: "completed",
  completado: "completed",
  completed: "completed",
  cancelada: "cancelled",
  cancelado: "cancelled",
  cancelled: "cancelled",
  canceled: "cancelled",
  "no asistio": "no-show",
  "no show": "no-show",
  no_show: "no-show",
  reagendada: "rescheduled",
  reprogramada: "rescheduled",
  rescheduled: "rescheduled",
  borrador: "draft",
  draft: "draft",
};

export function normalizeSearchText(value: string): string {
  return value
    .toLocaleLowerCase("es-MX")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9@.+\-\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeSearchPhone(value: string): string {
  return value.replace(/\D/g, "");
}

function categoryFromOperator(
  operator: string,
  value: string,
): GlobalSearchCategory | null {
  if (operator === "consulta") return "consultations";
  if (operator === "plan") return "plans";
  if (operator === "lab") return "laboratory";
  if (operator === "receta") return "recipes";
  if (operator !== "tipo") return null;

  const normalized = normalizeSearchText(value);
  if (normalized.startsWith("pacient")) return "patients";
  if (normalized.startsWith("consult")) return "consultations";
  if (normalized.startsWith("plan")) return "plans";
  if (normalized.startsWith("lab")) return "laboratory";
  if (normalized.startsWith("recet") || normalized.startsWith("recipe"))
    return "recipes";
  if (
    normalized.startsWith("accion") ||
    normalized.startsWith("comando") ||
    normalized.startsWith("action") ||
    normalized.startsWith("command")
  )
    return "actions";
  return null;
}

export function parseGlobalSearch(rawQuery: string): ParsedGlobalSearch {
  const normalizedQuery = normalizeSearchText(rawQuery);
  if (/^consultas? de hoy$/.test(normalizedQuery)) {
    return {
      text: "",
      category: "consultations",
      filters: { date: "hoy" },
      errors: [],
    };
  }
  if (/^today s consultations?$/.test(normalizedQuery)) {
    return {
      text: "",
      category: "consultations",
      filters: { date: "today" },
      errors: [],
    };
  }

  const naturalRecipeCalories = normalizedQuery.match(
    /^(?:recetas?|recipes?)(?: de| with)? (\d+) (?:kcal|calorias|kalorias|calories)(?: (?:totales?|total))?(?: (por porcion|per serving))?$/,
  );
  if (naturalRecipeCalories?.[1]) {
    const perServing = Boolean(naturalRecipeCalories[2]);
    return {
      text: "",
      category: "recipes",
      filters: perServing
        ? { kcalPerServing: naturalRecipeCalories[1] }
        : { kcalTotal: naturalRecipeCalories[1] },
      errors: [],
    };
  }

  const naturalRecipeSearch = normalizedQuery.match(
    /^(?:recetas?|recipes?)(?: de| with)?(?: (.+))?$/,
  );
  if (naturalRecipeSearch) {
    return {
      text: naturalRecipeSearch[1] ?? "",
      category: "recipes",
      filters: {},
      errors: [],
    };
  }

  const filters: ParsedGlobalSearch["filters"] = {};
  const errors: string[] = [];
  let category: GlobalSearchCategory | null = null;
  let freeText = rawQuery;
  const extraText: string[] = [];

  for (const match of rawQuery.matchAll(OPERATOR_PATTERN)) {
    const fullMatch = match[0];
    const rawOperator = normalizeSearchText(match[1] ?? "");
    const operator = OPERATOR_ALIASES[rawOperator] ?? rawOperator;
    const value = (match[2] ?? match[3] ?? "").trim();
    const operatorCategory = categoryFromOperator(operator, value);
    if (operatorCategory && category && category !== operatorCategory) {
      errors.push(`${rawOperator}:${value}`);
    } else if (operatorCategory) {
      category = operatorCategory;
    }

    if (operator === "tel") {
      const phone = normalizeSearchPhone(value);
      if (phone) filters.phone = phone;
      else errors.push(`${rawOperator}:${value}`);
    }
    else if (operator === "correo") filters.email = normalizeSearchText(value);
    else if (operator === "fecha") {
      const normalizedDate = normalizeSearchText(value);
      if (["hoy", "today", "ayer", "yesterday"].includes(normalizedDate)) {
        filters.date = normalizedDate;
      } else {
        const calendarDate = /^\d{4}-\d{1,2}-\d{1,2}$/.test(value)
          ? toCalendarDateKey(value)
          : null;
        if (calendarDate) filters.date = calendarDate;
        else errors.push(`${rawOperator}:${value}`);
      }
    }
    else if (operator === "estado") {
      const normalizedStatus = normalizeSearchText(value);
      filters.status = STATUS_ALIASES[normalizedStatus] ?? normalizedStatus;
    }
    else if (operator === "paciente")
      filters.patient = normalizeSearchText(value);
    else if (operator === "calorias") {
      if (/^\d+$/.test(value)) filters.kcalTotal = value;
      else errors.push(`${rawOperator}:${value}`);
    }
    else if (
      operator === "consulta" ||
      operator === "plan" ||
      operator === "lab" ||
      operator === "receta"
    ) {
      extraText.push(value);
    } else if (operator === "tipo" && !operatorCategory) {
      errors.push(`${rawOperator}:${value}`);
    }

    freeText = freeText.replace(fullMatch, " ");
  }

  return {
    text: normalizeSearchText(`${freeText} ${extraText.join(" ")}`),
    category,
    filters,
    errors,
  };
}

export function toCalendarDateKey(value: string): string | null {
  const match = String(value).match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function localDateKey(value: Date): string {
  return [
    value.getFullYear(),
    String(value.getMonth() + 1).padStart(2, "0"),
    String(value.getDate()).padStart(2, "0"),
  ].join("-");
}

function matchesDateFilter(
  value: string,
  filter: string,
  now = new Date(),
): boolean {
  const normalizedValue = normalizeSearchText(value);
  if (filter === "hoy" || filter === "today") {
    const today = localDateKey(now);
    return normalizedValue.includes(today) || normalizedValue.includes("hoy");
  }
  if (filter === "ayer" || filter === "yesterday") {
    const yesterday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - 1,
    );
    const date = localDateKey(yesterday);
    return normalizedValue.includes(date) || normalizedValue.includes("ayer");
  }
  return normalizedValue.includes(filter);
}

function matchesFilters(
  result: GlobalSearchResult,
  parsed: ParsedGlobalSearch,
): boolean {
  const fields = result.fields ?? {};
  if (
    parsed.filters.phone &&
    !normalizeSearchPhone(fields.phone ?? "").includes(parsed.filters.phone)
  )
    return false;
  if (
    parsed.filters.email &&
    !normalizeSearchText(fields.email ?? "").includes(parsed.filters.email)
  )
    return false;
  if (
    parsed.filters.status &&
    !(fields.status ?? "")
      .split("|")
      .map((status) => STATUS_ALIASES[normalizeSearchText(status)] ?? normalizeSearchText(status))
      .includes(parsed.filters.status)
  )
    return false;
  if (
    parsed.filters.patient &&
    !normalizeSearchText(fields.patient ?? result.title).includes(
      parsed.filters.patient,
    )
  )
    return false;
  if (
    parsed.filters.date &&
    !matchesDateFilter(fields.date ?? result.date ?? "", parsed.filters.date)
  )
    return false;
  if (
    parsed.filters.kcalTotal &&
    Math.round(Number(fields.kcalTotal)) !== Number(parsed.filters.kcalTotal)
  ) return false;
  if (
    parsed.filters.kcalPerServing &&
    Math.round(Number(fields.kcalPerServing)) !==
      Number(parsed.filters.kcalPerServing)
  ) return false;
  return true;
}

export function scoreGlobalSearchResult(
  result: GlobalSearchResult,
  query: string,
): number {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return 1;

  const title = normalizeSearchText(result.title);
  const subtitle = normalizeSearchText(result.subtitle);
  const searchable = normalizeSearchText(
    `${result.searchableText} ${result.title} ${result.subtitle}`,
  );
  if (title === normalizedQuery) return 120;
  if (title.startsWith(normalizedQuery)) return 100;
  if (title.split(" ").some((word) => word.startsWith(normalizedQuery)))
    return 82;
  if (title.includes(normalizedQuery)) return 70;
  if (searchable.split(" ").some((word) => word.startsWith(normalizedQuery)))
    return 55;
  if (searchable.includes(normalizedQuery)) return 40;
  if (subtitle.includes(normalizedQuery)) return 30;
  const tokens = normalizedQuery.split(" ").filter(Boolean);
  let tokenScore = 0;
  for (const token of tokens) {
    if (title.split(" ").some((word) => word.startsWith(token))) tokenScore += 24;
    else if (searchable.split(" ").some((word) => word.startsWith(token))) tokenScore += 14;
    else return 0;
  }
  return tokenScore;
}

export function filterAndRankGlobalSearch(
  results: GlobalSearchResult[],
  rawQuery: string,
  selectedCategory: GlobalSearchCategory,
  limit = 20,
): GlobalSearchResult[] {
  const parsed = parseGlobalSearch(rawQuery);
  if (parsed.errors.length > 0) return [];
  const category = parsed.category ?? selectedCategory;

  return results
    .filter((result) => category === "all" || result.category === category)
    .filter((result) => matchesFilters(result, parsed))
    .map((result) => ({
      result,
      score: scoreGlobalSearchResult(result, parsed.text),
    }))
    .filter(({ score }) => !parsed.text || score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.result.title.localeCompare(b.result.title, "es-MX"),
    )
    .slice(0, limit)
    .map(({ result }) => result);
}

export function getGlobalSearchShortcutLabel(): string {
  if (
    typeof navigator !== "undefined" &&
    /Mac|iPhone|iPad/.test(navigator.platform)
  )
    return "⌘ K";
  return "Ctrl K";
}
