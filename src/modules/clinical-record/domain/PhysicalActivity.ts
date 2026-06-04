import { z } from "zod";
import { PhysicalActivityId } from "./PhysicalActivityId";
import type { PatientId } from "@modules/patient/domain/PatientId";

export const ActivityTypeSchema = z.enum([
  "caminata", "running", "natacion", "ciclismo", "pesas", "yoga",
  "pilates", "crossfit", "futbol", "basquetbol", "tenis", "baile",
  "artes_marciales", "otro",
]);
export type ActivityType = z.infer<typeof ActivityTypeSchema>;

export const ActivityTypeLabel: Record<ActivityType, string> = {
  caminata: "Caminata", running: "Running", natacion: "Natación",
  ciclismo: "Ciclismo", pesas: "Pesas", yoga: "Yoga",
  pilates: "Pilates", crossfit: "CrossFit", futbol: "Fútbol",
  basquetbol: "Básquetbol", tenis: "Tenis", baile: "Baile",
  artes_marciales: "Artes marciales", otro: "Otro",
};

export const BorgIntensitySchema = z.enum(["light", "moderate", "vigorous", "maximal"]);
export type BorgIntensity = z.infer<typeof BorgIntensitySchema>;

export const BorgIntensityLabel: Record<BorgIntensity, string> = {
  light: "Ligera (Borg 1-3)",
  moderate: "Moderada (Borg 4-6)",
  vigorous: "Vigorosa (Borg 7-8)",
  maximal: "Máxima (Borg 9-10)",
};

export interface PhysicalActivityProps {
  id: string;
  patientId: string;
  type: ActivityType;
  frequencyPerWeek: number;
  durationMinutes: number;
  intensity: BorgIntensity;
  startDate: string | null;
  endDate: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PhysicalActivityCreate {
  patientId: PatientId;
  type: ActivityType;
  frequencyPerWeek: number;
  durationMinutes: number;
  intensity: BorgIntensity;
  startDate?: string | null;
  endDate?: string | null;
  notes?: string | null;
}

export class PhysicalActivity {
  private constructor(private readonly props: PhysicalActivityProps) {}

  get id() { return PhysicalActivityId.fromUnsafe(this.props.id); }
  get patientId() { return this.props.patientId; }
  get type() { return this.props.type; }
  get frequencyPerWeek() { return this.props.frequencyPerWeek; }
  get durationMinutes() { return this.props.durationMinutes; }
  get intensity() { return this.props.intensity; }
  get startDate() { return this.props.startDate; }
  get endDate() { return this.props.endDate; }
  get isActive(): boolean { return !this.props.endDate || new Date(this.props.endDate) > new Date(); }
  get notes() { return this.props.notes; }
  get createdAt() { return this.props.createdAt; }
  get updatedAt() { return this.props.updatedAt; }

  toProps(): PhysicalActivityProps { return { ...this.props }; }

  static create(input: PhysicalActivityCreate): PhysicalActivity {
    if (input.frequencyPerWeek < 0 || input.frequencyPerWeek > 14) {
      throw new Error("La frecuencia debe ser entre 0 y 14 días por semana");
    }
    if (input.durationMinutes < 1 || input.durationMinutes > 600) {
      throw new Error("La duración debe ser entre 1 y 600 minutos");
    }
    const now = new Date().toISOString();
    return new PhysicalActivity({
      id: PhysicalActivityId.generate().value,
      patientId: input.patientId.toString(),
      type: input.type,
      frequencyPerWeek: input.frequencyPerWeek,
      durationMinutes: input.durationMinutes,
      intensity: input.intensity,
      startDate: input.startDate ?? null,
      endDate: input.endDate ?? null,
      notes: input.notes?.trim() ?? null,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(props: PhysicalActivityProps): PhysicalActivity {
    return new PhysicalActivity(props);
  }

  withUpdates(updates: Partial<PhysicalActivityCreate>): PhysicalActivity {
    return PhysicalActivity.reconstitute({
      ...this.props,
      type: updates.type ?? this.props.type,
      frequencyPerWeek: updates.frequencyPerWeek ?? this.props.frequencyPerWeek,
      durationMinutes: updates.durationMinutes ?? this.props.durationMinutes,
      intensity: updates.intensity ?? this.props.intensity,
      startDate: updates.startDate !== undefined ? (updates.startDate ?? null) : this.props.startDate,
      endDate: updates.endDate !== undefined ? (updates.endDate ?? null) : this.props.endDate,
      notes: updates.notes !== undefined ? (updates.notes?.trim() ?? null) : this.props.notes,
      updatedAt: new Date().toISOString(),
    });
  }
}
