import { z } from "zod";
import { IntoleranceId } from "./IntoleranceId";
import type { PatientId } from "@modules/patient/domain/PatientId";

export const MechanismSchema = z.enum(["lactosa", "fructosa", "sorbitol", "histamina", "gluten", "otro"]);
export type Mechanism = z.infer<typeof MechanismSchema>;

export const MechanismLabel: Record<Mechanism, string> = {
  lactosa: "Lactosa", fructosa: "Fructosa", sorbitol: "Sorbitol",
  histamina: "Histamina", gluten: "Gluten", otro: "Otro",
};

export const IntoleranceSeveritySchema = z.enum(["leve", "moderada", "severa"]);
export type IntoleranceSeverity = z.infer<typeof IntoleranceSeveritySchema>;

export const IntoleranceSeverityLabel: Record<IntoleranceSeverity, string> = {
  leve: "Leve", moderada: "Moderada", severa: "Severa",
};

export interface IntoleranceProps {
  id: string;
  patientId: string;
  food: string;
  symptom: string;
  severity: IntoleranceSeverity;
  thresholdDose: string | null;
  mechanism: Mechanism;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IntoleranceCreate {
  patientId: PatientId;
  food: string;
  symptom: string;
  severity: IntoleranceSeverity;
  thresholdDose?: string | null;
  mechanism: Mechanism;
  notes?: string | null;
}

export class Intolerance {
  private constructor(private readonly props: IntoleranceProps) {}

  get id() { return IntoleranceId.fromUnsafe(this.props.id); }
  get patientId() { return this.props.patientId; }
  get food() { return this.props.food; }
  get symptom() { return this.props.symptom; }
  get severity() { return this.props.severity; }
  get thresholdDose() { return this.props.thresholdDose; }
  get mechanism() { return this.props.mechanism; }
  get notes() { return this.props.notes; }
  get createdAt() { return this.props.createdAt; }
  get updatedAt() { return this.props.updatedAt; }

  toProps(): IntoleranceProps { return { ...this.props }; }

  static create(input: IntoleranceCreate): Intolerance {
    const food = input.food.trim();
    if (food.length < 2) throw new Error("El alimento debe tener al menos 2 caracteres");
    const symptom = input.symptom.trim();
    if (symptom.length < 2) throw new Error("El síntoma debe tener al menos 2 caracteres");
    const now = new Date().toISOString();
    return new Intolerance({
      id: IntoleranceId.generate().value,
      patientId: input.patientId.toString(),
      food,
      symptom,
      severity: input.severity,
      thresholdDose: input.thresholdDose?.trim() ?? null,
      mechanism: input.mechanism,
      notes: input.notes?.trim() ?? null,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(props: IntoleranceProps): Intolerance {
    return new Intolerance(props);
  }

  withUpdates(updates: Partial<IntoleranceCreate>): Intolerance {
    return Intolerance.reconstitute({
      ...this.props,
      food: updates.food?.trim() ?? this.props.food,
      symptom: updates.symptom?.trim() ?? this.props.symptom,
      severity: updates.severity ?? this.props.severity,
      thresholdDose: updates.thresholdDose !== undefined ? (updates.thresholdDose?.trim() ?? null) : this.props.thresholdDose,
      mechanism: updates.mechanism ?? this.props.mechanism,
      notes: updates.notes !== undefined ? (updates.notes?.trim() ?? null) : this.props.notes,
      updatedAt: new Date().toISOString(),
    });
  }
}
