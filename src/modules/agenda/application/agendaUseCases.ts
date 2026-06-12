import { Appointment, Block, Schedule, createAppointmentId, createBlockId, createScheduleId, type AppointmentId, type BlockId, type ScheduleId } from "../domain";
import type { AgendaRepository } from "../domain/AgendaRepository";
import { BlockFormSchema, ScheduleFormSchema, type BlockFormInput, type NewAppointmentFormInput, type RescheduleAppointmentInput, type ScheduleFormInput } from "./agendaFormSchema";

export const createAppointmentUC = async (
  repo: AgendaRepository,
  input: NewAppointmentFormInput,
  professionalId: string,
  officeId?: string,
): Promise<Appointment> => {
  const existing = await repo.listAppointmentsByDate(input.date);
  const requested = timeRange(input.startTime, input.endTime);
  const hasConflict = existing.some((appointment) => {
    if (appointment.professionalId !== professionalId) return false;
    if (["cancelled", "no_show", "rescheduled"].includes(appointment.status)) return false;
    const booked = timeRange(appointment.startTime, appointment.endTime);
    return requested.start < booked.end && requested.end > booked.start;
  });
  if (hasConflict) {
    throw new Error("La cita se solapa con otra cita del profesional.");
  }

  const blocks = await repo.listBlocksByRange(input.date, input.date);
  const hasBlockConflict = blocks.some((block) => block.professionalId === professionalId && blockOverlapsRange(block, input.date, requested));
  if (hasBlockConflict) {
    throw new Error("La cita se solapa con un bloqueo del profesional.");
  }

  const appointment = Appointment.create({
    id: createAppointmentId(),
    patientId: input.patientId,
    professionalId,
    officeId,
    date: input.date,
    startTime: input.startTime,
    endTime: input.endTime,
    type: input.type,
    reason: input.reason ?? "",
    notes: input.notes ?? "",
    durationMin: 0,
  });
  await repo.saveAppointment(appointment);
  return appointment;
};

function timeRange(startTime: string, endTime: string): { start: number; end: number } {
  const [startH, startM] = startTime.split(":").map(Number);
  const [endH, endM] = endTime.split(":").map(Number);
  return { start: startH * 60 + startM, end: endH * 60 + endM };
}

export const listAppointmentsByDateUC = async (
  repo: AgendaRepository,
  date: string,
): Promise<Appointment[]> => {
  return repo.listAppointmentsByDate(date);
};

export const listAppointmentsByRangeUC = async (
  repo: AgendaRepository,
  startDate: string,
  endDate: string,
): Promise<Appointment[]> => {
  return repo.listAppointmentsByRange(startDate, endDate);
};

export const listAppointmentsByPatientUC = async (
  repo: AgendaRepository,
  patientId: string,
): Promise<Appointment[]> => {
  return repo.listAppointmentsByPatient(patientId);
};

export const cancelAppointmentUC = async (
  repo: AgendaRepository,
  id: AppointmentId,
  reason: string,
): Promise<Appointment> => {
  const appointment = await repo.findAppointmentById(id);
  if (!appointment) throw new Error(`Cita no encontrada: ${id}`);
  const cancelled = appointment.cancel(reason);
  await repo.saveAppointment(cancelled);
  return cancelled;
};

export const rescheduleAppointmentUC = async (
  repo: AgendaRepository,
  id: AppointmentId,
  input: RescheduleAppointmentInput,
): Promise<Appointment> => {
  const appointment = await repo.findAppointmentById(id);
  if (!appointment) throw new Error(`Cita no encontrada: ${id}`);
  const newId = createAppointmentId();
  const rescheduled = appointment.reschedule();
  await repo.saveAppointment(rescheduled);
  const newAppointment = Appointment.create({
    id: newId,
    patientId: appointment.patientId,
    professionalId: appointment.professionalId,
    officeId: appointment.officeId,
    date: input.date,
    startTime: input.startTime,
    endTime: input.endTime,
    type: appointment.type,
    reason: appointment.reason,
    notes: appointment.notes,
    durationMin: appointment.durationMin,
    rescheduledFromId: appointment.id,
  });
  await repo.saveAppointment(newAppointment);
  return newAppointment;
};

export const markNoShowUC = async (
  repo: AgendaRepository,
  id: AppointmentId,
): Promise<Appointment> => {
  const appointment = await repo.findAppointmentById(id);
  if (!appointment) throw new Error(`Cita no encontrada: ${id}`);
  const updated = appointment.markNoShow();
  await repo.saveAppointment(updated);
  return updated;
};

export const confirmAppointmentUC = async (
  repo: AgendaRepository,
  id: AppointmentId,
): Promise<Appointment> => {
  const appointment = await repo.findAppointmentById(id);
  if (!appointment) throw new Error(`Cita no encontrada: ${id}`);
  const updated = appointment.confirm();
  await repo.saveAppointment(updated);
  return updated;
};

export const completeAppointmentUC = async (
  repo: AgendaRepository,
  id: AppointmentId,
  consultationId?: string,
): Promise<Appointment> => {
  const appointment = await repo.findAppointmentById(id);
  if (!appointment) throw new Error(`Cita no encontrada: ${id}`);
  const updated = appointment.complete(consultationId);
  await repo.saveAppointment(updated);
  return updated;
};

export const listSchedulesUC = async (
  repo: AgendaRepository,
  professionalId: string,
): Promise<Schedule[]> => {
  return repo.listSchedulesByProfessional(professionalId);
};

export const saveScheduleUC = async (
  repo: AgendaRepository,
  input: ScheduleFormInput,
  professionalId: string,
): Promise<Schedule> => {
  const parsed = ScheduleFormSchema.parse(input);
  const existingForProfessional = await repo.listSchedulesByProfessional(professionalId);
  const existingForDay = existingForProfessional.filter((schedule) => schedule.dayOfWeek === parsed.dayOfWeek);
  const existing = existingForDay[0];
  const schedule = existing
    ? Schedule.reconstitute({
      ...existing.toProps(),
      startTime: parsed.startTime,
      endTime: parsed.endTime,
      active: parsed.active,
      updatedAt: Date.now(),
    })
    : Schedule.create({
      id: createScheduleId(),
      professionalId,
      dayOfWeek: parsed.dayOfWeek,
      startTime: parsed.startTime,
      endTime: parsed.endTime,
      active: parsed.active,
    });

  await repo.saveSchedule(schedule);
  await Promise.all(existingForDay.slice(1).map((duplicate) => repo.deleteSchedule(duplicate.id)));
  return schedule;
};

export const deleteScheduleUC = async (
  repo: AgendaRepository,
  id: ScheduleId,
): Promise<void> => {
  await repo.deleteSchedule(id);
};

export const listBlocksByRangeUC = async (
  repo: AgendaRepository,
  startDate: string,
  endDate: string,
  professionalId?: string,
): Promise<Block[]> => {
  const blocks = await repo.listBlocksByRange(startDate, endDate);
  return professionalId ? blocks.filter((block) => block.professionalId === professionalId) : blocks;
};

export const createBlockUC = async (
  repo: AgendaRepository,
  input: BlockFormInput,
  professionalId: string,
): Promise<Block> => {
  const parsed = BlockFormSchema.parse(input);
  const block = Block.create({
    id: createBlockId(),
    professionalId,
    startDate: parsed.startDate,
    endDate: parsed.endDate,
    allDay: parsed.allDay,
    startTime: parsed.allDay ? undefined : parsed.startTime,
    endTime: parsed.allDay ? undefined : parsed.endTime,
    reason: parsed.reason ?? "",
  });
  await repo.saveBlock(block);
  return block;
};

export const deleteBlockUC = async (
  repo: AgendaRepository,
  id: BlockId,
): Promise<void> => {
  await repo.deleteBlock(id);
};

export interface TimeSlot {
  startTime: string;
  endTime: string;
  available: boolean;
}

export const getAvailableSlotsUC = async (
  repo: AgendaRepository,
  date: string,
  professionalId: string,
  slotDurationMin: number = 30,
): Promise<TimeSlot[]> => {
  const appointments = await repo.listAppointmentsByDate(date);
  const blocks = await repo.listBlocksByRange(date, date);
  const dayOfWeek = dayOfWeekFromDateString(date);
  const schedules = await repo.listSchedulesByProfessional(professionalId);
  const daySchedule = schedules.find((s) => s.dayOfWeek === dayOfWeek && s.active);
  if (!daySchedule) return [];
  const slots: TimeSlot[] = [];
  const [startH, startM] = daySchedule.startTime.split(":").map(Number);
  const [endH, endM] = daySchedule.endTime.split(":").map(Number);
  let currentMin = startH * 60 + startM;
  const endMin = endH * 60 + endM;
  const booked = appointments
    .filter((a) => a.professionalId === professionalId && a.status !== "cancelled" && a.status !== "no_show" && a.status !== "rescheduled")
    .map((a) => {
      const [sh, sm] = a.startTime.split(":").map(Number);
      const [eh, em] = a.endTime.split(":").map(Number);
      return { start: sh * 60 + sm, end: eh * 60 + em };
    })
    .concat(blocks
      .filter((block) => block.professionalId === professionalId && dateIsWithinBlock(date, block))
      .map(blockToBookedRange));
  while (currentMin + slotDurationMin <= endMin) {
    const slotStart = currentMin;
    const slotEnd = currentMin + slotDurationMin;
    const isBooked = booked.some((b) => slotStart < b.end && slotEnd > b.start);
    const h = String(Math.floor(slotStart / 60)).padStart(2, "0");
    const m = String(slotStart % 60).padStart(2, "0");
    const eh = String(Math.floor(slotEnd / 60)).padStart(2, "0");
    const em = String(slotEnd % 60).padStart(2, "0");
    slots.push({
      startTime: `${h}:${m}`,
      endTime: `${eh}:${em}`,
      available: !isBooked,
    });
    currentMin += slotDurationMin;
  }
  return slots;
};

function blockToBookedRange(block: Block): { start: number; end: number } {
  if (block.allDay || !block.startTime || !block.endTime) {
    return { start: 0, end: 24 * 60 };
  }
  return timeRange(block.startTime, block.endTime);
}

function blockOverlapsRange(block: Block, date: string, requested: { start: number; end: number }): boolean {
  if (!dateIsWithinBlock(date, block)) return false;
  const blocked = blockToBookedRange(block);
  return requested.start < blocked.end && requested.end > blocked.start;
}

function dateIsWithinBlock(date: string, block: Block): boolean {
  return block.startDate <= date && block.endDate >= date;
}

function dayOfWeekFromDateString(date: string): 0 | 1 | 2 | 3 | 4 | 5 | 6 {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day).getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6;
}
