import { ConsultationId } from "./ConsultationId";
import type { PatientId } from "@modules/patient/domain/PatientId";
import type { AnthropometryId } from "@modules/anthropometry/domain/AnthropometryId";
import type { LabPanelId } from "@modules/laboratory/domain/LabPanelId";
import type { ConsultationStatus } from "./ConsultationStatus";

/**
 * Consulta nutricional. Snapshot inmutable de una visita.
 *
 * Estructura SOAP:
 *  - reason     (motivo de consulta)
 *  - subjective (S) — lo que el paciente reporta
 *  - objective  (O) — hallazgos: signos vitales, exploración, refs a antropometría/lab
 *  - assessment (A) — diagnóstico nutricional
 *  - plan       (P) — plan a seguir, recomendaciones, próxima cita
 *
 * Almacena además los IDs de la medición antropométrica y del panel de
 * laboratorio tomados en la misma sesión, para vincular los datos.
 */
export class Consultation {
  private constructor(
    public readonly id: ConsultationId,
    public readonly patientId: PatientId,
    public readonly consultationDate: Date,
    public readonly consultationNumber: number,
    public readonly reason: string,
    public readonly subjective: string | null,
    public readonly objective: string | null,
    public readonly assessment: string | null,
    public readonly plan: string | null,
    public readonly anthropometryId: AnthropometryId | null,
    public readonly labPanelId: LabPanelId | null,
    public readonly nextVisitDate: Date | null,
    public readonly status: ConsultationStatus,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    public readonly deletedAt: Date | null,
  ) {}

  get isCompleted(): boolean {
    return this.status === "completed";
  }

  get isActive(): boolean {
    return this.status === "scheduled" || this.status === "in-progress";
  }

  withStatus(newStatus: ConsultationStatus, now: Date = new Date()): Consultation {
    if (this.status === newStatus) return this;
    if (this.isCompleted) {
      throw new Error("Una consulta completada no puede cambiar de estado.");
    }
    if (this.deletedAt) {
      throw new Error("No se puede modificar una consulta eliminada.");
    }
    return Consultation.reconstitute({
      ...this.toProps(),
      status: newStatus,
      updatedAt: now,
    });
  }

  withNotes(updates: {
    reason?: string;
    subjective?: string | null;
    objective?: string | null;
    assessment?: string | null;
    plan?: string | null;
    anthropometryId?: AnthropometryId | null;
    labPanelId?: LabPanelId | null;
    nextVisitDate?: Date | null;
  }): Consultation {
    if (this.isCompleted) {
      throw new Error("Una consulta completada no puede modificarse.");
    }
    if (this.deletedAt) {
      throw new Error("No se puede modificar una consulta eliminada.");
    }
    return Consultation.reconstitute({
      ...this.toProps(),
      reason: updates.reason ?? this.reason,
      subjective: updates.subjective !== undefined ? updates.subjective : this.subjective,
      objective: updates.objective !== undefined ? updates.objective : this.objective,
      assessment: updates.assessment !== undefined ? updates.assessment : this.assessment,
      plan: updates.plan !== undefined ? updates.plan : this.plan,
      anthropometryId:
        updates.anthropometryId !== undefined ? updates.anthropometryId : this.anthropometryId,
      labPanelId: updates.labPanelId !== undefined ? updates.labPanelId : this.labPanelId,
      nextVisitDate: updates.nextVisitDate !== undefined ? updates.nextVisitDate : this.nextVisitDate,
      updatedAt: new Date(),
    });
  }

  softDelete(now: Date = new Date()): Consultation {
    if (this.deletedAt) return this;
    return Consultation.reconstitute({
      ...this.toProps(),
      deletedAt: now,
      updatedAt: now,
    });
  }

  toProps(): ConsultationProps {
    return {
      id: this.id,
      patientId: this.patientId,
      consultationDate: this.consultationDate,
      consultationNumber: this.consultationNumber,
      reason: this.reason,
      subjective: this.subjective,
      objective: this.objective,
      assessment: this.assessment,
      plan: this.plan,
      anthropometryId: this.anthropometryId,
      labPanelId: this.labPanelId,
      nextVisitDate: this.nextVisitDate,
      status: this.status,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      deletedAt: this.deletedAt,
    };
  }

  static create(input: ConsultationCreate): Consultation {
    Consultation.validateReason(input.reason);
    Consultation.validateDate(input.consultationDate, "consulta");
    if (input.consultationNumber < 1 || !Number.isInteger(input.consultationNumber)) {
      throw new Error("El número de consulta debe ser un entero positivo.");
    }
    if (input.nextVisitDate) {
      Consultation.validateDate(input.nextVisitDate, "próxima cita", {
        allowFuture: true,
        noFuture: true,
      });
    }
    return new Consultation(
      input.id ?? ConsultationId.generate(),
      input.patientId,
      input.consultationDate,
      input.consultationNumber,
      input.reason.trim(),
      input.subjective?.trim() ? input.subjective.trim() : null,
      input.objective?.trim() ? input.objective.trim() : null,
      input.assessment?.trim() ? input.assessment.trim() : null,
      input.plan?.trim() ? input.plan.trim() : null,
      input.anthropometryId ?? null,
      input.labPanelId ?? null,
      input.nextVisitDate ?? null,
      input.status ?? "scheduled",
      new Date(),
      new Date(),
      null,
    );
  }

  static reconstitute(props: ConsultationProps): Consultation {
    return new Consultation(
      props.id,
      props.patientId,
      props.consultationDate,
      props.consultationNumber,
      props.reason,
      props.subjective,
      props.objective,
      props.assessment,
      props.plan,
      props.anthropometryId,
      props.labPanelId,
      props.nextVisitDate,
      props.status,
      props.createdAt,
      props.updatedAt,
      props.deletedAt,
    );
  }

  private static validateReason(reason: string): void {
    const trimmed = reason.trim();
    if (trimmed.length < 3) {
      throw new Error("El motivo debe tener al menos 3 caracteres.");
    }
    if (trimmed.length > 500) {
      throw new Error("El motivo no puede exceder 500 caracteres.");
    }
  }

  private static validateDate(
    date: Date,
    field: string,
    opts: { allowFuture?: boolean; noFuture?: boolean } = {},
  ): void {
    if (Number.isNaN(date.getTime())) {
      throw new Error(`Fecha de ${field} inválida.`);
    }
    const now = Date.now();
    if (opts.noFuture && date.getTime() > now + 24 * 60 * 60 * 1000) {
      throw new Error(`La fecha de ${field} no puede estar más de 1 día en el futuro.`);
    }
    if (!opts.allowFuture && date.getTime() > now + 24 * 60 * 60 * 1000) {
      throw new Error(`La fecha de ${field} no puede estar en el futuro.`);
    }
  }
}

export interface ConsultationProps {
  id: ConsultationId;
  patientId: PatientId;
  consultationDate: Date;
  consultationNumber: number;
  reason: string;
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  plan: string | null;
  anthropometryId: AnthropometryId | null;
  labPanelId: LabPanelId | null;
  nextVisitDate: Date | null;
  status: ConsultationStatus;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface ConsultationCreate {
  id?: ConsultationId;
  patientId: PatientId;
  consultationDate: Date;
  consultationNumber: number;
  reason: string;
  subjective?: string | null;
  objective?: string | null;
  assessment?: string | null;
  plan?: string | null;
  anthropometryId?: AnthropometryId | null;
  labPanelId?: LabPanelId | null;
  nextVisitDate?: Date | null;
  status?: ConsultationStatus;
}
