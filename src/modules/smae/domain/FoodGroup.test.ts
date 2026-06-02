import { describe, it, expect } from "vitest";
import {
  findGroupsByKcal,
  FoodGroupSchema,
  GroupNutrition,
  FOOD_GROUPS,
  FoodGroupLabel,
  FoodGroupShortLabel,
} from "./FoodGroup";

describe("FoodGroup", () => {
  it("FOOD_GROUPS contains 16 groups", () => {
    expect(FOOD_GROUPS.length).toBe(16);
  });

  it("FOOD_GROUPS is a superset of FoodGroupSchema.options", () => {
    const opt = FoodGroupSchema.options as readonly string[];
    expect(FOOD_GROUPS.every((g) => opt.includes(g))).toBe(true);
  });

  it("FoodGroupLabel has label for every group", () => {
    for (const g of FOOD_GROUPS) {
      expect(FoodGroupLabel[g]).toBeTruthy();
    }
  });

  it("FoodGroupShortLabel has label for every group", () => {
    for (const g of FOOD_GROUPS) {
      expect(FoodGroupShortLabel[g]).toBeTruthy();
    }
  });

  it("GroupNutrition has profile for every group", () => {
    for (const g of FOOD_GROUPS) {
      const n = GroupNutrition[g];
      expect(n.kcal).toBeGreaterThan(0);
      expect(n.proteinG).toBeGreaterThanOrEqual(0);
      expect(n.carbsG).toBeGreaterThanOrEqual(0);
      expect(n.fatG).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("findGroupsByKcal (inverse equivalence)", () => {
  it("target 70 kcal ± 0 → both cereales (s/g y c/g)", () => {
    const r = findGroupsByKcal(70, 0);
    expect(r.length).toBe(2);
    const groups = r.map((m) => m.group);
    expect(groups).toContain("cereales-sin-grasa");
    expect(groups).toContain("cereales-con-grasa");
  });

  it("target 70 kcal ± 5 → cereals (both) + AOA moderado (5)", () => {
    const r = findGroupsByKcal(70, 5);
    const groups = r.map((m) => m.group);
    expect(groups).toContain("cereales-sin-grasa");
    expect(groups).toContain("cereales-con-grasa");
    expect(groups).toContain("aoa-moderado");
    expect(r.length).toBe(3);
  });

  it("target 65 kcal ± 10 → cereals (5), frutas (5), AOA bajo (10); no leguminosas (15)", () => {
    const r = findGroupsByKcal(65, 10);
    const groups = r.map((m) => m.group);
    expect(groups).toContain("cereales-sin-grasa");
    expect(groups).toContain("cereales-con-grasa");
    expect(groups).toContain("frutas");
    expect(groups).toContain("aoa-bajo");
    expect(groups).not.toContain("leguminosas");
  });

  it("sorts by delta asc (closest first)", () => {
    const r = findGroupsByKcal(70, 20);
    for (let i = 1; i < r.length; i++) {
      const prev = r[i - 1];
      const cur = r[i];
      if (prev && cur) expect(prev.delta).toBeLessThanOrEqual(cur.delta);
    }
  });

  it("rejects non-positive target", () => {
    expect(findGroupsByKcal(0, 10).length).toBe(0);
    expect(findGroupsByKcal(-1, 10).length).toBe(0);
  });

  it("rejects negative tolerance", () => {
    expect(() => findGroupsByKcal(70, -1)).toThrow("negativa");
  });

  it("empty result for unreachable target with tolerance 0", () => {
    expect(findGroupsByKcal(999, 0).length).toBe(0);
  });

  it("large tolerance matches all groups", () => {
    const r = findGroupsByKcal(70, 1000);
    expect(r.length).toBe(16);
  });
});
