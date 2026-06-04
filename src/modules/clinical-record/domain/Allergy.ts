import { z } from "zod";
import { AllergyId } from "./AllergyId";
import type { PatientId } from "@modules/patient/domain/PatientId";

export const SeveritySchema = z.enum(["leve", "moderada", "severa", "anafilaxia"]);
export type Severity = z.infer<typeof SeveritySchema>;

export const SeverityLabel: Record<Severity, string> = {
  leve: "Leve",
  moderada: "Moderada",
  severa: "Severa",
  anafilaxia: "Anafilaxia",
};

export const AllergyDiagnosisSchema = z.enum(["clinico", "prick", "rast", "desafio"]);
export type AllergyDiagnosis = z.infer<typeof AllergyDiagnosisSchema>;

export const AllergyDiagnosisLabel: Record<AllergyDiagnosis, string> = {
  clinico: "Clínico",
  prick: "Prick test",
  rast: "RAST",
  desafio: "Desafío oral",
};

export interface AllergyProps {
  id: string;
  patientId: string;
  allergen: string;
  reaction: string;
  severity: Severity;
  diagnosis: AllergyDiagnosis;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AllergyCreate {
  patientId: PatientId;
  allergen: string;
  reaction: string;
  severity: Severity;
  diagnosis: AllergyDiagnosis;
  notes?: string | null;
}

export class Allergy {
  private constructor(private readonly props: AllergyProps) {}

  get id(): AllergyId {
    return AllergyId.fromUnsafe(this.props.id);
  }
  get patientId(): string {
    return this.props.patientId;
  }
  get allergen(): string {
    return this.props.allergen;
  }
  get reaction(): string {
    return this.props.reaction;
  }
  get severity(): Severity {
    return this.props.severity;
  }
  get diagnosis(): AllergyDiagnosis {
    return this.props.diagnosis;
  }
  get notes(): string | null {
    return this.props.notes;
  }
  get createdAt(): string {
    return this.props.createdAt;
  }
  get updatedAt(): string {
    return this.props.updatedAt;
  }

  toProps(): AllergyProps {
    return { ...this.props };
  }

  static create(input: AllergyCreate): Allergy {
    const allergen = input.allergen.trim();
    if (allergen.length < 2) throw new Error("El alérgeno debe tener al menos 2 caracteres");
    const reaction = input.reaction.trim();
    if (reaction.length < 2) throw new Error("La reacción debe tener al menos 2 caracteres");
    const now = new Date().toISOString();
    return new Allergy({
      id: AllergyId.generate().value,
      patientId: input.patientId.toString(),
      allergen,
      reaction,
      severity: input.severity,
      diagnosis: input.diagnosis,
      notes: input.notes?.trim() ?? null,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(props: AllergyProps): Allergy {
    return new Allergy(props);
  }

  withUpdates(updates: Partial<AllergyCreate>): Allergy {
    return Allergy.reconstitute({
      ...this.props,
      allergen: updates.allergen?.trim() ?? this.props.allergen,
      reaction: updates.reaction?.trim() ?? this.props.reaction,
      severity: updates.severity ?? this.props.severity,
      diagnosis: updates.diagnosis ?? this.props.diagnosis,
      notes: updates.notes !== undefined ? (updates.notes?.trim() ?? null) : this.props.notes,
      updatedAt: new Date().toISOString(),
    });
  }
}
