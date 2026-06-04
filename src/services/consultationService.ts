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
import type { ConsultationStatus } from "@modules/consultation/domain/ConsultationStatus";
import { clinicalRecordService } from "@services/clinicalRecordService";

const repository: ConsultationRepository = new DexieConsultationRepository(db);
const originalTransition = new TransitionConsultationStatusUseCase(repository);

export const consultationService = {
  schedule: new ScheduleConsultationUseCase(repository),
  transition: {
    async execute(id: Parameters<typeof originalTransition.execute>[0], to: ConsultationStatus): ReturnType<typeof originalTransition.execute> {
      const consultation = await originalTransition.execute(id, to);
      if (to === "completed") {
        clinicalRecordService.snapshots.create.execute({
          consultaId: consultation.id.toString(),
          patientId: consultation.patientId.toString(),
          contenidoJsonExpediente: {
            consultationNumber: consultation.consultationNumber,
            reason: consultation.reason,
            subjective: consultation.subjective,
            objective: consultation.objective,
            assessment: consultation.assessment,
            plan: consultation.plan,
            anthropometryId: consultation.anthropometryId?.toString() ?? null,
            labPanelId: consultation.labPanelId?.toString() ?? null,
            vitals: consultation.vitals.toJSON(),
            nextVisitDate: consultation.nextVisitDate?.toISOString() ?? null,
          },
          profesionalId: "system",
        }).catch((err: unknown) => {
          console.error("Error al crear snapshot al completar consulta:", err);
        });
      }
      return consultation;
    },
  },
  updateNotes: new UpdateConsultationNotesUseCase(repository),
  get: new GetConsultationUseCase(repository),
  list: new ListConsultationsUseCase(repository),
  delete: new DeleteConsultationUseCase(repository),
};

export type ConsultationService = typeof consultationService;
