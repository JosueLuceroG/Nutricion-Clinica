import { z } from "zod";
import { HabitId } from "./HabitId";
import type { PatientId } from "@modules/patient/domain/PatientId";

export const HabitCategorySchema = z.enum([
  "smoking", "alcohol", "sleep", "stress", "hydration", "coffee", "ultraprocessed",
]);
export type HabitCategory = z.infer<typeof HabitCategorySchema>;

export const HabitCategoryLabel: Record<HabitCategory, string> = {
  smoking: "Tabaquismo", alcohol: "Alcohol", sleep: "Sueño",
  stress: "Estrés", hydration: "Hidratación", coffee: "Café",
  ultraprocessed: "Ultraprocesados",
};

export interface HabitProps {
  id: string;
  patientId: string;
  category: HabitCategory;
  status: string;
  frequency: string | null;
  quantity: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface HabitCreate {
  patientId: PatientId;
  category: HabitCategory;
  status: string;
  frequency?: string | null;
  quantity?: string | null;
  notes?: string | null;
}

export class Habit {
  private constructor(private readonly props: HabitProps) {}

  get id() { return HabitId.fromUnsafe(this.props.id); }
  get patientId() { return this.props.patientId; }
  get category() { return this.props.category; }
  get status() { return this.props.status; }
  get frequency() { return this.props.frequency; }
  get quantity() { return this.props.quantity; }
  get notes() { return this.props.notes; }
  get createdAt() { return this.props.createdAt; }
  get updatedAt() { return this.props.updatedAt; }

  toProps(): HabitProps { return { ...this.props }; }

  static create(input: HabitCreate): Habit {
    const now = new Date().toISOString();
    return new Habit({
      id: HabitId.generate().value,
      patientId: input.patientId.toString(),
      category: input.category,
      status: input.status.trim(),
      frequency: input.frequency?.trim() ?? null,
      quantity: input.quantity?.trim() ?? null,
      notes: input.notes?.trim() ?? null,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(props: HabitProps): Habit {
    return new Habit(props);
  }

  withUpdates(updates: Partial<HabitCreate>): Habit {
    return Habit.reconstitute({
      ...this.props,
      status: updates.status?.trim() ?? this.props.status,
      frequency: updates.frequency !== undefined ? (updates.frequency?.trim() ?? null) : this.props.frequency,
      quantity: updates.quantity !== undefined ? (updates.quantity?.trim() ?? null) : this.props.quantity,
      notes: updates.notes !== undefined ? (updates.notes?.trim() ?? null) : this.props.notes,
      updatedAt: new Date().toISOString(),
    });
  }
}
