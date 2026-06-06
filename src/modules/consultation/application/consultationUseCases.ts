import { Consultation, type ConsultationCreate } from "../domain/Consultation";
import type { ConsultationId } from "../domain/ConsultationId";
import type { ConsultationStatus } from "../domain/ConsultationStatus";
import type { PaymentMethod } from "../domain/PaymentMethod";
import {
  type ConsultationQuery,
  type ConsultationRepository,
  ConsultationNotFoundError,
} from "../domain/ConsultationRepository";
import { canTransitionConsultation } from "../domain/ConsultationStatus";

export class ScheduleConsultationUseCase {
  constructor(private readonly repo: ConsultationRepository) {}

  async execute(input: Omit<ConsultationCreate, "id" | "status" | "createdAt" | "updatedAt">): Promise<Consultation> {
    const consultationNumber = await this.repo.nextConsultationNumber(input.patientId);
    const consultation = Consultation.create({
      ...input,
      consultationNumber,
      status: "scheduled",
    });
    await this.repo.save(consultation);
    return consultation;
  }
}

export class TransitionConsultationStatusUseCase {
  constructor(private readonly repo: ConsultationRepository) {}

  async execute(id: ConsultationId, to: ConsultationStatus): Promise<Consultation> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new ConsultationNotFoundError(id);
    if (!canTransitionConsultation(existing.status, to)) {
      throw new Error(`Transición no permitida: ${existing.status} → ${to}`);
    }
    const updated = existing.withStatus(to);
    await this.repo.save(updated);
    return updated;
  }
}

export class UpdateConsultationNotesUseCase {
  constructor(private readonly repo: ConsultationRepository) {}

  async execute(
    id: ConsultationId,
    updates: Parameters<Consultation["withNotes"]>[0],
  ): Promise<Consultation> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new ConsultationNotFoundError(id);
    const updated = existing.withNotes(updates);
    await this.repo.save(updated);
    return updated;
  }
}

export class GetConsultationUseCase {
  constructor(private readonly repo: ConsultationRepository) {}

  async execute(id: ConsultationId): Promise<Consultation> {
    const found = await this.repo.findById(id);
    if (!found) throw new ConsultationNotFoundError(id);
    return found;
  }
}

export class ListConsultationsUseCase {
  constructor(private readonly repo: ConsultationRepository) {}

  async execute(query?: ConsultationQuery): Promise<{ items: Consultation[]; total: number }> {
    const [items, total] = await Promise.all([
      this.repo.findAll(query),
      this.repo.count(query),
    ]);
    return { items, total };
  }
}

export class DeleteConsultationUseCase {
  constructor(private readonly repo: ConsultationRepository) {}

  async execute(id: ConsultationId, soft = true): Promise<void> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new ConsultationNotFoundError(id);
    await this.repo.delete(id, soft);
  }
}

/* ------------------------- pagos (Sprint 14D) ------------------------- */

export interface RegisterPaymentInput {
  cost?: number;
  paid: boolean;
  paymentMethod?: PaymentMethod | null;
  paidAt?: Date | null;
  reference?: string | null;
  invoiceNumber?: string | null;
  billingNotes?: string | null;
}

/**
 * Registra o actualiza el pago de una consulta (Sprint 14D).
 * - Si `paid=true` se exige `paymentMethod` y `paidAt` (validación de dominio).
 * - Si `paid=false` se limpian método/referencia/fecha (regla de dominio).
 * - No permite pagar consultas eliminadas (validación de dominio).
 */
export class RegisterPaymentUseCase {
  constructor(private readonly repo: ConsultationRepository) {}

  async execute(id: ConsultationId, input: RegisterPaymentInput): Promise<Consultation> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new ConsultationNotFoundError(id);
    const updated = existing.withPayment(input);
    await this.repo.save(updated);
    return updated;
  }
}
