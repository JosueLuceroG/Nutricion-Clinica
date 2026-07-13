import { describe, expect, it } from "vitest";
import { Search } from "lucide-react";
import {
  filterAndRankGlobalSearch,
  normalizeSearchPhone,
  normalizeSearchText,
  parseGlobalSearch,
  toCalendarDateKey,
} from "./globalSearchEngine";
import type { GlobalSearchResult } from "./globalSearchTypes";

function result(
  id: string,
  title: string,
  category: GlobalSearchResult["category"],
  searchableText = title,
  fields: GlobalSearchResult["fields"] = {},
): GlobalSearchResult {
  return {
    id,
    title,
    subtitle: "Detalle",
    category,
    kind: category === "patients" ? "patient" : "action",
    searchableText,
    icon: Search,
    tone: "blue",
    fields,
  };
}

describe("globalSearchEngine", () => {
  it("normaliza acentos, mayúsculas y espacios", () => {
    expect(normalizeSearchText("  María   Fernández  ")).toBe(
      "maria fernandez",
    );
    expect(normalizeSearchText("MARIA MUÑOZ")).toBe("maria munoz");
    expect(normalizeSearchPhone("+52 (55) 1234-5678")).toBe("525512345678");
  });

  it("devuelve lo mismo con o sin acentos y mayúsculas", () => {
    const results = [result("maria", "María Muñoz", "patients")];
    expect(filterAndRankGlobalSearch(results, "maria munoz", "all")).toEqual(
      filterAndRankGlobalSearch(results, "MARÍA MUÑOZ", "all"),
    );
  });

  it("interpreta operadores sin mezclar filtros con texto libre", () => {
    expect(parseGlobalSearch('paciente:"María López" estado:activo')).toEqual({
      text: "",
      category: null,
      filters: { patient: "maria lopez", status: "active" },
      errors: [],
    });
    expect(parseGlobalSearch("consulta:seguimiento fecha:hoy")).toEqual({
      text: "seguimiento",
      category: "consultations",
      filters: { date: "hoy" },
      errors: [],
    });
  });

  it("admite operadores en inglés y laboratorio como categoría real", () => {
    expect(
      parseGlobalSearch('type:laboratory patient:"Maria Lopez" date:2026-07-03'),
    ).toEqual({
      text: "",
      category: "laboratory",
      filters: { patient: "maria lopez", date: "2026-07-03" },
      errors: [],
    });
    expect(parseGlobalSearch("lab:triglicéridos")).toEqual({
      text: "trigliceridos",
      category: "laboratory",
      filters: {},
      errors: [],
    });
  });

  it("convierte consultas de hoy en un filtro de resultados", () => {
    expect(parseGlobalSearch("consultas de hoy")).toEqual({
      text: "",
      category: "consultations",
      filters: { date: "hoy" },
      errors: [],
    });
    expect(parseGlobalSearch("Today's consultations")).toEqual({
      text: "",
      category: "consultations",
      filters: { date: "today" },
      errors: [],
    });
  });

  it("consultas de hoy incluye consultas clínicas y citas del día", () => {
    const now = new Date();
    const today = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
    ].join("-");
    const tomorrowDate = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
    );
    const tomorrow = [
      tomorrowDate.getFullYear(),
      String(tomorrowDate.getMonth() + 1).padStart(2, "0"),
      String(tomorrowDate.getDate()).padStart(2, "0"),
    ].join("-");
    const results = [
      result("clinical", "Consulta clínica", "consultations", "", {
        date: today,
      }),
      result("appointment", "Cita de agenda", "consultations", "", {
        date: today,
      }),
      result("tomorrow", "Consulta de mañana", "consultations", "", {
        date: tomorrow,
      }),
    ];

    expect(
      filterAndRankGlobalSearch(results, "consultas de hoy", "all").map(
        (item) => item.id,
      ),
    ).toEqual(["appointment", "clinical"]);
  });

  it("interpreta recetas por texto y calorías", () => {
    expect(parseGlobalSearch("recetas")).toEqual({
      text: "",
      category: "recipes",
      filters: {},
      errors: [],
    });
    expect(parseGlobalSearch("recetas de pollo")).toEqual({
      text: "pollo",
      category: "recipes",
      filters: {},
      errors: [],
    });
    expect(parseGlobalSearch("recetas de 2000 kalorias")).toEqual({
      text: "",
      category: "recipes",
      filters: { kcalTotal: "2000" },
      errors: [],
    });
    expect(
      parseGlobalSearch("recetas de 500 calorías por porción"),
    ).toEqual({
      text: "",
      category: "recipes",
      filters: { kcalPerServing: "500" },
      errors: [],
    });
  });

  it("combina paciente con consulta sin depender del orden", () => {
    const first = parseGlobalSearch("paciente:Ana consulta:seguimiento");
    const second = parseGlobalSearch("consulta:seguimiento paciente:Ana");
    expect(first).toEqual(second);
    expect(first.category).toBe("consultations");
    expect(first.filters.patient).toBe("ana");
  });

  it("rechaza filtros inválidos o categorías contradictorias", () => {
    expect(parseGlobalSearch("tel:abc").errors).toEqual(["tel:abc"]);
    expect(parseGlobalSearch("tipo:desconocido").errors).toEqual([
      "tipo:desconocido",
    ]);
    expect(parseGlobalSearch("fecha:2026-02-30").errors).toEqual([
      "fecha:2026-02-30",
    ]);
    expect(parseGlobalSearch("consulta:uno plan:dos").errors).toEqual([
      "plan:dos",
    ]);
  });

  it("conserva fechas calendario sin desplazarlas por zona horaria", () => {
    expect(toCalendarDateKey("2026-07-03T00:00:00.000Z")).toBe("2026-07-03");
    expect(toCalendarDateKey("2026-2-9")).toBe("2026-02-09");
    expect(toCalendarDateKey("2026-02-30")).toBeNull();
  });

  it("prioriza coincidencias exactas y de prefijo", () => {
    const results = [
      result("contains", "Paciente María Fernández", "patients"),
      result("exact", "María", "patients"),
      result("prefix", "María López", "patients"),
    ];

    expect(
      filterAndRankGlobalSearch(results, "maria", "all").map((item) => item.id),
    ).toEqual(["exact", "prefix", "contains"]);
  });

  it("filtra por categoría y teléfono normalizado", () => {
    const results = [
      result("patient", "María", "patients", "María", {
        phone: "+52 55 1234 5678",
      }),
      result("action", "Abrir pacientes", "actions"),
    ];

    expect(
      filterAndRankGlobalSearch(results, "tel:5512345678", "all").map(
        (item) => item.id,
      ),
    ).toEqual(["patient"]);
    expect(
      filterAndRankGlobalSearch(results, "", "actions").map((item) => item.id),
    ).toEqual(["action"]);
  });

  it("compara estados completos y no confunde activo con inactivo", () => {
    const results = [
      result("active", "Ana", "patients", "Ana", { status: "active" }),
      result("inactive", "Berta", "patients", "Berta", { status: "inactive" }),
    ];
    expect(
      filterAndRankGlobalSearch(results, "estado:activo", "all").map(
        (item) => item.id,
      ),
    ).toEqual(["active"]);
  });

  it("filtra recetas por calorías totales o por porción", () => {
    const recipes = [
      result("total-2000", "Receta familiar", "recipes", "Receta familiar", {
        kcalTotal: "2000",
        kcalPerServing: "500",
        status: "active",
      }),
      result("portion-2000", "Receta energética", "recipes", "Receta energética", {
        kcalTotal: "8000",
        kcalPerServing: "2000",
        status: "active",
      }),
    ];
    expect(
      filterAndRankGlobalSearch(
        recipes,
        "recetas de 2000 calorías",
        "all",
      ).map((item) => item.id),
    ).toEqual(["total-2000"]);
    expect(
      filterAndRankGlobalSearch(
        recipes,
        "recetas de 2000 calorías por porción",
        "all",
      ).map((item) => item.id),
    ).toEqual(["portion-2000"]);
    expect(
      filterAndRankGlobalSearch(
        recipes,
        "tipo:receta estado:activa",
        "all",
      ),
    ).toHaveLength(2);
  });

  it("encuentra términos aunque estén en campos separados", () => {
    const results = [
      result("match", "María López", "patients", "María López active"),
      result("miss", "María Pérez", "patients", "María Pérez inactive"),
    ];
    expect(
      filterAndRankGlobalSearch(results, "maria active", "all").map(
        (item) => item.id,
      ),
    ).toEqual(["match"]);
  });

  it("respeta el límite de resultados", () => {
    const results = Array.from({ length: 30 }, (_, index) =>
      result(`patient-${index}`, `Paciente ${index}`, "patients"),
    );
    expect(
      filterAndRankGlobalSearch(results, "paciente", "all", 8),
    ).toHaveLength(8);
  });
});
