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

  /* ------------------------- pagos (Sprint 14D) ------------------------- */

  it("create: por defecto cost=0, paid=false, paymentMethod=null, paidAt=null", () => {
    const c = build();
    expect(c.cost).toBe(0);
    expect(c.paid).toBe(false);
    expect(c.paymentMethod).toBeNull();
    expect(c.paidAt).toBeNull();
    expect(c.reference).toBeNull();
    expect(c.invoiceNumber).toBeNull();
    expect(c.billingNotes).toBeNull();
    expect(c.isPaid).toBe(false);
    expect(c.isPendingPayment).toBe(false);
  });

  it("create: acepta cost positivo explícito", () => {
    const c = build({ cost: 850 });
    expect(c.cost).toBe(850);
    expect(c.isPendingPayment).toBe(true);
  });

  it("create: rechaza cost negativo", () => {
    expect(() => build({ cost: -1 })).toThrow(/>= 0/);
  });

  it("create: rechaza cost NaN/Infinity", () => {
    expect(() => build({ cost: NaN })).toThrow();
    expect(() => build({ cost: Infinity })).toThrow();
  });

  it("withPayment: paid=true exige paymentMethod y paidAt", () => {
    const c = build({ cost: 1000 });
    expect(() => c.withPayment({ paid: true })).toThrow(/método de pago/);
    expect(() =>
      c.withPayment({ paid: true, paymentMethod: "cash" }),
    ).toThrow(/fecha de pago/);
  });

  it("withPayment: marca como pagada con método y referencia", () => {
    const c = build({ cost: 1200 });
    const paid = c.withPayment({
      paid: true,
      paymentMethod: "transfer",
      paidAt: new Date("2024-06-15T11:30:00Z"),
      reference: "TRF-001",
    });
    expect(paid.paid).toBe(true);
    expect(paid.paymentMethod).toBe("transfer");
    expect(paid.paidAt?.toISOString()).toBe("2024-06-15T11:30:00.000Z");
    expect(paid.reference).toBe("TRF-001");
    expect(paid.isPaid).toBe(true);
    expect(paid.isPendingPayment).toBe(false);
  });

  it("withPayment: paid=false limpia método/referencia/fecha", () => {
    const c = build({ cost: 1200 });
    const paid = c.withPayment({
      paid: true,
      paymentMethod: "cash",
      paidAt: new Date(),
      reference: "X",
    });
    expect(paid.paid).toBe(true);

    const unpaid = paid.withPayment({ paid: false });
    expect(unpaid.paid).toBe(false);
    expect(unpaid.paymentMethod).toBeNull();
    expect(unpaid.paidAt).toBeNull();
    expect(unpaid.reference).toBeNull();
    expect(unpaid.invoiceNumber).toBeNull();
  });

  it("withPayment: re-registrar pago cambia método y referencia", () => {
    const c = build({ cost: 500 });
    const first = c.withPayment({
      paid: true,
      paymentMethod: "cash",
      paidAt: new Date(),
      reference: "CAJA-1",
    });
    const second = first.withPayment({
      paid: true,
      paymentMethod: "card",
      paidAt: new Date(),
      reference: "AUTH-99",
    });
    expect(second.paymentMethod).toBe("card");
    expect(second.reference).toBe("AUTH-99");
  });

  it("withPayment: trimea y limita referencia a 120 chars", () => {
    const c = build({ cost: 100 });
    const paid = c.withPayment({
      paid: true,
      paymentMethod: "cash",
      paidAt: new Date(),
      reference: "  " + "x".repeat(200) + "  ",
    });
    expect(paid.reference?.length).toBe(120);
  });

  it("withPayment: billingNotes se trimea y limita a 500 chars", () => {
    const c = build();
    const updated = c.withPayment({
      paid: false,
      billingNotes: "   " + "y".repeat(600) + "   ",
    });
    expect(updated.billingNotes?.length).toBe(500);
  });

  it("withPayment: rechaza cost negativo en update", () => {
    const c = build({ cost: 100 });
    expect(() => c.withPayment({ paid: false, cost: -1 })).toThrow(/>= 0/);
  });

  it("withPayment: lanza error si la consulta está eliminada", () => {
    const c = build();
    const deleted = c.softDelete();
    expect(() =>
      deleted.withPayment({ paid: true, paymentMethod: "cash", paidAt: new Date() }),
    ).toThrow(/eliminada/);
  });

  it("withPayment: actualiza updatedAt", async () => {
    const c = build();
    const originalUpdated = c.updatedAt;
    await new Promise((r) => setTimeout(r, 5));
    const paid = c.withPayment({
      paid: true,
      paymentMethod: "cash",
      paidAt: new Date(),
    });
    expect(paid.updatedAt.getTime()).toBeGreaterThan(originalUpdated.getTime());
  });

  it("reconstitute preserva campos de pago", () => {
    const c = build({ cost: 1500 });
    const paid = c.withPayment({
      paid: true,
      paymentMethod: "other",
      paidAt: new Date("2024-06-15T10:00:00Z"),
      reference: "OTRO-1",
      invoiceNumber: "INV-99",
      billingNotes: "nota",
    });
    const r = Consultation.reconstitute(paid.toProps());
    expect(r.cost).toBe(1500);
    expect(r.paid).toBe(true);
    expect(r.paymentMethod).toBe("other");
    expect(r.paidAt?.toISOString()).toBe("2024-06-15T10:00:00.000Z");
    expect(r.reference).toBe("OTRO-1");
    expect(r.invoiceNumber).toBe("INV-99");
    expect(r.billingNotes).toBe("nota");
  });
});
