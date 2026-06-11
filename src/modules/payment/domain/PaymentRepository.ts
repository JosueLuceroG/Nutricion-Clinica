import type { Payment } from "./Payment";
import type { PaymentId } from "./PaymentId";
import type { PaymentStatus } from "@modules/consultation/domain/PaymentStatus";

export interface PaymentQuery {
  pacienteId?: string;
  status?: PaymentStatus;
  from?: Date;
  to?: Date;
  limit?: number;
  offset?: number;
}

export interface PaymentRepository {
  save(payment: Payment): Promise<void>;
  findById(id: PaymentId): Promise<Payment | null>;
  findAll(query?: PaymentQuery): Promise<Payment[]>;
  count(query?: PaymentQuery): Promise<number>;
  delete(id: PaymentId, soft?: boolean): Promise<void>;
}
