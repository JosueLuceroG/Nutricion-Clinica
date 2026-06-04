import { SnapshotExpedienteId } from "./SnapshotExpedienteId";

export interface SnapshotExpedienteProps {
  id: string;
  consultaId: string;
  patientId: string;
  fechaSnapshot: string;
  contenidoJsonExpediente: string;
  contenidoJsonAntropometria: string | null;
  contenidoJsonBioquimica: string | null;
  contenidoJsonPlan: string | null;
  hashIntegridad: string;
  versionSmae: string;
  profesionalId: string;
  createdAt: string;
}

export interface SnapshotExpedienteCreate {
  consultaId: string;
  patientId: string;
  fechaSnapshot?: string;
  contenidoJsonExpediente: Record<string, unknown>;
  contenidoJsonAntropometria?: Record<string, unknown> | null;
  contenidoJsonBioquimica?: Record<string, unknown> | null;
  contenidoJsonPlan?: Record<string, unknown> | null;
  versionSmae?: string;
  profesionalId: string;
}

export async function computeIntegrityHash(
  expedienteJson: string,
  antropometriaJson: string | null,
  bioquimicaJson: string | null,
  planJson: string | null,
  versionSmae: string,
): Promise<string> {
  const payload = [expedienteJson, antropometriaJson, bioquimicaJson, planJson, versionSmae].join("|");
  const bytes = new TextEncoder().encode(payload);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export class SnapshotExpediente {
  private constructor(private readonly props: SnapshotExpedienteProps) {}
  get id() { return SnapshotExpedienteId.fromUnsafe(this.props.id); }
  get consultaId() { return this.props.consultaId; }
  get patientId() { return this.props.patientId; }
  get fechaSnapshot() { return this.props.fechaSnapshot; }
  get contenidoJsonExpediente() { return this.props.contenidoJsonExpediente; }
  get contenidoJsonAntropometria() { return this.props.contenidoJsonAntropometria; }
  get contenidoJsonBioquimica() { return this.props.contenidoJsonBioquimica; }
  get contenidoJsonPlan() { return this.props.contenidoJsonPlan; }
  get hashIntegridad() { return this.props.hashIntegridad; }
  get versionSmae() { return this.props.versionSmae; }
  get profesionalId() { return this.props.profesionalId; }
  get createdAt() { return this.props.createdAt; }
  toProps(): SnapshotExpedienteProps { return { ...this.props }; }

  static async create(input: SnapshotExpedienteCreate): Promise<SnapshotExpediente> {
    const now = new Date().toISOString();
    const expedienteJson = JSON.stringify(input.contenidoJsonExpediente);
    const antropometriaJson = input.contenidoJsonAntropometria ? JSON.stringify(input.contenidoJsonAntropometria) : null;
    const bioquimicaJson = input.contenidoJsonBioquimica ? JSON.stringify(input.contenidoJsonBioquimica) : null;
    const planJson = input.contenidoJsonPlan ? JSON.stringify(input.contenidoJsonPlan) : null;
    const versionSmae = input.versionSmae ?? "1.0";
    const hashIntegridad = await computeIntegrityHash(
      expedienteJson,
      antropometriaJson,
      bioquimicaJson,
      planJson,
      versionSmae,
    );
    return new SnapshotExpediente({
      id: SnapshotExpedienteId.generate().value,
      consultaId: input.consultaId,
      patientId: input.patientId,
      fechaSnapshot: input.fechaSnapshot ?? now,
      contenidoJsonExpediente: expedienteJson,
      contenidoJsonAntropometria: antropometriaJson,
      contenidoJsonBioquimica: bioquimicaJson,
      contenidoJsonPlan: planJson,
      hashIntegridad,
      versionSmae,
      profesionalId: input.profesionalId,
      createdAt: now,
    });
  }

  static reconstitute(props: SnapshotExpedienteProps): SnapshotExpediente {
    return new SnapshotExpediente(props);
  }

  async verifyIntegrity(): Promise<boolean> {
    const realHash = await computeIntegrityHash(
      this.contenidoJsonExpediente,
      this.contenidoJsonAntropometria,
      this.contenidoJsonBioquimica,
      this.contenidoJsonPlan,
      this.versionSmae,
    );
    return this.hashIntegridad === realHash;
  }
}
