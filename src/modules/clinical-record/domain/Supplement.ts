import { z } from "zod";
import { SupplementId } from "./SupplementId";
import type { PatientId } from "@modules/patient/domain/PatientId";

export const SupplementCategorySchema = z.enum([
  "multivitaminico", "vitamina_d", "hierro", "calcio", "omega_3",
  "proteina", "creatina", "probiotico", "herbolario", "homeopatico", "otro",
]);
export type SupplementCategory = z.infer<typeof SupplementCategorySchema>;
export const SupplementCategoryLabel: Record<SupplementCategory, string> = {
  multivitaminico: "Multivitamínico", vitamina_d: "Vitamina D", hierro: "Hierro",
  calcio: "Calcio", omega_3: "Omega 3", proteina: "Proteína",
  creatina: "Creatina", probiotico: "Probiótico", herbolario: "Herbolario",
  homeopatico: "Homeopático", otro: "Otro",
};

export interface SupplementProps {
  id: string; patientId: string; name: string; brand: string;
  category: SupplementCategory; composition: string; dose: string;
  frequency: string; prescribedBy: string | null; startDate: string | null;
  endDate: string | null; notes: string | null; createdAt: string; updatedAt: string;
}
export interface SupplementCreate {
  patientId: PatientId; name: string; brand?: string;
  category?: SupplementCategory; composition?: string; dose?: string;
  frequency?: string; prescribedBy?: string | null; startDate?: string | null;
  endDate?: string | null; notes?: string | null;
}

export class Supplement {
  private constructor(private readonly props: SupplementProps) {}
  get id() { return SupplementId.fromUnsafe(this.props.id); }
  get patientId() { return this.props.patientId; }
  get name() { return this.props.name; }
  get brand() { return this.props.brand; }
  get category() { return this.props.category; }
  get composition() { return this.props.composition; }
  get dose() { return this.props.dose; }
  get frequency() { return this.props.frequency; }
  get prescribedBy() { return this.props.prescribedBy; }
  get startDate() { return this.props.startDate; }
  get endDate() { return this.props.endDate; }
  get notes() { return this.props.notes; }
  get createdAt() { return this.props.createdAt; }
  get updatedAt() { return this.props.updatedAt; }
  toProps(): SupplementProps { return { ...this.props }; }

  static create(input: SupplementCreate): Supplement {
    const now = new Date().toISOString();
    return new Supplement({
      id: SupplementId.generate().value, patientId: input.patientId.toString(),
      name: input.name.trim(), brand: input.brand?.trim() ?? "",
      category: input.category ?? "otro", composition: input.composition?.trim() ?? "",
      dose: input.dose?.trim() ?? "", frequency: input.frequency?.trim() ?? "",
      prescribedBy: input.prescribedBy?.trim() ?? null,
      startDate: input.startDate?.trim() ?? null, endDate: input.endDate?.trim() ?? null,
      notes: input.notes?.trim() ?? null, createdAt: now, updatedAt: now,
    });
  }
  static reconstitute(props: SupplementProps): Supplement { return new Supplement(props); }
  withUpdates(updates: Partial<SupplementCreate>): Supplement {
    return Supplement.reconstitute({
      ...this.props,       name: updates.name?.trim() ?? this.props.name,
      brand: updates.brand?.trim() ?? this.props.brand,
      category: updates.category ?? this.props.category,
      composition: updates.composition?.trim() ?? this.props.composition,
      dose: updates.dose?.trim() ?? this.props.dose,
      frequency: updates.frequency?.trim() ?? this.props.frequency,
      prescribedBy: updates.prescribedBy !== undefined ? (updates.prescribedBy?.trim() ?? null) : this.props.prescribedBy,
      startDate: updates.startDate !== undefined ? (updates.startDate?.trim() ?? null) : this.props.startDate,
      endDate: updates.endDate !== undefined ? (updates.endDate?.trim() ?? null) : this.props.endDate,
      notes: updates.notes !== undefined ? (updates.notes?.trim() ?? null) : this.props.notes,
      updatedAt: new Date().toISOString(),
    });
  }
}
