import { z } from "zod";
import {
  EvolutionVariableSchema, type EvolutionVariable,
  StagnationSeveritySchema, type StagnationSeverity,
} from "./EvolutionTypes";

export const StagnationAlertSchema = z.object({
  id: z.string().uuid(),
  patientId: z.string().uuid(),
  variable: EvolutionVariableSchema,
  periodWeeks: z.number().int().positive().default(4),
  severity: StagnationSeveritySchema,
  generatedAt: z.number().int().positive(),
  actionTaken: z.string().max(2000).default(""),
  notes: z.string().max(2000).default(""),
  resolvedAt: z.number().int().positive().optional(),
});
export type StagnationAlertProps = z.infer<typeof StagnationAlertSchema>;

export class StagnationAlert {
  constructor(public readonly props: StagnationAlertProps) {}

  get id(): string { return this.props.id; }
  get variable(): EvolutionVariable { return this.props.variable; }
  get severity(): StagnationSeverity { return this.props.severity; }
}
