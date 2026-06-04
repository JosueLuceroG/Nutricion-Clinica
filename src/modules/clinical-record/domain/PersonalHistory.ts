import { z } from "zod";
import { PersonalHistoryId } from "./PersonalHistoryId";
import type { PatientId } from "@modules/patient/domain/PatientId";

export const PersonalConditionSchema = z.enum([
  "diabetes_tipo_1", "diabetes_tipo_2", "hta", "dislipidemia", "obesidad",
  "erc", "higado_graso", "sindrome_metabolico", "tiroidea", "anemia",
  "gastrointestinal", "autoinmune", "cancer", "cardiopatia", "depresion",
  "trastorno_alimentario", "covid", "otro",
]);
export type PersonalCondition = z.infer<typeof PersonalConditionSchema>;

export const PersonalConditionLabel: Record<PersonalCondition, string> = {
  diabetes_tipo_1: "Diabetes tipo 1", diabetes_tipo_2: "Diabetes tipo 2",
  hta: "Hipertensión", dislipidemia: "Dislipidemia", obesidad: "Obesidad",
  erc: "ERC", higado_graso: "Hígado graso", sindrome_metabolico: "Síndrome metabólico",
  tiroidea: "Tiroidea", anemia: "Anemia", gastrointestinal: "Gastrointestinal",
  autoinmune: "Autoinmune", cancer: "Cáncer", cardiopatia: "Cardiopatía",
  depresion: "Depresión", trastorno_alimentario: "Trastorno alimentario",
  covid: "COVID-19", otro: "Otro",
};

export interface PersonalHistoryProps {
  id: string;
  patientId: string;
  condition: PersonalCondition;
  diagnosisDate: string | null;
  status: string;
  treatingPhysician: string | null;
  treatment: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PersonalHistoryCreate {
  patientId: PatientId;
  condition: PersonalCondition;
  diagnosisDate?: string | null;
  status?: string;
  treatingPhysician?: string | null;
  treatment?: string | null;
  notes?: string | null;
}

export class PersonalHistory {
  private constructor(private readonly props: PersonalHistoryProps) {}

  get id() { return PersonalHistoryId.fromUnsafe(this.props.id); }
  get patientId() { return this.props.patientId; }
  get condition() { return this.props.condition; }
  get diagnosisDate() { return this.props.diagnosisDate; }
  get status() { return this.props.status; }
  get treatingPhysician() { return this.props.treatingPhysician; }
  get treatment() { return this.props.treatment; }
  get notes() { return this.props.notes; }
  get createdAt() { return this.props.createdAt; }
  get updatedAt() { return this.props.updatedAt; }

  toProps(): PersonalHistoryProps { return { ...this.props }; }

  static create(input: PersonalHistoryCreate): PersonalHistory {
    const now = new Date().toISOString();
    return new PersonalHistory({
      id: PersonalHistoryId.generate().value,
      patientId: input.patientId.toString(),
      condition: input.condition,
      diagnosisDate: input.diagnosisDate ?? null,
      status: input.status ?? "activo",
      treatingPhysician: input.treatingPhysician?.trim() ?? null,
      treatment: input.treatment?.trim() ?? null,
      notes: input.notes?.trim() ?? null,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(props: PersonalHistoryProps): PersonalHistory {
    return new PersonalHistory(props);
  }

  withUpdates(updates: Partial<PersonalHistoryCreate>): PersonalHistory {
    return PersonalHistory.reconstitute({
      ...this.props,
      condition: updates.condition ?? this.props.condition,
      diagnosisDate: updates.diagnosisDate !== undefined ? (updates.diagnosisDate ?? null) : this.props.diagnosisDate,
      status: updates.status ?? this.props.status,
      treatingPhysician: updates.treatingPhysician !== undefined ? (updates.treatingPhysician?.trim() ?? null) : this.props.treatingPhysician,
      treatment: updates.treatment !== undefined ? (updates.treatment?.trim() ?? null) : this.props.treatment,
      notes: updates.notes !== undefined ? (updates.notes?.trim() ?? null) : this.props.notes,
      updatedAt: new Date().toISOString(),
    });
  }
}
