import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import {
  CreateMealPlanUseCase,
  UpdateMealPlanMealsUseCase,
  UpdateMealPlanNotesUseCase,
  TransitionMealPlanStatusUseCase,
  GetMealPlanUseCase,
  ListMealPlansUseCase,
  DeleteMealPlanUseCase,
} from "./mealPlanUseCases";
import { DexieMealPlanRepository } from "../infrastructure/DexieMealPlanRepository";
import { DexieConsultationRepository } from "@modules/consultation/infrastructure/DexieConsultationRepository";
import { ScheduleConsultationUseCase, TransitionConsultationStatusUseCase } from "@modules/consultation/application/consultationUseCases";
import { NutriClinicaDB } from "@services/db/dexieSchema";
import { ConsultationId } from "@modules/consultation/domain/ConsultationId";
import { MealPlanId } from "../domain/MealPlanId";
import { MealPlanNotFoundError, MealPlanRequiresConsultationError } from "../domain/MealPlanRepository";
import { PatientId } from "@modules/patient/domain/PatientId";
import { MEAL_SLOT_ORDER } from "../domain/MealSlot";

describe("mealPlanUseCases", () => {
  let repo: DexieMealPlanRepository;
  let db: NutriClinicaDB;
  let create: CreateMealPlanUseCase;
  let updateMeals: UpdateMealPlanMealsUseCase;
  let updateNotes: UpdateMealPlanNotesUseCase;
  let transition: TransitionMealPlanStatusUseCase;
  let get: GetMealPlanUseCase;
  let list: ListMealPlansUseCase;
  let del: DeleteMealPlanUseCase;
  let scheduleConsultation: ScheduleConsultationUseCase;
  let transitionConsultation: TransitionConsultationStatusUseCase;
  const pid = PatientId.generate();

  beforeEach(async () => {
    db = new NutriClinicaDB(`test-mp-uc-${Math.random().toString(36).slice(2)}`);
    await db.open();
    repo = new DexieMealPlanRepository(db);
    const consultationRepo = new DexieConsultationRepository(db);
    create = new CreateMealPlanUseCase(repo, consultationRepo);
    updateMeals = new UpdateMealPlanMealsUseCase(repo);
    updateNotes = new UpdateMealPlanNotesUseCase(repo);
    transition = new TransitionMealPlanStatusUseCase(repo);
    get = new GetMealPlanUseCase(repo);
    list = new ListMealPlansUseCase(repo);
    del = new DeleteMealPlanUseCase(repo);
    scheduleConsultation = new ScheduleConsultationUseCase(consultationRepo);
    transitionConsultation = new TransitionConsultationStatusUseCase(consultationRepo);
  });

  const scheduleActiveConsultation = async () => {
    const c = await scheduleConsultation.execute({
      patientId: pid,
      consultationDate: new Date(),
      consultationNumber: 1,
      reason: "Control",
    });
    await transitionConsultation.execute(c.id, "in-progress");
    return c;
  };

  const baseInput = (consultationId: ConsultationId) => ({
    patientId: pid,
    consultationId,
    name: "Plan hipocalórico",
    startDate: new Date(),
    kcalTarget: 1500,
    proteinTargetG: 80,
    carbsTargetG: 180,
    fatTargetG: 50,
    meals: MEAL_SLOT_ORDER.map((slot) => ({ slot, exchanges: [] })),
  });

  it("Create rechaza plan sin consultationId (RN-PLA-01)", async () => {
    await expect(create.execute({ ...baseInput(ConsultationId.generate()), consultationId: undefined }))
      .rejects.toBeInstanceOf(MealPlanRequiresConsultationError);
  });

  it("Create rechaza plan con consultationId inexistente (RN-PLA-01)", async () => {
    await expect(create.execute(baseInput(ConsultationId.generate())))
      .rejects.toBeInstanceOf(MealPlanRequiresConsultationError);
  });

  it("Create rechaza plan con consultationId completada (RN-PLA-01)", async () => {
    const c = await scheduleActiveConsultation();
    await transitionConsultation.execute(c.id, "completed");
    await expect(create.execute(baseInput(c.id)))
      .rejects.toBeInstanceOf(MealPlanRequiresConsultationError);
  });

  it("Create persiste y recupera con 5 tiempos vacíos", async () => {
    const c = await scheduleActiveConsultation();
    const p = await create.execute(baseInput(c.id));
    const found = await get.execute(p.id);
    expect(found.name).toBe("Plan hipocalórico");
    expect(found.meals).toHaveLength(5);
    expect(found.status).toBe("draft");
  });

  it("UpdateMeals modifica intercambios", async () => {
    const c = await scheduleActiveConsultation();
    const p = await create.execute(baseInput(c.id));
    const newMeals = MEAL_SLOT_ORDER.map((slot, i) => ({
      slot,
      exchanges: i === 0 ? [{ foodId: "fruta-manzana", count: 1 }] : [],
    }));
    const updated = await updateMeals.execute(p.id, newMeals);
    expect(updated.getMeal("breakfast")?.exchanges).toHaveLength(1);
  });

  it("UpdateNotes modifica notas", async () => {
    const c = await scheduleActiveConsultation();
    const p = await create.execute(baseInput(c.id));
    const updated = await updateNotes.execute(p.id, "Tomar 2 L de agua al día");
    expect(updated.notes).toBe("Tomar 2 L de agua al día");
  });

  it("Transition draft → active → completed", async () => {
    const c = await scheduleActiveConsultation();
    const p = await create.execute(baseInput(c.id));
    const active = await transition.execute(p.id, "active");
    expect(active.isActive).toBe(true);
    const completed = await transition.execute(p.id, "completed");
    expect(completed.isCompleted).toBe(true);
  });

  it("Transition rechaza inválida", async () => {
    const c = await scheduleActiveConsultation();
    const p = await create.execute(baseInput(c.id));
    await expect(transition.execute(p.id, "completed")).rejects.toThrow();
  });

  it("Update sobre plan completado lanza error", async () => {
    const c = await scheduleActiveConsultation();
    const p = await create.execute(baseInput(c.id));
    await transition.execute(p.id, "active");
    await transition.execute(p.id, "completed");
    await expect(updateMeals.execute(p.id, [])).rejects.toThrow();
  });

  it("Get lanza MealPlanNotFoundError si no existe", async () => {
    await expect(get.execute(MealPlanId.generate())).rejects.toBeInstanceOf(MealPlanNotFoundError);
  });

  it("List filtra por paciente y devuelve total", async () => {
    const c = await scheduleActiveConsultation();
    const other = PatientId.generate();
    await create.execute(baseInput(c.id));
    await create.execute({ ...baseInput(c.id), name: "Plan B" });
    await create.execute({ ...baseInput(c.id), patientId: other });

    const result = await list.execute({ patientId: pid });
    expect(result.items).toHaveLength(2);
    expect(result.total).toBe(2);
  });

  it("Delete soft remueve de listados", async () => {
    const c = await scheduleActiveConsultation();
    const p = await create.execute(baseInput(c.id));
    await del.execute(p.id, true);
    const result = await list.execute({ patientId: pid });
    expect(result.items).toHaveLength(0);
  });
});
