import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { DexiePatientRepository } from "./DexiePatientRepository";
import { NutriClinicaDB } from "@services/db/dexieSchema";
import { Patient } from "../domain/Patient";
import { PatientId } from "../domain/PatientId";
import { Email, Phone } from "../domain/Contact";
import type { Sex } from "../domain/Sex";

const makePatient = (
  overrides: Partial<{
    firstName: string;
    lastName: string;
    email: string | null;
    whatsappEnabled: boolean | null;
    status: "active" | "inactive" | "archived" | "deceased";
  }> = {},
) => {
  return Patient.create({
    firstName: overrides.firstName ?? "Ana",
    lastName: overrides.lastName ?? "Pérez",
    birthDate: new Date("1990-05-15"),
    sex: "female" as Sex,
    email: overrides.email ? Email.from(overrides.email) : null,
    phone: overrides.email ? Phone.from("+52 55 1234 5678") : null,
    whatsappEnabled: overrides.whatsappEnabled,
    status: overrides.status,
  });
};

describe("DexiePatientRepository", () => {
  let repo: DexiePatientRepository;
  let db: NutriClinicaDB;

  beforeEach(async () => {
    db = new NutriClinicaDB(`test-${Math.random().toString(36).slice(2)}`);
    await db.delete();
    db = new NutriClinicaDB(`test-${Math.random().toString(36).slice(2)}`);
    await db.open();
    repo = new DexiePatientRepository(db);
  });

  it("guarda y recupera un paciente por id", async () => {
    const p = makePatient();
    await repo.save(p);

    const found = await repo.findById(p.id);
    expect(found).not.toBeNull();
    expect(found?.fullName).toBe("Ana Pérez");
    expect(found?.id.equals(p.id)).toBe(true);
  });

  it("retorna null cuando el paciente no existe", async () => {
    const found = await repo.findById(PatientId.generate());
    expect(found).toBeNull();
  });

  it("findAll excluye soft-deleted por defecto", async () => {
    const p1 = makePatient({ firstName: "Ana" });
    const p2 = makePatient({ firstName: "Beto" });
    const p3 = makePatient({ firstName: "Carla" });

    await repo.save(p1);
    await repo.save(p2);
    await repo.save(p3);

    await repo.delete(p2.id, true);

    const all = await repo.findAll();
    const ids = all.map((p) => p.id.toString());
    expect(ids).toContain(p1.id.toString());
    expect(ids).not.toContain(p2.id.toString());
    expect(ids).toContain(p3.id.toString());
  });

  it("count refleja el número de pacientes activos", async () => {
    await repo.save(makePatient({ firstName: "Ana" }));
    await repo.save(makePatient({ firstName: "Beto" }));
    const p3 = makePatient({ firstName: "Carla" });
    await repo.save(p3);
    await repo.delete(p3.id, true);

    expect(await repo.count()).toBe(2);
  });

  it("filtra por search en nombre y apellido", async () => {
    await repo.save(makePatient({ firstName: "María", lastName: "García" }));
    await repo.save(makePatient({ firstName: "Juan", lastName: "Pérez" }));
    await repo.save(makePatient({ firstName: "Marisol", lastName: "López" }));

    const results = await repo.findAll({ search: "mar" });
    expect(results).toHaveLength(2);
    expect(results.map((p) => p.firstName).sort()).toEqual([
      "Marisol",
      "María",
    ]);
  });

  it("filtra por status", async () => {
    await repo.save(makePatient({ firstName: "Ana", status: "active" }));
    await repo.save(makePatient({ firstName: "Beto", status: "archived" }));
    await repo.save(makePatient({ firstName: "Carla", status: "inactive" }));

    const active = await repo.findAll({ status: "active" });
    expect(active).toHaveLength(1);
    expect(active[0]?.firstName).toBe("Ana");
  });

  it("filtra por sucursalId", async () => {
    const s1 = makePatient({ firstName: "SucursalUno" });
    const s2 = makePatient({ firstName: "SucursalDos" });
    await repo.save(s1);
    await repo.save(s2);
    await db.patients.update(s1.id.toString(), { sucursal_id: "s1" });
    await db.patients.update(s2.id.toString(), { sucursal_id: "s2" });

    const results = await repo.findAll({ sucursalId: "s1" });

    expect(results).toHaveLength(1);
    expect(results[0]?.firstName).toBe("SucursalUno");
    expect(await repo.count({ sucursalId: "s1" })).toBe(1);
  });

  it("filtra por sexo", async () => {
    await repo.save(makePatient({ firstName: "Ana" }));
    await repo.save(
      Patient.create({
        firstName: "Beto",
        lastName: "Pérez",
        birthDate: new Date("1985-01-01"),
        sex: "male" as Sex,
      }),
    );

    const males = await repo.findAll({ sex: "male" });
    expect(males).toHaveLength(1);
    expect(males[0]?.firstName).toBe("Beto");
  });

  it("limita y pagina resultados", async () => {
    for (let i = 0; i < 10; i++) {
      const num = String(i).padStart(2, "0");
      await repo.save(makePatient({ firstName: `P${num}`, lastName: "Test" }));
    }
    const first = await repo.findAll({ limit: 3, offset: 0 });
    const second = await repo.findAll({ limit: 3, offset: 3 });
    expect(first).toHaveLength(3);
    expect(second).toHaveLength(3);
    expect(first[0]?.id.equals(second[0]?.id ?? PatientId.generate())).toBe(
      false,
    );
  });

  it("preserva datos a través de save/findById roundtrip", async () => {
    const p = Patient.create({
      firstName: "Lucía",
      lastName: "Ramírez",
      birthDate: new Date("1992-08-20"),
      sex: "female" as Sex,
      email: Email.from("lucia@example.com"),
      phone: Phone.from("+52 55 9876 5432"),
      whatsappEnabled: false,
      externalRecordNumber: "EXP-2026-001",
      admissionReason: "Primera valoración nutricional",
      photoUrl: "data:image/png;base64,AAAA",
      medicalIntake: {
        diagnosedConditions: true,
        previousSurgeries: false,
        diagnosedConditionDetails: [
          {
            diagnosis: "Diabetes mellitus tipo 2",
            diagnosisYear: 2020,
            status: "controlled",
            treatment: "Metformina",
          },
        ],
        previousSurgeryDetails: [],
        currentTreatmentDetails: [
          {
            name: "Terapia física",
            reason: "Dolor lumbar",
            frequency: "Semanal",
            professional: "Dra. Laura Martínez",
          },
        ],
        intoleranceDetails: [
          {
            substance: "Lactosa",
            reaction: "Distensión abdominal",
            severity: "moderate",
          },
        ],
        medicationAllergies: true,
        adverseMedicationOrSupplementEffects: false,
        supplementDetails: [
          {
            name: "Omega 3",
            dose: "1000 mg",
            frequency: "daily",
            objective: "Salud cardiovascular",
          },
        ],
        medicationAllergyDetails: [
          {
            medication: "Penicilina",
            reaction: "Urticaria",
            severity: "moderate",
            requiredMedicalAttention: true,
          },
        ],
        dailyMedicationDetails: [
          {
            name: "Metformina",
            dose: "850 mg",
            frequency: "twiceDaily",
            schedule: "08:00",
            reason: "Diabetes",
            prescribedByProfessional: true,
          },
        ],
        familyHistory: true,
        familyHistoryMode: "recorded",
        familyHistoryDetails: {
          diabetes: ["mother", "siblings"],
          hypertension: ["father"],
          obesity: ["none"],
          cardiovascularDisease: ["maternalGrandparents"],
          dyslipidemia: ["none"],
          kidneyDisease: ["none"],
          thyroidDisease: ["paternalGrandparents"],
          otherConditions: null,
          notes: "Antecedente materno relevante",
        },
        nutritionIntake: {
          routine: {
            breakfastTime: "08:00",
            mainMealTime: "13:30",
            dinnerTime: "20:00",
            snackTimes: ["10:30"],
            mealsPerDay: 4,
            skipsMeals: false,
            mostSkippedMeal: null,
            scheduleVaries: false,
            scheduleVariation: null,
            mealDuration: "20To30",
          },
          patterns: {
            eatingOutFrequency: "rarely",
            snacksBetweenMeals: false,
            eatsLateAtNight: false,
            frequentCravings: false,
            cravingTime: null,
            mealPreparer: "family",
            primaryMealLocation: null,
          },
          preferences: {
            usualDietType: "vegetarian",
            otherDietDescription: null,
            avoidsFoods: false,
            avoidedFoods: null,
            followsFoodRestrictions: true,
            foodRestrictionDetails: "Vegetariana por elección",
            hasFoodDiscomfort: false,
            discomfortFoods: null,
            specialPreference: "none",
            notes: null,
          },
          hydration: {
            waterIntake: "twoToThreeLiters",
            drinksWaterThroughoutDay: true,
            carriesWaterBottle: true,
            coffeeTeaFrequency: "onePerDay",
            sugaryDrinkFrequency: "never",
            consumesEnergyDrinks: false,
            otherBeverage: "none",
            alcoholFrequency: null,
            notes: null,
          },
          digestive: {
            appetiteLevel: "normal",
            earlySatiety: false,
            hasDigestiveDiscomfort: false,
            symptoms: [],
            otherSymptomDescription: null,
            symptomTiming: null,
            notes: null,
          },
        },
        physicalActivity: true,
      },
    });
    await repo.save(p);

    const found = await repo.findById(p.id);
    expect(found?.email?.toString()).toBe("lucia@example.com");
    expect(found?.phone?.toString()).toBe("+52 55 9876 5432");
    expect(found?.whatsappEnabled).toBe(false);
    expect(found?.externalRecordNumber).toBe("EXP-2026-001");
    expect(found?.admissionReason).toBe("Primera valoración nutricional");
    expect(found?.photoUrl).toBe("data:image/png;base64,AAAA");
    expect(found?.medicalIntake.diagnosedConditions).toBe(true);
    expect(found?.medicalIntake.previousSurgeries).toBe(false);
    expect(found?.medicalIntake.diagnosedConditionDetails[0]).toEqual({
      diagnosis: "Diabetes mellitus tipo 2",
      diagnosisYear: 2020,
      status: "controlled",
      treatment: "Metformina",
    });
    expect(found?.medicalIntake.currentTreatmentDetails[0]).toEqual({
      name: "Terapia física",
      reason: "Dolor lumbar",
      frequency: "Semanal",
      professional: "Dra. Laura Martínez",
    });
    expect(found?.medicalIntake.intoleranceDetails[0]).toEqual({
      substance: "Lactosa",
      reaction: "Distensión abdominal",
      severity: "moderate",
    });
    expect(found?.medicalIntake.medicationAllergies).toBe(true);
    expect(found?.medicalIntake.adverseMedicationOrSupplementEffects).toBe(
      false,
    );
    expect(found?.medicalIntake.supplementDetails[0]).toEqual({
      name: "Omega 3",
      dose: "1000 mg",
      frequency: "daily",
      objective: "Salud cardiovascular",
    });
    expect(found?.medicalIntake.medicationAllergyDetails[0]).toEqual({
      medication: "Penicilina",
      reaction: "Urticaria",
      severity: "moderate",
      requiredMedicalAttention: true,
    });
    expect(found?.medicalIntake.dailyMedicationDetails[0]).toEqual({
      name: "Metformina",
      dose: "850 mg",
      frequency: "twiceDaily",
      schedule: "08:00",
      reason: "Diabetes",
      prescribedByProfessional: true,
    });
    expect(found?.medicalIntake.physicalActivity).toBe(true);
    expect(found?.medicalIntake.familyHistoryDetails?.diabetes).toEqual([
      "mother",
      "siblings",
    ]);
    expect(found?.medicalIntake.familyHistoryDetails?.notes).toBe(
      "Antecedente materno relevante",
    );
    expect(found?.medicalIntake.familyHistoryMode).toBe("recorded");
    expect(found?.medicalIntake.nutritionIntake?.routine).toEqual({
      breakfastTime: "08:00",
      mainMealTime: "13:30",
      dinnerTime: "20:00",
      snackTimes: ["10:30"],
      mealsPerDay: 4,
      skipsMeals: false,
      mostSkippedMeal: null,
      scheduleVaries: false,
      scheduleVariation: null,
      mealDuration: "20To30",
    });
    expect(found?.medicalIntake.nutritionIntake?.patterns).toEqual({
      eatingOutFrequency: "rarely",
      snacksBetweenMeals: false,
      eatsLateAtNight: false,
      frequentCravings: false,
      cravingTime: null,
      mealPreparer: "family",
      primaryMealLocation: null,
    });
    expect(found?.medicalIntake.nutritionIntake?.preferences).toEqual({
      usualDietType: "vegetarian",
      otherDietDescription: null,
      avoidsFoods: false,
      avoidedFoods: null,
      followsFoodRestrictions: true,
      foodRestrictionDetails: "Vegetariana por elección",
      hasFoodDiscomfort: false,
      discomfortFoods: null,
      specialPreference: "none",
      notes: null,
    });
    expect(found?.medicalIntake.nutritionIntake?.hydration).toEqual({
      waterIntake: "twoToThreeLiters",
      drinksWaterThroughoutDay: true,
      carriesWaterBottle: true,
      coffeeTeaFrequency: "onePerDay",
      sugaryDrinkFrequency: "never",
      consumesEnergyDrinks: false,
      otherBeverage: "none",
      alcoholFrequency: null,
      notes: null,
    });
    expect(found?.medicalIntake.nutritionIntake?.digestive).toEqual({
      appetiteLevel: "normal",
      earlySatiety: false,
      hasDigestiveDiscomfort: false,
      symptoms: [],
      otherSymptomDescription: null,
      symptomTiming: null,
      notes: null,
    });
    expect(found?.birthDate.toISOString()).toBe(
      new Date("1992-08-20").toISOString(),
    );
  });

  it("carga como null una fila heredada sin whatsapp_enabled", async () => {
    const patient = makePatient({ whatsappEnabled: true });
    await repo.save(patient);
    const row = await db.patients.get(patient.id.toString());
    expect(row).toBeDefined();
    delete row!.whatsapp_enabled;
    await db.patients.put(row!);

    const found = await repo.findById(patient.id);
    expect(found?.whatsappEnabled).toBeNull();
  });

  it("soft delete actualiza deletedAt y status", async () => {
    const p = makePatient();
    await repo.save(p);
    await repo.delete(p.id, true);

    const found = await repo.findById(p.id);
    expect(found?.deletedAt).not.toBeNull();
    expect(found?.status).toBe("inactive");
  });

  it("hard delete elimina definitivamente", async () => {
    const p = makePatient();
    await repo.save(p);
    await repo.delete(p.id, false);

    const found = await repo.findById(p.id);
    expect(found).toBeNull();
  });

  it("soft delete sobrevive a fila con fecha corrupta en IndexedDB (no lanza 'Invalid time value')", async () => {
    const p = makePatient({ firstName: "Malichita" });
    await repo.save(p);

    // Simulamos corrupción: alguien escribió string vacío en un campo
    // de fecha (e.g. una mutación a medio commit, o un pull side con
    // un campo faltante). La fila queda en IndexedDB con birth_date=""
    // y deleted_at="".
    await db.patients.update(p.id.toString(), {
      birth_date: "" as unknown as string,
      record_opened_at: "" as unknown as string,
      fecha_firma_consentimiento: "" as unknown as string,
    });

    // El soft delete debe sobrevivir: el mapper hace fallback a `new Date()`
    // en campos requeridos y a `null` en opcionales, en vez de lanzar.
    await expect(repo.delete(p.id, true)).resolves.toBeUndefined();

    const found = await repo.findById(p.id);
    expect(found).not.toBeNull();
    expect(found?.deletedAt).not.toBeNull();
    expect(found?.status).toBe("inactive");
    // birthDate fue reparado a una fecha válida (el fallback `new Date()`)
    expect(found?.birthDate).toBeInstanceOf(Date);
    expect(Number.isNaN(found?.birthDate.getTime() ?? NaN)).toBe(false);
  });

  it("soft delete sobrevive a birth_date como Date object (caso del pull del servidor)", async () => {
    const p = makePatient({ firstName: "Servidor" });
    await repo.save(p);

    // El pull del servidor guarda Date objects en IndexedDB en vez de
    // strings ISO. El mapper debe parsearlos correctamente.
    await db.patients.update(p.id.toString(), {
      birth_date: new Date("1990-05-15") as unknown as string,
      created_at: new Date() as unknown as string,
      updated_at: new Date() as unknown as string,
    });

    await expect(repo.delete(p.id, true)).resolves.toBeUndefined();

    const found = await repo.findById(p.id);
    expect(found?.status).toBe("inactive");
  });

  it("findDeleted devuelve solo pacientes soft-deleted, ordenados por deletedAt desc", async () => {
    const a = makePatient({ firstName: "Ana" });
    const b = makePatient({ firstName: "Bea" });
    const c = makePatient({ firstName: "Cris" });
    await repo.save(a);
    await repo.save(b);
    await repo.save(c);

    // Soft-delete a y c, pero NO a b.
    await repo.delete(a.id, true);
    await new Promise((r) => setTimeout(r, 5));
    await repo.delete(c.id, true);

    const deleted = await repo.findDeleted();
    expect(deleted.length).toBe(2);
    // c fue borrado más recientemente → primero
    expect(deleted[0]?.firstName).toBe("Cris");
    expect(deleted[1]?.firstName).toBe("Ana");
  });

  it("countDeleted cuenta solo soft-deleted", async () => {
    const a = makePatient({ firstName: "Ana" });
    const b = makePatient({ firstName: "Bea" });
    await repo.save(a);
    await repo.save(b);
    await repo.delete(a.id, true);
    expect(await repo.countDeleted()).toBe(1);
    expect(await repo.count()).toBe(1);
  });

  it("findAll con includeDeleted=true incluye soft-deleted en el resultado", async () => {
    const a = makePatient({ firstName: "Ana" });
    const b = makePatient({ firstName: "Bea" });
    await repo.save(a);
    await repo.save(b);
    await repo.delete(a.id, true);

    const allIncludingDeleted = await repo.findAll({ includeDeleted: true });
    expect(allIncludingDeleted.length).toBe(2);

    const onlyActive = await repo.findAll();
    expect(onlyActive.length).toBe(1);
    expect(onlyActive[0]?.firstName).toBe("Bea");
  });
});
