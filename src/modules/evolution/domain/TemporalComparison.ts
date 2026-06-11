import { z } from "zod";

export const TemporalComparisonSchema = z.object({
  id: z.string().uuid(),
  patientId: z.string().uuid(),
  currentConsultationId: z.string().uuid(),
  comparedConsultationId: z.string().uuid(),
  differencesJson: z.string(),
  summary: z.string().max(3000).default(""),
  calculatedAt: z.number().int().positive(),
});
export type TemporalComparisonProps = z.infer<typeof TemporalComparisonSchema>;

export class TemporalComparison {
  constructor(public readonly props: TemporalComparisonProps) {}

  get id(): string { return this.props.id; }
  get differencesJson(): string { return this.props.differencesJson; }
  get summary(): string { return this.props.summary; }
}
