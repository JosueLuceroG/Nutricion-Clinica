import { Appointment, createAppointmentId, type AppointmentId } from "../domain";
import type { AgendaRepository } from "../domain/AgendaRepository";
import type { NewAppointmentFormInput, RescheduleAppointmentInput } from "./agendaFormSchema";

export const createAppointmentUC = async (
  repo: AgendaRepository,
  input: NewAppointmentFormInput,
  professionalId: string,
  officeId?: string,
): Promise<Appointment> => {
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
  const dayOfWeek = new Date(date).getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6;
  const schedules = await repo.listSchedulesByProfessional(professionalId);
  const daySchedule = schedules.find((s) => s.dayOfWeek === dayOfWeek && s.active);
  if (!daySchedule) return [];
  const slots: TimeSlot[] = [];
  const [startH, startM] = daySchedule.startTime.split(":").map(Number);
  const [endH, endM] = daySchedule.endTime.split(":").map(Number);
  let currentMin = startH * 60 + startM;
  const endMin = endH * 60 + endM;
  const booked = appointments
    .filter((a) => a.status !== "cancelled" && a.status !== "no_show")
    .map((a) => {
      const [sh, sm] = a.startTime.split(":").map(Number);
      const [eh, em] = a.endTime.split(":").map(Number);
      return { start: sh * 60 + sm, end: eh * 60 + em };
    });
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
