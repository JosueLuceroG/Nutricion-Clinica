import { z } from "zod";
import { FoodFrequencyId } from "./FoodFrequencyId";
import type { PatientId } from "@modules/patient/domain/PatientId";

export const FrequencyValueSchema = z.enum(["diario", "3-5_sem", "1-2_sem", "1-3_mes", "ocasional", "nunca"]);
export type FrequencyValue = z.infer<typeof FrequencyValueSchema>;
export const FrequencyValueLabel: Record<FrequencyValue, string> = {
  diario: "Diario", "3-5_sem": "3-5 / semana", "1-2_sem": "1-2 / semana",
  "1-3_mes": "1-3 / mes", ocasional: "Ocasional", nunca: "Nunca",
};

export interface FoodFrequencyProps {
  id: string; patientId: string; foodGroupId: string;
  foodGroupName: string; frequency: FrequencyValue;
  quantity: string; preparation: string | null; notes: string | null;
  createdAt: string; updatedAt: string;
}
export interface FoodFrequencyCreate {
  patientId: PatientId; foodGroupId: string; foodGroupName?: string;
  frequency: FrequencyValue; quantity?: string | null; preparation?: string | null;
  notes?: string | null;
}

export class FoodFrequency {
  private constructor(private readonly props: FoodFrequencyProps) {}
  get id() { return FoodFrequencyId.fromUnsafe(this.props.id); }
  get patientId() { return this.props.patientId; }
  get foodGroupId() { return this.props.foodGroupId; }
  get foodGroupName() { return this.props.foodGroupName; }
  get frequency() { return this.props.frequency; }
  get quantity() { return this.props.quantity; }
  get preparation() { return this.props.preparation; }
  get notes() { return this.props.notes; }
  get createdAt() { return this.props.createdAt; }
  get updatedAt() { return this.props.updatedAt; }
  toProps(): FoodFrequencyProps { return { ...this.props }; }

  static create(input: FoodFrequencyCreate): FoodFrequency {
    const now = new Date().toISOString();
    return new FoodFrequency({
      id: FoodFrequencyId.generate().value, patientId: input.patientId.toString(),
      foodGroupId: input.foodGroupId, foodGroupName: input.foodGroupName?.trim() ?? "",
      frequency: input.frequency, quantity: input.quantity?.trim() ?? "",
      preparation: input.preparation?.trim() ?? null, notes: input.notes?.trim() ?? null,
      createdAt: now, updatedAt: now,
    });
  }
  static reconstitute(props: FoodFrequencyProps): FoodFrequency { return new FoodFrequency(props); }
  withUpdates(updates: Partial<FoodFrequencyCreate>): FoodFrequency {
    return FoodFrequency.reconstitute({
      ...this.props,
      foodGroupId: updates.foodGroupId ?? this.props.foodGroupId,
      foodGroupName: updates.foodGroupName?.trim() ?? this.props.foodGroupName,
      frequency: updates.frequency ?? this.props.frequency,
      quantity: updates.quantity?.trim() ?? this.props.quantity,
      preparation: updates.preparation !== undefined ? (updates.preparation?.trim() ?? null) : this.props.preparation,
      notes: updates.notes !== undefined ? (updates.notes?.trim() ?? null) : this.props.notes,
      updatedAt: new Date().toISOString(),
    });
  }
}
