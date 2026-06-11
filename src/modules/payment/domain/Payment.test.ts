import { describe, it, expect } from "vitest";
import { Payment } from "./Payment";
import { PaymentId } from "./PaymentId";

describe("PaymentId", () => {
  it("generates a unique id", () => {
    const a = PaymentId.generate();
    const b = PaymentId.generate();
    expect(a.value).not.toBe(b.value);
  });

  it("fromUnsafe returns the same value", () => {
    const id = PaymentId.fromUnsafe("pay-123");
    expect(id.toString()).toBe("pay-123");
  });

  it("equals compares by value", () => {
    const a = PaymentId.fromUnsafe("x");
    const b = PaymentId.fromUnsafe("x");
    const c = PaymentId.fromUnsafe("y");
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });
});

describe("Payment", () => {
  const validInput = {
    pacienteId: "pat-1",
    amount: 500,
  };

  it("creates a payment with valid input", () => {
    const p = Payment.create(validInput);
    expect(p.id).toBeInstanceOf(PaymentId);
    expect(p.pacienteId).toBe("pat-1");
    expect(p.amount).toBe(500);
    expect(p.currency).toBe("MXN");
    expect(p.concept).toBe("consulta");
    expect(p.status).toBe("pending");
    expect(p.method).toBeNull();
    expect(p.consultationId).toBeNull();
    expect(p.deletedAt).toBeNull();
  });

  it("rejects negative amount", () => {
    expect(() => Payment.create({ ...validInput, amount: -1 })).toThrow(">= 0");
  });

  it("rejects non-finite amount", () => {
    expect(() => Payment.create({ ...validInput, amount: NaN })).toThrow(">= 0");
  });

  it("accepts full optional fields", () => {
    const p = Payment.create({
      ...validInput,
      consultationId: "cons-1",
      concept: "plan",
      method: "cash",
      status: "paid",
      paidAt: new Date("2026-06-01"),
      reference: "REF-001",
      notes: "Pago en efectivo",
    });
    expect(p.consultationId).toBe("cons-1");
    expect(p.concept).toBe("plan");
    expect(p.method).toBe("cash");
    expect(p.status).toBe("paid");
    expect(p.reference).toBe("REF-001");
  });

  it("reconstitutes from props", () => {
    const original = Payment.create(validInput);
    const props = original.toProps();
    const restored = Payment.reconstitute(props);
    expect(restored.id.equals(original.id)).toBe(true);
    expect(restored.amount).toBe(original.amount);
    expect(restored.status).toBe(original.status);
  });

  describe("withStatus", () => {
    it("updates status", () => {
      const p = Payment.create(validInput);
      const paid = p.withStatus("paid");
      expect(paid.status).toBe("paid");
      expect(paid.amount).toBe(500);
    });

    it("throws on deleted payment", () => {
      const p = Payment.create(validInput).softDelete();
      expect(() => p.withStatus("paid")).toThrow("eliminado");
    });
  });

  describe("withDetails", () => {
    it("updates method, reference, notes", () => {
      const p = Payment.create(validInput);
      const updated = p.withDetails({ method: "card", reference: "TXN-001", notes: "Pago con tarjeta" });
      expect(updated.method).toBe("card");
      expect(updated.reference).toBe("TXN-001");
      expect(updated.notes).toBe("Pago con tarjeta");
    });

    it("throws on deleted payment", () => {
      const p = Payment.create(validInput).softDelete();
      expect(() => p.withDetails({ method: "cash" })).toThrow("eliminado");
    });
  });

  describe("softDelete", () => {
    it("marks as deleted", () => {
      const p = Payment.create(validInput);
      const deleted = p.softDelete(new Date("2026-07-01"));
      expect(deleted.deletedAt).toBeInstanceOf(Date);
    });

    it("idempotent when already deleted", () => {
      const p = Payment.create(validInput).softDelete();
      const again = p.softDelete();
      expect(again.deletedAt).toEqual(p.deletedAt);
    });
  });
});
