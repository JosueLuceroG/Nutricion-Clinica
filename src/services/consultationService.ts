import { DexieConsultationRepository } from "@modules/consultation/infrastructure/DexieConsultationRepository";
import { db } from "@services/db/dexieSchema";
import {
  ScheduleConsultationUseCase,
  TransitionConsultationStatusUseCase,
  UpdateConsultationNotesUseCase,
  GetConsultationUseCase,
  ListConsultationsUseCase,
  DeleteConsultationUseCase,
} from "@modules/consultation/application/consultationUseCases";
import type { ConsultationRepository } from "@modules/consultation/domain/ConsultationRepository";

const repository: ConsultationRepository = new DexieConsultationRepository(db);

export const consultationService = {
  schedule: new ScheduleConsultationUseCase(repository),
  transition: new TransitionConsultationStatusUseCase(repository),
  updateNotes: new UpdateConsultationNotesUseCase(repository),
  get: new GetConsultationUseCase(repository),
  list: new ListConsultationsUseCase(repository),
  delete: new DeleteConsultationUseCase(repository),
};

export type ConsultationService = typeof consultationService;
