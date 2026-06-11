import { describe, it, expect, beforeEach } from "vitest";
import { Payment } from "../domain/Payment";
import { PaymentId } from "../domain/PaymentId";
import type { PaymentRepository, PaymentQuery } from "../domain/PaymentRepository";
import {
  CreatePaymentUseCase,
  UpdatePaymentStatusUseCase,
  ListPaymentsUseCase,
  GetPaymentUseCase,
  DeletePaymentUseCase,
} from "./paymentUseCases";

class InMemoryPaymentRepo implements PaymentRepository {
  private store = new Map<string, Payment>();

  async save(payment: Payment): Promise<void> {
    this.store.set(payment.id.toString(), payment);
  }

  async findById(id: PaymentId): Promise<Payment | null> {
    return this.store.get(id.toString()) ?? null;
  }

  async findAll(query?: PaymentQuery): Promise<Payment[]> {
    let items = Array.from(this.store.values()).filter((p) => !p.deletedAt);
    if (query?.pacienteId) items = items.filter((p) => p.pacienteId === query.pacienteId);
    if (query?.status) items = items.filter((p) => p.status === query.status);
    if (query?.from) items = items.filter((p) => p.paidAt && p.paidAt >= query.from!);
    if (query?.to) items = items.filter((p) => p.paidAt && p.paidAt <= query.to!);
    if (query?.offset) items = items.slice(query.offset);
    if (query?.limit) items = items.slice(0, query.limit);
    return items;
  }

  async count(query?: PaymentQuery): Promise<number> {
    const items = await this.findAll(query);
    return items.length;
  }

  async delete(id: PaymentId, soft = true): Promise<void> {
    if (soft) {
      const p = this.store.get(id.toString());
      if (p) this.store.set(id.toString(), p.softDelete());
    } else {
      this.store.delete(id.toString());
    }
  }
}

describe("CreatePaymentUseCase", () => {
  let repo: InMemoryPaymentRepo;
  let useCase: CreatePaymentUseCase;

  beforeEach(() => {
    repo = new InMemoryPaymentRepo();
    useCase = new CreatePaymentUseCase(repo);
  });

  it("creates and persists a payment", async () => {
    const payment = await useCase.execute({ pacienteId: "pat-1", amount: 500 });
    expect(payment.amount).toBe(500);
    const found = await repo.findById(payment.id);
    expect(found).not.toBeNull();
  });
});

describe("UpdatePaymentStatusUseCase", () => {
  it("updates payment status", async () => {
    const repo = new InMemoryPaymentRepo();
    const created = await new CreatePaymentUseCase(repo).execute({ pacienteId: "pat-1", amount: 500 });
    const updated = await new UpdatePaymentStatusUseCase(repo).execute(created.id, "paid");
    expect(updated.status).toBe("paid");
  });

  it("throws on non-existent payment", async () => {
    await expect(new UpdatePaymentStatusUseCase(new InMemoryPaymentRepo()).execute(PaymentId.generate(), "paid")).rejects.toThrow("no encontrado");
  });
});

describe("ListPaymentsUseCase", () => {
  let repo: InMemoryPaymentRepo;
  const create = (pacienteId: string, amount: number, status?: string) =>
    new CreatePaymentUseCase(repo).execute({ pacienteId, amount, status: status as any });

  beforeEach(async () => {
    repo = new InMemoryPaymentRepo();
    await create("pat-1", 500, "paid");
    await create("pat-1", 300, "pending");
    await create("pat-2", 200, "paid");
  });

  it("lists all non-deleted payments", async () => {
    const result = await new ListPaymentsUseCase(repo).execute();
    expect(result.items).toHaveLength(3);
    expect(result.total).toBe(3);
  });

  it("filters by pacienteId", async () => {
    const result = await new ListPaymentsUseCase(repo).execute({ pacienteId: "pat-1" });
    expect(result.items).toHaveLength(2);
  });

  it("filters by status", async () => {
    const result = await new ListPaymentsUseCase(repo).execute({ status: "paid" });
    expect(result.items).toHaveLength(2);
  });
});

describe("GetPaymentUseCase", () => {
  it("finds a payment by id", async () => {
    const repo = new InMemoryPaymentRepo();
    const created = await new CreatePaymentUseCase(repo).execute({ pacienteId: "pat-1", amount: 500 });
    const found = await new GetPaymentUseCase(repo).execute(created.id);
    expect(found.amount).toBe(500);
  });

  it("throws when not found", async () => {
    await expect(new GetPaymentUseCase(new InMemoryPaymentRepo()).execute(PaymentId.generate())).rejects.toThrow("no encontrado");
  });
});

describe("DeletePaymentUseCase", () => {
  it("soft-deletes a payment", async () => {
    const repo = new InMemoryPaymentRepo();
    const created = await new CreatePaymentUseCase(repo).execute({ pacienteId: "pat-1", amount: 100 });
    await new DeletePaymentUseCase(repo).execute(created.id);
    const all = await repo.findAll();
    expect(all).toHaveLength(0);
  });
});
