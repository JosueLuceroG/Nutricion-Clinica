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
import {
  requireActiveSucursalId,
  rowMatchesSucursal,
} from "@services/tenancy/sucursalScope";

const appointmentMatchesSucursal = (
  row: { office_id?: string | null },
  sucursalId: string,
): boolean =>
  rowMatchesSucursal({ sucursal_id: row.office_id }, sucursalId);

export class DexieAgendaRepository implements AgendaRepository {
  constructor(private readonly db: NutriClinicaDB) {}

  async saveAppointment(appointment: Appointment): Promise<void> {
    const row = appointmentDomainToRow(appointment);
    const sucursalId = requireActiveSucursalId();
    if (row.office_id && !appointmentMatchesSucursal(row, sucursalId)) {
      throw new Error("APPOINTMENT_BRANCH_MISMATCH");
    }
    row.office_id = sucursalId;
    await this.db.appointments.put(row);
  }

  async findAppointmentById(id: AppointmentId): Promise<Appointment | null> {
    const row = await this.db.appointments.get(id);
    if (!row || !appointmentMatchesSucursal(row, requireActiveSucursalId())) return null;
    return appointmentRowToDomain(row);
  }

  async listAppointmentsByDate(date: string): Promise<Appointment[]> {
    const rows = await this.db.appointments
      .where("date")
      .equals(date)
      .toArray();
    const sucursalId = requireActiveSucursalId();
    return rows
      .filter((row) => appointmentMatchesSucursal(row, sucursalId))
      .map(appointmentRowToDomain);
  }

  async listAppointmentsByRange(startDate: string, endDate: string): Promise<Appointment[]> {
    const rows = await this.db.appointments
      .where("date")
      .between(startDate, endDate, true, true)
      .toArray();
    const sucursalId = requireActiveSucursalId();
    return rows
      .filter((row) => appointmentMatchesSucursal(row, sucursalId))
      .map(appointmentRowToDomain);
  }

  async listAppointmentsByPatient(patientId: string): Promise<Appointment[]> {
    const rows = await this.db.appointments
      .where("patient_id")
      .equals(patientId)
      .toArray();
    const sucursalId = requireActiveSucursalId();
    return rows
      .filter((row) => appointmentMatchesSucursal(row, sucursalId))
      .map(appointmentRowToDomain);
  }

  async listAppointmentsByStatus(status: AppointmentStatus): Promise<Appointment[]> {
    const rows = await this.db.appointments
      .where("status")
      .equals(status)
      .toArray();
    const sucursalId = requireActiveSucursalId();
    return rows
      .filter((row) => appointmentMatchesSucursal(row, sucursalId))
      .map(appointmentRowToDomain);
  }

  async deleteAppointment(id: AppointmentId): Promise<void> {
    const existing = await this.db.appointments.get(id);
    if (!existing || !appointmentMatchesSucursal(existing, requireActiveSucursalId())) {
      throw new AppointmentNotFoundError(id);
    }
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
      .belowOrEqual(endDate)
      .filter((row) => row.end_date >= startDate)
      .toArray();
    return rows.map(blockRowToDomain);
  }

  async deleteBlock(id: BlockId): Promise<void> {
    const existing = await this.db.blocks.get(id);
    if (!existing) throw new BlockNotFoundError(id);
    await this.db.blocks.delete(id);
  }
}
