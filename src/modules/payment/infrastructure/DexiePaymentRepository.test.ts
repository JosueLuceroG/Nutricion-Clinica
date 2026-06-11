import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { DexiePaymentRepository } from "./DexiePaymentRepository";
import { NutriClinicaDB } from "@services/db/dexieSchema";
import { Payment } from "../domain/Payment";
import { PaymentId } from "../domain/PaymentId";
import type { PaymentStatus } from "@modules/consultation/domain/PaymentStatus";

const makePayment = (overrides: Partial<{
  pacienteId: string;
  amount: number;
  status: PaymentStatus;
}> = {}) => {
  return Payment.create({
    pacienteId: overrides.pacienteId ?? "pat-1",
    amount: overrides.amount ?? 500,
    status: overrides.status,
  });
};

describe("DexiePaymentRepository", () => {
  let repo: DexiePaymentRepository;
  let db: NutriClinicaDB;

  beforeEach(async () => {
    db = new NutriClinicaDB(`test-${Math.random().toString(36).slice(2)}`);
    await db.delete();
    db = new NutriClinicaDB(`test-${Math.random().toString(36).slice(2)}`);
    await db.open();
    repo = new DexiePaymentRepository(db);
  });

  it("guarda y recupera un pago por id", async () => {
    const p = makePayment();
    await repo.save(p);

    const found = await repo.findById(p.id);
    expect(found).not.toBeNull();
    expect(found?.amount).toBe(500);
    expect(found?.pacienteId).toBe("pat-1");
    expect(found?.id.equals(p.id)).toBe(true);
  });

  it("retorna null cuando el pago no existe", async () => {
    const found = await repo.findById(PaymentId.generate());
    expect(found).toBeNull();
  });

  it("findAll retorna todos los pagos", async () => {
    await repo.save(makePayment({ pacienteId: "pat-1" }));
    await repo.save(makePayment({ pacienteId: "pat-2" }));
    await repo.save(makePayment({ pacienteId: "pat-3" }));

    const all = await repo.findAll();
    expect(all).toHaveLength(3);
  });

  it("filtra por status", async () => {
    await repo.save(makePayment({ status: "pending" }));
    await repo.save(makePayment({ status: "paid" }));
    await repo.save(makePayment({ status: "cancelled" }));

    const results = await repo.findAll({ status: "paid" });
    expect(results).toHaveLength(1);
    expect(results[0]?.status).toBe("paid");
  });

  it("filtra por rango de fechas", async () => {
    const p1 = Payment.create({ pacienteId: "pat-1", amount: 100 });
    const p2 = Payment.create({ pacienteId: "pat-1", amount: 200, status: "paid", paidAt: new Date("2026-07-15") });
    const p3 = Payment.create({ pacienteId: "pat-1", amount: 300, status: "paid", paidAt: new Date("2026-08-20") });
    await repo.save(p1);
    await repo.save(p2);
    await repo.save(p3);

    const results = await repo.findAll({
      from: new Date("2026-07-01"),
      to: new Date("2026-08-01"),
    });
    expect(results).toHaveLength(1);
  });

  it("pagina resultados (limit/offset)", async () => {
    for (let i = 0; i < 10; i++) {
      await repo.save(makePayment({ pacienteId: "pat-1", amount: 100 + i }));
    }

    const first = await repo.findAll({ limit: 3, offset: 0 });
    const second = await repo.findAll({ limit: 3, offset: 3 });
    expect(first).toHaveLength(3);
    expect(second).toHaveLength(3);
    expect(first[0]?.id.equals(second[0]?.id ?? PaymentId.generate())).toBe(false);
  });

  it("count retorna el número total de pagos", async () => {
    await repo.save(makePayment());
    await repo.save(makePayment());
    expect(await repo.count()).toBe(2);
  });

  it("soft delete marca deletedAt", async () => {
    const p = makePayment();
    await repo.save(p);
    await repo.delete(p.id, true);

    const found = await repo.findById(p.id);
    expect(found).not.toBeNull();
    expect(found?.deletedAt).not.toBeNull();
  });

  it("hard delete elimina definitivamente", async () => {
    const p = makePayment();
    await repo.save(p);
    await repo.delete(p.id, false);

    const found = await repo.findById(p.id);
    expect(found).toBeNull();
  });
});
