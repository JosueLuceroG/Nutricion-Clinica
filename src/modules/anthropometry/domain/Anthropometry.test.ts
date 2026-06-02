import { describe, it, expect } from "vitest";
import { Anthropometry } from "./Anthropometry";
import { PatientId } from "@modules/patient/domain/PatientId";
import { Weight, Height, Circumference, Skinfold } from "./Measurements";

const pid = PatientId.generate();

describe("Anthropometry.create", () => {
  it("crea medición válida", () => {
    const m = Anthropometry.create({
      patientId: pid,
      measuredAt: new Date(),
      weight: Weight.fromKg(70),
      height: Height.fromCentimeters(170),
    });
    expect(m.weight.toKg()).toBe(70);
    expect(m.height.toMeters()).toBeCloseTo(1.7);
    expect(m.bmi).toBeCloseTo(24.22, 1);
    expect(m.deletedAt).toBeNull();
  });

  it("rechaza fecha en el futuro lejano", () => {
    const future = new Date();
    future.setDate(future.getDate() + 10);
    expect(() =>
      Anthropometry.create({
        patientId: pid,
        measuredAt: future,
        weight: Weight.fromKg(70),
        height: Height.fromCentimeters(170),
      }),
    ).toThrow(/futuro/);
  });

  it("rechaza fecha anterior a 1900", () => {
    expect(() =>
      Anthropometry.create({
        patientId: pid,
        measuredAt: new Date("1899-12-31"),
        weight: Weight.fromKg(70),
        height: Height.fromCentimeters(170),
      }),
    ).toThrow(/1900/);
  });

  it("waistHipRatio es null si no hay cintura o cadera", () => {
    const m = Anthropometry.create({
      patientId: pid,
      measuredAt: new Date(),
      weight: Weight.fromKg(70),
      height: Height.fromCentimeters(170),
    });
    expect(m.waistHipRatio).toBeNull();
  });

  it("waistHipRatio se calcula con cintura y cadera", () => {
    const m = Anthropometry.create({
      patientId: pid,
      measuredAt: new Date(),
      weight: Weight.fromKg(70),
      height: Height.fromCentimeters(170),
      circumferences: {
        waist: Circumference.fromCm(80),
        hip: Circumference.fromCm(100),
      },
    });
    expect(m.waistHipRatio).toBe(0.8);
  });

  it("sumOfSkinfolds suma solo los pliegues presentes", () => {
    const m = Anthropometry.create({
      patientId: pid,
      measuredAt: new Date(),
      weight: Weight.fromKg(70),
      height: Height.fromCentimeters(170),
      skinfolds: {
        triceps: Skinfold.fromMm(10),
        biceps: Skinfold.fromMm(8),
        subscapular: Skinfold.fromMm(12),
      },
    });
    expect(m.sumOfSkinfolds).toBe(30);
  });
});

describe("Anthropometry.inmutabilidad", () => {
  it("with() retorna nueva instancia con updatedAt fresco", () => {
    const m = Anthropometry.create({
      patientId: pid,
      measuredAt: new Date(),
      weight: Weight.fromKg(70),
      height: Height.fromCentimeters(170),
      notes: "original",
    });
    const updated = m.with({ notes: "actualizado" });
    expect(m.notes).toBe("original");
    expect(updated.notes).toBe("actualizado");
    expect(updated.id.equals(m.id)).toBe(true);
  });

  it("softDelete marca deletedAt", () => {
    const m = Anthropometry.create({
      patientId: pid,
      measuredAt: new Date(),
      weight: Weight.fromKg(70),
      height: Height.fromCentimeters(170),
    });
    const deleted = m.softDelete();
    expect(deleted.deletedAt).not.toBeNull();
  });
});
