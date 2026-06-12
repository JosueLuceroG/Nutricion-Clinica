import { db } from "@services/db/dexieSchema";
import { DexieAgendaRepository } from "@modules/agenda/infrastructure/DexieAgendaRepository";
import { useAuthStore } from "@store/authStore";
import { useSyncStore } from "@store/syncStore";
import {
  createAppointmentUC,
  listAppointmentsByDateUC,
  listAppointmentsByRangeUC,
  listAppointmentsByPatientUC,
  cancelAppointmentUC,
  rescheduleAppointmentUC,
  markNoShowUC,
  confirmAppointmentUC,
  completeAppointmentUC,
  getAvailableSlotsUC,
} from "@modules/agenda/application/agendaUseCases";
import type { AppointmentId } from "@modules/agenda/domain/AppointmentId";
import type { Appointment } from "@modules/agenda/domain/Appointment";
import type { NewAppointmentFormInput, RescheduleAppointmentInput } from "@modules/agenda/application/agendaFormSchema";

const repository = new DexieAgendaRepository(db);

let defaultProfessionalId: string | null = null;

export function setDefaultProfessionalId(id: string | null): void {
  defaultProfessionalId = id;
}

export function resolveAgendaProfessionalId(professionalId?: string): string {
  const resolved = professionalId ?? useAuthStore.getState().user?.id ?? defaultProfessionalId;
  if (!resolved) {
    throw new Error("No hay profesional autenticado para agendar la cita.");
  }
  return resolved;
}

export function resolveAgendaOfficeId(officeId?: string): string {
  const resolved = officeId ?? useSyncStore.getState().sucursalId ?? useAuthStore.getState().sucursalActivaId;
  if (!resolved) {
    throw new Error("No hay sucursal activa para agendar la cita.");
  }
  return resolved;
}

export const agendaService = {
  create: (input: NewAppointmentFormInput, professionalId?: string, officeId?: string): Promise<Appointment> =>
    createAppointmentUC(repository, input, resolveAgendaProfessionalId(professionalId), resolveAgendaOfficeId(officeId)),

  listByDate: (date: string): Promise<Appointment[]> =>
    listAppointmentsByDateUC(repository, date),

  listByRange: (startDate: string, endDate: string): Promise<Appointment[]> =>
    listAppointmentsByRangeUC(repository, startDate, endDate),

  listByPatient: (patientId: string): Promise<Appointment[]> =>
    listAppointmentsByPatientUC(repository, patientId),

  cancel: (id: AppointmentId, reason: string): Promise<Appointment> =>
    cancelAppointmentUC(repository, id, reason),

  reschedule: (id: AppointmentId, input: RescheduleAppointmentInput): Promise<Appointment> =>
    rescheduleAppointmentUC(repository, id, input),

  markNoShow: (id: AppointmentId): Promise<Appointment> =>
    markNoShowUC(repository, id),

  confirm: (id: AppointmentId): Promise<Appointment> =>
    confirmAppointmentUC(repository, id),

  complete: (id: AppointmentId, consultationId?: string): Promise<Appointment> =>
    completeAppointmentUC(repository, id, consultationId),

  getAvailableSlots: (date: string, professionalId?: string, slotDurationMin?: number) =>
    getAvailableSlotsUC(repository, date, resolveAgendaProfessionalId(professionalId), slotDurationMin),
};

export type AgendaService = typeof agendaService;
