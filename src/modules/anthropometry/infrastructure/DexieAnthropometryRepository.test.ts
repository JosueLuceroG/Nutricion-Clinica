import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { DexieAnthropometryRepository } from "./DexieAnthropometryRepository";
import { NutriClinicaDB } from "@services/db/dexieSchema";
import { Anthropometry } from "../domain/Anthropometry";
import { PatientId } from "@modules/patient/domain/PatientId";
import { Weight, Height, Circumference, Skinfold } from "../domain/Measurements";
import { AnthropometryId } from "../domain/AnthropometryId";

const makeMeasurement = (
  patientId: PatientId,
  overrides: Partial<{ daysAgo: number; weight: number; heightCm: number }> = {},
) => {
  const date = new Date();
  date.setDate(date.getDate() - (overrides.daysAgo ?? 0));
  return Anthropometry.create({
    patientId,
    measuredAt: date,
    weight: Weight.fromKg(overrides.weight ?? 70),
    height: Height.fromCentimeters(overrides.heightCm ?? 170),
    circumferences: {
      waist: Circumference.fromCm(80),
      hip: Circumference.fromCm(100),
    },
    skinfolds: {
      triceps: Skinfold.fromMm(10),
      subscapular: Skinfold.fromMm(12),
    },
  });
};

describe("DexieAnthropometryRepository", () => {
  let repo: DexieAnthropometryRepository;
  let db: NutriClinicaDB;
  const pid = PatientId.generate();

  beforeEach(async () => {
    db = new NutriClinicaDB(`test-anth-${Math.random().toString(36).slice(2)}`);
    await db.open();
    repo = new DexieAnthropometryRepository(db);
  });

  it("guarda y recupera una medición por id", async () => {
    const m = makeMeasurement(pid);
    await repo.save(m);

    const found = await repo.findById(m.id);
    expect(found).not.toBeNull();
    expect(found?.patientId.equals(pid)).toBe(true);
    expect(found?.weight.toKg()).toBe(70);
  });

  it("filtra por patientId", async () => {
    const other = PatientId.generate();
    await repo.save(makeMeasurement(pid, { daysAgo: 0 }));
    await repo.save(makeMeasurement(pid, { daysAgo: 30 }));
    await repo.save(makeMeasurement(other, { daysAgo: 0 }));

    const mine = await repo.findAll({ patientId: pid });
    expect(mine).toHaveLength(2);
    expect(mine.every((m) => m.patientId.equals(pid))).toBe(true);
  });

  it("ordena por fecha de medición descendente (más reciente primero)", async () => {
    await repo.save(makeMeasurement(pid, { daysAgo: 60 }));
    await repo.save(makeMeasurement(pid, { daysAgo: 0 }));
    await repo.save(makeMeasurement(pid, { daysAgo: 30 }));

    const items = await repo.findAll({ patientId: pid });
    expect(items).toHaveLength(3);
    expect(items[0]?.measuredAt.getTime()).toBeGreaterThan(items[1]?.measuredAt.getTime() ?? 0);
    expect(items[1]?.measuredAt.getTime()).toBeGreaterThan(items[2]?.measuredAt.getTime() ?? 0);
  });

  it("excluye soft-deleted", async () => {
    const m1 = makeMeasurement(pid);
    const m2 = makeMeasurement(pid);
    await repo.save(m1);
    await repo.save(m2);
    await repo.delete(m1.id, true);

    const items = await repo.findAll({ patientId: pid });
    expect(items.map((m) => m.id.toString())).toEqual([m2.id.toString()]);
  });

  it("filtra por rango de fechas", async () => {
    const from = new Date();
    from.setDate(from.getDate() - 30);
    const to = new Date();
    to.setDate(to.getDate() - 5);

    await repo.save(makeMeasurement(pid, { daysAgo: 60 }));
    await repo.save(makeMeasurement(pid, { daysAgo: 15 }));
    await repo.save(makeMeasurement(pid, { daysAgo: 2 }));

    const items = await repo.findAll({ patientId: pid, from, to });
    expect(items).toHaveLength(1);
    expect(items[0]?.measuredAt.getTime()).toBeGreaterThanOrEqual(from.getTime());
  });

  it("preserva circunferencias y pliegues en roundtrip", async () => {
    const m = Anthropometry.create({
      patientId: pid,
      measuredAt: new Date(),
      weight: Weight.fromKg(75),
      height: Height.fromCentimeters(168),
      circumferences: {
        waist: Circumference.fromCm(85),
        hip: Circumference.fromCm(102),
        arm: Circumference.fromCm(30),
      },
      skinfolds: {
        triceps: Skinfold.fromMm(15),
        biceps: Skinfold.fromMm(8),
        subscapular: Skinfold.fromMm(14),
        suprailiac: Skinfold.fromMm(18),
        abdominal: Skinfold.fromMm(20),
        thigh: Skinfold.fromMm(22),
        calf: Skinfold.fromMm(12),
      },
    });
    await repo.save(m);

    const found = await repo.findById(m.id);
    expect(found?.circumferences.waist?.toCm()).toBe(85);
    expect(found?.circumferences.hip?.toCm()).toBe(102);
    expect(found?.skinfolds.triceps?.toMm()).toBe(15);
    expect(found?.skinfolds.thigh?.toMm()).toBe(22);
    expect(found?.sumOfSkinfolds).toBeCloseTo(15 + 8 + 14 + 18 + 20 + 22 + 12);
  });

  it("calcula BMI y waistHipRatio desde la entidad hidratada", async () => {
    const m = makeMeasurement(pid, { weight: 80, heightCm: 180 });
    await repo.save(m);

    const found = await repo.findById(m.id);
    expect(found?.bmi).toBeCloseTo(24.69, 2);
    expect(found?.waistHipRatio).toBe(0.8);
  });

  it("count refleja el total sin soft-deleted", async () => {
    const a = makeMeasurement(pid);
    const b = makeMeasurement(pid);
    await repo.save(a);
    await repo.save(b);
    await repo.delete(a.id, true);

    expect(await repo.count({ patientId: pid })).toBe(1);
  });

  it("count sin filtros", async () => {
    await repo.save(makeMeasurement(pid));
    await repo.save(makeMeasurement(PatientId.generate()));
    expect(await repo.count()).toBe(2);
  });

  it("hard delete elimina definitivamente", async () => {
    const m = makeMeasurement(pid);
    await repo.save(m);
    await repo.delete(m.id, false);

    const found = await repo.findById(m.id);
    expect(found).toBeNull();
  });

  it("delete en id inexistente (soft) no lanza error", async () => {
    await expect(repo.delete(AnthropometryId.generate(), true)).resolves.not.toThrow();
  });
});
