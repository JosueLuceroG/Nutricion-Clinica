import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { DexieAgendaRepository } from "./DexieAgendaRepository";
import { NutriClinicaDB } from "@services/db/dexieSchema";
import { Appointment } from "../domain/Appointment";
import { Schedule } from "../domain/Schedule";
import { Block } from "../domain/Block";
import { createAppointmentId, createScheduleId, createBlockId } from "../domain";
import { AppointmentNotFoundError, ScheduleNotFoundError, BlockNotFoundError } from "../domain/AgendaRepository";

const professionalId = crypto.randomUUID();
const patientId = crypto.randomUUID();

const makeAppointment = (overrides: Partial<{
  date: string;
  startTime: string;
  endTime: string;
  type: "primera_vez" | "seguimiento" | "urgencia" | "control" | "cierre";
  status: "scheduled" | "confirmed" | "in_progress" | "completed" | "cancelled" | "no_show" | "rescheduled";
  notes: string;
}> = {}) => {
  return Appointment.create({
    id: createAppointmentId(),
    patientId,
    professionalId,
    date: overrides.date ?? "2026-06-08",
    startTime: overrides.startTime ?? "09:00",
    endTime: overrides.endTime ?? "09:30",
    type: overrides.type ?? "control",
    status: overrides.status ?? "scheduled",
    reason: "Consulta de control",
    notes: overrides.notes ?? "",
    durationMin: 30,
  });
};

const makeSchedule = (overrides: Partial<{ dayOfWeek: number; startTime: string; endTime: string }> = {}) => {
  return Schedule.create({
    id: createScheduleId(),
    professionalId,
    dayOfWeek: overrides.dayOfWeek ?? 1,
    startTime: overrides.startTime ?? "08:00",
    endTime: overrides.endTime ?? "14:00",
  });
};

const makeBlock = (overrides: Partial<{ startDate: string; endDate: string; allDay: boolean }> = {}) => {
  return Block.create({
    id: createBlockId(),
    professionalId,
    startDate: overrides.startDate ?? "2026-06-08",
    endDate: overrides.endDate ?? "2026-06-10",
    allDay: overrides.allDay ?? true,
    reason: "Vacaciones",
  });
};

describe("DexieAgendaRepository", () => {
  let repo: DexieAgendaRepository;
  let db: NutriClinicaDB;

  beforeEach(async () => {
    db = new NutriClinicaDB(`test-${Math.random().toString(36).slice(2)}`);
    await db.delete();
    db = new NutriClinicaDB(`test-${Math.random().toString(36).slice(2)}`);
    await db.open();
    repo = new DexieAgendaRepository(db);
  });

  describe("Appointments", () => {
    it("guarda y recupera una cita por id", async () => {
      const a = makeAppointment();
      await repo.saveAppointment(a);

      const found = await repo.findAppointmentById(a.id);
      expect(found).not.toBeNull();
      expect(found?.date).toBe("2026-06-08");
      expect(found?.type).toBe("control");
      expect(found?.status).toBe("scheduled");
    });

    it("retorna null cuando la cita no existe", async () => {
      const found = await repo.findAppointmentById(createAppointmentId());
      expect(found).toBeNull();
    });

    it("listAppointmentsByDate filtra por fecha", async () => {
      const a1 = makeAppointment({ date: "2026-06-08", startTime: "09:00", endTime: "09:30" });
      const a2 = makeAppointment({ date: "2026-06-08", startTime: "10:00", endTime: "10:30" });
      const a3 = makeAppointment({ date: "2026-06-09", startTime: "09:00", endTime: "09:30" });
      await repo.saveAppointment(a1);
      await repo.saveAppointment(a2);
      await repo.saveAppointment(a3);

      const results = await repo.listAppointmentsByDate("2026-06-08");
      expect(results).toHaveLength(2);
    });

    it("listAppointmentsByPatient filtra por paciente", async () => {
      const a1 = makeAppointment();
      const otherPatient = crypto.randomUUID();
      const a2 = Appointment.create({
        id: createAppointmentId(),
        patientId: otherPatient,
        professionalId,
        date: "2026-06-08",
        startTime: "10:00",
        endTime: "10:30",
        type: "seguimiento",
        reason: "Otro paciente",
        notes: "",
        durationMin: 30,
      });
      await repo.saveAppointment(a1);
      await repo.saveAppointment(a2);

      const results = await repo.listAppointmentsByPatient(patientId);
      expect(results).toHaveLength(1);
    });

    it("listAppointmentsByRange devuelve citas en el rango", async () => {
      await repo.saveAppointment(makeAppointment({ date: "2026-06-08" }));
      await repo.saveAppointment(makeAppointment({ date: "2026-06-10" }));
      await repo.saveAppointment(makeAppointment({ date: "2026-06-15" }));

      const results = await repo.listAppointmentsByRange("2026-06-08", "2026-06-12");
      expect(results).toHaveLength(2);
    });

    it("listAppointmentsByStatus filtra por estado", async () => {
      await repo.saveAppointment(makeAppointment({ status: "scheduled" }));
      const cancelled = makeAppointment({ status: "cancelled" });
      await repo.saveAppointment(cancelled);

      const results = await repo.listAppointmentsByStatus("cancelled");
      expect(results).toHaveLength(1);
      expect(results[0]?.id).toBe(cancelled.id);
    });

    it("deleteAppointment elimina la cita", async () => {
      const a = makeAppointment();
      await repo.saveAppointment(a);
      await repo.deleteAppointment(a.id);

      const found = await repo.findAppointmentById(a.id);
      expect(found).toBeNull();
    });

    it("deleteAppointment lanza AppointmentNotFoundError si no existe", async () => {
      await expect(repo.deleteAppointment(createAppointmentId())).rejects.toBeInstanceOf(AppointmentNotFoundError);
    });
  });

  describe("Schedules", () => {
    it("guarda y recupera un horario por id", async () => {
      const s = makeSchedule();
      await repo.saveSchedule(s);

      const found = await repo.findScheduleById(s.id);
      expect(found).not.toBeNull();
      expect(found?.dayOfWeek).toBe(1);
      expect(found?.active).toBe(true);
    });

    it("retorna null cuando el horario no existe", async () => {
      const found = await repo.findScheduleById(createScheduleId());
      expect(found).toBeNull();
    });

    it("listSchedulesByProfessional filtra por profesional", async () => {
      const s1 = makeSchedule({ dayOfWeek: 1 });
      const s2 = makeSchedule({ dayOfWeek: 3 });
      const otherProfessional = crypto.randomUUID();
      const s3 = Schedule.create({
        id: createScheduleId(),
        professionalId: otherProfessional,
        dayOfWeek: 2,
        startTime: "09:00",
        endTime: "13:00",
      });
      await repo.saveSchedule(s1);
      await repo.saveSchedule(s2);
      await repo.saveSchedule(s3);

      const results = await repo.listSchedulesByProfessional(professionalId);
      expect(results).toHaveLength(2);
    });

    it("deleteSchedule lanza ScheduleNotFoundError si no existe", async () => {
      await expect(repo.deleteSchedule(createScheduleId())).rejects.toBeInstanceOf(ScheduleNotFoundError);
    });
  });

  describe("Blocks", () => {
    it("guarda y recupera un bloque por id", async () => {
      const b = makeBlock();
      await repo.saveBlock(b);

      const found = await repo.findBlockById(b.id);
      expect(found).not.toBeNull();
      expect(found?.allDay).toBe(true);
      expect(found?.reason).toBe("Vacaciones");
    });

    it("retorna null cuando el bloque no existe", async () => {
      const found = await repo.findBlockById(createBlockId());
      expect(found).toBeNull();
    });

    it("listBlocksByProfessional filtra por profesional", async () => {
      const b1 = makeBlock({ startDate: "2026-06-08", endDate: "2026-06-10" });
      const b2 = makeBlock({ startDate: "2026-07-01", endDate: "2026-07-05" });
      const otherProfessional = crypto.randomUUID();
      const b3 = Block.create({
        id: createBlockId(),
        professionalId: otherProfessional,
        startDate: "2026-06-15",
        endDate: "2026-06-20",
        allDay: true,
        reason: "Capacitación",
      });
      await repo.saveBlock(b1);
      await repo.saveBlock(b2);
      await repo.saveBlock(b3);

      const results = await repo.listBlocksByProfessional(professionalId);
      expect(results).toHaveLength(2);
    });

    it("listBlocksByRange devuelve bloques en el rango", async () => {
      await repo.saveBlock(makeBlock({ startDate: "2026-06-08", endDate: "2026-06-10" }));
      await repo.saveBlock(makeBlock({ startDate: "2026-06-20", endDate: "2026-06-25" }));

      const results = await repo.listBlocksByRange("2026-06-01", "2026-06-15");
      expect(results).toHaveLength(1);
    });

    it("deleteBlock lanza BlockNotFoundError si no existe", async () => {
      await expect(repo.deleteBlock(createBlockId())).rejects.toBeInstanceOf(BlockNotFoundError);
    });
  });
});
