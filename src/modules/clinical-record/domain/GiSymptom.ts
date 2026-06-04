import { z } from "zod";
import { GiSymptomId } from "./GiSymptomId";
import type { PatientId } from "@modules/patient/domain/PatientId";

export const GiSymptomTypeSchema = z.enum([
  "estrenimiento", "diarrea", "distension", "reflujo", "nausea",
  "vomito", "dolor_abdominal", "acidez", "eructos", "flatulencia",
  "saciedad_temprana", "disfagia", "otro",
]);
export type GiSymptomType = z.infer<typeof GiSymptomTypeSchema>;
export const GiSymptomTypeLabel: Record<GiSymptomType, string> = {
  estrenimiento: "Estreñimiento", diarrea: "Diarrea", distension: "Distensión",
  reflujo: "Reflujo", nausea: "Náusea", vomito: "Vómito",
  dolor_abdominal: "Dolor abdominal", acidez: "Acidez", eructos: "Eructos",
  flatulencia: "Flatulencia", saciedad_temprana: "Saciedad temprana",
  disfagia: "Disfagia", otro: "Otro",
};

export interface GiSymptomProps {
  id: string; patientId: string; symptomType: GiSymptomType;
  description: string; frequency: string; severity: number;
  foodRelation: string | null; onsetDate: string | null;
  triggers: string | null; notes: string | null;
  createdAt: string; updatedAt: string;
}
export interface GiSymptomCreate {
  patientId: PatientId; symptomType: GiSymptomType;
  description?: string; frequency?: string; severity?: number;
  foodRelation?: string | null; onsetDate?: string | null;
  triggers?: string | null; notes?: string | null;
}

export class GiSymptom {
  private constructor(private readonly props: GiSymptomProps) {}
  get id() { return GiSymptomId.fromUnsafe(this.props.id); }
  get patientId() { return this.props.patientId; }
  get symptomType() { return this.props.symptomType; }
  get description() { return this.props.description; }
  get frequency() { return this.props.frequency; }
  get severity() { return this.props.severity; }
  get foodRelation() { return this.props.foodRelation; }
  get onsetDate() { return this.props.onsetDate; }
  get triggers() { return this.props.triggers; }
  get notes() { return this.props.notes; }
  get createdAt() { return this.props.createdAt; }
  get updatedAt() { return this.props.updatedAt; }
  toProps(): GiSymptomProps { return { ...this.props }; }

  static create(input: GiSymptomCreate): GiSymptom {
    const now = new Date().toISOString();
    return new GiSymptom({
      id: GiSymptomId.generate().value, patientId: input.patientId.toString(),
      symptomType: input.symptomType,
      description: input.description?.trim() ?? "",
      frequency: input.frequency?.trim() ?? "", severity: input.severity ?? 5,
      foodRelation: input.foodRelation?.trim() ?? null,
      onsetDate: input.onsetDate?.trim() ?? null,
      triggers: input.triggers?.trim() ?? null,
      notes: input.notes?.trim() ?? null, createdAt: now, updatedAt: now,
    });
  }
  static reconstitute(props: GiSymptomProps): GiSymptom { return new GiSymptom(props); }
  withUpdates(updates: Partial<GiSymptomCreate>): GiSymptom {
    return GiSymptom.reconstitute({
      ...this.props,
      symptomType: updates.symptomType ?? this.props.symptomType,
      description: updates.description?.trim() ?? this.props.description,
      frequency: updates.frequency?.trim() ?? this.props.frequency,
      severity: updates.severity ?? this.props.severity,
      foodRelation: updates.foodRelation !== undefined ? (updates.foodRelation?.trim() ?? null) : this.props.foodRelation,
      onsetDate: updates.onsetDate !== undefined ? (updates.onsetDate?.trim() ?? null) : this.props.onsetDate,
      triggers: updates.triggers !== undefined ? (updates.triggers?.trim() ?? null) : this.props.triggers,
      notes: updates.notes !== undefined ? (updates.notes?.trim() ?? null) : this.props.notes,
      updatedAt: new Date().toISOString(),
    });
  }
}
