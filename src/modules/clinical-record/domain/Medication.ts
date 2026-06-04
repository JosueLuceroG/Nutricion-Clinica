import { z } from "zod";
import { MedicationId } from "./MedicationId";
import type { PatientId } from "@modules/patient/domain/PatientId";

export const MedicationFreqSchema = z.enum([
  "cada-24h", "cada-12h", "cada-8h", "cada-6h",
  "cada-4h", "desayuno", "comida", "cena", "noches", "cuando-requiera",
]);
export type MedicationFreq = z.infer<typeof MedicationFreqSchema>;

export const MedicationFreqLabel: Record<MedicationFreq, string> = {
  "cada-24h": "Cada 24 h",
  "cada-12h": "Cada 12 h",
  "cada-8h": "Cada 8 h",
  "cada-6h": "Cada 6 h",
  "cada-4h": "Cada 4 h",
  desayuno: "Desayuno",
  comida: "Comida",
  cena: "Cena",
  noches: "Noches",
  "cuando-requiera": "Cuando requiera",
};

export interface MedicationProps {
  id: string;
  patientId: string;
  name: string;
  activeIngredient: string;
  dose: string;
  frequency: MedicationFreq;
  route: string;
  startDate: string;
  endDate: string | null;
  prescribedBy: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MedicationCreate {
  patientId: PatientId;
  name: string;
  activeIngredient: string;
  dose: string;
  frequency: MedicationFreq;
  route?: string;
  startDate: string;
  endDate?: string | null;
  prescribedBy?: string | null;
  notes?: string | null;
}

export class Medication {
  private constructor(private readonly props: MedicationProps) {}

  get id(): MedicationId {
    return MedicationId.fromUnsafe(this.props.id);
  }
  get patientId(): string {
    return this.props.patientId;
  }
  get name(): string {
    return this.props.name;
  }
  get activeIngredient(): string {
    return this.props.activeIngredient;
  }
  get dose(): string {
    return this.props.dose;
  }
  get frequency(): MedicationFreq {
    return this.props.frequency;
  }
  get route(): string {
    return this.props.route;
  }
  get startDate(): string {
    return this.props.startDate;
  }
  get endDate(): string | null {
    return this.props.endDate;
  }
  get isActive(): boolean {
    return !this.props.endDate || new Date(this.props.endDate) > new Date();
  }
  get prescribedBy(): string | null {
    return this.props.prescribedBy;
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

  toProps(): MedicationProps {
    return { ...this.props };
  }

  static create(input: MedicationCreate): Medication {
    const name = input.name.trim();
    if (name.length < 2) throw new Error("El nombre debe tener al menos 2 caracteres");
    const ingredient = input.activeIngredient.trim();
    if (ingredient.length < 2) throw new Error("El principio activo debe tener al menos 2 caracteres");
    const now = new Date().toISOString();
    return new Medication({
      id: MedicationId.generate().value,
      patientId: input.patientId.toString(),
      name,
      activeIngredient: ingredient,
      dose: input.dose.trim(),
      frequency: input.frequency,
      route: input.route?.trim() || "oral",
      startDate: input.startDate,
      endDate: input.endDate ?? null,
      prescribedBy: input.prescribedBy?.trim() ?? null,
      notes: input.notes?.trim() ?? null,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(props: MedicationProps): Medication {
    return new Medication(props);
  }

  withUpdates(updates: Partial<MedicationCreate>): Medication {
    return Medication.reconstitute({
      ...this.props,
      name: updates.name?.trim() ?? this.props.name,
      activeIngredient: updates.activeIngredient?.trim() ?? this.props.activeIngredient,
      dose: updates.dose?.trim() ?? this.props.dose,
      frequency: updates.frequency ?? this.props.frequency,
      route: updates.route?.trim() ?? this.props.route,
      startDate: updates.startDate ?? this.props.startDate,
      endDate: updates.endDate !== undefined ? (updates.endDate ?? null) : this.props.endDate,
      prescribedBy: updates.prescribedBy !== undefined ? (updates.prescribedBy?.trim() ?? null) : this.props.prescribedBy,
      notes: updates.notes !== undefined ? (updates.notes?.trim() ?? null) : this.props.notes,
      updatedAt: new Date().toISOString(),
    });
  }
}
