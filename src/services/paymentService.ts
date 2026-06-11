import { DexiePaymentRepository } from "@modules/payment/infrastructure/DexiePaymentRepository";
import { db } from "@services/db/dexieSchema";
import {
  CreatePaymentUseCase,
  UpdatePaymentStatusUseCase,
  ListPaymentsUseCase,
  GetPaymentUseCase,
  DeletePaymentUseCase,
} from "@modules/payment/application/paymentUseCases";

const repository = new DexiePaymentRepository(db);

export const paymentService = {
  create: new CreatePaymentUseCase(repository),
  updateStatus: new UpdatePaymentStatusUseCase(repository),
  list: new ListPaymentsUseCase(repository),
  get: new GetPaymentUseCase(repository),
  delete: new DeletePaymentUseCase(repository),
};

export type PaymentService = typeof paymentService;
