import { Payment, type PaymentCreate } from "../domain/Payment";
import type { PaymentId } from "../domain/PaymentId";
import type { PaymentStatus } from "@modules/consultation/domain/PaymentStatus";
import type { PaymentRepository } from "../domain/PaymentRepository";

export class CreatePaymentUseCase {
  constructor(private readonly repo: PaymentRepository) {}

  async execute(input: PaymentCreate): Promise<Payment> {
    const payment = Payment.create(input);
    await this.repo.save(payment);
    return payment;
  }
}

export class UpdatePaymentStatusUseCase {
  constructor(private readonly repo: PaymentRepository) {}

  async execute(id: PaymentId, status: PaymentStatus): Promise<Payment> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new Error("Pago no encontrado.");
    const updated = existing.withStatus(status);
    await this.repo.save(updated);
    return updated;
  }
}

export class ListPaymentsUseCase {
  constructor(private readonly repo: PaymentRepository) {}

  async execute(query?: { pacienteId?: string; status?: PaymentStatus; from?: Date; to?: Date; limit?: number; offset?: number }) {
    const items = await this.repo.findAll(query);
    const total = await this.repo.count(query);
    return { items, total };
  }
}

export class GetPaymentUseCase {
  constructor(private readonly repo: PaymentRepository) {}

  async execute(id: PaymentId): Promise<Payment> {
    const found = await this.repo.findById(id);
    if (!found) throw new Error("Pago no encontrado.");
    return found;
  }
}

export class DeletePaymentUseCase {
  constructor(private readonly repo: PaymentRepository) {}

  async execute(id: PaymentId, soft = true): Promise<void> {
    await this.repo.delete(id, soft);
  }
}
