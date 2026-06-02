import { LabPanelId } from "./LabPanelId";
import type { PatientId } from "@modules/patient/domain/PatientId";
import type { LabResult } from "./LabResult";
import type { LabTestCode } from "./LabTest";

/**
 * Panel de laboratorio: una toma puntual con N resultados.
 * Inmutable. Cada corrección se hace creando un panel nuevo.
 */
export class LabPanel {
  private constructor(
    public readonly id: LabPanelId,
    public readonly patientId: PatientId,
    public readonly takenAt: Date,
    public readonly labName: string | null,
    public readonly results: ReadonlyArray<LabResult>,
    public readonly notes: string | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    public readonly deletedAt: Date | null,
  ) {}

  get resultBytest(): Map<LabTestCode, LabResult> {
    return new Map(this.results.map((r) => [r.test, r]));
  }

  getValue(test: LabTestCode): number | null {
    return this.resultBytest.get(test)?.value ?? null;
  }

  hasTest(test: LabTestCode): boolean {
    return this.resultBytest.has(test);
  }

  withNotes(notes: string | null): LabPanel {
    return LabPanel.reconstitute({
      ...this.toProps(),
      notes,
      updatedAt: new Date(),
    });
  }

  softDelete(now: Date = new Date()): LabPanel {
    if (this.deletedAt) return this;
    return LabPanel.reconstitute({
      ...this.toProps(),
      deletedAt: now,
      updatedAt: now,
    });
  }

  toProps(): LabPanelProps {
    return {
      id: this.id,
      patientId: this.patientId,
      takenAt: this.takenAt,
      labName: this.labName,
      results: [...this.results],
      notes: this.notes,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      deletedAt: this.deletedAt,
    };
  }

  static create(input: LabPanelCreate): LabPanel {
    validateTakenAt(input.takenAt);
    if (input.results.length === 0) {
      throw new Error("El panel debe tener al menos un resultado.");
    }
    return new LabPanel(
      input.id ?? LabPanelId.generate(),
      input.patientId,
      input.takenAt,
      input.labName ?? null,
      input.results,
      input.notes ?? null,
      new Date(),
      new Date(),
      null,
    );
  }

  static reconstitute(props: LabPanelProps): LabPanel {
    return new LabPanel(
      props.id,
      props.patientId,
      props.takenAt,
      props.labName,
      props.results,
      props.notes,
      props.createdAt,
      props.updatedAt,
      props.deletedAt,
    );
  }
}

export interface LabPanelProps {
  id: LabPanelId;
  patientId: PatientId;
  takenAt: Date;
  labName: string | null;
  results: LabResult[];
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface LabPanelCreate {
  id?: LabPanelId;
  patientId: PatientId;
  takenAt: Date;
  labName?: string | null;
  results: LabResult[];
  notes?: string | null;
}

const validateTakenAt = (date: Date): void => {
  if (Number.isNaN(date.getTime())) {
    throw new Error("Fecha de toma inválida.");
  }
  const now = Date.now();
  if (date.getTime() > now + 24 * 60 * 60 * 1000) {
    throw new Error("La fecha de toma no puede estar más de 1 día en el futuro.");
  }
  if (date.getTime() < new Date(1900, 0, 1).getTime()) {
    throw new Error("La fecha de toma no puede ser anterior a 1900.");
  }
};
