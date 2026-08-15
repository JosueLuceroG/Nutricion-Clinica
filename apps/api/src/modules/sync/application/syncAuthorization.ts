import type {
  Role,
  SyncPushBatch,
  SyncPushOperation,
  SyncableEntity,
} from "@nutriclinica/shared";
import { HttpError } from "../../../middleware/errorHandler.js";
import { prepareColumnsForWrite } from "./entityColumnMaps.js";

export interface SyncActor {
  id: string;
  role: Role;
}

export interface SyncOperationViolation {
  index: number;
  entity: SyncableEntity;
  id: string;
  op: SyncPushOperation["op"];
  code: "unauthorized" | "invalid_operation";
  reason: string;
}

export class SyncBatchPolicyError extends HttpError {
  constructor(public readonly violations: SyncOperationViolation[]) {
    const status = violations.some(
      (violation) => violation.code === "unauthorized",
    )
      ? 403
      : 400;
    const summary = violations
      .map(
        (violation) =>
          `op[${violation.index}] ${violation.entity}/${violation.op}: ${violation.reason}`,
      )
      .join("; ");
    super(status, `Batch de sincronización rechazado: ${summary}`, violations);
    this.name = "SyncBatchPolicyError";
  }
}

const BILLING_FIELDS = new Set([
  "cost",
  "paid",
  "payment_status",
  "payment_concept",
  "payment_method",
  "paid_at",
  "reference",
  "invoice_number",
  "billing_notes",
  "amount_paid",
]);

const COMMON_SERVER_FIELDS = new Set([
  "id",
  "sucursal_id",
  "created_at",
  "updated_at",
  "row_version",
]);

const ENTITY_SERVER_FIELDS: Record<SyncableEntity, ReadonlySet<string>> = {
  pacientes: new Set(["responsible_professional_id"]),
  consultas: new Set(["profesional_id", "consultation_number"]),
  antropometrias: new Set(["profesional_id"]),
  lab_panels: new Set(["profesional_id"]),
  planes_alimenticios: new Set(["profesional_id"]),
  adherence_records: new Set(["submitted_by_token_id"]),
};

const IMMUTABLE_UPDATE_FIELDS: Record<SyncableEntity, ReadonlySet<string>> = {
  pacientes: new Set(),
  consultas: new Set(["patient_id"]),
  antropometrias: new Set(["patient_id"]),
  lab_panels: new Set(["patient_id"]),
  planes_alimenticios: new Set([
    "patient_id",
    "consulta_id",
    "consultation_id",
  ]),
  adherence_records: new Set([
    "patient_id",
    "consulta_id",
    "consultation_id",
    "source",
  ]),
};

function isPayloadObject(payload: unknown): payload is Record<string, unknown> {
  return (
    Boolean(payload) && typeof payload === "object" && !Array.isArray(payload)
  );
}

function canPerformOperation(actor: SyncActor, op: SyncPushOperation): boolean {
  if (actor.role === "admin" || actor.role === "nutriologa") return true;
  if (actor.role === "asistente" || actor.role === "facturacion") {
    return op.entity === "consultas" && op.op === "update";
  }
  return false;
}

function addViolation(
  violations: SyncOperationViolation[],
  index: number,
  op: SyncPushOperation,
  code: SyncOperationViolation["code"],
  reason: string,
): void {
  violations.push({
    index,
    entity: op.entity,
    id: op.id,
    op: op.op,
    code,
    reason,
  });
}

function normalizePayload(
  batch: SyncPushBatch,
  actor: SyncActor,
  op: SyncPushOperation,
  index: number,
  violations: SyncOperationViolation[],
): SyncPushOperation | null {
  if (op.op === "delete") {
    if (op.payload !== null && op.payload !== undefined) {
      addViolation(
        violations,
        index,
        op,
        "invalid_operation",
        "delete requiere payload null",
      );
      return null;
    }
    return { ...op, payload: null };
  }

  if (!isPayloadObject(op.payload)) {
    addViolation(
      violations,
      index,
      op,
      "invalid_operation",
      `${op.op} requiere un payload de objeto`,
    );
    return null;
  }

  const payload = { ...op.payload };
  if (typeof payload.id === "string" && payload.id !== op.id) {
    addViolation(
      violations,
      index,
      op,
      "invalid_operation",
      "payload.id no coincide con operation.id",
    );
  }
  if (
    typeof payload.sucursal_id === "string" &&
    payload.sucursal_id !== batch.sucursalId
  ) {
    addViolation(
      violations,
      index,
      op,
      "invalid_operation",
      "payload.sucursal_id no coincide con el batch",
    );
  }

  if (payload.deleted_at !== null && payload.deleted_at !== undefined) {
    if (op.op === "update") {
      return { ...op, op: "delete", payload: null };
    }
    addViolation(
      violations,
      index,
      op,
      "invalid_operation",
      "un create no puede incluir deleted_at",
    );
  }

  delete payload.deleted_at;
  for (const field of COMMON_SERVER_FIELDS) delete payload[field];
  for (const field of ENTITY_SERVER_FIELDS[op.entity]) delete payload[field];
  if (op.op === "update") {
    for (const field of IMMUTABLE_UPDATE_FIELDS[op.entity])
      delete payload[field];
  }

  if (
    op.entity === "adherence_records" &&
    op.op === "create" &&
    payload.source === "portal"
  ) {
    addViolation(
      violations,
      index,
      op,
      "invalid_operation",
      "source portal solo puede crearse mediante el portal del paciente",
    );
  }

  if (actor.role === "nutriologa" && op.entity === "consultas") {
    for (const field of BILLING_FIELDS) delete payload[field];
  }

  if (actor.role === "asistente" || actor.role === "facturacion") {
    const billingPayload = Object.fromEntries(
      Object.entries(payload).filter(([field]) => BILLING_FIELDS.has(field)),
    );
    if (Object.keys(billingPayload).length === 0) {
      addViolation(
        violations,
        index,
        op,
        "unauthorized",
        "el rol solo puede actualizar campos de facturación de consultas",
      );
      return null;
    }
    return { ...op, payload: billingPayload };
  }

  return { ...op, payload };
}

export function authorizeAndNormalizeSyncBatch(
  batch: SyncPushBatch,
  actor: SyncActor,
): SyncPushBatch {
  const violations: SyncOperationViolation[] = [];
  const normalized: SyncPushOperation[] = [];
  const seen = new Set<string>();

  batch.operations.forEach((op, index) => {
    const key = `${op.entity}:${op.id}`;
    if (seen.has(key)) {
      addViolation(
        violations,
        index,
        op,
        "invalid_operation",
        "la entidad e id están duplicados en el batch",
      );
    }
    seen.add(key);

    const normalizedOperation = normalizePayload(
      batch,
      actor,
      op,
      index,
      violations,
    );
    if (!normalizedOperation) return;

    if (!canPerformOperation(actor, normalizedOperation)) {
      addViolation(
        violations,
        index,
        normalizedOperation,
        "unauthorized",
        `el rol ${actor.role} no puede ejecutar esta operación`,
      );
      return;
    }

    if (normalizedOperation.op !== "delete") {
      try {
        prepareColumnsForWrite(
          normalizedOperation.entity,
          normalizedOperation.payload,
        );
      } catch (error) {
        addViolation(
          violations,
          index,
          normalizedOperation,
          "invalid_operation",
          error instanceof Error ? error.message : "payload inválido",
        );
        return;
      }
    }

    normalized.push(normalizedOperation);
  });

  if (violations.length > 0) throw new SyncBatchPolicyError(violations);
  return { ...batch, operations: normalized };
}
