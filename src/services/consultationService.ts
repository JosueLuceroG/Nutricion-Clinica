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
  RegisterPaymentsBulkUseCase,
  type RegisterPaymentInput,
} from "@modules/consultation/application/consultationUseCases";
import type { ConsultationRepository } from "@modules/consultation/domain/ConsultationRepository";
import type { ConsultationId } from "@modules/consultation/domain/ConsultationId";
import type { Consultation } from "@modules/consultation/domain/Consultation";
import type { ConsultationStatus } from "@modules/consultation/domain/ConsultationStatus";
import { clinicalRecordService } from "@services/clinicalRecordService";
import { recordClinicalAudit } from "@services/audit/clinicalAudit";
import { requireActiveSucursalId, rowMatchesSucursal } from "@services/tenancy/sucursalScope";

const repository: ConsultationRepository = new DexieConsultationRepository(db);
const scheduleConsultation = new ScheduleConsultationUseCase(repository);
const originalTransition = new TransitionConsultationStatusUseCase(repository);
const updateConsultationNotes = new UpdateConsultationNotesUseCase(repository);
const deleteConsultation = new DeleteConsultationUseCase(repository);
const registerPayment = new RegisterPaymentUseCase(repository);
const registerPaymentsBulk = new RegisterPaymentsBulkUseCase(repository);

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
      const consultationId = id.toString();
      const sucursalId = requireActiveSucursalId();
      await db.transaction(
        "rw",
        [db.consultations, db.meal_plans, db.adherence_records],
        async () => {
          const [plans, adherenceRecords] = await Promise.all([
            db.meal_plans
              .filter((row) => row.consultation_id === consultationId && row.deleted_at == null && rowMatchesSucursal(row, sucursalId))
              .toArray(),
            db.adherence_records
              .filter((row) => row.consultation_id === consultationId && row.deleted_at == null && rowMatchesSucursal(row, sucursalId))
              .toArray(),
          ]);
          for (const plan of plans) await db.meal_plans.delete(plan.id);
          for (const record of adherenceRecords) await db.adherence_records.delete(record.id);
          await deleteConsultation.execute(id, soft);
        },
      );
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
    /**
     * Bulk-pay atómico e idempotente: una sola transacción Dexie para todo
     * el lote y guard concurrente (doble click) reutiliza la misma promesa.
     */
    registerMany: (() => {
      let inFlight: Promise<Consultation[]> | null = null;
      return (
        entries: Array<{ id: ConsultationId; input: RegisterPaymentInput }>,
      ): Promise<Consultation[]> => {
        if (inFlight) return inFlight;
        const run = (async () => {
          const results = await db.transaction(
            "rw",
            db.consultations,
            () => registerPaymentsBulk.execute(entries),
          );
          for (const consultation of results) {
            await recordClinicalAudit({
              module: "billing",
              action: "update",
              resourceType: "consultation",
              resourceId: consultation.id.toString(),
              patientId: consultation.patientId.toString(),
              justification: "bulk_payment",
            });
          }
          return results;
        })();
        inFlight = run;
        // `.then` con ambos callbacks (no `.finally().catch()`): limpia el
        // guard sin crear una promesa nueva que rechace sin handler.
        run.then(
          () => {
            inFlight = null;
          },
          () => {
            inFlight = null;
          },
        );
        return run;
      };
    })(),
  },
};

export type ConsultationService = typeof consultationService;
