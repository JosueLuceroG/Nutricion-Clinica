import { z } from "zod";
import { DietHistoryId } from "./DietHistoryId";
import type { PatientId } from "@modules/patient/domain/PatientId";

export const DietTypeSchema = z.enum([
  "omnivoro", "vegetariano", "vegano", "pescetariano", "keto",
  "paleo", "mediterraneo", "dash", "ayuno_intermitente", "otro",
]);
export type DietType = z.infer<typeof DietTypeSchema>;

export const DietTypeLabel: Record<DietType, string> = {
  omnivoro: "Omnívoro", vegetariano: "Vegetariano", vegano: "Vegano",
  pescetariano: "Pescetariano", keto: "Keto", paleo: "Paleo",
  mediterraneo: "Mediterránea", dash: "DASH",
  ayuno_intermitente: "Ayuno intermitente", otro: "Otro",
};

export const MealPlaceSchema = z.enum(["hogar", "trabajo", "escuela", "restaurante", "calle", "otro"]);
export type MealPlace = z.infer<typeof MealPlaceSchema>;

export const MealPlaceLabel: Record<MealPlace, string> = {
  hogar: "Hogar", trabajo: "Trabajo", escuela: "Escuela",
  restaurante: "Restaurante", calle: "Calle/vía pública", otro: "Otro",
};

export interface DietHistoryProps {
  id: string;
  patientId: string;
  dietType: DietType;
  mealsPerDay: number;
  mealSchedule: string;
  mealPlace: MealPlace;
  mealPreparer: string;
  timeAvailable: string;
  budget: string;
  kitchenEquipment: string;
  previousDiets: string;
  labelReading: boolean;
  nutritionalKnowledge: string;
  preferences: string;
  aversions: string;
  chewing: string;
  workSchedule: string;
  householdPeople: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DietHistoryCreate {
  patientId: PatientId;
  dietType: DietType;
  mealsPerDay: number;
  mealSchedule?: string;
  mealPlace?: MealPlace;
  mealPreparer?: string;
  timeAvailable?: string;
  budget?: string;
  kitchenEquipment?: string;
  previousDiets?: string;
  labelReading?: boolean;
  nutritionalKnowledge?: string;
  preferences?: string;
  aversions?: string;
  chewing?: string;
  workSchedule?: string;
  householdPeople?: number;
  notes?: string | null;
}

export class DietHistory {
  private constructor(private readonly props: DietHistoryProps) {}

  get id() { return DietHistoryId.fromUnsafe(this.props.id); }
  get patientId() { return this.props.patientId; }
  get dietType() { return this.props.dietType; }
  get mealsPerDay() { return this.props.mealsPerDay; }
  get mealSchedule() { return this.props.mealSchedule; }
  get mealPlace() { return this.props.mealPlace; }
  get mealPreparer() { return this.props.mealPreparer; }
  get timeAvailable() { return this.props.timeAvailable; }
  get budget() { return this.props.budget; }
  get kitchenEquipment() { return this.props.kitchenEquipment; }
  get previousDiets() { return this.props.previousDiets; }
  get labelReading() { return this.props.labelReading; }
  get nutritionalKnowledge() { return this.props.nutritionalKnowledge; }
  get preferences() { return this.props.preferences; }
  get aversions() { return this.props.aversions; }
  get chewing() { return this.props.chewing; }
  get workSchedule() { return this.props.workSchedule; }
  get householdPeople() { return this.props.householdPeople; }
  get notes() { return this.props.notes; }
  get createdAt() { return this.props.createdAt; }
  get updatedAt() { return this.props.updatedAt; }

  toProps(): DietHistoryProps { return { ...this.props }; }

  static create(input: DietHistoryCreate): DietHistory {
    if (input.mealsPerDay < 1 || input.mealsPerDay > 20) {
      throw new Error("El número de comidas debe ser entre 1 y 20");
    }
    if (input.householdPeople !== undefined && (input.householdPeople < 1 || input.householdPeople > 50)) {
      throw new Error("El número de personas debe ser entre 1 y 50");
    }
    const now = new Date().toISOString();
    return new DietHistory({
      id: DietHistoryId.generate().value,
      patientId: input.patientId.toString(),
      dietType: input.dietType,
      mealsPerDay: input.mealsPerDay,
      mealSchedule: input.mealSchedule?.trim() ?? "",
      mealPlace: input.mealPlace ?? "hogar",
      mealPreparer: input.mealPreparer?.trim() ?? "",
      timeAvailable: input.timeAvailable?.trim() ?? "",
      budget: input.budget?.trim() ?? "",
      kitchenEquipment: input.kitchenEquipment?.trim() ?? "",
      previousDiets: input.previousDiets?.trim() ?? "",
      labelReading: input.labelReading ?? false,
      nutritionalKnowledge: input.nutritionalKnowledge?.trim() ?? "",
      preferences: input.preferences?.trim() ?? "",
      aversions: input.aversions?.trim() ?? "",
      chewing: input.chewing?.trim() ?? "",
      workSchedule: input.workSchedule?.trim() ?? "",
      householdPeople: input.householdPeople ?? 1,
      notes: input.notes?.trim() ?? null,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(props: DietHistoryProps): DietHistory {
    return new DietHistory(props);
  }

  withUpdates(updates: Partial<DietHistoryCreate>): DietHistory {
    return DietHistory.reconstitute({
      ...this.props,
      dietType: updates.dietType ?? this.props.dietType,
      mealsPerDay: updates.mealsPerDay ?? this.props.mealsPerDay,
      mealSchedule: updates.mealSchedule?.trim() ?? this.props.mealSchedule,
      mealPlace: updates.mealPlace ?? this.props.mealPlace,
      mealPreparer: updates.mealPreparer?.trim() ?? this.props.mealPreparer,
      timeAvailable: updates.timeAvailable?.trim() ?? this.props.timeAvailable,
      budget: updates.budget?.trim() ?? this.props.budget,
      kitchenEquipment: updates.kitchenEquipment?.trim() ?? this.props.kitchenEquipment,
      previousDiets: updates.previousDiets?.trim() ?? this.props.previousDiets,
      labelReading: updates.labelReading ?? this.props.labelReading,
      nutritionalKnowledge: updates.nutritionalKnowledge?.trim() ?? this.props.nutritionalKnowledge,
      preferences: updates.preferences?.trim() ?? this.props.preferences,
      aversions: updates.aversions?.trim() ?? this.props.aversions,
      chewing: updates.chewing?.trim() ?? this.props.chewing,
      workSchedule: updates.workSchedule?.trim() ?? this.props.workSchedule,
      householdPeople: updates.householdPeople ?? this.props.householdPeople,
      notes: updates.notes !== undefined ? (updates.notes?.trim() ?? null) : this.props.notes,
      updatedAt: new Date().toISOString(),
    });
  }
}
