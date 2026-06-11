import { z } from "zod";
import { EvolutionVariableSchema } from "../domain/EvolutionTypes";

export const EvolutionRecordFormSchema = z.object({
  consultationId: z.string().uuid(),
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
});

export const EvolutionIndicatorFormSchema = z.object({
  patientId: z.string().uuid(),
  variable: EvolutionVariableSchema,
  initialConsultationId: z.string().uuid(),
  currentConsultationId: z.string().uuid(),
  initialValue: z.number(),
  currentValue: z.number(),
  goalId: z.string().uuid().optional(),
  targetValue: z.number().optional(),
});

export type EvolutionRecordFormInput = z.infer<typeof EvolutionRecordFormSchema>;
export type EvolutionIndicatorFormInput = z.infer<typeof EvolutionIndicatorFormSchema>;
