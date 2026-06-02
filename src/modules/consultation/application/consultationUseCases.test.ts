import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import {
  ScheduleConsultationUseCase,
  TransitionConsultationStatusUseCase,
  UpdateConsultationNotesUseCase,
  GetConsultationUseCase,
  ListConsultationsUseCase,
  DeleteConsultationUseCase,
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
});
