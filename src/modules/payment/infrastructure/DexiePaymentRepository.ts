import type { Payment } from "../domain/Payment";
import type { PaymentId } from "../domain/PaymentId";
import type { PaymentQuery, PaymentRepository } from "../domain/PaymentRepository";
import { paymentDomainToRow, paymentRowToDomain } from "./paymentMapper";
import type { NutriClinicaDB } from "@services/db/dexieSchema";

export class DexiePaymentRepository implements PaymentRepository {
  constructor(private readonly db: NutriClinicaDB) {}

  async save(payment: Payment): Promise<void> {
    const row = paymentDomainToRow(payment);
    await this.db.payments.put(row);
  }

  async findById(id: PaymentId): Promise<Payment | null> {
    const row = await this.db.payments.get(id.toString());
    if (!row) return null;
    return paymentRowToDomain(row);
  }

  async findAll(query?: PaymentQuery): Promise<Payment[]> {
    let collection = this.db.payments.toCollection();

    if (query?.pacienteId) {
      collection = this.db.payments
        .where("patient_id")
        .equals(query.pacienteId);
    }

    let rows = await collection.toArray();

    if (query?.status) {
      rows = rows.filter((r) => r.status === query.status);
    }
    if (query?.from) {
      const fromMs = query.from.getTime();
      rows = rows.filter((r) => {
        const t = new Date(r.paid_at ?? r.created_at).getTime();
        return t >= fromMs;
      });
    }
    if (query?.to) {
      const toMs = query.to.getTime();
      rows = rows.filter((r) => {
        const t = new Date(r.paid_at ?? r.created_at).getTime();
        return t <= toMs;
      });
    }

    rows.sort((a, b) => {
      const da = new Date(a.paid_at ?? a.created_at).getTime();
      const db_ = new Date(b.paid_at ?? b.created_at).getTime();
      return db_ - da;
    });

    if (query?.offset) {
      rows = rows.slice(query.offset);
    }
    if (query?.limit) {
      rows = rows.slice(0, query.limit);
    }

    return rows.map(paymentRowToDomain);
  }

  async count(query?: PaymentQuery): Promise<number> {
    const items = await this.findAll(query);
    return items.length;
  }

  async delete(id: PaymentId, soft = true): Promise<void> {
    if (soft) {
      const existing = await this.findById(id);
      if (!existing) return;
      const deleted = existing.softDelete();
      await this.save(deleted);
    } else {
      await this.db.payments.delete(id.toString());
    }
  }
}
