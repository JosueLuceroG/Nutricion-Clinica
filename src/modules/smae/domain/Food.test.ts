import { describe, it, expect } from "vitest";
import {
  Food,
  FoodSchema,
  searchFoods,
  findByEquivalencia,
  SYSTEM_FOODS,
  getSystemFoods,
  getSystemFoodById,
  getSystemFoodsByGroup,
  type FoodProps,
} from "./index";
import { GroupNutrition } from "./FoodGroup";

const validProps: FoodProps = {
  id: "verdura-test",
  group: "verduras",
  name: "Test Food",
  shortName: "Test",
  serving: "1 taza",
  servingGrams: 100,
  keywords: ["test", "demo"],
  custom: false,
};

describe("Food (entity)", () => {
  it("create() returns a Food with trimmed and lowercased keywords", () => {
    const food = Food.create({
      ...validProps,
      keywords: ["  TEST  ", "Demo", "ejemplo"],
    });
    expect(food.keywords).toEqual(["test", "demo", "ejemplo"]);
    expect(food.name).toBe("Test Food");
    expect(food.shortName).toBe("Test");
  });

  it("create() throws on empty name", () => {
    expect(() => Food.create({ ...validProps, name: "   " })).toThrow(
      "Nombre de alimento requerido",
    );
  });

  it("create() throws on non-positive servingGrams", () => {
    expect(() => Food.create({ ...validProps, servingGrams: 0 })).toThrow(
      "Gramos por ración deben ser positivos",
    );
    expect(() => Food.create({ ...validProps, servingGrams: -10 })).toThrow();
  });

  it("create() throws if custom food lacks createdAt", () => {
    expect(() => Food.create({ ...validProps, custom: true })).toThrow(
      "Alimentos personalizados requieren createdAt",
    );
  });

  it("create() allows custom food with createdAt", () => {
    const f = Food.create({ ...validProps, custom: true, createdAt: 1_700_000_000_000 });
    expect(f.custom).toBe(true);
    expect(f.createdAt).toBe(1_700_000_000_000);
  });

  it("nutrition() returns the GroupNutrition for its group", () => {
    const f = Food.create({ ...validProps, group: "cereales-sin-grasa" });
    expect(f.nutrition).toEqual(GroupNutrition["cereales-sin-grasa"]);
    expect(f.nutrition.kcal).toBe(70);
  });

  it("toProps() returns a defensive copy of keywords", () => {
    const f = Food.create(validProps);
    const props = f.toProps();
    props.keywords.push("mutate");
    expect(f.keywords).toEqual(["test", "demo"]);
  });

  it("reconstitute() skips validation (for repository hydration)", () => {
    const f = Food.reconstitute(validProps);
    expect(f.id).toBe("verdura-test");
  });

  it("FoodSchema validates a valid payload", () => {
    expect(FoodSchema.safeParse(validProps).success).toBe(true);
  });

  it("FoodSchema rejects id with uppercase", () => {
    expect(FoodSchema.safeParse({ ...validProps, id: "Verdura-Test" }).success).toBe(false);
  });
});

describe("searchFoods", () => {
  const customVerdura: Food = Food.create({
    id: "verdura-custom",
    group: "verduras",
    name: "Quelites",
    shortName: "Quelites",
    serving: "1 taza",
    servingGrams: 60,
    keywords: ["hoja", "mexicano", "hierba"],
    custom: true,
    createdAt: 1_700_000_000_000,
  });

  const corpus: readonly Food[] = [
    Food.create(validProps),
    customVerdura,
    Food.create({
      id: "fruta-platano",
      group: "frutas",
      name: "Plátano",
      shortName: "Plátano",
      serving: "1/2 pieza",
      servingGrams: 70,
      keywords: ["tropical"],
      custom: false,
    }),
  ];

  it("returns all when query is empty", () => {
    expect(searchFoods(corpus).length).toBe(3);
  });

  it("matches by name (case-insensitive)", () => {
    const r = searchFoods(corpus, { query: "TEST" });
    expect(r.length).toBe(1);
    expect(r[0]?.id).toBe("verdura-test");
  });

  it("matches by keyword", () => {
    const r = searchFoods(corpus, { query: "tropical" });
    expect(r.length).toBe(1);
    expect(r[0]?.id).toBe("fruta-platano");
  });

  it("matches accent-insensitive (Plátano == Platano)", () => {
    const r = searchFoods(corpus, { query: "platano" });
    expect(r.length).toBe(1);
  });

  it("filters by group", () => {
    const r = searchFoods(corpus, { group: "verduras" });
    expect(r.length).toBe(2);
    expect(r.every((f) => f.group === "verduras")).toBe(true);
  });

  it("customOnly restricts to custom foods", () => {
    const r = searchFoods(corpus, { group: "verduras", customOnly: true });
    expect(r.length).toBe(1);
    expect(r[0]?.custom).toBe(true);
  });

  it("returns empty when nothing matches", () => {
    expect(searchFoods(corpus, { query: "no-existe" }).length).toBe(0);
  });
});

describe("findByEquivalencia", () => {
  const corpus: readonly Food[] = [
    Food.create({ ...validProps, id: "verd-x", group: "verduras" }),
    Food.create({
      ...validProps,
      id: "cereal-x",
      group: "cereales-sin-grasa",
      name: "CerealTest",
      shortName: "CerealTest",
    }),
    Food.create({
      ...validProps,
      id: "fruta-x",
      group: "frutas",
      name: "FrutaTest",
      shortName: "FrutaTest",
    }),
    Food.create({
      ...validProps,
      id: "leche-x",
      group: "leche-descremada",
      name: "LecheTest",
      shortName: "LecheTest",
    }),
  ];

  it("target 70 kcal ± 5 returns cereals only", () => {
    const r = findByEquivalencia(corpus, 70, 5);
    expect(r.length).toBe(1);
    expect(r[0]?.group).toBe("cereales-sin-grasa");
  });

  it("target 60 kcal ± 0 returns frutas only", () => {
    const r = findByEquivalencia(corpus, 60, 0);
    expect(r.length).toBe(1);
    expect(r[0]?.group).toBe("frutas");
  });

  it("tolerance 0 is exact match", () => {
    expect(findByEquivalencia(corpus, 70, 0).length).toBe(1);
    expect(findByEquivalencia(corpus, 25, 0).length).toBe(1);
    expect(findByEquivalencia(corpus, 999, 0).length).toBe(0);
  });

  it("sorts by delta (closest first)", () => {
    const r = findByEquivalencia(corpus, 60, 30);
    expect(r[0]?.nutrition.kcal).toBe(60);
  });

  it("rejects negative tolerance", () => {
    expect(() => findByEquivalencia(corpus, 70, -1)).toThrow("negativa");
  });

  it("rejects non-positive target", () => {
    expect(findByEquivalencia(corpus, 0, 10).length).toBe(0);
    expect(findByEquivalencia(corpus, -10, 10).length).toBe(0);
  });

  it("filters by group", () => {
    const r = findByEquivalencia(corpus, 70, 5, { group: "cereales-sin-grasa" });
    expect(r.length).toBe(1);
  });
});

describe("SYSTEM_FOODS", () => {
  it("contains the expected baseline catalog", () => {
    expect(SYSTEM_FOODS.length).toBeGreaterThanOrEqual(30);
    expect(SYSTEM_FOODS.length).toBeLessThan(50);
  });

  it("getSystemFoods() returns same reference", () => {
    expect(getSystemFoods()).toBe(SYSTEM_FOODS);
  });

  it("all system foods are marked custom=false", () => {
    expect(SYSTEM_FOODS.every((f) => !f.custom)).toBe(true);
  });

  it("all system foods have non-empty keywords", () => {
    expect(SYSTEM_FOODS.every((f) => f.keywords.length > 0)).toBe(true);
  });

  it("system ids are unique", () => {
    const ids = new Set(SYSTEM_FOODS.map((f) => f.id));
    expect(ids.size).toBe(SYSTEM_FOODS.length);
  });

  it("getSystemFoodById finds a known id", () => {
    const f = getSystemFoodById("verdura-acelga");
    expect(f).not.toBeNull();
    expect(f?.name).toBe("Acelga");
  });

  it("getSystemFoodById returns null for unknown id", () => {
    expect(getSystemFoodById("no-existe")).toBeNull();
  });

  it("getSystemFoodsByGroup groups correctly", () => {
    const grouped = getSystemFoodsByGroup();
    expect(grouped.get("verduras")?.length).toBeGreaterThan(0);
    expect(grouped.get("frutas")?.length).toBeGreaterThan(0);
  });
});
