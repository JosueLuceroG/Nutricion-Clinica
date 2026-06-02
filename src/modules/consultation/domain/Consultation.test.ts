import { describe, it, expect } from "vitest";
import { Consultation } from "./Consultation";
import { ConsultationId } from "./ConsultationId";
import { PatientId } from "@modules/patient/domain/PatientId";
import { AnthropometryId } from "@modules/anthropometry/domain/AnthropometryId";
import { LabPanelId } from "@modules/laboratory/domain/LabPanelId";

const pid = PatientId.generate();

const build = (overrides: Partial<Parameters<typeof Consultation.create>[0]> = {}) =>
  Consultation.create({
    patientId: pid,
    consultationDate: new Date("2024-06-15T10:00:00Z"),
    consultationNumber: 1,
    reason: "Control de peso trimestral",
    ...overrides,
  });

describe("Consultation entity", () => {
  it("crea consulta con valores por defecto (status=scheduled)", () => {
    const c = build();
    expect(c.status).toBe("scheduled");
    expect(c.consultationNumber).toBe(1);
    expect(c.isActive).toBe(true);
    expect(c.isCompleted).toBe(false);
  });

  it("trimea strings y normaliza vacíos a null", () => {
    const c = build({
      reason: "  Control  ",
      subjective: "   ",
      objective: "  PA 120/80  ",
    });
    expect(c.reason).toBe("Control");
    expect(c.subjective).toBeNull();
    expect(c.objective).toBe("PA 120/80");
  });

  it("rechaza motivo con menos de 3 caracteres", () => {
    expect(() => build({ reason: "ab" })).toThrow();
  });

  it("rechaza motivo con más de 500 caracteres", () => {
    expect(() => build({ reason: "x".repeat(501) })).toThrow();
  });

  it("rechaza fecha inválida", () => {
    expect(() =>
      build({ consultationDate: new Date("not-a-date") }),
    ).toThrow();
  });

  it("rechaza fecha más de 1 día en el futuro", () => {
    const future = new Date();
    future.setDate(future.getDate() + 5);
    expect(() => build({ consultationDate: future })).toThrow();
  });

  it("rechaza número de consulta no positivo", () => {
    expect(() => build({ consultationNumber: 0 })).toThrow();
    expect(() => build({ consultationNumber: -1 })).toThrow();
    expect(() => build({ consultationNumber: 1.5 })).toThrow();
  });

  it("withStatus transiciona estados válidos", () => {
    const c = build();
    const inProgress = c.withStatus("in-progress");
    expect(inProgress.status).toBe("in-progress");
    const completed = inProgress.withStatus("completed");
    expect(completed.isCompleted).toBe(true);
  });

  it("withStatus lanza error al transicionar desde completed", () => {
    const c = build();
    const completed = c.withStatus("in-progress").withStatus("completed");
    expect(() => completed.withStatus("scheduled")).toThrow();
  });

  it("withStatus sin cambio retorna la misma instancia", () => {
    const c = build();
    const same = c.withStatus("scheduled");
    expect(same).toBe(c);
  });

  it("withNotes actualiza campos sin tocar otros", () => {
    const c = build({ assessment: "Inicial" });
    const updated = c.withNotes({ assessment: "Actualizado", plan: "Plan X" });
    expect(updated.assessment).toBe("Actualizado");
    expect(updated.plan).toBe("Plan X");
    expect(updated.reason).toBe(c.reason);
  });

  it("withNotes lanza error si la consulta está completada", () => {
    const c = build();
    const completed = c.withStatus("in-progress").withStatus("completed");
    expect(() => completed.withNotes({ plan: "nuevo" })).toThrow();
  });

  it("softDelete marca deletedAt", () => {
    const c = build();
    const deleted = c.softDelete();
    expect(deleted.deletedAt).not.toBeNull();
  });

  it("softDelete idempotente", () => {
    const c = build();
    const first = c.softDelete();
    const second = first.softDelete();
    expect(second.deletedAt?.getTime()).toBe(first.deletedAt?.getTime());
  });

  it("reconstitute preserva todos los campos", () => {
    const anthroId = AnthropometryId.generate();
    const labId = LabPanelId.generate();
    const c = build({
      anthropometryId: anthroId,
      labPanelId: labId,
      nextVisitDate: new Date("2024-09-15"),
    });
    const props = c.toProps();
    const r = Consultation.reconstitute(props);
    expect(r.id.equals(c.id)).toBe(true);
    expect(r.anthropometryId?.equals(anthroId)).toBe(true);
    expect(r.labPanelId?.equals(labId)).toBe(true);
  });

  it("permite generar ID explícito", () => {
    const id = ConsultationId.generate();
    const c = build({ id });
    expect(c.id.equals(id)).toBe(true);
  });
});
