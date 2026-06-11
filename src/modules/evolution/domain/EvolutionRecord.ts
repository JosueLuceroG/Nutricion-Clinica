import { z } from "zod";

export const EvolutionRecordSchema = z.object({
  id: z.string().uuid(),
  patientId: z.string().uuid(),
  consultationId: z.string().uuid(),
  professionalId: z.string().uuid(),
  changesSinceLastConsultation: z.string().max(3000).default(""),
  intercurrentEvents: z.string().max(2000).default(""),
  perceivedCompliance: z.number().int().min(1).max(10).default(5),
  barriersIdentified: z.string().max(2000).default(""),
  facilitatorsIdentified: z.string().max(2000).default(""),
  patientSatisfaction: z.number().int().min(1).max(5).default(3),
  nextAppointment: z.string().optional(),
  nextConsultationPlan: z.string().max(3000).default(""),
  requiresReferral: z.boolean().default(false),
  referralSpecialties: z.array(z.string()).default([]),
  snapshotBeforeId: z.string().uuid().optional(),
  snapshotAfterId: z.string().uuid().optional(),
  createdAt: z.number().int().positive(),
  updatedAt: z.number().int().positive(),
});
export type EvolutionRecordProps = z.infer<typeof EvolutionRecordSchema>;

export class EvolutionRecord {
  constructor(public readonly props: EvolutionRecordProps) {}

  get id(): string { return this.props.id; }
  get patientId(): string { return this.props.patientId; }
  get consultationId(): string { return this.props.consultationId; }
  get changesSinceLastConsultation(): string { return this.props.changesSinceLastConsultation; }
  get perceivedCompliance(): number { return this.props.perceivedCompliance; }
  get patientSatisfaction(): number { return this.props.patientSatisfaction; }
}
