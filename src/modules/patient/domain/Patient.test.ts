import { describe, it, expect } from "vitest";
import { Patient } from "./Patient";
import { Email } from "./Contact";

const baseProps = {
  firstName: "María",
  lastName: "García López",
  birthDate: new Date("1990-05-15"),
  sex: "female" as const,
  email: Email.from("maria.garcia@example.com"),
};

describe("Patient.create", () => {
  it("crea paciente con datos válidos", () => {
    const patient = Patient.create(baseProps);
    expect(patient.firstName).toBe("María");
    expect(patient.lastName).toBe("García López");
    expect(patient.fullName).toBe("María García López");
    expect(patient.email?.toString()).toBe("maria.garcia@example.com");
    expect(patient.status).toBe("active");
    expect(patient.deletedAt).toBeNull();
  });

  it("calcula edad correcta", () => {
    const patient = Patient.create({
      ...baseProps,
      birthDate: new Date("1990-06-15"),
    });
    const age = patient.age;
    expect(age).toBeGreaterThanOrEqual(33);
    expect(age).toBeLessThanOrEqual(35);
  });

  it("rechaza nombre muy corto", () => {
    expect(() =>
      Patient.create({ ...baseProps, firstName: "A" }),
    ).toThrow(/al menos 2 caracteres/);
  });

  it("rechaza fecha de nacimiento en el futuro", () => {
    const future = new Date();
    future.setFullYear(future.getFullYear() + 1);
    expect(() =>
      Patient.create({ ...baseProps, birthDate: future }),
    ).toThrow(/futuro/);
  });

  it("rechaza fecha anterior a 1900", () => {
    expect(() =>
      Patient.create({ ...baseProps, birthDate: new Date("1899-01-01") }),
    ).toThrow(/1900/);
  });
});

describe("Patient.inmutabilidad", () => {
  it("with() retorna nueva instancia sin mutar original", () => {
    const original = Patient.create(baseProps);
    const originalSnapshot = { ...original };
    const updated = original.with({ firstName: "Ana" });

    expect(original.firstName).toBe(originalSnapshot.firstName);
    expect(original.firstName).toBe("María");
    expect(updated.firstName).toBe("Ana");
    expect(updated.id.equals(original.id)).toBe(true);
  });

  it("with() actualiza updatedAt", () => {
    const original = Patient.create(baseProps);
    const updated = original.with({ status: "inactive" });
    expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(original.updatedAt.getTime());
  });

  it("softDelete() marca deletedAt y status inactive", () => {
    const patient = Patient.create(baseProps);
    const deleted = patient.softDelete();
    expect(deleted.deletedAt).not.toBeNull();
    expect(deleted.status).toBe("inactive");
    expect(deleted.isActive).toBe(false);
  });

  it("isActive es true cuando status=active y deletedAt=null", () => {
    const patient = Patient.create(baseProps);
    expect(patient.isActive).toBe(true);
  });
});
