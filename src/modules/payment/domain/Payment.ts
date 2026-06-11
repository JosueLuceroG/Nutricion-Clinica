import { PaymentId } from "./PaymentId";
import type { PaymentStatus } from "@modules/consultation/domain/PaymentStatus";
import type { PaymentConcept } from "@modules/consultation/domain/PaymentConcept";
import type { PaymentMethod } from "@modules/consultation/domain/PaymentMethod";

export class Payment {
  private constructor(
    public readonly id: PaymentId,
    public readonly pacienteId: string,
    public readonly consultationId: string | null,
    public readonly appointmentId: string | null,
    public readonly mealPlanId: string | null,
    public readonly concept: PaymentConcept,
    public readonly amount: number,
    public readonly currency: string,
    public readonly method: PaymentMethod | null,
    public readonly status: PaymentStatus,
    public readonly paidAt: Date | null,
    public readonly reference: string | null,
    public readonly invoiceNumber: string | null,
    public readonly invoiceXml: string | null,
    public readonly notes: string | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    public readonly deletedAt: Date | null,
  ) {}

  static create(input: PaymentCreate): Payment {
    if (input.amount < 0 || !Number.isFinite(input.amount)) {
      throw new Error("El monto debe ser un número >= 0.");
    }
    const now = new Date();
    return new Payment(
      input.id ?? PaymentId.generate(),
      input.pacienteId,
      input.consultationId ?? null,
      input.appointmentId ?? null,
      input.mealPlanId ?? null,
      input.concept ?? "consulta",
      input.amount,
      input.currency ?? "MXN",
      input.method ?? null,
      input.status ?? "pending",
      input.paidAt ?? null,
      input.reference?.trim()?.slice(0, 120) ?? null,
      input.invoiceNumber?.trim()?.slice(0, 40) ?? null,
      null,
      input.notes?.trim()?.slice(0, 500) ?? null,
      now,
      now,
      null,
    );
  }

  static reconstitute(props: PaymentProps): Payment {
    return new Payment(
      props.id,
      props.pacienteId,
      props.consultationId,
      props.appointmentId,
      props.mealPlanId,
      props.concept,
      props.amount,
      props.currency,
      props.method,
      props.status,
      props.paidAt,
      props.reference,
      props.invoiceNumber,
      props.invoiceXml,
      props.notes,
      props.createdAt,
      props.updatedAt,
      props.deletedAt,
    );
  }

  withStatus(newStatus: PaymentStatus, now: Date = new Date()): Payment {
    if (this.deletedAt) {
      throw new Error("No se puede modificar un pago eliminado.");
    }
    return Payment.reconstitute({
      ...this.toProps(),
      status: newStatus,
      updatedAt: now,
    });
  }

  withDetails(input: {
    method?: PaymentMethod;
    paidAt?: Date;
    reference?: string;
    invoiceNumber?: string;
    notes?: string;
  }): Payment {
    if (this.deletedAt) {
      throw new Error("No se puede modificar un pago eliminado.");
    }
    return Payment.reconstitute({
      ...this.toProps(),
      method: input.method ?? this.method,
      paidAt: input.paidAt ?? this.paidAt,
      reference: input.reference?.trim()?.slice(0, 120) ?? this.reference,
      invoiceNumber: input.invoiceNumber?.trim()?.slice(0, 40) ?? this.invoiceNumber,
      notes: input.notes?.trim()?.slice(0, 500) ?? this.notes,
      updatedAt: new Date(),
    });
  }

  softDelete(now: Date = new Date()): Payment {
    if (this.deletedAt) return this;
    return Payment.reconstitute({
      ...this.toProps(),
      deletedAt: now,
      updatedAt: now,
    });
  }

  toProps(): PaymentProps {
    return {
      id: this.id,
      pacienteId: this.pacienteId,
      consultationId: this.consultationId,
      appointmentId: this.appointmentId,
      mealPlanId: this.mealPlanId,
      concept: this.concept,
      amount: this.amount,
      currency: this.currency,
      method: this.method,
      status: this.status,
      paidAt: this.paidAt,
      reference: this.reference,
      invoiceNumber: this.invoiceNumber,
      invoiceXml: this.invoiceXml,
      notes: this.notes,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      deletedAt: this.deletedAt,
    };
  }
}

export interface PaymentProps {
  id: PaymentId;
  pacienteId: string;
  consultationId: string | null;
  appointmentId: string | null;
  mealPlanId: string | null;
  concept: PaymentConcept;
  amount: number;
  currency: string;
  method: PaymentMethod | null;
  status: PaymentStatus;
  paidAt: Date | null;
  reference: string | null;
  invoiceNumber: string | null;
  invoiceXml: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface PaymentCreate {
  id?: PaymentId;
  pacienteId: string;
  consultationId?: string | null;
  appointmentId?: string | null;
  mealPlanId?: string | null;
  concept?: PaymentConcept;
  amount: number;
  currency?: string;
  method?: PaymentMethod | null;
  status?: PaymentStatus;
  paidAt?: Date | null;
  reference?: string | null;
  invoiceNumber?: string | null;
  notes?: string | null;
}
