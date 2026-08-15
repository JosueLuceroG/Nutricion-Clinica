import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { db } from "@services/db/dexieSchema";
import { consultationService } from "./consultationService";
import { DexieConsultationRepository } from "@modules/consultation/infrastructure/DexieConsultationRepository";
import { ScheduleConsultationUseCase } from "@modules/consultation/application/consultationUseCases";
import { PatientId } from "@modules/patient/domain/PatientId";

describe("consultationService.payment.registerMany", () => {
  beforeEach(async () => {
    await db.consultations.clear();
    await db.audit_events.clear();
  });

  it("paga todo el lote en una sola transacción", async () => {
    const repo = new DexieConsultationRepository(db);
    const schedule = new ScheduleConsultationUseCase(repo);
    const pid = PatientId.generate();
    const c1 = await schedule.execute({
      patientId: pid,
      consultationDate: new Date(),
      consultationNumber: 1,
      reason: "Control A",
      cost: 100,
    });
    const c2 = await schedule.execute({
      patientId: pid,
      consultationDate: new Date(),
      consultationNumber: 2,
      reason: "Control B",
      cost: 200,
    });

    const results = await consultationService.payment.registerMany([
      {
        id: c1.id,
        input: {
          paid: true,
          paymentStatus: "paid",
          paymentMethod: "cash",
          paidAt: new Date(),
        },
      },
      {
        id: c2.id,
        input: {
          paid: true,
          paymentStatus: "paid",
          paymentMethod: "cash",
          paidAt: new Date(),
        },
      },
    ]);

    expect(results).toHaveLength(2);
    const rows = await db.consultations.toArray();
    expect(rows.every((r) => r.paid)).toBe(true);
  });

  it("revierte TODO el lote si un item falla (rollback de transacción)", async () => {
    const repo = new DexieConsultationRepository(db);
    const schedule = new ScheduleConsultationUseCase(repo);
    const pid = PatientId.generate();
    const c1 = await schedule.execute({
      patientId: pid,
      consultationDate: new Date(),
      consultationNumber: 1,
      reason: "Control A",
      cost: 100,
    });
    const c2 = await schedule.execute({
      patientId: pid,
      consultationDate: new Date(),
      consultationNumber: 2,
      reason: "Control B",
      cost: 200,
    });

    // El segundo item es inválido (paid=true sin método de pago): la
    // transacción Dexie debe abortar y c1 no debe quedar pagado.
    await expect(
      consultationService.payment.registerMany([
        {
          id: c1.id,
          input: {
            paid: true,
            paymentStatus: "paid",
            paymentMethod: "cash",
            paidAt: new Date(),
          },
        },
        { id: c2.id, input: { paid: true } },
      ]),
    ).rejects.toThrow(/método de pago/);

    const rows = await db.consultations.toArray();
    expect(rows.every((r) => !r.paid)).toBe(true);
  });

  it("doble invocación concurrente reutiliza la misma ejecución (idempotente)", async () => {
    const repo = new DexieConsultationRepository(db);
    const schedule = new ScheduleConsultationUseCase(repo);
    const pid = PatientId.generate();
    const c1 = await schedule.execute({
      patientId: pid,
      consultationDate: new Date(),
      consultationNumber: 1,
      reason: "Control A",
      cost: 100,
    });
    const input = {
      paid: true,
      paymentStatus: "paid" as const,
      paymentMethod: "cash" as const,
      paidAt: new Date(),
    };

    const entries = [{ id: c1.id, input }];
    const p1 = consultationService.payment.registerMany(entries);
    const p2 = consultationService.payment.registerMany(entries);
    expect(p1).toBe(p2);
    await Promise.all([p1, p2]);

    const rows = await db.consultations.toArray();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.paid).toBe(true);
  });
});