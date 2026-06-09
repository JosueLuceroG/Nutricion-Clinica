import { z } from "zod";
import { MedicationCatalogIdSchema, type MedicationCatalogId } from "./MedicationCatalogId";
import { MedicationRouteSchema, type MedicationRoute } from "./MedicationCatalogTypes";

export const MedicationCatalogSchema = z.object({
  id: MedicationCatalogIdSchema,
  nombre_comercial: z.string().min(1),
  principio_activo: z.string().min(1),
  presentacion: z.string().min(1),
  concentracion: z.string().min(1),
  via_administracion: MedicationRouteSchema,
  categoria_farmacologica: z.string(),
  efectos_secundarios: z.array(z.string()).default([]),
  contraindicaciones: z.array(z.string()).default([]),
  notas: z.string().default(""),
  createdAt: z.number().int().positive(),
  updatedAt: z.number().int().positive(),
});
export type MedicationCatalogProps = z.infer<typeof MedicationCatalogSchema>;

export class MedicationCatalog {
  private constructor(private readonly props: MedicationCatalogProps) {}

  get id(): MedicationCatalogId { return this.props.id as MedicationCatalogId; }
  get nombre_comercial(): string { return this.props.nombre_comercial; }
  get principio_activo(): string { return this.props.principio_activo; }
  get presentacion(): string { return this.props.presentacion; }
  get concentracion(): string { return this.props.concentracion; }
  get via_administracion(): MedicationRoute { return this.props.via_administracion; }
  get categoria_farmacologica(): string { return this.props.categoria_farmacologica; }
  get efectos_secundarios(): readonly string[] { return this.props.efectos_secundarios; }
  get contraindicaciones(): readonly string[] { return this.props.contraindicaciones; }
  get notas(): string { return this.props.notas; }
  get createdAt(): number { return this.props.createdAt; }
  get updatedAt(): number { return this.props.updatedAt; }

  toProps(): MedicationCatalogProps {
    return {
      ...this.props,
      efectos_secundarios: [...this.props.efectos_secundarios],
      contraindicaciones: [...this.props.contraindicaciones],
    };
  }

  static create(props: Omit<MedicationCatalogProps, "createdAt" | "updatedAt">): MedicationCatalog {
    return new MedicationCatalog({
      ...props,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  }

  static reconstitute(props: MedicationCatalogProps): MedicationCatalog {
    return new MedicationCatalog(props);
  }

  with(updates: Partial<MedicationCatalogProps>): MedicationCatalog {
    return MedicationCatalog.reconstitute({ ...this.props, ...updates, updatedAt: Date.now() });
  }
}
