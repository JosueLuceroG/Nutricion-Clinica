import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { db } from "@services/db/dexieSchema";
import { consultationService } from "./consultationService";
import { DexieConsultationRepository } from "@modules/consultation/infrastructure/DexieConsultationRepository";
import { ScheduleConsultationUseCase } from "@modules/consultation/application/consultationUseCases";
import { PatientId } from "@modules/patient/domain/PatientId";
import { useSyncStore } from "@store/syncStore";
import { markRemoteTransaction } from "@services/sync/atomicOutbox";

describe("consultationService.payment.registerMany", () => {
  beforeEach(async () => {
    useSyncStore.getState().setSucursalId("11111111-1111-4111-8111-111111111111");
    await db.transaction("rw", [db.consultations, db.meal_plans, db.adherence_records, db.sync_queue, db.audit_events], async () => {
      markRemoteTransaction();
      await db.consultations.clear();
      await db.meal_plans.clear();
      await db.adherence_records.clear();
      await db.audit_events.clear();
      await db.sync_queue.clear();
    });
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

  it("elimina primero planes y adherencia vinculados para no bloquear el tombstone de consulta", async () => {
    const repo = new DexieConsultationRepository(db);
    const schedule = new ScheduleConsultationUseCase(repo);
    const patientId = PatientId.generate();
    const consultation = await schedule.execute({
      patientId,
      consultationDate: new Date(),
      consultationNumber: 1,
      reason: "Control",
      cost: 100,
    });
    const consultationId = consultation.id.toString();
    const planId = crypto.randomUUID();
    const adherenceId = crypto.randomUUID();

    await db.transaction(
      "rw",
      [db.consultations, db.meal_plans, db.adherence_records, db.sync_queue],
      async () => {
        markRemoteTransaction();
        const row = await db.consultations.get(consultationId);
        await db.consultations.put({
          ...row,
          _syncHead: undefined,
          row_version: "AAAAAAAAAAE=",
        } as never);
        await db.meal_plans.put({
          id: planId,
          sucursal_id: "11111111-1111-4111-8111-111111111111",
          patient_id: patientId.toString(),
          consultation_id: consultationId,
          deleted_at: null,
          row_version: "AAAAAAAAAAE=",
          updated_at: new Date().toISOString(),
        } as never);
        await db.adherence_records.put({
          id: adherenceId,
          sucursal_id: "11111111-1111-4111-8111-111111111111",
          patient_id: patientId.toString(),
          consultation_id: consultationId,
          deleted_at: null,
          row_version: "AAAAAAAAAAE=",
          date: "2026-09-12",
          source: "manual",
          created_at: Date.now(),
          updated_at: Date.now(),
        } as never);
        await db.sync_queue.clear();
      },
    );

    await consultationService.delete.execute(consultation.id, true);

    expect(await db.consultations.get(consultationId)).toMatchObject({ deleted_at: expect.any(String) });
    expect(await db.meal_plans.get(planId)).toMatchObject({ deleted_at: expect.any(String) });
    expect(await db.adherence_records.get(adherenceId)).toMatchObject({ deleted_at: expect.any(String) });
    expect((await db.sync_queue.toArray()).map(({ entity, op }) => ({ entity, op })))
      .toEqual(expect.arrayContaining([
        { entity: "consultas", op: "delete" },
        { entity: "planes_alimenticios", op: "delete" },
        { entity: "adherence_records", op: "delete" },
      ]));
  });
});
