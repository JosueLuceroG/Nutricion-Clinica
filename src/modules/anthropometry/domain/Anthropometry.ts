import { AnthropometryId } from "./AnthropometryId";
import type { PatientId } from "@modules/patient/domain/PatientId";
import type { Weight, Height, Circumference, Skinfold } from "./Measurements";
import type { BiaReading } from "./BiaReading";

/**
 * Mediciones opcionales que pueden capturarse en una toma antropométrica.
 * Todas son opcionales porque la captura real varía según el paciente
 * y la etapa del tratamiento.
 */
export interface CircumferenceSet {
  neck?: Circumference;
  chest?: Circumference;
  waist?: Circumference;
  hip?: Circumference;
  arm?: Circumference;
  forearm?: Circumference;
  thigh?: Circumference;
  calf?: Circumference;
}

export interface SkinfoldSet {
  triceps?: Skinfold;
  biceps?: Skinfold;
  subscapular?: Skinfold;
  suprailiac?: Skinfold;
  abdominal?: Skinfold;
  thigh?: Skinfold;
  calf?: Skinfold;
}

export interface AnthropometryProps {
  id: AnthropometryId;
  patientId: PatientId;
  measuredAt: Date;
  weight: Weight;
  height: Height;
  circumferences: CircumferenceSet;
  skinfolds: SkinfoldSet;
  bia: BiaReading | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface AnthropometryCreate {
  id?: AnthropometryId;
  patientId: PatientId;
  measuredAt: Date;
  weight: Weight;
  height: Height;
  circumferences?: CircumferenceSet;
  skinfolds?: SkinfoldSet;
  notes?: string | null;
  bia?: BiaReading | null;
}

/**
 * Entidad de dominio: medición antropométrica inmutable.
 * Cada toma es un snapshot que nunca se modifica (regla SMAE).
 */
export class Anthropometry {
  private constructor(private readonly props: AnthropometryProps) {}

  get id(): AnthropometryId {
    return this.props.id;
  }
  get patientId(): PatientId {
    return this.props.patientId;
  }
  get measuredAt(): Date {
    return this.props.measuredAt;
  }
  get weight(): Weight {
    return this.props.weight;
  }
  get height(): Height {
    return this.props.height;
  }
  get circumferences(): CircumferenceSet {
    return this.props.circumferences;
  }
  get skinfolds(): SkinfoldSet {
    return this.props.skinfolds;
  }
  get bia(): BiaReading | null {
    return this.props.bia ?? null;
  }
  get notes(): string | null {
    return this.props.notes;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }
  get deletedAt(): Date | null {
    return this.props.deletedAt;
  }

  get bmi(): number {
    const m = this.props.height.toMeters();
    return this.props.weight.toKg() / (m * m);
  }

  get waistHipRatio(): number | null {
    const waist = this.props.circumferences.waist;
    const hip = this.props.circumferences.hip;
    if (!waist || !hip) return null;
    return waist.toCm() / hip.toCm();
  }

  get sumOfSkinfolds(): number {
    const s = this.props.skinfolds;
    return (s.triceps?.toMm() ?? 0) + (s.biceps?.toMm() ?? 0) + (s.subscapular?.toMm() ?? 0) + (s.suprailiac?.toMm() ?? 0) + (s.abdominal?.toMm() ?? 0) + (s.thigh?.toMm() ?? 0) + (s.calf?.toMm() ?? 0);
  }

  with(updates: Partial<Omit<AnthropometryCreate, "id" | "patientId">>): Anthropometry {
    return Anthropometry.reconstitute({
      ...this.props,
      ...updates,
      weight: updates.weight ?? this.props.weight,
      height: updates.height ?? this.props.height,
      circumferences: updates.circumferences ?? this.props.circumferences,
      skinfolds: updates.skinfolds ?? this.props.skinfolds,
      bia: updates.bia !== undefined ? updates.bia : this.props.bia,
      notes: updates.notes !== undefined ? updates.notes : this.props.notes,
      measuredAt: updates.measuredAt ?? this.props.measuredAt,
      updatedAt: new Date(),
    });
  }

  softDelete(now: Date = new Date()): Anthropometry {
    if (this.props.deletedAt) return this;
    return Anthropometry.reconstitute({
      ...this.props,
      deletedAt: now,
      updatedAt: now,
    });
  }

  static create(input: AnthropometryCreate): Anthropometry {
    const measuredAt = input.measuredAt ?? new Date();
    validateMeasuredAt(measuredAt);

    return new Anthropometry({
      id: input.id ?? AnthropometryId.generate(),
      patientId: input.patientId,
      measuredAt,
      weight: input.weight,
      height: input.height,
      circumferences: input.circumferences ?? {},
      skinfolds: input.skinfolds ?? {},
      bia: input.bia ?? null,
      notes: input.notes ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });
  }

  static reconstitute(props: AnthropometryProps): Anthropometry {
    return new Anthropometry(props);
  }
}

const validateMeasuredAt = (date: Date): void => {
  if (Number.isNaN(date.getTime())) {
    throw new Error("Fecha de medición inválida.");
  }
  const now = Date.now();
  if (date.getTime() > now + 24 * 60 * 60 * 1000) {
    throw new Error("La fecha de medición no puede estar más de 1 día en el futuro.");
  }
  const min = new Date(1900, 0, 1).getTime();
  if (date.getTime() < min) {
    throw new Error("La fecha de medición no puede ser anterior a 1900.");
  }
};
