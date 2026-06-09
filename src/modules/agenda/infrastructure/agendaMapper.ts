import { Appointment, type AppointmentProps } from "../domain/Appointment";
import { Schedule, type ScheduleProps } from "../domain/Schedule";
import { Block } from "../domain/Block";
import type { AppointmentId, ScheduleId, BlockId } from "../domain";

export interface AppointmentRow {
  id: string;
  patient_id: string;
  professional_id: string;
  office_id: string | null;
  date: string;
  start_time: string;
  end_time: string;
  duration_min: number;
  type: string;
  status: string;
  reason: string;
  notes: string;
  consultation_id: string | null;
  reminder_sent: number;
  confirmed_at: string | null;
  cancelled_reason: string;
  rescheduled_from_id: string | null;
  cost: number;
  paid: number;
  payment_method: string;
  created_at: number;
  updated_at: number;
}

export interface ScheduleRow {
  id: string;
  professional_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  active: number;
  created_at: number;
  updated_at: number;
}

export interface BlockRow {
  id: string;
  professional_id: string;
  start_date: string;
  end_date: string;
  start_time: string | null;
  end_time: string | null;
  all_day: number;
  reason: string;
  created_at: number;
  updated_at: number;
}

export function appointmentRowToDomain(row: AppointmentRow): Appointment {
  return Appointment.reconstitute({
    id: row.id as AppointmentId,
    patientId: row.patient_id,
    professionalId: row.professional_id,
    officeId: row.office_id ?? undefined,
    date: row.date,
    startTime: row.start_time,
    endTime: row.end_time,
    durationMin: row.duration_min,
    type: row.type as AppointmentProps["type"],
    status: row.status as AppointmentProps["status"],
    reason: row.reason,
    notes: row.notes,
    consultationId: row.consultation_id ?? undefined,
    reminderSent: row.reminder_sent === 1,
    confirmedAt: row.confirmed_at ?? undefined,
    cancelledReason: row.cancelled_reason,
    rescheduledFromId: row.rescheduled_from_id ?? undefined,
    cost: row.cost,
    paid: row.paid === 1,
    paymentMethod: row.payment_method,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export function appointmentDomainToRow(appointment: Appointment): AppointmentRow {
  const p = appointment.toProps();
  return {
    id: p.id,
    patient_id: p.patientId,
    professional_id: p.professionalId,
    office_id: p.officeId ?? null,
    date: p.date,
    start_time: p.startTime,
    end_time: p.endTime,
    duration_min: p.durationMin,
    type: p.type,
    status: p.status,
    reason: p.reason,
    notes: p.notes,
    consultation_id: p.consultationId ?? null,
    reminder_sent: p.reminderSent ? 1 : 0,
    confirmed_at: p.confirmedAt ?? null,
    cancelled_reason: p.cancelledReason,
    rescheduled_from_id: p.rescheduledFromId ?? null,
    cost: p.cost,
    paid: p.paid ? 1 : 0,
    payment_method: p.paymentMethod,
    created_at: p.createdAt,
    updated_at: p.updatedAt,
  };
}

export function scheduleRowToDomain(row: ScheduleRow): Schedule {
  return Schedule.reconstitute({
    id: row.id as ScheduleId,
    professionalId: row.professional_id,
    dayOfWeek: row.day_of_week as ScheduleProps["dayOfWeek"],
    startTime: row.start_time,
    endTime: row.end_time,
    active: row.active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export function scheduleDomainToRow(schedule: Schedule): ScheduleRow {
  const p = schedule.toProps();
  return {
    id: p.id,
    professional_id: p.professionalId,
    day_of_week: p.dayOfWeek,
    start_time: p.startTime,
    end_time: p.endTime,
    active: p.active ? 1 : 0,
    created_at: p.createdAt,
    updated_at: p.updatedAt,
  };
}

export function blockRowToDomain(row: BlockRow): Block {
  return Block.reconstitute({
    id: row.id as BlockId,
    professionalId: row.professional_id,
    startDate: row.start_date,
    endDate: row.end_date,
    startTime: row.start_time ?? undefined,
    endTime: row.end_time ?? undefined,
    allDay: row.all_day === 1,
    reason: row.reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export function blockDomainToRow(block: Block): BlockRow {
  const p = block.toProps();
  return {
    id: p.id,
    professional_id: p.professionalId,
    start_date: p.startDate,
    end_date: p.endDate,
    start_time: p.startTime ?? null,
    end_time: p.endTime ?? null,
    all_day: p.allDay ? 1 : 0,
    reason: p.reason,
    created_at: p.createdAt,
    updated_at: p.updatedAt,
  };
}
