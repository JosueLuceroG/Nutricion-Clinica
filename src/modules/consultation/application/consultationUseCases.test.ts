import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import {
  ScheduleConsultationUseCase,
  TransitionConsultationStatusUseCase,
  UpdateConsultationNotesUseCase,
  GetConsultationUseCase,
  ListConsultationsUseCase,
  DeleteConsultationUseCase,
  RegisterPaymentUseCase,
} from "./consultationUseCases";
import { DexieConsultationRepository } from "../infrastructure/DexieConsultationRepository";
import { NutriClinicaDB } from "@services/db/dexieSchema";
import { ConsultationId } from "../domain/ConsultationId";
import { ConsultationNotFoundError } from "../domain/ConsultationRepository";
import { PatientId } from "@modules/patient/domain/PatientId";

describe("consultationUseCases", () => {
  let repo: DexieConsultationRepository;
  let db: NutriClinicaDB;
  let schedule: ScheduleConsultationUseCase;
  let transition: TransitionConsultationStatusUseCase;
  let updateNotes: UpdateConsultationNotesUseCase;
  let get: GetConsultationUseCase;
  let list: ListConsultationsUseCase;
  let del: DeleteConsultationUseCase;
  let registerPayment: RegisterPaymentUseCase;
  const pid = PatientId.generate();

  beforeEach(async () => {
    db = new NutriClinicaDB(`test-consult-uc-${Math.random().toString(36).slice(2)}`);
    await db.open();
    repo = new DexieConsultationRepository(db);
    schedule = new ScheduleConsultationUseCase(repo);
    transition = new TransitionConsultationStatusUseCase(repo);
    updateNotes = new UpdateConsultationNotesUseCase(repo);
    get = new GetConsultationUseCase(repo);
    list = new ListConsultationsUseCase(repo);
    del = new DeleteConsultationUseCase(repo);
    registerPayment = new RegisterPaymentUseCase(repo);
  });

  it("Schedule asigna consultationNumber incremental y status=scheduled", async () => {
    const a = await schedule.execute({
      patientId: pid,
      consultationDate: new Date(),
      consultationNumber: 1,
      reason: "Primera consulta",
    });
    const b = await schedule.execute({
      patientId: pid,
      consultationDate: new Date(),
      consultationNumber: 2,
      reason: "Segunda consulta",
    });
    expect(a.consultationNumber).toBe(1);
    expect(b.consultationNumber).toBe(2);
    expect(a.status).toBe("scheduled");
    expect(b.status).toBe("scheduled");
  });

  it("Schedule incrementa el número correctamente tras soft-delete", async () => {
    const a = await schedule.execute({ patientId: pid, consultationDate: new Date(), consultationNumber: 1, reason: "Control" });
    await del.execute(a.id, true);
    const b = await schedule.execute({ patientId: pid, consultationDate: new Date(), consultationNumber: 2, reason: "Seguimiento" });
    expect(b.consultationNumber).toBe(1);
  });

  it("Transition avanza de scheduled → in-progress → completed", async () => {
    const c = await schedule.execute({ patientId: pid, consultationDate: new Date(), consultationNumber: 1, reason: "Control inicial" });
    const inProgress = await transition.execute(c.id, "in-progress");
    expect(inProgress.status).toBe("in-progress");
    const completed = await transition.execute(c.id, "completed");
    expect(completed.isCompleted).toBe(true);
  });

  it("Transition rechaza transiciones inválidas", async () => {
    const c = await schedule.execute({ patientId: pid, consultationDate: new Date(), consultationNumber: 1, reason: "Control inicial" });
    await expect(transition.execute(c.id, "completed")).rejects.toThrow();
  });

  it("Transition sobre id inexistente lanza ConsultationNotFoundError", async () => {
    await expect(transition.execute(ConsultationId.generate(), "in-progress")).rejects.toBeInstanceOf(ConsultationNotFoundError);
  });

  it("UpdateNotes modifica SOAP y conserva el resto", async () => {
    const c = await schedule.execute({ patientId: pid, consultationDate: new Date(), consultationNumber: 1, reason: "Control inicial" });
    const updated = await updateNotes.execute(c.id, {
      subjective: "Paciente refiere…",
      assessment: "Sobrepeso grado I",
      plan: "Dieta hipocalórica + actividad física",
    });
    expect(updated.subjective).toBe("Paciente refiere…");
    expect(updated.assessment).toBe("Sobrepeso grado I");
    expect(updated.plan).toBe("Dieta hipocalórica + actividad física");
    expect(updated.reason).toBe("Control inicial");
  });

  it("Get lanza ConsultationNotFoundError si no existe", async () => {
    await expect(get.execute(ConsultationId.generate())).rejects.toBeInstanceOf(ConsultationNotFoundError);
  });

  it("List filtra por paciente y devuelve total", async () => {
    const other = PatientId.generate();
    await schedule.execute({ patientId: pid, consultationDate: new Date(), consultationNumber: 1, reason: "Control peso" });
    await schedule.execute({ patientId: pid, consultationDate: new Date(), consultationNumber: 2, reason: "Seguimiento" });
    await schedule.execute({ patientId: other, consultationDate: new Date(), consultationNumber: 1, reason: "Otro paciente" });

    const result = await list.execute({ patientId: pid });
    expect(result.items).toHaveLength(2);
    expect(result.total).toBe(2);
  });

  /* ------------------------- RegisterPayment (Sprint 14D) ------------------------- */

  it("RegisterPayment: marca consulta como pagada con método y referencia", async () => {
    const c = await schedule.execute({ patientId: pid, consultationDate: new Date(), consultationNumber: 1, reason: "Control" });
    const paid = await registerPayment.execute(c.id, {
      cost: 1200,
      paid: true,
      paymentMethod: "cash",
      paidAt: new Date("2026-06-01T10:30:00Z"),
      reference: "CAJA-7",
    });
    expect(paid.paid).toBe(true);
    expect(paid.paymentMethod).toBe("cash");
    expect(paid.cost).toBe(1200);
    expect(paid.reference).toBe("CAJA-7");

    // Persistido
    const stored = await get.execute(c.id);
    expect(stored.paid).toBe(true);
    expect(stored.isPaid).toBe(true);
    expect(stored.isPendingPayment).toBe(false);
  });

  it("RegisterPayment: paid=false limpia método/referencia/fecha", async () => {
    const c = await schedule.execute({ patientId: pid, consultationDate: new Date(), consultationNumber: 1, reason: "Control" });
    await registerPayment.execute(c.id, {
      paid: true,
      paymentMethod: "transfer",
      paidAt: new Date(),
      reference: "X",
    });
    const unpaid = await registerPayment.execute(c.id, { paid: false });
    expect(unpaid.paid).toBe(false);
    expect(unpaid.paymentMethod).toBeNull();
    expect(unpaid.paidAt).toBeNull();
    expect(unpaid.reference).toBeNull();
  });

  it("RegisterPayment: paid=true sin paymentMethod lanza error de dominio", async () => {
    const c = await schedule.execute({ patientId: pid, consultationDate: new Date(), consultationNumber: 1, reason: "Control" });
    await expect(registerPayment.execute(c.id, { paid: true })).rejects.toThrow(/método de pago/);
  });

  it("RegisterPayment: paid=true sin paidAt lanza error de dominio", async () => {
    const c = await schedule.execute({ patientId: pid, consultationDate: new Date(), consultationNumber: 1, reason: "Control" });
    await expect(
      registerPayment.execute(c.id, { paid: true, paymentMethod: "cash" }),
    ).rejects.toThrow(/fecha de pago/);
  });

  it("RegisterPayment: id inexistente lanza ConsultationNotFoundError", async () => {
    await expect(
      registerPayment.execute(ConsultationId.generate(), { paid: true, paymentMethod: "cash", paidAt: new Date() }),
    ).rejects.toBeInstanceOf(ConsultationNotFoundError);
  });

  it("RegisterPayment: rechaza pago en consulta eliminada", async () => {
    const c = await schedule.execute({ patientId: pid, consultationDate: new Date(), consultationNumber: 1, reason: "Control" });
    await del.execute(c.id, true);
    await expect(
      registerPayment.execute(c.id, { paid: true, paymentMethod: "cash", paidAt: new Date() }),
    ).rejects.toThrow(/eliminada/);
  });

  it("RegisterPayment: puede actualizar solo el cost sin cambiar paid", async () => {
    const c = await schedule.execute({ patientId: pid, consultationDate: new Date(), consultationNumber: 1, reason: "Control" });
    const updated = await registerPayment.execute(c.id, { paid: false, cost: 1500 });
    expect(updated.cost).toBe(1500);
    expect(updated.paid).toBe(false);
    expect(updated.isPendingPayment).toBe(true);
  });
});
