import { z } from "zod";
import { AppointmentIdSchema, type AppointmentId } from "./AppointmentId";
import { AppointmentStatusSchema, type AppointmentStatus } from "./AppointmentStatus";
import { AppointmentTypeSchema, type AppointmentType, DefaultDurationMin } from "./AppointmentType";

export const AppointmentSchema = z.object({
  id: AppointmentIdSchema,
  patientId: z.string().uuid(),
  professionalId: z.string().uuid(),
  officeId: z.string().uuid().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato YYYY-MM-DD"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Formato HH:MM"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Formato HH:MM"),
  durationMin: z.number().int().positive(),
  type: AppointmentTypeSchema,
  status: AppointmentStatusSchema,
  reason: z.string().max(500).default(""),
  notes: z.string().max(2000).default(""),
  consultationId: z.string().uuid().optional(),
  reminderSent: z.boolean().default(false),
  confirmedAt: z.string().datetime().optional(),
  cancelledReason: z.string().max(500).default(""),
  rescheduledFromId: z.string().uuid().optional(),
  cost: z.number().min(0).default(0),
  paid: z.boolean().default(false),
  paymentMethod: z.string().max(50).default(""),
  createdAt: z.number().int().positive(),
  updatedAt: z.number().int().positive(),
});

export type AppointmentProps = z.infer<typeof AppointmentSchema>;

export class Appointment {
  private constructor(private readonly props: AppointmentProps) {}

  get id(): AppointmentId { return this.props.id as AppointmentId; }
  get patientId(): string { return this.props.patientId; }
  get professionalId(): string { return this.props.professionalId; }
  get officeId(): string | undefined { return this.props.officeId; }
  get date(): string { return this.props.date; }
  get startTime(): string { return this.props.startTime; }
  get endTime(): string { return this.props.endTime; }
  get durationMin(): number { return this.props.durationMin; }
  get type(): AppointmentType { return this.props.type; }
  get status(): AppointmentStatus { return this.props.status; }
  get reason(): string { return this.props.reason; }
  get notes(): string { return this.props.notes; }
  get consultationId(): string | undefined { return this.props.consultationId; }
  get reminderSent(): boolean { return this.props.reminderSent; }
  get confirmedAt(): string | undefined { return this.props.confirmedAt; }
  get cancelledReason(): string { return this.props.cancelledReason; }
  get rescheduledFromId(): string | undefined { return this.props.rescheduledFromId; }
  get cost(): number { return this.props.cost; }
  get paid(): boolean { return this.props.paid; }
  get paymentMethod(): string { return this.props.paymentMethod; }
  get createdAt(): number { return this.props.createdAt; }
  get updatedAt(): number { return this.props.updatedAt; }

  toProps(): AppointmentProps {
    return { ...this.props };
  }

  static create(props: Omit<AppointmentProps, "createdAt" | "updatedAt" | "status" | "reminderSent" | "paid" | "paymentMethod" | "cost" | "cancelledReason"> & { status?: AppointmentStatus; cost?: number }): Appointment {
    const now = Date.now();
    const duration = props.durationMin || DefaultDurationMin[props.type] || 30;
    if (props.startTime >= props.endTime) {
      throw new Error("La hora de inicio debe ser anterior a la hora de fin.");
    }
    return new Appointment({
      id: props.id,
      patientId: props.patientId,
      professionalId: props.professionalId,
      officeId: props.officeId,
      date: props.date,
      startTime: props.startTime,
      endTime: props.endTime,
      durationMin: duration,
      type: props.type,
      status: props.status ?? "scheduled",
      reason: props.reason ?? "",
      notes: props.notes ?? "",
      consultationId: props.consultationId,
      reminderSent: false,
      confirmedAt: undefined,
      cancelledReason: "",
      rescheduledFromId: props.rescheduledFromId,
      cost: props.cost ?? 0,
      paid: false,
      paymentMethod: "",
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(props: AppointmentProps): Appointment {
    return new Appointment(props);
  }

  with(updates: Partial<AppointmentProps>): Appointment {
    return Appointment.reconstitute({
      ...this.props,
      ...updates,
      updatedAt: Date.now(),
    });
  }

  cancel(reason: string): Appointment {
    if (!reason.trim()) throw new Error("RN-AGE-04: Cancelaciones requieren motivo.");
    if (this.status === "completed" || this.status === "cancelled") {
      throw new Error(`No se puede cancelar una cita en estado ${this.status}.`);
    }
    return this.with({ status: "cancelled", cancelledReason: reason });
  }

  reschedule(): Appointment {
    if (this.status === "cancelled" || this.status === "completed") {
      throw new Error(`No se puede reagendar una cita en estado ${this.status}.`);
    }
    return this.with({ status: "rescheduled" });
  }

  markNoShow(): Appointment {
    if (this.status !== "scheduled" && this.status !== "confirmed") {
      throw new Error(`No se puede marcar como no asistió una cita en estado ${this.status}.`);
    }
    return this.with({ status: "no_show" });
  }

  confirm(): Appointment {
    return this.with({ status: "confirmed", confirmedAt: new Date().toISOString() });
  }

  start(): Appointment {
    return this.with({ status: "in_progress" });
  }

  complete(consultationId?: string): Appointment {
    return this.with({
      status: "completed",
      consultationId: consultationId ?? this.props.consultationId,
    });
  }

  markPaid(cost: number, method: string): Appointment {
    return this.with({ cost, paid: true, paymentMethod: method });
  }
}
