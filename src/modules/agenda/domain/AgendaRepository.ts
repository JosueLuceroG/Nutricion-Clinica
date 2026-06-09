import type { Appointment, AppointmentProps } from "./Appointment";
import type { AppointmentId } from "./AppointmentId";
import type { Schedule, ScheduleProps } from "./Schedule";
import type { ScheduleId } from "./ScheduleId";
import type { Block, BlockProps } from "./Block";
import type { BlockId } from "./BlockId";
import type { AppointmentStatus } from "./AppointmentStatus";

export interface AgendaRepository {
  saveAppointment(appointment: Appointment): Promise<void>;
  findAppointmentById(id: AppointmentId): Promise<Appointment | null>;
  listAppointmentsByDate(date: string): Promise<Appointment[]>;
  listAppointmentsByRange(startDate: string, endDate: string): Promise<Appointment[]>;
  listAppointmentsByPatient(patientId: string): Promise<Appointment[]>;
  listAppointmentsByStatus(status: AppointmentStatus): Promise<Appointment[]>;
  deleteAppointment(id: AppointmentId): Promise<void>;

  saveSchedule(schedule: Schedule): Promise<void>;
  findScheduleById(id: ScheduleId): Promise<Schedule | null>;
  listSchedulesByProfessional(professionalId: string): Promise<Schedule[]>;
  deleteSchedule(id: ScheduleId): Promise<void>;

  saveBlock(block: Block): Promise<void>;
  findBlockById(id: BlockId): Promise<Block | null>;
  listBlocksByProfessional(professionalId: string): Promise<Block[]>;
  listBlocksByRange(startDate: string, endDate: string): Promise<Block[]>;
  deleteBlock(id: BlockId): Promise<void>;
}

export class AppointmentNotFoundError extends Error {
  constructor(public readonly id: AppointmentId) {
    super(`Cita no encontrada: ${id}`);
    this.name = "AppointmentNotFoundError";
  }
}

export class ScheduleNotFoundError extends Error {
  constructor(public readonly id: ScheduleId) {
    super(`Horario no encontrado: ${id}`);
    this.name = "ScheduleNotFoundError";
  }
}

export class BlockNotFoundError extends Error {
  constructor(public readonly id: BlockId) {
    super(`Bloqueo no encontrado: ${id}`);
    this.name = "BlockNotFoundError";
  }
}

export type { Appointment, AppointmentProps, AppointmentId };
export type { Schedule, ScheduleProps, ScheduleId };
export type { Block, BlockProps, BlockId };
