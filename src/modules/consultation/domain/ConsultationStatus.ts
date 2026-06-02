import { z } from "zod";

/**
 * Estados de una consulta nutricional.
 *  - scheduled: agendada, aún no atendida
 *  - in-progress: en curso (paciente presente)
 *  - completed: finalizada, snapshot inmutable
 *  - cancelled: cancelada (por paciente o nutriólogo)
 */
export const ConsultationStatusSchema = z.enum([
  "scheduled",
  "in-progress",
  "completed",
  "cancelled",
]);

export type ConsultationStatus = z.infer<typeof ConsultationStatusSchema>;

export const ConsultationStatusLabel: Record<ConsultationStatus, string> = {
  scheduled: "Agendada",
  "in-progress": "En curso",
  completed: "Completada",
  cancelled: "Cancelada",
};

export const ConsultationStatusColor: Record<ConsultationStatus, "info" | "warning" | "success" | "destructive" | "secondary"> = {
  scheduled: "info",
  "in-progress": "warning",
  completed: "success",
  cancelled: "destructive",
};

const allowedTransitions: Record<ConsultationStatus, ReadonlyArray<ConsultationStatus>> = {
  scheduled: ["in-progress", "cancelled"],
  "in-progress": ["completed", "cancelled"],
  completed: [],
  cancelled: ["scheduled"],
};

export const canTransitionConsultation = (
  from: ConsultationStatus,
  to: ConsultationStatus,
): boolean => {
  if (from === to) return true;
  return allowedTransitions[from].includes(to);
};
