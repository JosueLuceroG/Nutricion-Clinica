import { describe, it, expect, beforeEach } from "vitest";
import {
  addCustomFoodUC,
  updateCustomFoodUC,
  removeCustomFoodUC,
  searchFoodsUC,
  findByEquivalenciaUC,
  type SmaeCustomFoodCreateInput,
  type SmaeCustomFoodUpdateInput,
} from "./smaeUseCases";
import { parseKeywordsInput, SmaeCustomFoodFormSchema } from "./smaeFormSchema";
import {
  Food,
  type FoodId,
  type FoodRepository,
  FoodNotFoundError,
  SYSTEM_FOODS,
} from "../domain";

class InMemoryFoodRepository implements FoodRepository {
  private readonly map = new Map<string, Food>();
  async save(food: Food): Promise<void> {
    if (!food.custom) throw new Error("Solo custom");
    this.map.set(food.id, food);
  }
  async findById(id: FoodId): Promise<Food | null> {
    return this.map.get(id) ?? null;
  }
  async findAllCustom(): Promise<Food[]> {
    return Array.from(this.map.values());
  }
  async delete(id: FoodId): Promise<void> {
    if (!this.map.has(id)) throw new FoodNotFoundError(id);
    this.map.delete(id);
  }
}

const makeInput = (overrides: Partial<SmaeCustomFoodCreateInput> = {}): SmaeCustomFoodCreateInput => ({
  id: "custom-1",
  group: "verduras",
  name: "Aguacate hass",
  shortName: "Aguacate",
  serving: "1/3 pieza",
  servingGrams: 35,
  keywords: ["mexicano", "grasa"],
  ...overrides,
});

describe("addCustomFoodUC", () => {
  let repo: InMemoryFoodRepository;
  beforeEach(() => {
    repo = new InMemoryFoodRepository();
  });

  it("crea y persiste un custom food con createdAt", async () => {
    const food = await addCustomFoodUC(repo, makeInput(), 1_700_000_000_000);
    expect(food.custom).toBe(true);
    expect(food.createdAt).toBe(1_700_000_000_000);
    const found = await repo.findById(food.id);
    expect(found?.name).toBe("Aguacate hass");
  });

  it("normaliza keywords (lowercase + trim)", async () => {
    const food = await addCustomFoodUC(
      repo,
      makeInput({ keywords: ["  MEXICANO  ", "Grasa", ""] }),
      1_700_000_000_000,
    );
    expect(food.keywords).toEqual(["mexicano", "grasa"]);
  });

  it("rechaza si custom food no tiene createdAt", async () => {
    await expect(
      addCustomFoodUC(repo, makeInput(), NaN).catch((e) => {
        if (e instanceof Error) throw e;
        throw new Error("fail");
      }),
    ).rejects.toBeTruthy();
  });
});

describe("updateCustomFoodUC", () => {
  let repo: InMemoryFoodRepository;
  beforeEach(async () => {
    repo = new InMemoryFoodRepository();
    await addCustomFoodUC(repo, makeInput(), 1_700_000_000_000);
  });

  it("actualiza campos provistos y conserva id + createdAt", async () => {
    const updated = await updateCustomFoodUC(
      repo,
      "custom-1",
      { name: "Aguacate hass grande" } satisfies SmaeCustomFoodUpdateInput,
    );
    expect(updated.name).toBe("Aguacate hass grande");
    expect(updated.id).toBe("custom-1");
    expect(updated.createdAt).toBe(1_700_000_000_000);
    expect(updated.group).toBe("verduras");
  });

  it("lanza FoodNotFoundError si no existe", async () => {
    await expect(
      updateCustomFoodUC(repo, "no-existe", { name: "X" }),
    ).rejects.toBeInstanceOf(FoodNotFoundError);
  });
});

describe("removeCustomFoodUC", () => {
  it("elimina el custom food", async () => {
    const repo = new InMemoryFoodRepository();
    await addCustomFoodUC(repo, makeInput(), 1_700_000_000_000);
    await removeCustomFoodUC(repo, "custom-1");
    expect(await repo.findById("custom-1")).toBeNull();
  });

  it("lanza FoodNotFoundError si no existe", async () => {
    const repo = new InMemoryFoodRepository();
    await expect(removeCustomFoodUC(repo, "no-existe")).rejects.toBeInstanceOf(
      FoodNotFoundError,
    );
  });
});

describe("searchFoodsUC", () => {
  it("busca en system + custom", async () => {
    const repo = new InMemoryFoodRepository();
    await addCustomFoodUC(repo, makeInput(), 1_700_000_000_000);
    const r = await searchFoodsUC(repo, { query: "hass" });
    expect(r.length).toBe(1);
    expect(r[0]?.custom).toBe(true);
  });

  it("filtra por grupo", async () => {
    const repo = new InMemoryFoodRepository();
    const r = await searchFoodsUC(repo, { group: "verduras" });
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((f) => f.group === "verduras")).toBe(true);
  });

  it("customOnly restringe a custom", async () => {
    const repo = new InMemoryFoodRepository();
    await addCustomFoodUC(repo, makeInput(), 1_700_000_000_000);
    const r = await searchFoodsUC(repo, { customOnly: true });
    expect(r.length).toBe(1);
    expect(r[0]?.custom).toBe(true);
  });
});

describe("findByEquivalenciaUC", () => {
  it("encuentra alimentos en grupos con kcal cercano al target", async () => {
    const repo = new InMemoryFoodRepository();
    const r = await findByEquivalenciaUC(repo, 70, 0);
    expect(r.every((f) => f.nutrition.kcal === 70)).toBe(true);
    expect(r.every((f) => f.group.startsWith("cereales"))).toBe(true);
    expect(r.length).toBeGreaterThanOrEqual(2);
  });

  it("incluye custom foods si su grupo calza", async () => {
    const repo = new InMemoryFoodRepository();
    await addCustomFoodUC(
      repo,
      makeInput({ id: "custom-fruta", group: "frutas" }),
      1_700_000_000_000,
    );
    const r = await findByEquivalenciaUC(repo, 60, 0);
    expect(r.some((f) => f.id === "custom-fruta" && f.custom)).toBe(true);
  });

  it("SYSTEM_FOODS tiene 30+ entradas", () => {
    expect(SYSTEM_FOODS.length).toBeGreaterThanOrEqual(30);
  });
});

describe("parseKeywordsInput", () => {
  it("string vacío → []", () => {
    expect(parseKeywordsInput("")).toEqual([]);
  });
  it("undefined → []", () => {
    expect(parseKeywordsInput(undefined)).toEqual([]);
  });
  it("'a, b, c' → ['a','b','c']", () => {
    expect(parseKeywordsInput("a, b, c")).toEqual(["a", "b", "c"]);
  });
  it("lowercase y trim", () => {
    expect(parseKeywordsInput("  MEXICANO  , Grasa ")).toEqual(["mexicano", "grasa"]);
  });
  it("omite vacíos", () => {
    expect(parseKeywordsInput("a, , b, ,")).toEqual(["a", "b"]);
  });
});

describe("SmaeCustomFoodFormSchema", () => {
  it("acepta input válido", () => {
    const r = SmaeCustomFoodFormSchema.safeParse({
      id: "custom-test",
      group: "verduras",
      name: "Test",
      shortName: "T",
      serving: "1 pieza",
      servingGrams: 100,
      keywordsInput: "a, b",
    });
    expect(r.success).toBe(true);
  });

  it("rechaza servingGrams negativo", () => {
    const r = SmaeCustomFoodFormSchema.safeParse({
      id: "x",
      group: "verduras",
      name: "X",
      shortName: "X",
      serving: "1",
      servingGrams: -10,
    });
    expect(r.success).toBe(false);
  });

  it("rechaza id con mayúsculas", () => {
    const r = SmaeCustomFoodFormSchema.safeParse({
      id: "Custom-Test",
      group: "verduras",
      name: "X",
      shortName: "X",
      serving: "1",
      servingGrams: 10,
    });
    expect(r.success).toBe(false);
  });

  it("keywordsInput default '' cuando se omite", () => {
    const r = SmaeCustomFoodFormSchema.parse({
      id: "xx",
      group: "verduras",
      name: "X",
      shortName: "X",
      serving: "1",
      servingGrams: 10,
    });
    expect(r.keywordsInput).toBe("");
  });
});
