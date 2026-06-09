import type { AgendaRepository } from "../domain/AgendaRepository";
import { AppointmentNotFoundError, ScheduleNotFoundError, BlockNotFoundError } from "../domain/AgendaRepository";
import type { Appointment } from "../domain/Appointment";
import type { AppointmentId } from "../domain/AppointmentId";
import type { Schedule } from "../domain/Schedule";
import type { ScheduleId } from "../domain/ScheduleId";
import type { Block } from "../domain/Block";
import type { BlockId } from "../domain/BlockId";
import type { AppointmentStatus } from "../domain/AppointmentStatus";
import { appointmentDomainToRow, appointmentRowToDomain, scheduleDomainToRow, scheduleRowToDomain, blockDomainToRow, blockRowToDomain } from "./agendaMapper";
import type { NutriClinicaDB } from "@services/db/dexieSchema";

export class DexieAgendaRepository implements AgendaRepository {
  constructor(private readonly db: NutriClinicaDB) {}

  async saveAppointment(appointment: Appointment): Promise<void> {
    const row = appointmentDomainToRow(appointment);
    await this.db.appointments.put(row);
  }

  async findAppointmentById(id: AppointmentId): Promise<Appointment | null> {
    const row = await this.db.appointments.get(id);
    if (!row) return null;
    return appointmentRowToDomain(row);
  }

  async listAppointmentsByDate(date: string): Promise<Appointment[]> {
    const rows = await this.db.appointments
      .where("date")
      .equals(date)
      .toArray();
    return rows.map(appointmentRowToDomain);
  }

  async listAppointmentsByRange(startDate: string, endDate: string): Promise<Appointment[]> {
    const rows = await this.db.appointments
      .where("date")
      .between(startDate, endDate, true, true)
      .toArray();
    return rows.map(appointmentRowToDomain);
  }

  async listAppointmentsByPatient(patientId: string): Promise<Appointment[]> {
    const rows = await this.db.appointments
      .where("patient_id")
      .equals(patientId)
      .toArray();
    return rows.map(appointmentRowToDomain);
  }

  async listAppointmentsByStatus(status: AppointmentStatus): Promise<Appointment[]> {
    const rows = await this.db.appointments
      .where("status")
      .equals(status)
      .toArray();
    return rows.map(appointmentRowToDomain);
  }

  async deleteAppointment(id: AppointmentId): Promise<void> {
    const existing = await this.db.appointments.get(id);
    if (!existing) throw new AppointmentNotFoundError(id);
    await this.db.appointments.delete(id);
  }

  async saveSchedule(schedule: Schedule): Promise<void> {
    const row = scheduleDomainToRow(schedule);
    await this.db.schedules.put(row);
  }

  async findScheduleById(id: ScheduleId): Promise<Schedule | null> {
    const row = await this.db.schedules.get(id);
    if (!row) return null;
    return scheduleRowToDomain(row);
  }

  async listSchedulesByProfessional(professionalId: string): Promise<Schedule[]> {
    const rows = await this.db.schedules
      .where("professional_id")
      .equals(professionalId)
      .toArray();
    return rows.map(scheduleRowToDomain);
  }

  async deleteSchedule(id: ScheduleId): Promise<void> {
    const existing = await this.db.schedules.get(id);
    if (!existing) throw new ScheduleNotFoundError(id);
    await this.db.schedules.delete(id);
  }

  async saveBlock(block: Block): Promise<void> {
    const row = blockDomainToRow(block);
    await this.db.blocks.put(row);
  }

  async findBlockById(id: BlockId): Promise<Block | null> {
    const row = await this.db.blocks.get(id);
    if (!row) return null;
    return blockRowToDomain(row);
  }

  async listBlocksByProfessional(professionalId: string): Promise<Block[]> {
    const rows = await this.db.blocks
      .where("professional_id")
      .equals(professionalId)
      .toArray();
    return rows.map(blockRowToDomain);
  }

  async listBlocksByRange(startDate: string, endDate: string): Promise<Block[]> {
    const rows = await this.db.blocks
      .where("start_date")
      .between(startDate, endDate, true, true)
      .toArray();
    return rows.map(blockRowToDomain);
  }

  async deleteBlock(id: BlockId): Promise<void> {
    const existing = await this.db.blocks.get(id);
    if (!existing) throw new BlockNotFoundError(id);
    await this.db.blocks.delete(id);
  }
}
