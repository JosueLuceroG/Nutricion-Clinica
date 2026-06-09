import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { DexieAgendaRepository } from "../infrastructure/DexieAgendaRepository";
import { NutriClinicaDB } from "@services/db/dexieSchema";
import { createAppointmentUC, listAppointmentsByDateUC, cancelAppointmentUC } from "./agendaUseCases";
import { createAppointmentId } from "../domain";
import type { NewAppointmentFormInput } from "./agendaFormSchema";

describe("agendaUseCases", () => {
  let repo: DexieAgendaRepository;
  let db: NutriClinicaDB;
  const professionalId = crypto.randomUUID();
  const patientId = crypto.randomUUID();

  const baseInput: NewAppointmentFormInput = {
    patientId,
    date: "2026-06-08",
    startTime: "09:00",
    endTime: "09:30",
    type: "control",
    reason: "Control mensual",
    notes: "",
    cost: 0,
  };

  beforeEach(async () => {
    db = new NutriClinicaDB(`test-ag-uc-${Math.random().toString(36).slice(2)}`);
    await db.open();
    repo = new DexieAgendaRepository(db);
  });

  it("createAppointmentUC crea con status scheduled y type correcto", async () => {
    const appointment = await createAppointmentUC(repo, baseInput, professionalId);

    expect(appointment.status).toBe("scheduled");
    expect(appointment.type).toBe("control");
    expect(appointment.date).toBe("2026-06-08");
    expect(appointment.professionalId).toBe(professionalId);
    expect(appointment.patientId).toBe(patientId);

    const found = await repo.findAppointmentById(appointment.id);
    expect(found).not.toBeNull();
  });

  it("listAppointmentsByDateUC filtra por fecha correctamente", async () => {
    await createAppointmentUC(repo, baseInput, professionalId);
    await createAppointmentUC(repo, { ...baseInput, startTime: "10:00", endTime: "10:30" }, professionalId);
    await createAppointmentUC(repo, { ...baseInput, date: "2026-06-09", startTime: "09:00", endTime: "09:30" }, professionalId);

    const results = await listAppointmentsByDateUC(repo, "2026-06-08");
    expect(results).toHaveLength(2);
  });

  it("listAppointmentsByDateUC retorna vacío si no hay citas", async () => {
    const results = await listAppointmentsByDateUC(repo, "2026-06-08");
    expect(results).toHaveLength(0);
  });

  it("cancelAppointmentUC cambia el status a cancelled", async () => {
    const appointment = await createAppointmentUC(repo, baseInput, professionalId);

    const cancelled = await cancelAppointmentUC(repo, appointment.id, "Paciente canceló");

    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.cancelledReason).toBe("Paciente canceló");

    const found = await repo.findAppointmentById(appointment.id);
    expect(found?.status).toBe("cancelled");
    expect(found?.cancelledReason).toBe("Paciente canceló");
  });

  it("cancelAppointmentUC lanza si no se proporciona motivo", async () => {
    const appointment = await createAppointmentUC(repo, baseInput, professionalId);

    await expect(cancelAppointmentUC(repo, appointment.id, "")).rejects.toThrow();
  });

  it("cancelAppointmentUC lanza si la cita no existe", async () => {
    await expect(cancelAppointmentUC(repo, createAppointmentId(), "Motivo")).rejects.toThrow();
  });
});
