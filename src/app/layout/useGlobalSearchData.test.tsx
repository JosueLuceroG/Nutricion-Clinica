import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import type { GlobalSearchAccess } from "./globalSearchTypes";
import { useGlobalSearchData } from "./useGlobalSearchData";

const database = vi.hoisted(() => {
  const rows = {
    patients: [] as Array<Record<string, unknown>>,
    consultations: [] as Array<Record<string, unknown>>,
    mealPlans: [] as Array<Record<string, unknown>>,
    labPanels: [] as Array<Record<string, unknown>>,
    appointments: [] as Array<Record<string, unknown>>,
    recipes: [] as Array<Record<string, unknown>>,
  };
  const flags = { recipeNutritionFails: false };

  const collection = (items: Array<Record<string, unknown>>) => ({
    filter: (predicate: (row: Record<string, unknown>) => boolean) =>
      collection(items.filter(predicate)),
    toArray: async () => [...items],
  });
  const scopedTable = (items: Array<Record<string, unknown>>) => ({
    where: (field: string) => ({
      equals: (value: string) =>
        collection(items.filter((row) => row[field] === value)),
    }),
  });

  return {
    rows,
    flags,
    db: {
      patients: scopedTable(rows.patients),
      consultations: scopedTable(rows.consultations),
      meal_plans: scopedTable(rows.mealPlans),
      lab_panels: collection(rows.labPanels),
      appointments: collection(rows.appointments),
    },
  };
});

vi.mock("@services/db", () => ({ db: database.db }));
vi.mock("@services/recipeService", () => ({
  recipeService: {
    listWithNutrition: async () => {
      if (database.flags.recipeNutritionFails) {
        throw new Error("nutrition unavailable");
      }
      return [...database.rows.recipes];
    },
    list: async () => [...database.rows.recipes],
  },
}));

const FULL_ACCESS: GlobalSearchAccess = {
  patients: true,
  consultations: true,
  plans: true,
  laboratory: true,
  agenda: true,
  recipes: true,
};

beforeEach(() => {
  for (const rows of Object.values(database.rows)) rows.length = 0;
  database.flags.recipeNutritionFails = false;

  database.rows.patients.push(
    {
      id: "patient-a",
      sucursal_id: "branch-a",
      first_name: "María",
      last_name: "López",
      second_last_name: null,
      phone: "+52 55 1234 5678",
      secondary_phone: null,
      email: "maria@example.com",
      status: "active",
      clave_interna: "EXP-01",
      external_record_number: null,
      photo_url: null,
      updated_at: "2026-07-04T10:00:00.000Z",
      deleted_at: null,
    },
    {
      id: "patient-b",
      sucursal_id: "branch-b",
      first_name: "Paciente",
      last_name: "Otra",
      second_last_name: null,
      phone: null,
      secondary_phone: null,
      email: null,
      status: "active",
      clave_interna: null,
      external_record_number: null,
      photo_url: null,
      updated_at: "2026-07-04T10:00:00.000Z",
      deleted_at: null,
    },
  );
  database.rows.consultations.push({
    id: "consultation-a",
    sucursal_id: "branch-a",
    patient_id: "patient-a",
    consultation_date: "2026-07-03T00:00:00.000Z",
    consultation_number: 4,
    reason: "Seguimiento",
    assessment: "Evolución favorable",
    status: "completed",
    deleted_at: null,
  });
  database.rows.mealPlans.push({
    id: "plan-a",
    sucursal_id: "branch-a",
    patient_id: "patient-a",
    name: "Plan mediterráneo",
    description: null,
    notes: null,
    start_date: "2026-07-03T00:00:00.000Z",
    end_date: "2026-07-31T00:00:00.000Z",
    kcal_target: 1800,
    status: "active",
    updated_at: "2026-07-03T00:00:00.000Z",
    deleted_at: null,
  });
  database.rows.labPanels.push(
    {
      id: "lab-a",
      patient_id: "patient-a",
      taken_at: "2026-07-03T00:00:00.000Z",
      lab_name: "Laboratorio Central",
      notes: null,
      results: [{ test: "HBA1C", value: 5.4 }],
      deleted_at: null,
    },
    {
      id: "lab-b",
      patient_id: "patient-b",
      taken_at: "2026-07-03T00:00:00.000Z",
      lab_name: "Otra sucursal",
      notes: null,
      results: [{ test: "GLUCOSA", value: 90 }],
      deleted_at: null,
    },
  );
  database.rows.appointments.push({
    id: "appointment-a",
    office_id: "branch-a",
    patient_id: "patient-a",
    date: "2026-07-03",
    start_time: "09:30",
    reason: "Control mensual",
    notes: "",
    type: "control",
    status: "confirmed",
  });
  database.rows.recipes.push({
    id: "recipe-a",
    name: "Ensalada mediterránea",
    description: "Receta fresca",
    cuisine: "mediterránea",
    category: "entrada",
    difficulty: "facil",
    status: "active",
    updatedAt: 1_720_000_000_000,
    servings: 4,
    kcal: 2000,
    tags: ["vegetariana"],
    allergens: [],
    derivedAllergens: [],
    ingredients: [{ name: "Jitomate" }],
  });
});

describe("useGlobalSearchData", () => {
  it("construye resultados coherentes y aislados por sucursal", async () => {
    const { result } = renderHook(() =>
      useGlobalSearchData(true, "branch-a", "es-MX", FULL_ACCESS),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.results).toHaveLength(6);
    expect(result.current.results.some((item) => item.title.includes("Otra"))).toBe(false);

    const consultation = result.current.results.find(
      (item) => item.kind === "consultation",
    );
    expect(consultation?.fields?.date).toBe("2026-07-03");
    expect(consultation?.subtitle).toContain("Completada");

    const plan = result.current.results.find((item) => item.kind === "plan");
    expect(plan?.subtitle).toContain("31 jul 2026");

    const laboratory = result.current.results.find(
      (item) => item.kind === "laboratory",
    );
    expect(laboratory?.searchableText).toContain("Hemoglobina glucosilada");
    expect(laboratory?.path).toContain("panelId=lab-a");

    const appointment = result.current.results.find(
      (item) => item.kind === "appointment",
    );
    expect(appointment?.subtitle).toContain("Confirmada");
    expect(appointment?.path).toBe(
      "/agenda?date=2026-07-03&appointmentId=appointment-a",
    );

    const recipe = result.current.results.find((item) => item.kind === "recipe");
    expect(recipe?.subtitle).toContain("2000 kcal totales");
    expect(recipe?.subtitle).toContain("500 kcal/porción");
    expect(recipe?.path).toBe("/recetas?recipeId=recipe-a");
    expect(recipe?.fields?.kcalPerServing).toBe("500");
  });

  it("oculta módulos sin permiso pero conserva el paciente para unir consultas", async () => {
    const consultationOnly: GlobalSearchAccess = {
      patients: false,
      consultations: true,
      plans: false,
      laboratory: false,
      agenda: false,
      recipes: false,
    };
    const { result } = renderHook(() =>
      useGlobalSearchData(true, "branch-a", "es-MX", consultationOnly),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.results.map((item) => item.kind)).toEqual([
      "consultation",
    ]);
    expect(result.current.results[0]?.title).toContain("María López");
  });

  it("mantiene recetas por nombre si falla el cálculo de calorías", async () => {
    database.flags.recipeNutritionFails = true;
    const { result } = renderHook(() =>
      useGlobalSearchData(true, "branch-a", "es-MX", FULL_ACCESS),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    const recipe = result.current.results.find((item) => item.kind === "recipe");
    expect(recipe?.title).toBe("Ensalada mediterránea");
    expect(recipe?.subtitle).toBe("Entrada · Activa");
    expect(recipe?.fields?.kcalTotal).toBeUndefined();
    expect(result.current.error).toBe("recipeNutrition");
  });

  it("invalida resultados inmediatamente al cambiar o quitar la sucursal", async () => {
    const { result, rerender } = renderHook(
      ({ branch }: { branch: string | null }) =>
        useGlobalSearchData(true, branch, "es-MX", FULL_ACCESS),
      { initialProps: { branch: "branch-a" as string | null } },
    );
    await waitFor(() => expect(result.current.results).toHaveLength(6));

    rerender({ branch: "branch-b" });
    expect(result.current.results).toEqual([]);
    expect(result.current.loading).toBe(true);
    await waitFor(() =>
      expect(result.current.results.map((item) => item.id)).toEqual([
        "patient-patient-b",
        "laboratory-lab-b",
        "recipe-recipe-a",
      ]),
    );

    rerender({ branch: null });
    expect(result.current).toEqual({ results: [], loading: false, error: null });
  });
});
