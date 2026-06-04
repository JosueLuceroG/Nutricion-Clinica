import { describe, it, expect } from "vitest";
import { Patient } from "./Patient";
import { Email } from "./Contact";

const baseProps = {
  firstName: "María",
  lastName: "García",
  secondLastName: "López",
  birthDate: new Date("1990-05-15"),
  sex: "female" as const,
  email: Email.from("maria.garcia@example.com"),
};

describe("Patient.create", () => {
  it("crea paciente con datos válidos", () => {
    const patient = Patient.create(baseProps);
    expect(patient.firstName).toBe("María");
    expect(patient.lastName).toBe("García");
    expect(patient.secondLastName).toBe("López");
    expect(patient.fullName).toBe("María García López");
    expect(patient.email?.toString()).toBe("maria.garcia@example.com");
    expect(patient.status).toBe("active");
    expect(patient.recordStatus).toBe("active");
    expect(patient.recordOpenedAt).toBeInstanceOf(Date);
    expect(patient.clinicalTags).toEqual([]);
    expect(patient.generalNotes).toBeNull();
    expect(patient.gender).toBeNull();
    expect(patient.maritalStatus).toBeNull();
    expect(patient.occupation).toBeNull();
    expect(patient.education).toBeNull();
    expect(patient.deletedAt).toBeNull();
  });

  it("crea paciente con campos opcionales completos", () => {
    const patient = Patient.create({
      ...baseProps,
      gender: "woman",
      maritalStatus: "married",
      occupation: "Ingeniera",
      education: "bachelor",
      secondaryPhone: null,
      emergencyContactName: "Juan Pérez",
      emergencyContactRelationship: "Cónyuge",
      generalNotes: "Paciente con antecedentes",
      clinicalTags: ["diabético", "embarazo"],
    });
    expect(patient.gender).toBe("woman");
    expect(patient.maritalStatus).toBe("married");
    expect(patient.occupation).toBe("Ingeniera");
    expect(patient.education).toBe("bachelor");
    expect(patient.emergencyContactName).toBe("Juan Pérez");
    expect(patient.emergencyContactRelationship).toBe("Cónyuge");
    expect(patient.generalNotes).toBe("Paciente con antecedentes");
    expect(patient.clinicalTags).toEqual(["diabético", "embarazo"]);
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

  it("fullName incluye secondLastName cuando existe", () => {
    const p1 = Patient.create({ ...baseProps, secondLastName: "López" });
    expect(p1.fullName).toBe("María García López");
    const p2 = Patient.create({ ...baseProps, secondLastName: null });
    expect(p2.fullName).toBe("María García");
  });
});

describe("Patient.inmutabilidad", () => {
  it("with() retorna nueva instancia sin mutar original", () => {
    const original = Patient.create(baseProps);
    const updated = original.with({ firstName: "Ana" });

    expect(original.firstName).toBe("María");
    expect(updated.firstName).toBe("Ana");
    expect(updated.id.equals(original.id)).toBe(true);
  });

  it("with() actualiza updatedAt", () => {
    const original = Patient.create(baseProps);
    const updated = original.with({ status: "inactive" });
    expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(original.updatedAt.getTime());
  });

  it("with() preserva secondLastName", () => {
    const original = Patient.create(baseProps);
    const updated = original.with({ occupation: "Doctora" });
    expect(updated.secondLastName).toBe("López");
    expect(updated.occupation).toBe("Doctora");
  });

  it("softDelete() marca deletedAt y status inactive", () => {
    const patient = Patient.create(baseProps);
    const deleted = patient.softDelete();
    expect(deleted.deletedAt).not.toBeNull();
    expect(deleted.status).toBe("inactive");
    expect(deleted.recordStatus).toBe("inactive");
    expect(deleted.isActive).toBe(false);
  });

  it("isActive es true cuando status=active y deletedAt=null", () => {
    const patient = Patient.create(baseProps);
    expect(patient.isActive).toBe(true);
  });
});
