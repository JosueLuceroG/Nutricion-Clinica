import { z } from "zod";
import { ClinicalEventId } from "./ClinicalEventId";
import type { PatientId } from "@modules/patient/domain/PatientId";

export const EventTypeSchema = z.enum([
  "antecedente-heredofamiliar",
  "antecedente-personal-patologico",
  "cirugia",
  "hospitalizacion",
  "sintoma-gastrointestinal",
  "evento-clinico",
]);
export type EventType = z.infer<typeof EventTypeSchema>;

export const EventTypeLabel: Record<EventType, string> = {
  "antecedente-heredofamiliar": "Antecedente heredofamiliar",
  "antecedente-personal-patologico": "Antecedente personal patológico",
  cirugia: "Cirugía",
  hospitalizacion: "Hospitalización",
  "sintoma-gastrointestinal": "Síntoma gastrointestinal",
  "evento-clinico": "Evento clínico",
};

export interface ClinicalEventProps {
  id: string;
  patientId: string;
  type: EventType;
  name: string;
  description: string | null;
  date: string;
  endDate: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClinicalEventCreate {
  patientId: PatientId;
  type: EventType;
  name: string;
  description?: string | null;
  date: string;
  endDate?: string | null;
  notes?: string | null;
}

export class ClinicalEvent {
  private constructor(private readonly props: ClinicalEventProps) {}

  get id(): ClinicalEventId {
    return ClinicalEventId.fromUnsafe(this.props.id);
  }
  get patientId(): string {
    return this.props.patientId;
  }
  get type(): EventType {
    return this.props.type;
  }
  get name(): string {
    return this.props.name;
  }
  get description(): string | null {
    return this.props.description;
  }
  get date(): string {
    return this.props.date;
  }
  get endDate(): string | null {
    return this.props.endDate;
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

  toProps(): ClinicalEventProps {
    return { ...this.props };
  }

  static create(input: ClinicalEventCreate): ClinicalEvent {
    const name = input.name.trim();
    if (name.length < 2) throw new Error("El nombre debe tener al menos 2 caracteres");
    const now = new Date().toISOString();
    return new ClinicalEvent({
      id: ClinicalEventId.generate().value,
      patientId: input.patientId.toString(),
      type: input.type,
      name,
      description: input.description?.trim() ?? null,
      date: input.date,
      endDate: input.endDate ?? null,
      notes: input.notes?.trim() ?? null,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(props: ClinicalEventProps): ClinicalEvent {
    return new ClinicalEvent(props);
  }

  withUpdates(updates: Partial<ClinicalEventCreate>): ClinicalEvent {
    return ClinicalEvent.reconstitute({
      ...this.props,
      name: updates.name?.trim() ?? this.props.name,
      description: updates.description !== undefined ? (updates.description?.trim() ?? null) : this.props.description,
      date: updates.date ?? this.props.date,
      endDate: updates.endDate !== undefined ? (updates.endDate ?? null) : this.props.endDate,
      notes: updates.notes !== undefined ? (updates.notes?.trim() ?? null) : this.props.notes,
      updatedAt: new Date().toISOString(),
    });
  }
}
