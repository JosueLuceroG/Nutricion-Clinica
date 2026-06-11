import { describe, it, expect } from "vitest";
import {
  Appointment,
  type AppointmentProps,
} from "./Appointment";
import {
  createAppointmentId,
  appointmentIdFrom,
  appointmentIdFromUnsafe,
  AppointmentIdSchema,
} from "./AppointmentId";
import {
  AppointmentStatusSchema,
  AppointmentStatusLabel,
  APPOINTMENT_STATUSES,
  type AppointmentStatus,
} from "./AppointmentStatus";
import {
  AppointmentTypeSchema,
  AppointmentTypeLabel,
  APPOINTMENT_TYPES,
  DefaultDurationMin,
  type AppointmentType,
} from "./AppointmentType";
import { Schedule, ScheduleSchema, DayOfWeekLabel, type ScheduleProps } from "./Schedule";
import {
  createScheduleId,
  scheduleIdFrom,
  scheduleIdFromUnsafe,
} from "./ScheduleId";
import { Block, BlockSchema, type BlockProps } from "./Block";
import {
  createBlockId,
  blockIdFrom,
  blockIdFromUnsafe,
} from "./BlockId";
import {
  AppointmentNotFoundError,
  ScheduleNotFoundError,
  BlockNotFoundError,
} from "./AgendaRepository";

const validUUID = "550e8400-e29b-41d4-a716-446655440000";
const validUUID2 = "660e8400-e29b-41d4-a716-446655440001";

// ---------------------------------------------------------------------------
// AppointmentId
// ---------------------------------------------------------------------------
describe("AppointmentId", () => {
  it("createAppointmentId genera un UUID válido", () => {
    const id = createAppointmentId();
    expect(AppointmentIdSchema.safeParse(id).success).toBe(true);
  });

  it("appointmentIdFrom acepta un UUID válido", () => {
    const id = appointmentIdFrom(validUUID);
    expect(id).toBe(validUUID);
  });

  it("appointmentIdFrom rechaza un string no UUID", () => {
    expect(() => appointmentIdFrom("not-a-uuid")).toThrow();
  });

  it("appointmentIdFromUnsafe no valida el formato", () => {
    const id = appointmentIdFromUnsafe("cualquier-cosa");
    expect(id).toBe("cualquier-cosa");
  });

  it("dos instancias con el mismo UUID son iguales", () => {
    const a = appointmentIdFrom(validUUID);
    const b = appointmentIdFrom(validUUID);
    expect(a).toBe(b);
  });
});

// ---------------------------------------------------------------------------
// AppointmentStatus
// ---------------------------------------------------------------------------
describe("AppointmentStatus", () => {
  it("tiene 7 valores enum", () => {
    expect(APPOINTMENT_STATUSES).toHaveLength(7);
    expect(APPOINTMENT_STATUSES).toEqual([
      "scheduled",
      "confirmed",
      "in_progress",
      "completed",
      "cancelled",
      "no_show",
      "rescheduled",
    ]);
  });

  it("APPOINTMENT_STATUSES cubre todas las claves del label map", () => {
    for (const s of APPOINTMENT_STATUSES) {
      expect(AppointmentStatusLabel[s]).toBeDefined();
    }
  });

  it("AppointmentStatusLabel contiene etiquetas en español", () => {
    expect(AppointmentStatusLabel.scheduled).toBe("Programada");
    expect(AppointmentStatusLabel.confirmed).toBe("Confirmada");
    expect(AppointmentStatusLabel.in_progress).toBe("En curso");
    expect(AppointmentStatusLabel.completed).toBe("Completada");
    expect(AppointmentStatusLabel.cancelled).toBe("Cancelada");
    expect(AppointmentStatusLabel.no_show).toBe("No asistió");
    expect(AppointmentStatusLabel.rescheduled).toBe("Reagendada");
  });

  it("Zod schema rechaza un valor inválido", () => {
    expect(AppointmentStatusSchema.safeParse("invalid_status").success).toBe(
      false,
    );
  });

  it("Zod schema acepta todos los valores válidos", () => {
    for (const s of APPOINTMENT_STATUSES) {
      expect(AppointmentStatusSchema.safeParse(s).success).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// AppointmentType
// ---------------------------------------------------------------------------
describe("AppointmentType", () => {
  it("tiene 5 valores enum", () => {
    expect(APPOINTMENT_TYPES).toHaveLength(5);
    expect(APPOINTMENT_TYPES).toEqual([
      "primera_vez",
      "seguimiento",
      "urgencia",
      "control",
      "cierre",
    ]);
  });

  it("APPOINTMENT_TYPES cubre todas las claves del label map", () => {
    for (const t of APPOINTMENT_TYPES) {
      expect(AppointmentTypeLabel[t]).toBeDefined();
    }
  });

  it("AppointmentTypeLabel contiene etiquetas en español", () => {
    expect(AppointmentTypeLabel.primera_vez).toBe("Primera vez");
    expect(AppointmentTypeLabel.seguimiento).toBe("Seguimiento");
    expect(AppointmentTypeLabel.urgencia).toBe("Urgencia");
    expect(AppointmentTypeLabel.control).toBe("Control");
    expect(AppointmentTypeLabel.cierre).toBe("Cierre");
  });

  it("DefaultDurationMin tiene duraciones para todos los tipos", () => {
    expect(DefaultDurationMin.primera_vez).toBe(60);
    expect(DefaultDurationMin.seguimiento).toBe(30);
    expect(DefaultDurationMin.urgencia).toBe(20);
    expect(DefaultDurationMin.control).toBe(45);
    expect(DefaultDurationMin.cierre).toBe(30);
  });

  it("Zod schema rechaza un valor inválido", () => {
    expect(AppointmentTypeSchema.safeParse("otro_tipo").success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Appointment
// ---------------------------------------------------------------------------
const baseAppointment = {
  id: appointmentIdFrom(validUUID).toString(),
  patientId: validUUID,
  professionalId: validUUID2,
  date: "2026-06-15",
  startTime: "10:00",
  endTime: "10:30",
  durationMin: 30,
  type: "seguimiento" as AppointmentType,
  reason: "",
  notes: "",
} satisfies Omit<
  AppointmentProps,
  | "createdAt"
  | "updatedAt"
  | "status"
  | "reminderSent"
  | "confirmedAt"
  | "cancelledReason"
  | "rescheduledFromId"
  | "cost"
  | "paid"
  | "paymentMethod"
>;

function createAppointment(
  overrides: Partial<AppointmentProps> = {},
): Appointment {
  return Appointment.create({
    ...baseAppointment,
    ...(overrides as any),
  });
}

describe("Appointment.create", () => {
  it("crea cita con datos válidos", () => {
    const apt = Appointment.create(baseAppointment);
    expect(apt.patientId).toBe(validUUID);
    expect(apt.professionalId).toBe(validUUID2);
    expect(apt.date).toBe("2026-06-15");
    expect(apt.startTime).toBe("10:00");
    expect(apt.endTime).toBe("10:30");
    expect(apt.durationMin).toBe(30);
    expect(apt.type).toBe("seguimiento");
    expect(apt.status).toBe("scheduled");
    expect(apt.reason).toBe("");
    expect(apt.notes).toBe("");
    expect(apt.reminderSent).toBe(false);
    expect(apt.confirmedAt).toBeUndefined();
    expect(apt.cancelledReason).toBe("");
    expect(apt.cost).toBe(0);
    expect(apt.paid).toBe(false);
    expect(apt.paymentMethod).toBe("");
    expect(apt.createdAt).toBeGreaterThan(0);
    expect(apt.updatedAt).toBeGreaterThan(0);
  });

  it("asigna status 'scheduled' por defecto", () => {
    const apt = Appointment.create(baseAppointment);
    expect(apt.status).toBe("scheduled");
  });

  it("acepta status personalizado", () => {
    const apt = Appointment.create({
      ...baseAppointment,
      status: "confirmed" as AppointmentStatus,
    });
    expect(apt.status).toBe("confirmed");
  });

  it("usa duración por defecto según tipo si no se provee", () => {
    const apt = Appointment.create({ ...baseAppointment, durationMin: 0 });
    expect(apt.durationMin).toBe(30);
  });

  it("usa duración por defecto para primera_vez", () => {
    const apt = Appointment.create({
      ...baseAppointment,
      type: "primera_vez",
      durationMin: 0,
    });
    expect(apt.durationMin).toBe(60);
  });

  it("lanza error si startTime >= endTime", () => {
    expect(() =>
      Appointment.create({ ...baseAppointment, startTime: "11:00", endTime: "10:00" }),
    ).toThrow(/inicio.*anterior/);
  });

  it("lanza error si startTime == endTime", () => {
    expect(() =>
      Appointment.create({ ...baseAppointment, startTime: "10:00", endTime: "10:00" }),
    ).toThrow(/inicio.*anterior/);
  });
});

describe("Appointment.reconstitute", () => {
  it("reconstituye una cita existente sin modificar props", () => {
    const now = Date.now();
    const props: AppointmentProps = {
      id: appointmentIdFrom(validUUID).toString(),
      patientId: validUUID,
      professionalId: validUUID2,
      date: "2026-06-15",
      startTime: "10:00",
      endTime: "10:30",
      durationMin: 30,
      type: "seguimiento",
      status: "completed",
      reason: "Dolor de cabeza",
      notes: "Paciente mejoró",
      reminderSent: true,
      confirmedAt: new Date().toISOString(),
      cancelledReason: "",
      cost: 500,
      paid: true,
      paymentMethod: "efectivo",
      createdAt: now,
      updatedAt: now,
    };
    const apt = Appointment.reconstitute(props);
    expect(apt.status).toBe("completed");
    expect(apt.reason).toBe("Dolor de cabeza");
    expect(apt.paid).toBe(true);
    expect(apt.cost).toBe(500);
    expect(apt.createdAt).toBe(now);
  });
});

describe("Appointment.toProps", () => {
  it("retorna copia de las propiedades", () => {
    const apt = createAppointment();
    const props = apt.toProps();
    expect(props.patientId).toBe(validUUID);
    expect(props.status).toBe("scheduled");
  });
});

describe("Appointment.with", () => {
  it("retorna nueva instancia sin mutar la original", () => {
    const original = createAppointment();
    const updated = original.with({ reason: "Nuevo motivo" });
    expect(original.reason).toBe("");
    expect(updated.reason).toBe("Nuevo motivo");
    expect(updated.id).toBe(original.id);
  });

  it("actualiza updatedAt", () => {
    const original = createAppointment();
    const updated = original.with({ notes: "Nota" });
    expect(updated.updatedAt).toBeGreaterThanOrEqual(original.updatedAt);
  });
});

describe("Appointment.cancel", () => {
  it("cancela una cita programada", () => {
    const apt = createAppointment();
    const cancelled = apt.cancel("El paciente canceló");
    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.cancelledReason).toBe("El paciente canceló");
  });

  it("lanza error si el motivo es vacío", () => {
    const apt = createAppointment();
    expect(() => apt.cancel("  ")).toThrow(/RN-AGE-04/);
  });

  it("lanza error si la cita ya está completada", () => {
    const apt = createAppointment({ status: "completed" });
    expect(() => apt.cancel("Motivo")).toThrow(/No se puede cancelar/);
  });

  it("lanza error si la cita ya está cancelada", () => {
    const apt = createAppointment({ status: "cancelled" });
    expect(() => apt.cancel("Otro motivo")).toThrow(/No se puede cancelar/);
  });
});

describe("Appointment.reschedule", () => {
  it("reagenda una cita programada", () => {
    const apt = createAppointment();
    const rescheduled = apt.reschedule();
    expect(rescheduled.status).toBe("rescheduled");
  });

  it("lanza error si la cita está cancelada", () => {
    const apt = createAppointment({ status: "cancelled" });
    expect(() => apt.reschedule()).toThrow(/No se puede reagendar/);
  });

  it("lanza error si la cita está completada", () => {
    const apt = createAppointment({ status: "completed" });
    expect(() => apt.reschedule()).toThrow(/No se puede reagendar/);
  });
});

describe("Appointment.markNoShow", () => {
  it("marca como no asistió una cita programada", () => {
    const apt = createAppointment();
    const noshow = apt.markNoShow();
    expect(noshow.status).toBe("no_show");
  });

  it("marca como no asistió una cita confirmada", () => {
    const apt = createAppointment({ status: "confirmed" });
    const noshow = apt.markNoShow();
    expect(noshow.status).toBe("no_show");
  });

  it("lanza error si la cita está completada", () => {
    const apt = createAppointment({ status: "completed" });
    expect(() => apt.markNoShow()).toThrow(/No se puede marcar/);
  });

  it("lanza error si la cita está cancelada", () => {
    const apt = createAppointment({ status: "cancelled" });
    expect(() => apt.markNoShow()).toThrow(/No se puede marcar/);
  });
});

describe("Appointment.confirm", () => {
  it("confirma una cita y asigna confirmedAt", () => {
    const apt = createAppointment();
    const confirmed = apt.confirm();
    expect(confirmed.status).toBe("confirmed");
    expect(confirmed.confirmedAt).toBeDefined();
    expect(confirmed.confirmedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe("Appointment.start", () => {
  it("cambia estado a in_progress", () => {
    const apt = createAppointment();
    const started = apt.start();
    expect(started.status).toBe("in_progress");
  });
});

describe("Appointment.complete", () => {
  it("completa una cita", () => {
    const apt = createAppointment();
    const completed = apt.complete(validUUID);
    expect(completed.status).toBe("completed");
    expect(completed.consultationId).toBe(validUUID);
  });

  it("completa sin consultationId preserva el existente", () => {
    const apt = createAppointment({ consultationId: validUUID });
    const completed = apt.complete();
    expect(completed.consultationId).toBe(validUUID);
  });
});

describe("Appointment.markPaid", () => {
  it("marca como pagada con costo y método", () => {
    const apt = createAppointment();
    const paid = apt.markPaid(800, "transferencia");
    expect(paid.paid).toBe(true);
    expect(paid.cost).toBe(800);
    expect(paid.paymentMethod).toBe("transferencia");
  });
});

// ---------------------------------------------------------------------------
// ScheduleId
// ---------------------------------------------------------------------------
describe("ScheduleId", () => {
  it("createScheduleId genera un UUID válido", () => {
    const id = createScheduleId();
    expect(ScheduleSchema.shape.id.safeParse(id).success).toBe(true);
  });

  it("scheduleIdFrom acepta un UUID válido", () => {
    const id = scheduleIdFrom(validUUID);
    expect(id).toBe(validUUID);
  });

  it("scheduleIdFrom rechaza un string no UUID", () => {
    expect(() => scheduleIdFrom("invalido")).toThrow();
  });

  it("scheduleIdFromUnsafe no valida el formato", () => {
    const id = scheduleIdFromUnsafe("cualquier-cosa");
    expect(id).toBe("cualquier-cosa");
  });
});

// ---------------------------------------------------------------------------
// Schedule
// ---------------------------------------------------------------------------
describe("Schedule.create", () => {
  it("crea horario con datos válidos", () => {
    const sched = Schedule.create({
      id: scheduleIdFrom(validUUID).toString(),
      professionalId: validUUID,
      dayOfWeek: 1 as const,
      startTime: "09:00",
      endTime: "17:00",
    });
    expect(sched.professionalId).toBe(validUUID);
    expect(sched.dayOfWeek).toBe(1);
    expect(sched.startTime).toBe("09:00");
    expect(sched.endTime).toBe("17:00");
    expect(sched.active).toBe(true);
    expect(sched.createdAt).toBeGreaterThan(0);
    expect(sched.updatedAt).toBeGreaterThan(0);
  });

  it("acepta active=false explícitamente", () => {
    const sched = Schedule.create({
      id: scheduleIdFrom(validUUID).toString(),
      professionalId: validUUID,
      dayOfWeek: 2 as const,
      startTime: "08:00",
      endTime: "14:00",
      active: false,
    });
    expect(sched.active).toBe(false);
  });
});

describe("Schedule.reconstitute", () => {
  it("reconstituye horario existente", () => {
    const now = Date.now();
    const props: ScheduleProps = {
      id: scheduleIdFrom(validUUID).toString(),
      professionalId: validUUID,
      dayOfWeek: 3 as const,
      startTime: "10:00",
      endTime: "18:00",
      active: false,
      createdAt: now,
      updatedAt: now,
    };
    const sched = Schedule.reconstitute(props);
    expect(sched.dayOfWeek).toBe(3);
    expect(sched.active).toBe(false);
    expect(sched.createdAt).toBe(now);
  });
});

describe("Schedule.toProps", () => {
  it("retorna copia de propiedades", () => {
    const sched = Schedule.create({
      id: scheduleIdFrom(validUUID).toString(),
      professionalId: validUUID,
      dayOfWeek: 1 as const,
      startTime: "09:00",
      endTime: "17:00",
    });
    const props = sched.toProps();
    expect(props.dayOfWeek).toBe(1);
    expect(props.startTime).toBe("09:00");
  });
});

// ---------------------------------------------------------------------------
// BlockId
// ---------------------------------------------------------------------------
describe("BlockId", () => {
  it("createBlockId genera un UUID válido", () => {
    const id = createBlockId();
    expect(BlockSchema.shape.id.safeParse(id).success).toBe(true);
  });

  it("blockIdFrom acepta un UUID válido", () => {
    const id = blockIdFrom(validUUID);
    expect(id).toBe(validUUID);
  });

  it("blockIdFrom rechaza un string no UUID", () => {
    expect(() => blockIdFrom("invalido")).toThrow();
  });

  it("blockIdFromUnsafe no valida el formato", () => {
    const id = blockIdFromUnsafe("cualquier-cosa");
    expect(id).toBe("cualquier-cosa");
  });
});

// ---------------------------------------------------------------------------
// Block
// ---------------------------------------------------------------------------
describe("Block.create", () => {
  it("crea bloqueo con datos válidos (allDay=true)", () => {
    const block = Block.create({
      id: blockIdFrom(validUUID).toString(),
      professionalId: validUUID,
      startDate: "2026-06-15",
      endDate: "2026-06-15",
      allDay: true,
      reason: "",
    });
    expect(block.professionalId).toBe(validUUID);
    expect(block.startDate).toBe("2026-06-15");
    expect(block.endDate).toBe("2026-06-15");
    expect(block.allDay).toBe(true);
    expect(block.startTime).toBeUndefined();
    expect(block.endTime).toBeUndefined();
    expect(block.reason).toBe("");
    expect(block.createdAt).toBeGreaterThan(0);
  });

  it("crea bloqueo parcial con horario específico", () => {
    const block = Block.create({
      id: blockIdFrom(validUUID).toString(),
      professionalId: validUUID,
      startDate: "2026-06-15",
      endDate: "2026-06-15",
      startTime: "14:00",
      endTime: "16:00",
      allDay: false,
      reason: "Junta médica",
    });
    expect(block.allDay).toBe(false);
    expect(block.startTime).toBe("14:00");
    expect(block.endTime).toBe("16:00");
    expect(block.reason).toBe("Junta médica");
  });
});

describe("Block.reconstitute", () => {
  it("reconstituye bloqueo existente", () => {
    const now = Date.now();
    const props: BlockProps = {
      id: blockIdFrom(validUUID).toString(),
      professionalId: validUUID,
      startDate: "2026-06-20",
      endDate: "2026-06-21",
      allDay: true,
      reason: "Capacitación",
      createdAt: now,
      updatedAt: now,
    };
    const block = Block.reconstitute(props);
    expect(block.startDate).toBe("2026-06-20");
    expect(block.reason).toBe("Capacitación");
    expect(block.createdAt).toBe(now);
  });
});

describe("Block.toProps", () => {
  it("retorna copia de propiedades", () => {
    const block = Block.create({
      id: blockIdFrom(validUUID).toString(),
      professionalId: validUUID,
      startDate: "2026-06-15",
      endDate: "2026-06-15",
      allDay: true,
      reason: "",
    });
    const props = block.toProps();
    expect(props.startDate).toBe("2026-06-15");
    expect(props.allDay).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// DayOfWeekLabel (Schedule)
// ---------------------------------------------------------------------------
describe("DayOfWeekLabel", () => {
  it("contiene los 7 días de la semana en español", () => {
    expect(DayOfWeekLabel[0]).toBe("Domingo");
    expect(DayOfWeekLabel[1]).toBe("Lunes");
    expect(DayOfWeekLabel[2]).toBe("Martes");
    expect(DayOfWeekLabel[3]).toBe("Miércoles");
    expect(DayOfWeekLabel[4]).toBe("Jueves");
    expect(DayOfWeekLabel[5]).toBe("Viernes");
    expect(DayOfWeekLabel[6]).toBe("Sábado");
  });
});

// ---------------------------------------------------------------------------
// AgendaRepository - Error classes
// ---------------------------------------------------------------------------
describe("AgendaRepository errors", () => {
  it("AppointmentNotFoundError tiene nombre y mensaje correctos", () => {
    const id = appointmentIdFrom(validUUID);
    const err = new AppointmentNotFoundError(id);
    expect(err.name).toBe("AppointmentNotFoundError");
    expect(err.message).toContain("Cita no encontrada");
    expect(err.message).toContain(validUUID);
    expect(err.id).toBe(id);
  });

  it("ScheduleNotFoundError tiene nombre y mensaje correctos", () => {
    const id = scheduleIdFrom(validUUID);
    const err = new ScheduleNotFoundError(id);
    expect(err.name).toBe("ScheduleNotFoundError");
    expect(err.message).toContain("Horario no encontrado");
    expect(err.message).toContain(validUUID);
    expect(err.id).toBe(id);
  });

  it("BlockNotFoundError tiene nombre y mensaje correctos", () => {
    const id = blockIdFrom(validUUID);
    const err = new BlockNotFoundError(id);
    expect(err.name).toBe("BlockNotFoundError");
    expect(err.message).toContain("Bloqueo no encontrado");
    expect(err.message).toContain(validUUID);
    expect(err.id).toBe(id);
  });

  it("AppointmentNotFoundError es instancia de Error", () => {
    const err = new AppointmentNotFoundError(appointmentIdFrom(validUUID));
    expect(err).toBeInstanceOf(Error);
  });

  it("ScheduleNotFoundError es instancia de Error", () => {
    const err = new ScheduleNotFoundError(scheduleIdFrom(validUUID));
    expect(err).toBeInstanceOf(Error);
  });

  it("BlockNotFoundError es instancia de Error", () => {
    const err = new BlockNotFoundError(blockIdFrom(validUUID));
    expect(err).toBeInstanceOf(Error);
  });
});
