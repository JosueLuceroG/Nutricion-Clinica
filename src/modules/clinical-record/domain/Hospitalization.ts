import { HospitalizationId } from "./HospitalizationId";
import type { PatientId } from "@modules/patient/domain/PatientId";

export interface HospitalizationProps {
  id: string; patientId: string; reason: string;
  admissionDate: string; dischargeDate: string | null;
  stayDays: number; hospital: string; notes: string | null;
  createdAt: string; updatedAt: string;
}
export interface HospitalizationCreate {
  patientId: PatientId; reason: string;
  admissionDate: string; dischargeDate?: string | null;
  stayDays?: number; hospital?: string; notes?: string | null;
}

export class Hospitalization {
  private constructor(private readonly props: HospitalizationProps) {}
  get id() { return HospitalizationId.fromUnsafe(this.props.id); }
  get patientId() { return this.props.patientId; }
  get reason() { return this.props.reason; }
  get admissionDate() { return this.props.admissionDate; }
  get dischargeDate() { return this.props.dischargeDate; }
  get stayDays() { return this.props.stayDays; }
  get hospital() { return this.props.hospital; }
  get notes() { return this.props.notes; }
  get createdAt() { return this.props.createdAt; }
  get updatedAt() { return this.props.updatedAt; }
  toProps(): HospitalizationProps { return { ...this.props }; }

  static create(input: HospitalizationCreate): Hospitalization {
    const now = new Date().toISOString();
    return new Hospitalization({
      id: HospitalizationId.generate().value, patientId: input.patientId.toString(),
      reason: input.reason.trim(), admissionDate: input.admissionDate,
      dischargeDate: input.dischargeDate?.trim() ?? null,
      stayDays: input.stayDays ?? 0, hospital: input.hospital?.trim() ?? "",
      notes: input.notes?.trim() ?? null, createdAt: now, updatedAt: now,
    });
  }
  static reconstitute(props: HospitalizationProps): Hospitalization { return new Hospitalization(props); }
  withUpdates(updates: Partial<HospitalizationCreate>): Hospitalization {
    return Hospitalization.reconstitute({
      ...this.props,
      reason: updates.reason?.trim() ?? this.props.reason,
      admissionDate: updates.admissionDate ?? this.props.admissionDate,
      dischargeDate: updates.dischargeDate !== undefined ? (updates.dischargeDate?.trim() ?? null) : this.props.dischargeDate,
      stayDays: updates.stayDays ?? this.props.stayDays,
      hospital: updates.hospital?.trim() ?? this.props.hospital,
      notes: updates.notes !== undefined ? (updates.notes?.trim() ?? null) : this.props.notes,
      updatedAt: new Date().toISOString(),
    });
  }
}
