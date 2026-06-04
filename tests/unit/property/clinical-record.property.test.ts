import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  Allergy,
  AllergyId,
  AllergyDiagnosisSchema,
  SeveritySchema,
  Medication,
  MedicationId,
  MedicationFreqSchema,
  ClinicalEvent,
  ClinicalEventId,
  EventTypeSchema,
  FamilyHistory,
  FamilyHistoryId,
  FamilyRelationshipSchema,
  ConditionSchema,
  PersonalHistory,
  PersonalHistoryId,
  PersonalConditionSchema,
  Habit,
  HabitId,
  HabitCategorySchema,
  PhysicalActivity,
  PhysicalActivityId,
  ActivityTypeSchema,
  BorgIntensitySchema,
  DietHistory,
  DietHistoryId,
  DietTypeSchema,
  MealPlaceSchema,
  Surgery,
  SurgeryId,
  SurgeryTypeSchema,
  Hospitalization,
  HospitalizationId,
  Supplement,
  SupplementId,
  SupplementCategorySchema,
  FoodFrequency,
  FoodFrequencyId,
  FrequencyValueSchema,
  GiSymptom,
  GiSymptomId,
  GiSymptomTypeSchema,
  SnapshotExpediente,
  SnapshotExpedienteId,
} from "@modules/clinical-record/domain";

const validStringArb = fc.string({ minLength: 2, maxLength: 50 }).filter(s => s.trim().length >= 2);
const shortStringArb = fc.string({ minLength: 0, maxLength: 1 });
const isoDateArb = fc.date({ min: new Date("1900-01-01"), max: new Date("2100-01-01") }).map((d) => d.toISOString().split("T")[0]);
const optionalStringArb = fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: null });

describe("Allergy — property tests", () => {
  it("create con inputs válidos siempre produce un Allergy con id y fechas", () => {
    fc.assert(
      fc.property(
        validStringArb, validStringArb,
        fc.constantFrom(...SeveritySchema.options),
        fc.constantFrom(...AllergyDiagnosisSchema.options),
        optionalStringArb,
        (allergen, reaction, severity, diagnosis, notes) => {
          const allergy = Allergy.create({
            patientId: AllergyId.generate(),
            allergen,
            reaction,
            severity,
            diagnosis,
            notes,
          });
          expect(allergy.allergen).toBe(allergen.trim());
          expect(allergy.reaction).toBe(reaction.trim());
          expect(allergy.severity).toBe(severity);
          expect(allergy.diagnosis).toBe(diagnosis);
          expect(allergy.notes).toBe(notes?.trim() ?? null);
          expect(allergy.id).toBeInstanceOf(AllergyId);
          expect(allergy.createdAt).toBeTruthy();
          expect(allergy.updatedAt).toBeTruthy();
        },
      ),
    );
  });

  it("create lanza para allergen o reaction de < 2 caracteres", () => {
    fc.assert(
      fc.property(shortStringArb, validStringArb, (allergen, reaction) => {
        expect(() => Allergy.create({
          patientId: AllergyId.generate(), allergen, reaction,
          severity: "leve", diagnosis: "clinico",
        })).toThrow();
      }),
    );
  });

  it("reconstitute + toProps roundtrip preserva todos los campos", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 10, maxLength: 36 }), fc.string({ minLength: 10, maxLength: 36 }),
        validStringArb, validStringArb,
        fc.constantFrom(...SeveritySchema.options),
        fc.constantFrom(...AllergyDiagnosisSchema.options),
        optionalStringArb,
        fc.string(), fc.string(),
        (id, pid, allergen, reaction, severity, diagnosis, notes, createdAt, updatedAt) => {
          const props = { id, patientId: pid, allergen, reaction, severity, diagnosis, notes, createdAt, updatedAt };
          const allergy = Allergy.reconstitute(props);
          const back = allergy.toProps();
          expect(back).toEqual(props);
        },
      ),
    );
  });

  it("withUpdates solo modifica los campos especificados", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 10, maxLength: 36 }), fc.string({ minLength: 10, maxLength: 36 }),
        validStringArb, validStringArb,
        fc.constantFrom(...SeveritySchema.options),
        fc.constantFrom(...AllergyDiagnosisSchema.options),
        optionalStringArb,
        fc.string(), fc.string(),
        validStringArb,
        (id, pid, allergen, reaction, severity, diagnosis, notes, createdAt, updatedAt, newAllergen) => {
          const props = { id, patientId: pid, allergen, reaction, severity, diagnosis, notes, createdAt, updatedAt };
          const original = Allergy.reconstitute(props);
          const updated = original.withUpdates({ allergen: newAllergen });
          expect(updated.allergen).toBe(newAllergen.trim());
          expect(updated.reaction).toBe(original.reaction);
          expect(updated.severity).toBe(original.severity);
          expect(updated.diagnosis).toBe(original.diagnosis);
          expect(updated.notes).toBe(original.notes);
        },
      ),
    );
  });
});

describe("Medication — property tests", () => {
  it("create con inputs válidos produce un Medication con defaults", () => {
    fc.assert(
      fc.property(
        validStringArb, validStringArb, validStringArb,
        fc.constantFrom(...MedicationFreqSchema.options),
        isoDateArb,
        (name, activeIngredient, dose, frequency, startDate) => {
          const med = Medication.create({
            patientId: MedicationId.generate(),
            name, activeIngredient, dose, frequency, startDate,
          });
          expect(med.name).toBe(name.trim());
          expect(med.activeIngredient).toBe(activeIngredient.trim());
          expect(med.dose).toBe(dose.trim());
          expect(med.route).toBe("oral");
          expect(med.endDate).toBeNull();
          expect(med.prescribedBy).toBeNull();
          expect(med.notes).toBeNull();
          expect(med.id).toBeInstanceOf(MedicationId);
        },
      ),
    );
  });

  it("create lanza para name o activeIngredient de < 2 caracteres", () => {
    fc.assert(
      fc.property(shortStringArb, validStringArb, isoDateArb, (name, ingredient, startDate) => {
        expect(() => Medication.create({
          patientId: MedicationId.generate(), name, activeIngredient: ingredient,
          dose: "10mg", frequency: "cada-24h", startDate,
        })).toThrow();
      }),
    );
  });

  it("reconstitute + toProps roundtrip preserva todos los campos", () => {
    fc.assert(
      fc.property(
        fc.string(), fc.string(),
        validStringArb, validStringArb, validStringArb,
        fc.constantFrom(...MedicationFreqSchema.options),
        validStringArb, isoDateArb,
        optionalStringArb, optionalStringArb, optionalStringArb,
        fc.string(), fc.string(),
        (id, pid, name, ingredient, dose, freq, route, startDate, endDate, prescribedBy, notes, createdAt, updatedAt) => {
          const props = {
            id, patientId: pid, name, activeIngredient: ingredient, dose,
            frequency: freq, route, startDate,
            endDate, prescribedBy, notes, createdAt, updatedAt,
          };
          const med = Medication.reconstitute(props);
          const back = med.toProps();
          expect(back).toEqual(props);
        },
      ),
    );
  });

  it("isActive es false cuando endDate es pasado", () => {
    fc.assert(
      fc.property(
        validStringArb, validStringArb, validStringArb,
        fc.constantFrom(...MedicationFreqSchema.options),
        isoDateArb,
        fc.date({ min: new Date("2000-01-01"), max: new Date("2020-12-31") }).map((d) => d.toISOString().split("T")[0]),
        (name, ingredient, dose, freq, startDate, endDate) => {
          const med = Medication.create({
            patientId: MedicationId.generate(),
            name, activeIngredient: ingredient, dose, frequency: freq,
            startDate, endDate,
          });
          expect(med.isActive).toBe(false);
        },
      ),
    );
  });
});

describe("ClinicalEvent — property tests", () => {
  it("create con inputs válidos produce un ClinicalEvent", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...EventTypeSchema.options),
        validStringArb,
        isoDateArb,
        optionalStringArb,
        optionalStringArb,
        (type, name, date, description, notes) => {
          const event = ClinicalEvent.create({
            patientId: ClinicalEventId.generate(),
            type, name, date, description, notes,
          });
          expect(event.type).toBe(type);
          expect(event.name).toBe(name.trim());
          expect(event.date).toBe(date);
          expect(event.description).toBe(description?.trim() ?? null);
          expect(event.notes).toBe(notes?.trim() ?? null);
          expect(event.endDate).toBeNull();
          expect(event.id).toBeInstanceOf(ClinicalEventId);
        },
      ),
    );
  });

  it("create lanza para name de < 2 caracteres", () => {
    fc.assert(
      fc.property(shortStringArb, isoDateArb, (name, date) => {
        expect(() => ClinicalEvent.create({
          patientId: ClinicalEventId.generate(),
          type: "evento-clinico", name, date,
        })).toThrow();
      }),
    );
  });

  it("reconstitute + toProps roundtrip preserva todos los campos", () => {
    fc.assert(
      fc.property(
        fc.string(), fc.string(),
        fc.constantFrom(...EventTypeSchema.options),
        validStringArb,
        optionalStringArb, isoDateArb,
        optionalStringArb, optionalStringArb,
        fc.string(), fc.string(),
        (id, pid, type, name, description, date, endDate, notes, createdAt, updatedAt) => {
          const props = { id, patientId: pid, type, name, description, date, endDate, notes, createdAt, updatedAt };
          const event = ClinicalEvent.reconstitute(props);
          const back = event.toProps();
          expect(back).toEqual(props);
        },
      ),
    );
  });
});

describe("FamilyHistory — property tests", () => {
  it("create con inputs válidos produce un FamilyHistory con id y fechas", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...FamilyRelationshipSchema.options),
        fc.constantFrom(...ConditionSchema.options),
        fc.option(fc.integer({ min: 0, max: 120 }), { nil: null }),
        optionalStringArb,
        (relationship, condition, diagnosisAge, notes) => {
          const fh = FamilyHistory.create({
            patientId: FamilyHistoryId.generate(),
            relationship, condition, diagnosisAge, notes,
          });
          expect(fh.relationship).toBe(relationship);
          expect(fh.condition).toBe(condition);
          expect(fh.diagnosisAge).toBe(diagnosisAge ?? null);
          expect(fh.notes).toBe(notes?.trim() ?? null);
          expect(fh.id).toBeInstanceOf(FamilyHistoryId);
          expect(fh.createdAt).toBeTruthy();
          expect(fh.updatedAt).toBeTruthy();
        },
      ),
    );
  });

  it("reconstitute + toProps roundtrip preserva todos los campos", () => {
    fc.assert(
      fc.property(
        fc.string(), fc.string(),
        fc.constantFrom(...FamilyRelationshipSchema.options),
        fc.constantFrom(...ConditionSchema.options),
        fc.option(fc.integer({ min: 0, max: 120 }), { nil: null }),
        optionalStringArb,
        fc.string(), fc.string(),
        (id, pid, relationship, condition, diagnosisAge, notes, createdAt, updatedAt) => {
          const props = { id, patientId: pid, relationship, condition, diagnosisAge, notes, createdAt, updatedAt };
          const fh = FamilyHistory.reconstitute(props);
          const back = fh.toProps();
          expect(back).toEqual(props);
        },
      ),
    );
  });

  it("withUpdates solo modifica los campos especificados", () => {
    fc.assert(
      fc.property(
        fc.string(), fc.string(),
        fc.constantFrom(...FamilyRelationshipSchema.options),
        fc.constantFrom(...ConditionSchema.options),
        fc.option(fc.integer({ min: 0, max: 120 }), { nil: null }),
        optionalStringArb, fc.string(), fc.string(),
        fc.constantFrom(...FamilyRelationshipSchema.options),
        (id, pid, rel, cond, age, notes, createdAt, updatedAt, newRel) => {
          const props = { id, patientId: pid, relationship: rel, condition: cond, diagnosisAge: age, notes, createdAt, updatedAt };
          const original = FamilyHistory.reconstitute(props);
          const updated = original.withUpdates({ relationship: newRel });
          expect(updated.relationship).toBe(newRel);
          expect(updated.condition).toBe(original.condition);
          expect(updated.diagnosisAge).toBe(original.diagnosisAge);
          expect(updated.notes).toBe(original.notes);
        },
      ),
    );
  });
});

describe("PersonalHistory — property tests", () => {
  it("create con inputs válidos produce un PersonalHistory con status default", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...PersonalConditionSchema.options),
        fc.option(isoDateArb, { nil: null }),
        fc.option(validStringArb, { nil: null }),
        fc.option(validStringArb, { nil: null }),
        optionalStringArb,
        (condition, diagnosisDate, treatingPhysician, treatment, notes) => {
          const ph = PersonalHistory.create({
            patientId: PersonalHistoryId.generate(),
            condition, diagnosisDate, treatingPhysician, treatment, notes,
          });
          expect(ph.condition).toBe(condition);
          expect(ph.diagnosisDate).toBe(diagnosisDate ?? null);
          expect(ph.status).toBe("activo");
          expect(ph.treatingPhysician).toBe(treatingPhysician?.trim() ?? null);
          expect(ph.treatment).toBe(treatment?.trim() ?? null);
          expect(ph.notes).toBe(notes?.trim() ?? null);
          expect(ph.id).toBeInstanceOf(PersonalHistoryId);
        },
      ),
    );
  });

  it("reconstitute + toProps roundtrip preserva todos los campos", () => {
    fc.assert(
      fc.property(
        fc.string(), fc.string(),
        fc.constantFrom(...PersonalConditionSchema.options),
        fc.option(isoDateArb, { nil: null }),
        fc.string({ minLength: 1, maxLength: 20 }),
        optionalStringArb, optionalStringArb, optionalStringArb,
        fc.string(), fc.string(),
        (id, pid, condition, diagnosisDate, status, treatingPhysician, treatment, notes, createdAt, updatedAt) => {
          const props = {
            id, patientId: pid, condition, diagnosisDate, status,
            treatingPhysician, treatment, notes, createdAt, updatedAt,
          };
          const ph = PersonalHistory.reconstitute(props);
          const back = ph.toProps();
          expect(back).toEqual(props);
        },
      ),
    );
  });

  it("withUpdates solo modifica los campos especificados y preserva status", () => {
    fc.assert(
      fc.property(
        fc.string(), fc.string(),
        fc.constantFrom(...PersonalConditionSchema.options),
        fc.option(isoDateArb, { nil: null }),
        fc.string({ minLength: 1 }), optionalStringArb, optionalStringArb,
        optionalStringArb, fc.string(), fc.string(),
        fc.constantFrom(...PersonalConditionSchema.options),
        (id, pid, cond, dd, st, tp, tr, notes, ca, ua, newCond) => {
          const props = {
            id, patientId: pid, condition: cond, diagnosisDate: dd,
            status: st, treatingPhysician: tp, treatment: tr,
            notes, createdAt: ca, updatedAt: ua,
          };
          const original = PersonalHistory.reconstitute(props);
          const updated = original.withUpdates({ condition: newCond });
          expect(updated.condition).toBe(newCond);
          expect(updated.status).toBe(original.status);
          expect(updated.treatingPhysician).toBe(original.treatingPhysician);
          expect(updated.treatment).toBe(original.treatment);
        },
      ),
    );
  });
});

describe("Habit — property tests", () => {
  const statusArb = fc.string({ minLength: 1, maxLength: 30 });

  it("create con inputs válidos produce un Habit", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...HabitCategorySchema.options),
        statusArb,
        fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: null }),
        fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: null }),
        optionalStringArb,
        (category, status, frequency, quantity, notes) => {
          const habit = Habit.create({
            patientId: HabitId.generate(),
            category, status, frequency, quantity, notes,
          });
          expect(habit.category).toBe(category);
          expect(habit.status).toBe(status.trim());
          expect(habit.frequency).toBe(frequency?.trim() ?? null);
          expect(habit.quantity).toBe(quantity?.trim() ?? null);
          expect(habit.notes).toBe(notes?.trim() ?? null);
          expect(habit.id).toBeInstanceOf(HabitId);
        },
      ),
    );
  });

  it("reconstitute + toProps roundtrip preserva todos los campos", () => {
    fc.assert(
      fc.property(
        fc.string(), fc.string(),
        fc.constantFrom(...HabitCategorySchema.options),
        statusArb,
        optionalStringArb, optionalStringArb, optionalStringArb,
        fc.string(), fc.string(),
        (id, pid, category, st, freq, qty, notes, ca, ua) => {
          const props = {
            id, patientId: pid, category, status: st,
            frequency: freq, quantity: qty, notes,
            createdAt: ca, updatedAt: ua,
          };
          const habit = Habit.reconstitute(props);
          const back = habit.toProps();
          expect(back).toEqual(props);
        },
      ),
    );
  });
});

describe("PhysicalActivity — property tests", () => {
  it("create con inputs válidos produce un PhysicalActivity", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ActivityTypeSchema.options),
        fc.integer({ min: 0, max: 14 }),
        fc.integer({ min: 1, max: 600 }),
        fc.constantFrom(...BorgIntensitySchema.options),
        fc.option(isoDateArb, { nil: null }),
        fc.option(isoDateArb, { nil: null }),
        optionalStringArb,
        (type, freq, dur, intensity, startDate, endDate, notes) => {
          const pa = PhysicalActivity.create({
            patientId: PhysicalActivityId.generate(),
            type, frequencyPerWeek: freq, durationMinutes: dur,
            intensity, startDate, endDate, notes,
          });
          expect(pa.type).toBe(type);
          expect(pa.frequencyPerWeek).toBe(freq);
          expect(pa.durationMinutes).toBe(dur);
          expect(pa.intensity).toBe(intensity);
          expect(pa.startDate).toBe(startDate ?? null);
          expect(pa.endDate).toBe(endDate ?? null);
          expect(pa.notes).toBe(notes?.trim() ?? null);
          expect(pa.id).toBeInstanceOf(PhysicalActivityId);
        },
      ),
    );
  });

  it("create lanza para frequencyPerWeek fuera de rango", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 15, max: 100 }),
        (freq) => {
          expect(() => PhysicalActivity.create({
            patientId: PhysicalActivityId.generate(),
            type: "caminata", frequencyPerWeek: freq,
            durationMinutes: 30, intensity: "moderate",
          })).toThrow();
        },
      ),
    );
  });

  it("create lanza para durationMinutes fuera de rango", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 601, max: 2000 }),
        (dur) => {
          expect(() => PhysicalActivity.create({
            patientId: PhysicalActivityId.generate(),
            type: "caminata", frequencyPerWeek: 3,
            durationMinutes: dur, intensity: "moderate",
          })).toThrow();
        },
      ),
    );
  });

  it("reconstitute + toProps roundtrip preserva todos los campos", () => {
    fc.assert(
      fc.property(
        fc.string(), fc.string(),
        fc.constantFrom(...ActivityTypeSchema.options),
        fc.integer({ min: 0, max: 14 }),
        fc.integer({ min: 1, max: 600 }),
        fc.constantFrom(...BorgIntensitySchema.options),
        fc.option(isoDateArb, { nil: null }),
        fc.option(isoDateArb, { nil: null }),
        optionalStringArb, fc.string(), fc.string(),
        (id, pid, type, freq, dur, intensity, startDate, endDate, notes, ca, ua) => {
          const props = {
            id, patientId: pid, type, frequencyPerWeek: freq,
            durationMinutes: dur, intensity, startDate, endDate,
            notes, createdAt: ca, updatedAt: ua,
          };
          const pa = PhysicalActivity.reconstitute(props);
          const back = pa.toProps();
          expect(back).toEqual(props);
        },
      ),
    );
  });

  it("isActive es false cuando endDate es pasado", () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date("2000-01-01"), max: new Date("2020-12-31") }).map((d) => d.toISOString().split("T")[0]),
        (endDate) => {
          const pa = PhysicalActivity.create({
            patientId: PhysicalActivityId.generate(),
            type: "caminata", frequencyPerWeek: 3,
            durationMinutes: 30, intensity: "moderate",
            endDate,
          });
          expect(pa.isActive).toBe(false);
        },
      ),
    );
  });
});

describe("DietHistory — property tests", () => {
  const stringFieldArb = fc.string({ minLength: 0, maxLength: 100 });

  it("create con inputs válidos produce un DietHistory con defaults", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...DietTypeSchema.options),
        fc.integer({ min: 1, max: 20 }),
        (dietType, mealsPerDay) => {
          const dh = DietHistory.create({
            patientId: DietHistoryId.generate(),
            dietType, mealsPerDay,
          });
          expect(dh.dietType).toBe(dietType);
          expect(dh.mealsPerDay).toBe(mealsPerDay);
          expect(dh.mealPlace).toBe("hogar");
          expect(dh.labelReading).toBe(false);
          expect(dh.householdPeople).toBe(1);
          expect(dh.id).toBeInstanceOf(DietHistoryId);
        },
      ),
    );
  });

  it("create lanza para mealsPerDay fuera de rango", () => {
    fc.assert(
      fc.property(fc.integer({ min: 21, max: 100 }), (n) => {
        expect(() => DietHistory.create({
          patientId: DietHistoryId.generate(),
          dietType: "omnivoro", mealsPerDay: n,
        })).toThrow();
      }),
    );
  });

  it("create lanza para householdPeople fuera de rango", () => {
    fc.assert(
      fc.property(fc.integer({ min: 51, max: 200 }), (n) => {
        expect(() => DietHistory.create({
          patientId: DietHistoryId.generate(),
          dietType: "omnivoro", mealsPerDay: 3, householdPeople: n,
        })).toThrow();
      }),
    );
  });

  it("reconstitute + toProps roundtrip preserva todos los campos", () => {
    fc.assert(
      fc.property(
        fc.string(), fc.string(),
        fc.constantFrom(...DietTypeSchema.options),
        fc.integer({ min: 1, max: 20 }),
        stringFieldArb, fc.constantFrom(...MealPlaceSchema.options),
        stringFieldArb, stringFieldArb, stringFieldArb, stringFieldArb,
        stringFieldArb, fc.boolean(), stringFieldArb,
        stringFieldArb, stringFieldArb, stringFieldArb, stringFieldArb,
        fc.integer({ min: 1, max: 50 }),
        optionalStringArb, fc.string(), fc.string(),
        (id, pid, dt, mpd, ms, mpl, mpr, ta, bud, ke, pd, lr, nk, pref, av, ch, ws, hp, notes, ca, ua) => {
          const props = {
            id, patientId: pid, dietType: dt, mealsPerDay: mpd,
            mealSchedule: ms, mealPlace: mpl, mealPreparer: mpr,
            timeAvailable: ta, budget: bud, kitchenEquipment: ke,
            previousDiets: pd, labelReading: lr, nutritionalKnowledge: nk,
            preferences: pref, aversions: av, chewing: ch,
            workSchedule: ws, householdPeople: hp, notes,
            createdAt: ca, updatedAt: ua,
          };
          const dh = DietHistory.reconstitute(props);
          const back = dh.toProps();
          expect(back).toEqual(props);
        },
      ),
    );
  });
});

describe("Surgery — property tests", () => {
  it("create con inputs válidos produce un Surgery con id y fechas", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...SurgeryTypeSchema.options),
        isoDateArb,
        validStringArb,
        optionalStringArb,
        optionalStringArb,
        (type, date, hospital, complications, notes) => {
          const surgery = Surgery.create({
            patientId: SurgeryId.generate(),
            type, date, hospital, complications, notes,
          });
          expect(surgery.type).toBe(type);
          expect(surgery.date).toBe(date);
          expect(surgery.hospital).toBe(hospital.trim());
          expect(surgery.complications).toBe(complications?.trim() ?? null);
          expect(surgery.notes).toBe(notes?.trim() ?? null);
          expect(surgery.id).toBeInstanceOf(SurgeryId);
          expect(surgery.createdAt).toBeTruthy();
          expect(surgery.updatedAt).toBeTruthy();
        },
      ),
    );
  });

  it("reconstitute + toProps roundtrip preserva todos los campos", () => {
    fc.assert(
      fc.property(
        fc.string(), fc.string(),
        fc.constantFrom(...SurgeryTypeSchema.options),
        isoDateArb, validStringArb,
        optionalStringArb, optionalStringArb,
        fc.string(), fc.string(),
        (id, pid, type, date, hospital, complications, notes, ca, ua) => {
          const props = {
            id, patientId: pid, type, date, hospital,
            complications, notes, createdAt: ca, updatedAt: ua,
          };
          const surgery = Surgery.reconstitute(props);
          const back = surgery.toProps();
          expect(back).toEqual(props);
        },
      ),
    );
  });

  it("withUpdates solo modifica los campos especificados", () => {
    fc.assert(
      fc.property(
        fc.string(), fc.string(),
        fc.constantFrom(...SurgeryTypeSchema.options),
        isoDateArb, validStringArb,
        optionalStringArb, optionalStringArb, fc.string(), fc.string(),
        fc.constantFrom(...SurgeryTypeSchema.options),
        (id, pid, type, date, hospital, complications, notes, ca, ua, newType) => {
          const props = {
            id, patientId: pid, type, date, hospital,
            complications, notes, createdAt: ca, updatedAt: ua,
          };
          const original = Surgery.reconstitute(props);
          const updated = original.withUpdates({ type: newType });
          expect(updated.type).toBe(newType);
          expect(updated.date).toBe(original.date);
          expect(updated.hospital).toBe(original.hospital);
          expect(updated.complications).toBe(original.complications);
        },
      ),
    );
  });
});

describe("Hospitalization — property tests", () => {
  it("create con inputs válidos produce un Hospitalization", () => {
    fc.assert(
      fc.property(
        validStringArb, isoDateArb,
        fc.option(isoDateArb, { nil: null }),
        fc.integer({ min: 0, max: 365 }),
        validStringArb, optionalStringArb,
        (reason, admissionDate, dischargeDate, stayDays, hospital, notes) => {
          const h = Hospitalization.create({
            patientId: HospitalizationId.generate(),
            reason, admissionDate, dischargeDate, stayDays, hospital, notes,
          });
          expect(h.reason).toBe(reason.trim());
          expect(h.admissionDate).toBe(admissionDate);
          expect(h.dischargeDate).toBe(dischargeDate ?? null);
          expect(h.stayDays).toBe(stayDays);
          expect(h.hospital).toBe(hospital.trim());
          expect(h.notes).toBe(notes?.trim() ?? null);
          expect(h.id).toBeInstanceOf(HospitalizationId);
        },
      ),
    );
  });

  it("reconstitute + toProps roundtrip preserva todos los campos", () => {
    fc.assert(
      fc.property(
        fc.string(), fc.string(), validStringArb,
        isoDateArb, fc.option(isoDateArb, { nil: null }),
        fc.integer({ min: 0, max: 365 }), validStringArb,
        optionalStringArb, fc.string(), fc.string(),
        (id, pid, reason, ad, dd, stay, hospital, notes, ca, ua) => {
          const props = {
            id, patientId: pid, reason, admissionDate: ad,
            dischargeDate: dd, stayDays: stay, hospital, notes,
            createdAt: ca, updatedAt: ua,
          };
          const h = Hospitalization.reconstitute(props);
          const back = h.toProps();
          expect(back).toEqual(props);
        },
      ),
    );
  });
});

describe("Supplement — property tests", () => {
  it("create con inputs válidos produce un Supplement con defaults", () => {
    fc.assert(
      fc.property(
        validStringArb,
        fc.constantFrom(...SupplementCategorySchema.options),
        (name, category) => {
          const s = Supplement.create({
            patientId: SupplementId.generate(),
            name, category,
          });
          expect(s.name).toBe(name.trim());
          expect(s.category).toBe(category);
          expect(s.brand).toBe("");
          expect(s.composition).toBe("");
          expect(s.dose).toBe("");
          expect(s.frequency).toBe("");
          expect(s.prescribedBy).toBeNull();
          expect(s.startDate).toBeNull();
          expect(s.endDate).toBeNull();
          expect(s.notes).toBeNull();
          expect(s.id).toBeInstanceOf(SupplementId);
        },
      ),
    );
  });

  it("reconstitute + toProps roundtrip preserva todos los campos", () => {
    fc.assert(
      fc.property(
        fc.string(), fc.string(), validStringArb,
        fc.string({ minLength: 0, maxLength: 50 }),
        fc.constantFrom(...SupplementCategorySchema.options),
        fc.string({ minLength: 0, maxLength: 50 }),
        fc.string({ minLength: 0, maxLength: 50 }),
        fc.string({ minLength: 0, maxLength: 50 }),
        fc.option(validStringArb, { nil: null }),
        fc.option(isoDateArb, { nil: null }),
        fc.option(isoDateArb, { nil: null }),
        optionalStringArb, fc.string(), fc.string(),
        (id, pid, name, brand, category, composition, dose, freq, pb, sd, ed, notes, ca, ua) => {
          const props = {
            id, patientId: pid, name, brand, category, composition,
            dose, frequency: freq, prescribedBy: pb, startDate: sd,
            endDate: ed, notes, createdAt: ca, updatedAt: ua,
          };
          const s = Supplement.reconstitute(props);
          const back = s.toProps();
          expect(back).toEqual(props);
        },
      ),
    );
  });
});

describe("FoodFrequency — property tests", () => {
  it("create con inputs válidos produce un FoodFrequency", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 36 }),
        fc.constantFrom(...FrequencyValueSchema.options),
        optionalStringArb, optionalStringArb, optionalStringArb,
        (foodGroupId, frequency, quantity, preparation, notes) => {
          const ff = FoodFrequency.create({
            patientId: FoodFrequencyId.generate(),
            foodGroupId, frequency, quantity, preparation, notes,
          });
          expect(ff.foodGroupId).toBe(foodGroupId);
          expect(ff.frequency).toBe(frequency);
          expect(ff.quantity).toBe(quantity?.trim() ?? "");
          expect(ff.preparation).toBe(preparation?.trim() ?? null);
          expect(ff.notes).toBe(notes?.trim() ?? null);
          expect(ff.id).toBeInstanceOf(FoodFrequencyId);
        },
      ),
    );
  });

  it("reconstitute + toProps roundtrip preserva todos los campos", () => {
    fc.assert(
      fc.property(
        fc.string(), fc.string(),
        fc.string({ minLength: 1 }), fc.string({ minLength: 0, maxLength: 50 }),
        fc.constantFrom(...FrequencyValueSchema.options),
        fc.string({ minLength: 0, maxLength: 50 }),
        optionalStringArb, optionalStringArb,
        fc.string(), fc.string(),
        (id, pid, fgId, fgName, freq, qty, prep, notes, ca, ua) => {
          const props = {
            id, patientId: pid, foodGroupId: fgId, foodGroupName: fgName,
            frequency: freq, quantity: qty, preparation: prep, notes,
            createdAt: ca, updatedAt: ua,
          };
          const ff = FoodFrequency.reconstitute(props);
          const back = ff.toProps();
          expect(back).toEqual(props);
        },
      ),
    );
  });
});

describe("SnapshotExpediente — property tests", () => {
  const recordArb = fc.record({
    name: fc.string({ minLength: 1, maxLength: 50 }),
    value: fc.oneof(fc.string(), fc.integer(), fc.boolean()),
  });

  it("create con inputs válidos produce un SnapshotExpediente con hash de integridad", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 36 }),
        fc.string({ minLength: 1, maxLength: 36 }),
        fc.string({ minLength: 1, maxLength: 36 }),
        recordArb,
        async (consultaId, patientId, profesionalId, expediente) => {
          const s = await SnapshotExpediente.create({
            consultaId, patientId, profesionalId,
            contenidoJsonExpediente: expediente,
          });
          expect(s.consultaId).toBe(consultaId);
          expect(s.patientId).toBe(patientId);
          expect(s.profesionalId).toBe(profesionalId);
          expect(s.versionSmae).toBe("1.0");
          expect(s.contenidoJsonAntropometria).toBeNull();
          expect(s.contenidoJsonBioquimica).toBeNull();
          expect(s.contenidoJsonPlan).toBeNull();
          expect(s.id).toBeInstanceOf(SnapshotExpedienteId);
          expect(s.createdAt).toBeTruthy();
          expect(s.hashIntegridad).toBeTruthy();
          expect(s.hashIntegridad).toMatch(/^[a-f0-9]{64}$/);
          expect(await s.verifyIntegrity()).toBe(true);
        },
      ),
    );
  });

  it("verifyIntegrity retorna false cuando el contenido es modificado", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 36 }),
        fc.string({ minLength: 1, maxLength: 36 }),
        fc.string({ minLength: 1, maxLength: 36 }),
        recordArb,
        fc.string({ minLength: 1, maxLength: 50 }),
        async (consultaId, patientId, profesionalId, expediente, tampered) => {
          const s = await SnapshotExpediente.create({
            consultaId, patientId, profesionalId,
            contenidoJsonExpediente: expediente,
          });
          const tampered2 = SnapshotExpediente.reconstitute({
            ...s.toProps(),
            contenidoJsonExpediente: JSON.stringify({ name: tampered }),
          });
          expect(await tampered2.verifyIntegrity()).toBe(false);
        },
      ),
    );
  });

  it("reconstitute + toProps roundtrip preserva todos los campos", () => {
    fc.assert(
      fc.property(
        fc.string(), fc.string(), fc.string(), fc.string(),
        fc.string({ minLength: 2, maxLength: 200 }),
        fc.option(fc.string({ minLength: 2, maxLength: 200 }), { nil: null }),
        fc.option(fc.string({ minLength: 2, maxLength: 200 }), { nil: null }),
        fc.option(fc.string({ minLength: 2, maxLength: 200 }), { nil: null }),
        fc.string({ minLength: 8, maxLength: 64 }),
        fc.string({ minLength: 1, maxLength: 10 }),
        fc.string(), fc.string(),
        (id, cid, pid, fecha, exp, ant, bio, plan, hash, vs, prof, ca) => {
          const props = {
            id, consultaId: cid, patientId: pid, fechaSnapshot: fecha,
            contenidoJsonExpediente: exp, contenidoJsonAntropometria: ant,
            contenidoJsonBioquimica: bio, contenidoJsonPlan: plan,
            hashIntegridad: hash, versionSmae: vs, profesionalId: prof,
            createdAt: ca,
          };
          const s = SnapshotExpediente.reconstitute(props);
          const back = s.toProps();
          expect(back).toEqual(props);
        },
      ),
    );
  });
});

describe("GiSymptom — property tests", () => {
  it("create con inputs válidos produce un GiSymptom con defaults", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...GiSymptomTypeSchema.options),
        (symptomType) => {
          const s = GiSymptom.create({
            patientId: GiSymptomId.generate(),
            symptomType,
          });
          expect(s.symptomType).toBe(symptomType);
          expect(s.description).toBe("");
          expect(s.frequency).toBe("");
          expect(s.severity).toBe(5);
          expect(s.foodRelation).toBeNull();
          expect(s.onsetDate).toBeNull();
          expect(s.triggers).toBeNull();
          expect(s.notes).toBeNull();
          expect(s.id).toBeInstanceOf(GiSymptomId);
        },
      ),
    );
  });

  it("reconstitute + toProps roundtrip preserva todos los campos", () => {
    fc.assert(
      fc.property(
        fc.string(), fc.string(),
        fc.constantFrom(...GiSymptomTypeSchema.options),
        fc.string({ minLength: 0, maxLength: 100 }),
        fc.string({ minLength: 0, maxLength: 50 }),
        fc.integer({ min: 1, max: 10 }),
        optionalStringArb, fc.option(isoDateArb, { nil: null }),
        optionalStringArb, optionalStringArb,
        fc.string(), fc.string(),
        (id, pid, st, desc, freq, sev, fr, od, tr, notes, ca, ua) => {
          const props = {
            id, patientId: pid, symptomType: st, description: desc,
            frequency: freq, severity: sev, foodRelation: fr,
            onsetDate: od, triggers: tr, notes,
            createdAt: ca, updatedAt: ua,
          };
          const s = GiSymptom.reconstitute(props);
          const back = s.toProps();
          expect(back).toEqual(props);
        },
      ),
    );
  });
});
