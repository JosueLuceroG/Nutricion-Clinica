import { afterEach, describe, it, expect, vi } from "vitest";
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

afterEach(() => {
  vi.useRealTimers();
});

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
    expect(patient.whatsappEnabled).toBeNull();
    expect(patient.deletedAt).toBeNull();
    expect(patient.claveInterna).toBeNull();
    expect(patient.birthPlace).toBeNull();
    expect(patient.address).toBeNull();
    expect(patient.nationality).toBeNull();
    expect(patient.idType).toBeNull();
    expect(patient.idNumber).toBeNull();
    expect(patient.dischargeReason).toBeNull();
    expect(patient.responsibleProfessionalId).toBeNull();
    expect(patient.externalRecordNumber).toBeNull();
    expect(patient.admissionReason).toBeNull();
    expect(patient.photoUrl).toBeNull();
    expect(patient.medicalIntake).toEqual({
      diagnosedConditions: null,
      previousSurgeries: null,
      currentTreatments: null,
      intolerances: null,
      familyHistory: null,
      familyHistoryDetails: null,
      medications: null,
      supplements: null,
      medicationAllergies: null,
      adverseMedicationOrSupplementEffects: null,
      physicalActivity: null,
    });
  });

  it("crea paciente con campos opcionales completos", () => {
    const patient = Patient.create({
      ...baseProps,
      gender: "woman",
      maritalStatus: "married",
      occupation: "Ingeniera",
      education: "bachelor",
      secondaryPhone: null,
      whatsappEnabled: true,
      emergencyContactName: "Juan Pérez",
      emergencyContactRelationship: "Cónyuge",
      generalNotes: "Paciente con antecedentes",
      clinicalTags: ["diabético", "embarazo"],
      claveInterna: "CLI-001",
      birthPlace: "Ciudad de México",
      address: "Calle 123, Col. Centro",
      nationality: "Mexicana",
      idType: "INE",
      idNumber: "INE123456",
      dischargeReason: "Mejoría clínica",
      responsibleProfessionalId: "PROF-001",
      externalRecordNumber: "EXT-98765",
      admissionReason: "Primera valoración nutricional",
      photoUrl: "https://example.com/photo.jpg",
      medicalIntake: {
        diagnosedConditions: true,
        previousSurgeries: false,
        currentTreatments: true,
        intolerances: false,
        familyHistory: true,
        familyHistoryDetails: {
          diabetes: ["mother"],
          hypertension: ["father"],
          obesity: ["none"],
          cardiovascularDisease: ["maternalGrandparents"],
          dyslipidemia: ["siblings"],
          kidneyDisease: ["none"],
          thyroidDisease: ["none"],
          otherConditions: "  Cardiopatía congénita  ",
          notes: "  Diagnóstico antes de los 50 años  ",
        },
        medications: true,
        supplements: false,
        medicationAllergies: true,
        adverseMedicationOrSupplementEffects: false,
        physicalActivity: true,
      },
    });
    expect(patient.gender).toBe("woman");
    expect(patient.maritalStatus).toBe("married");
    expect(patient.occupation).toBe("Ingeniera");
    expect(patient.education).toBe("bachelor");
    expect(patient.whatsappEnabled).toBe(true);
    expect(patient.emergencyContactName).toBe("Juan Pérez");
    expect(patient.emergencyContactRelationship).toBe("Cónyuge");
    expect(patient.generalNotes).toBe("Paciente con antecedentes");
    expect(patient.clinicalTags).toEqual(["diabético", "embarazo"]);
    expect(patient.claveInterna).toBe("CLI-001");
    expect(patient.birthPlace).toBe("Ciudad de México");
    expect(patient.address).toBe("Calle 123, Col. Centro");
    expect(patient.nationality).toBe("Mexicana");
    expect(patient.idType).toBe("INE");
    expect(patient.idNumber).toBe("INE123456");
    expect(patient.dischargeReason).toBe("Mejoría clínica");
    expect(patient.responsibleProfessionalId).toBe("PROF-001");
    expect(patient.externalRecordNumber).toBe("EXT-98765");
    expect(patient.admissionReason).toBe("Primera valoración nutricional");
    expect(patient.photoUrl).toBe("https://example.com/photo.jpg");
    expect(patient.medicalIntake.diagnosedConditions).toBe(true);
    expect(patient.medicalIntake.previousSurgeries).toBe(false);
    expect(patient.medicalIntake.physicalActivity).toBe(true);
    expect(patient.medicalIntake.familyHistoryDetails).toEqual({
      diabetes: ["mother"],
      hypertension: ["father"],
      obesity: ["none"],
      cardiovascularDisease: ["maternalGrandparents"],
      dyslipidemia: ["siblings"],
      kidneyDisease: ["none"],
      thyroidDisease: ["none"],
      otherConditions: "Cardiopatía congénita",
      notes: "Diagnóstico antes de los 50 años",
    });
  });

  it("calcula edad correcta", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-16T12:00:00Z"));

    const patient = Patient.create({
      ...baseProps,
      birthDate: new Date("1990-06-15"),
    });
    expect(patient.age).toBe(34);
  });

  it("rechaza nombre muy corto", () => {
    expect(() => Patient.create({ ...baseProps, firstName: "A" })).toThrow(
      /al menos 2 caracteres/,
    );
  });

  it("rechaza fecha de nacimiento en el futuro", () => {
    const future = new Date();
    future.setFullYear(future.getFullYear() + 1);
    expect(() => Patient.create({ ...baseProps, birthDate: future })).toThrow(
      /futuro/,
    );
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
    expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(
      original.updatedAt.getTime(),
    );
  });

  it("with() preserva secondLastName", () => {
    const original = Patient.create(baseProps);
    const updated = original.with({ occupation: "Doctora" });
    expect(updated.secondLastName).toBe("López");
    expect(updated.occupation).toBe("Doctora");
  });

  it("with() conserva false y permite limpiar la preferencia de WhatsApp", () => {
    const original = Patient.create({ ...baseProps, whatsappEnabled: true });
    const disabled = original.with({ whatsappEnabled: false });
    const cleared = disabled.with({ whatsappEnabled: null });

    expect(disabled.whatsappEnabled).toBe(false);
    expect(cleared.whatsappEnabled).toBeNull();
    expect(original.whatsappEnabled).toBe(true);
  });

  it("softDelete() marca deletedAt y status inactive", () => {
    const patient = Patient.create({ ...baseProps, whatsappEnabled: false });
    const deleted = patient.softDelete();
    expect(deleted.deletedAt).not.toBeNull();
    expect(deleted.status).toBe("inactive");
    expect(deleted.recordStatus).toBe("inactive");
    expect(deleted.isActive).toBe(false);
    expect(deleted.whatsappEnabled).toBe(false);
  });

  it("isActive es true cuando status=active y deletedAt=null", () => {
    const patient = Patient.create(baseProps);
    expect(patient.isActive).toBe(true);
  });
});
