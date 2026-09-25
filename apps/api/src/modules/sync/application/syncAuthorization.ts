import type {
  Role,
  SyncPushBatch,
  SyncPushOperation,
  SyncableEntity,
} from "@nutriclinica/shared";
import { canonicalSyncId, isSyncRowVersion, SYNCABLE_ENTITIES } from "@nutriclinica/shared";
import { HttpError } from "../../../middleware/errorHandler.js";
import { getColumnMap, prepareColumnsForWrite } from "./entityColumnMaps.js";

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

const BILLING_PULL_FIELDS = new Set([
  ...BILLING_FIELDS,
  // Operational context needed to render a billing row without clinical data.
  "patient_id",
  "consultation_date",
  "consultation_number",
  "status",
]);

const RECEIPT_SYSTEM_FIELDS = new Set([
  "id",
  "sucursal_id",
  "created_at",
  "updated_at",
  "deleted_at",
]);

const ADHERENCE_SOURCES = new Set(["consulta", "portal", "app", "llamada"]);

const ASSISTANT_PULL_ENTITIES: readonly SyncableEntity[] = [
  "pacientes",
  "consultas",
  "antropometrias",
  "lab_panels",
];

const COMMON_SERVER_FIELDS = new Set([
  "id",
  "sucursal_id",
  "created_at",
  "updated_at",
  "row_version",
]);

const SYSTEM_PAYLOAD_FIELDS = new Set([
  ...COMMON_SERVER_FIELDS,
  "deleted_at",
]);

const UUID_PAYLOAD_FIELDS = new Set([
  "id",
  "sucursal_id",
  "patient_id",
  "consulta_id",
  "consultation_id",
  "anthropometry_id",
  "lab_panel_id",
  "consentimiento_informado_id",
  "responsible_professional_id",
  "profesional_id",
  "submitted_by_token_id",
]);

const UUID_PATTERN = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

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
    return op.entity === "consultas" && op.op === "update" && !op.restoreDeleted;
  }
  return false;
}

export function authorizeSyncPull(
  actor: SyncActor,
  requested: SyncableEntity[] | null,
): SyncableEntity[] {
  const allowed: readonly SyncableEntity[] =
    actor.role === "admin" || actor.role === "nutriologa"
      ? SYNCABLE_ENTITIES
      : actor.role === "asistente"
        ? ASSISTANT_PULL_ENTITIES
      : actor.role === "facturacion"
        ? ["consultas"]
        : [];
  if (allowed.length === 0) {
    throw new HttpError(403, `El rol ${actor.role} no puede leer datos de sincronización`);
  }
  const entities = requested ?? [...allowed];
  if (entities.some((entity) => !allowed.includes(entity))) {
    throw new HttpError(403, `El rol ${actor.role} no puede leer las entidades solicitadas`);
  }
  return [...new Set(entities)];
}

export function projectSyncServerPayload(
  entity: SyncableEntity,
  payload: Record<string, unknown>,
  role: Role,
): Record<string, unknown> | null {
  if (role === "admin" || role === "nutriologa") return payload;
  if (role === "asistente" && ASSISTANT_PULL_ENTITIES.includes(entity)) {
    return payload;
  }
  if (role === "facturacion" && entity === "consultas") {
    return Object.fromEntries(
      Object.entries(payload).filter(
        ([field]) => BILLING_PULL_FIELDS.has(field) || RECEIPT_SYSTEM_FIELDS.has(field),
      ),
    );
  }
  return null;
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
  if (op.restoreDeleted && op.op !== "update") {
    addViolation(
      violations,
      index,
      op,
      "invalid_operation",
      "restoreDeleted solo es válido para update",
    );
    return null;
  }

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
  const allowedFields = getColumnMap(op.entity).byClientField;
  for (const field of Object.keys(payload)) {
    if (!(field in allowedFields) && !SYSTEM_PAYLOAD_FIELDS.has(field)) {
      addViolation(
        violations,
        index,
        op,
        "invalid_operation",
        `campo de payload no reconocido: ${field}`,
      );
    }
  }
  for (const field of UUID_PAYLOAD_FIELDS) {
    if (!(field in payload) || payload[field] === null || payload[field] === undefined) continue;
    if (typeof payload[field] !== "string" || !UUID_PATTERN.test(payload[field])) {
      addViolation(
        violations,
        index,
        op,
        "invalid_operation",
        `${field} debe ser UUID`,
      );
      continue;
    }
    payload[field] = canonicalSyncId(payload[field]);
  }
  if (payload.id !== undefined && payload.id !== canonicalSyncId(op.id)) {
    addViolation(
      violations,
      index,
      op,
      "invalid_operation",
      "payload.id no coincide con operation.id",
    );
  }
  if (
    payload.sucursal_id !== undefined &&
    payload.sucursal_id !== canonicalSyncId(batch.sucursalId)
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
    addViolation(
      violations,
      index,
      op,
      "invalid_operation",
      "deleted_at no puede convertir una operación; use op=delete con payload null",
    );
    return null;
  }

  delete payload.deleted_at;
  for (const field of COMMON_SERVER_FIELDS) delete payload[field];
  for (const field of ENTITY_SERVER_FIELDS[op.entity]) delete payload[field];
  if (op.op === "update") {
    for (const field of IMMUTABLE_UPDATE_FIELDS[op.entity])
      delete payload[field];
  }

  if (op.entity === "adherence_records" && op.op === "create") {
    const source = payload.source;
    if (
      typeof source !== "string" ||
      source !== source.trim().toLowerCase() ||
      !ADHERENCE_SOURCES.has(source)
    ) {
      addViolation(
        violations,
        index,
        op,
        "invalid_operation",
        "source de adherencia debe ser un valor canónico permitido",
      );
    } else if (source === "portal") {
      addViolation(
        violations,
        index,
        op,
        "invalid_operation",
        "source portal solo puede crearse mediante el portal del paciente",
      );
    }
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
  const seenOperationIds = new Set<string>();

  const canonicalBatch = { ...batch, sucursalId: canonicalSyncId(batch.sucursalId) };
  batch.operations.forEach((rawOperation, index) => {
    const op: SyncPushOperation = {
      ...rawOperation,
      id: canonicalSyncId(rawOperation.id),
      operationId: canonicalSyncId(rawOperation.operationId),
    };
    if ((op.op === "create" && op.expectedRowVersion !== undefined) ||
      (op.expectedRowVersion !== undefined && !isSyncRowVersion(op.expectedRowVersion))) {
      addViolation(
        violations,
        index,
        op,
        "invalid_operation",
        "expectedRowVersion debe ser un ROWVERSION canónico de 8 bytes y no aplica a create",
      );
    }
    const key = `${op.entity}:${canonicalSyncId(op.id)}`;
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
    if (op.operationId) {
      const operationId = op.operationId.toLowerCase();
      if (seenOperationIds.has(operationId)) {
        addViolation(
          violations,
          index,
          op,
          "invalid_operation",
          "operationId está duplicado en el batch",
        );
      }
      seenOperationIds.add(operationId);
    }

    const normalizedOperation = normalizePayload(
      canonicalBatch,
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
        const prepared = prepareColumnsForWrite(
          normalizedOperation.entity,
          normalizedOperation.payload,
        );
        if (prepared.length === 0 && !normalizedOperation.restoreDeleted) {
          addViolation(
            violations,
            index,
            normalizedOperation,
            "invalid_operation",
            "el payload no contiene campos escribibles",
          );
          return;
        }
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
  return { ...canonicalBatch, operations: normalized };
}
