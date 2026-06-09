import { z } from "zod";
import { AdherenceSourceSchema } from "../domain/AdherenceTypes";

export const AdherenceFormSchema = z.object({
  patientId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  consultationId: z.string().uuid().optional(),
  source: AdherenceSourceSchema,
  adherenceMenu: z.number().min(0).max(100).default(0),
  adherenceWater: z.number().min(0).max(100).default(0),
  adherenceActivity: z.number().min(0).max(100).default(0),
  adherenceSupplements: z.number().min(0).max(100).default(0),
  adherenceSleep: z.number().min(0).max(100).default(0),
  hungerAvg: z.number().min(1).max(10).optional(),
  satietyAvg: z.number().min(1).max(10).optional(),
  moodAvg: z.number().min(1).max(10).optional(),
  energyAvg: z.number().min(1).max(10).optional(),
  intercurrentEvents: z.string().max(1000).default(""),
  barriers: z.string().max(1000).default(""),
  facilitators: z.string().max(1000).default(""),
  mealsLogged: z.string().max(2000).default(""),
  notes: z.string().max(2000).default(""),
});
export type AdherenceFormInput = z.infer<typeof AdherenceFormSchema>;
