import { DexieConsultationRepository } from "@modules/consultation/infrastructure/DexieConsultationRepository";
import { db } from "@services/db/dexieSchema";
import {
  ScheduleConsultationUseCase,
  TransitionConsultationStatusUseCase,
  UpdateConsultationNotesUseCase,
  GetConsultationUseCase,
  ListConsultationsUseCase,
  DeleteConsultationUseCase,
  RegisterPaymentUseCase,
  type RegisterPaymentInput,
} from "@modules/consultation/application/consultationUseCases";
import type { ConsultationRepository } from "@modules/consultation/domain/ConsultationRepository";
import type { ConsultationId } from "@modules/consultation/domain/ConsultationId";
import type { ConsultationStatus } from "@modules/consultation/domain/ConsultationStatus";
import { clinicalRecordService } from "@services/clinicalRecordService";
import { recordClinicalAudit } from "@services/audit/clinicalAudit";

const repository: ConsultationRepository = new DexieConsultationRepository(db);
const scheduleConsultation = new ScheduleConsultationUseCase(repository);
const originalTransition = new TransitionConsultationStatusUseCase(repository);
const updateConsultationNotes = new UpdateConsultationNotesUseCase(repository);
const deleteConsultation = new DeleteConsultationUseCase(repository);
const registerPayment = new RegisterPaymentUseCase(repository);

export const consultationService = {
  schedule: {
    async execute(input: Parameters<typeof scheduleConsultation.execute>[0]): ReturnType<typeof scheduleConsultation.execute> {
      const consultation = await scheduleConsultation.execute(input);
      await recordClinicalAudit({
        module: "consultations",
        action: "create",
        resourceType: "consultation",
        resourceId: consultation.id.toString(),
        patientId: consultation.patientId.toString(),
      });
      return consultation;
    },
  },
  transition: {
    async execute(id: Parameters<typeof originalTransition.execute>[0], to: ConsultationStatus): ReturnType<typeof originalTransition.execute> {
      const consultation = await originalTransition.execute(id, to);
      await recordClinicalAudit({
        module: "consultations",
        action: "update",
        resourceType: "consultation",
        resourceId: consultation.id.toString(),
        patientId: consultation.patientId.toString(),
        justification: `status:${to}`,
      });
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
  updateNotes: {
    async execute(id: Parameters<typeof updateConsultationNotes.execute>[0], updates: Parameters<typeof updateConsultationNotes.execute>[1]): ReturnType<typeof updateConsultationNotes.execute> {
      const consultation = await updateConsultationNotes.execute(id, updates);
      await recordClinicalAudit({
        module: "consultations",
        action: "update",
        resourceType: "consultation",
        resourceId: consultation.id.toString(),
        patientId: consultation.patientId.toString(),
        justification: "notes",
      });
      return consultation;
    },
  },
  get: new GetConsultationUseCase(repository),
  list: new ListConsultationsUseCase(repository),
  delete: {
    async execute(id: Parameters<typeof deleteConsultation.execute>[0], soft = true): ReturnType<typeof deleteConsultation.execute> {
      const existing = await repository.findById(id);
      await deleteConsultation.execute(id, soft);
      await recordClinicalAudit({
        module: "consultations",
        action: soft ? "soft_delete" : "remove",
        resourceType: "consultation",
        resourceId: id.toString(),
        patientId: existing?.patientId.toString() ?? null,
      });
    },
  },
  payment: {
    register: async (id: ConsultationId, input: RegisterPaymentInput) => {
      const consultation = await registerPayment.execute(id, input);
      await recordClinicalAudit({
        module: "billing",
        action: "update",
        resourceType: "consultation",
        resourceId: consultation.id.toString(),
        patientId: consultation.patientId.toString(),
        justification: "payment",
      });
      return consultation;
    },
  },
};

export type ConsultationService = typeof consultationService;
