import { z } from "zod";
import { SurgeryId } from "./SurgeryId";
import type { PatientId } from "@modules/patient/domain/PatientId";

export const SurgeryTypeSchema = z.enum(["laparoscopica", "abierta", "endoscopica", "bariatrica", "cesarea", "apendicectomia", "colecistectomia", "hernioplastia", "otro"]);
export type SurgeryType = z.infer<typeof SurgeryTypeSchema>;
export const SurgeryTypeLabel: Record<SurgeryType, string> = {
  laparoscopica: "Laparoscópica", abierta: "Abierta", endoscopica: "Endoscópica",
  bariatrica: "Bariátrica", cesarea: "Cesárea", apendicectomia: "Apendicectomía",
  colecistectomia: "Colecistectomía", hernioplastia: "Hernioplastia", otro: "Otra",
};

export interface SurgeryProps {
  id: string; patientId: string; type: SurgeryType; date: string;
  hospital: string; complications: string | null;
  notes: string | null; createdAt: string; updatedAt: string;
}
export interface SurgeryCreate {
  patientId: PatientId; type: SurgeryType; date: string;
  hospital?: string; complications?: string | null; notes?: string | null;
}

export class Surgery {
  private constructor(private readonly props: SurgeryProps) {}
  get id() { return SurgeryId.fromUnsafe(this.props.id); }
  get patientId() { return this.props.patientId; }
  get type() { return this.props.type; }
  get date() { return this.props.date; }
  get hospital() { return this.props.hospital; }
  get complications() { return this.props.complications; }
  get notes() { return this.props.notes; }
  get createdAt() { return this.props.createdAt; }
  get updatedAt() { return this.props.updatedAt; }
  toProps(): SurgeryProps { return { ...this.props }; }

  static create(input: SurgeryCreate): Surgery {
    const now = new Date().toISOString();
    return new Surgery({
      id: SurgeryId.generate().value, patientId: input.patientId.toString(),
      type: input.type, date: input.date,
      hospital: input.hospital?.trim() ?? "", complications: input.complications?.trim() ?? null,
      notes: input.notes?.trim() ?? null, createdAt: now, updatedAt: now,
    });
  }
  static reconstitute(props: SurgeryProps): Surgery { return new Surgery(props); }
  withUpdates(updates: Partial<SurgeryCreate>): Surgery {
    return Surgery.reconstitute({ ...this.props, type: updates.type ?? this.props.type, date: updates.date ?? this.props.date, hospital: updates.hospital?.trim() ?? this.props.hospital, complications: updates.complications !== undefined ? (updates.complications?.trim() ?? null) : this.props.complications, notes: updates.notes !== undefined ? (updates.notes?.trim() ?? null) : this.props.notes, updatedAt: new Date().toISOString() });
  }
}
