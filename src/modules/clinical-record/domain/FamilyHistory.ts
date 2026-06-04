import { z } from "zod";
import { FamilyHistoryId } from "./FamilyHistoryId";
import type { PatientId } from "@modules/patient/domain/PatientId";

export const FamilyRelationshipSchema = z.enum([
  "padre", "madre", "hermano", "hermana", "abuelo_paterno", "abuela_paterna",
  "abuelo_materno", "abuela_materna", "tio", "tia", "hijo", "hija", "otro",
]);
export type FamilyRelationship = z.infer<typeof FamilyRelationshipSchema>;

export const FamilyRelationshipLabel: Record<FamilyRelationship, string> = {
  padre: "Padre", madre: "Madre", hermano: "Hermano", hermana: "Hermana",
  abuelo_paterno: "Abuelo paterno", abuela_paterna: "Abuela paterna",
  abuelo_materno: "Abuelo materno", abuela_materna: "Abuela materna",
  tio: "Tío", tia: "Tía", hijo: "Hijo", hija: "Hija", otro: "Otro",
};

export const ConditionSchema = z.enum([
  "diabetes", "hta", "obesidad", "cancer", "ecv", "erc", "tiroidea",
  "autoinmune", "osteoporosis", "dislipidemia", "otro",
]);
export type Condition = z.infer<typeof ConditionSchema>;

export const ConditionLabel: Record<Condition, string> = {
  diabetes: "Diabetes", hta: "Hipertensión", obesidad: "Obesidad",
  cancer: "Cáncer", ecv: "Enfermedad cardiovascular", erc: "ERC",
  tiroidea: "Tiroidea", autoinmune: "Autoinmune", osteoporosis: "Osteoporosis",
  dislipidemia: "Dislipidemia", otro: "Otro",
};

export interface FamilyHistoryProps {
  id: string;
  patientId: string;
  relationship: FamilyRelationship;
  condition: Condition;
  diagnosisAge: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FamilyHistoryCreate {
  patientId: PatientId;
  relationship: FamilyRelationship;
  condition: Condition;
  diagnosisAge?: number | null;
  notes?: string | null;
}

export class FamilyHistory {
  private constructor(private readonly props: FamilyHistoryProps) {}

  get id() { return FamilyHistoryId.fromUnsafe(this.props.id); }
  get patientId() { return this.props.patientId; }
  get relationship() { return this.props.relationship; }
  get condition() { return this.props.condition; }
  get diagnosisAge() { return this.props.diagnosisAge; }
  get notes() { return this.props.notes; }
  get createdAt() { return this.props.createdAt; }
  get updatedAt() { return this.props.updatedAt; }

  toProps(): FamilyHistoryProps { return { ...this.props }; }

  static create(input: FamilyHistoryCreate): FamilyHistory {
    const now = new Date().toISOString();
    return new FamilyHistory({
      id: FamilyHistoryId.generate().value,
      patientId: input.patientId.toString(),
      relationship: input.relationship,
      condition: input.condition,
      diagnosisAge: input.diagnosisAge ?? null,
      notes: input.notes?.trim() ?? null,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(props: FamilyHistoryProps): FamilyHistory {
    return new FamilyHistory(props);
  }

  withUpdates(updates: Partial<FamilyHistoryCreate>): FamilyHistory {
    return FamilyHistory.reconstitute({
      ...this.props,
      relationship: updates.relationship ?? this.props.relationship,
      condition: updates.condition ?? this.props.condition,
      diagnosisAge: updates.diagnosisAge !== undefined ? (updates.diagnosisAge ?? null) : this.props.diagnosisAge,
      notes: updates.notes !== undefined ? (updates.notes?.trim() ?? null) : this.props.notes,
      updatedAt: new Date().toISOString(),
    });
  }
}
