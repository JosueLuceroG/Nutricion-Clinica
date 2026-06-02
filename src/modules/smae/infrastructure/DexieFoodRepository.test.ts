import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { DexieFoodRepository } from "./DexieFoodRepository";
import { NutriClinicaDB } from "@services/db/dexieSchema";
import { Food, type FoodProps } from "../domain/Food";
import { FoodNotFoundError } from "../domain/FoodRepository";

const makeCustomFood = (overrides: Partial<{ id: string; name: string; group: FoodProps["group"]; createdAt: number }> = {}): Food => {
  return Food.create({
    id: overrides.id ?? "custom-1",
    group: overrides.group ?? "verduras",
    name: overrides.name ?? "Mi verdura",
    shortName: overrides.name ?? "Mi verdura",
    serving: "1 taza",
    servingGrams: 80,
    keywords: ["custom", "personal"],
    custom: true,
    createdAt: overrides.createdAt ?? 1_700_000_000_000,
  });
};

const makeSystemFood = (): Food =>
  Food.create({
    id: "system-1",
    group: "verduras",
    name: "System Food",
    shortName: "Sys",
    serving: "1 pieza",
    servingGrams: 100,
    keywords: ["system"],
    custom: false,
  });

describe("DexieFoodRepository", () => {
  let repo: DexieFoodRepository;
  let db: NutriClinicaDB;

  beforeEach(async () => {
    db = new NutriClinicaDB(`test-${Math.random().toString(36).slice(2)}`);
    await db.delete();
    db = new NutriClinicaDB(`test-${Math.random().toString(36).slice(2)}`);
    await db.open();
    repo = new DexieFoodRepository(db);
  });

  it("guarda y recupera un custom food por id", async () => {
    const f = makeCustomFood({ name: "Aguacate hass" });
    await repo.save(f);

    const found = await repo.findById(f.id);
    expect(found).not.toBeNull();
    expect(found?.name).toBe("Aguacate hass");
    expect(found?.custom).toBe(true);
    expect(found?.keywords).toEqual(["custom", "personal"]);
  });

  it("rechaza persistir un system food (custom=false)", async () => {
    const f = makeSystemFood();
    await expect(repo.save(f)).rejects.toThrow("personalizados");
  });

  it("retorna null cuando el custom food no existe", async () => {
    const found = await repo.findById("no-existe");
    expect(found).toBeNull();
  });

  it("findAllCustom devuelve solo custom, ordenados por createdAt desc", async () => {
    const a = makeCustomFood({ id: "a", name: "A", createdAt: 1_000 });
    const b = makeCustomFood({ id: "b", name: "B", createdAt: 3_000 });
    const c = makeCustomFood({ id: "c", name: "C", createdAt: 2_000 });

    await repo.save(a);
    await repo.save(b);
    await repo.save(c);

    const all = await repo.findAllCustom();
    expect(all.map((f) => f.id)).toEqual(["b", "c", "a"]);
  });

  it("delete elimina el custom food", async () => {
    const f = makeCustomFood();
    await repo.save(f);
    await repo.delete(f.id);
    const found = await repo.findById(f.id);
    expect(found).toBeNull();
  });

  it("delete throws FoodNotFoundError si no existe", async () => {
    await expect(repo.delete("no-existe")).rejects.toBeInstanceOf(FoodNotFoundError);
  });

  it("reconstitute preserva keywords vacíos cuando keywords_json está corrupto", async () => {
    await db.smae_custom_foods.put({
      id: "broken",
      group: "verduras",
      name: "Broken",
      short_name: "Broken",
      serving: "1 pieza",
      serving_grams: 50,
      keywords_json: "not-json",
      custom: 1,
      created_at: 1_700_000_000_000,
    });
    const found = await repo.findById("broken");
    expect(found).not.toBeNull();
    expect(found?.keywords).toEqual([]);
  });
});
