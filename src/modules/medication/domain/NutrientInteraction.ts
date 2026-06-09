import { z } from "zod";
import { MedicationCatalogIdSchema, type MedicationCatalogId } from "./MedicationCatalogId";
import { InteractionTypeSchema, type InteractionType, InteractionSeveritySchema, type InteractionSeverity } from "./MedicationCatalogTypes";

export const NutrientInteractionSchema = z.object({
  id: MedicationCatalogIdSchema,
  medicamento_id: MedicationCatalogIdSchema,
  nutriente: z.string(),
  tipo: InteractionTypeSchema,
  severidad: InteractionSeveritySchema,
  recomendacion: z.string(),
  fuente: z.string().default(""),
  fecha_vigencia: z.string().nullable().default(null),
  createdAt: z.number().int().positive(),
  updatedAt: z.number().int().positive(),
});
export type NutrientInteractionProps = z.infer<typeof NutrientInteractionSchema>;

export class NutrientInteraction {
  private constructor(private readonly props: NutrientInteractionProps) {}

  get id(): MedicationCatalogId { return this.props.id as MedicationCatalogId; }
  get medicamento_id(): MedicationCatalogId { return this.props.medicamento_id as MedicationCatalogId; }
  get nutriente(): string { return this.props.nutriente; }
  get tipo(): InteractionType { return this.props.tipo; }
  get severidad(): InteractionSeverity { return this.props.severidad; }
  get recomendacion(): string { return this.props.recomendacion; }
  get fuente(): string { return this.props.fuente; }
  get fecha_vigencia(): string | null { return this.props.fecha_vigencia; }
  get createdAt(): number { return this.props.createdAt; }
  get updatedAt(): number { return this.props.updatedAt; }

  toProps(): NutrientInteractionProps {
    return { ...this.props };
  }

  static create(props: Omit<NutrientInteractionProps, "createdAt" | "updatedAt">): NutrientInteraction {
    return new NutrientInteraction({
      ...props,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  }

  static reconstitute(props: NutrientInteractionProps): NutrientInteraction {
    return new NutrientInteraction(props);
  }

  with(updates: Partial<NutrientInteractionProps>): NutrientInteraction {
    return NutrientInteraction.reconstitute({ ...this.props, ...updates, updatedAt: Date.now() });
  }
}
