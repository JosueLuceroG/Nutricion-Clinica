import sql from "mssql";
import { getPool } from "../../../db/connection.js";
import {
  API_VERSION,
  canonicalSyncId,
  SYNCABLE_ENTITIES,
  SYNC_SCHEMA_VERSION,
  SYNC_OPERATION_CONTRACT,
  type SyncableEntity,
  type SyncPullChange,
  type SyncPullCursors,
  type SyncPullResponse,
  type SyncPushBatch,
  type SyncPushResponse,
  type SyncPushResultItem,
  type SyncManifest,
} from "@nutriclinica/shared";
import { dbRowToClient, prepareColumnsForWrite } from "./entityColumnMaps.js";
import {
  assertConsultaInSucursal,
  assertPacienteInSucursal,
  type DbSession,
} from "../../tenancy/application/tenantGuards.js";
import {
  authorizeAndNormalizeSyncBatch,
  authorizeSyncPull,
  projectSyncServerPayload,
  type SyncActor,
} from "./syncAuthorization.js";
import { HttpError } from "../../../middleware/errorHandler.js";
import { applyWithReceipt, type SyncApplyResult } from "./syncReceipt.js";

const MAX_BATCH_SIZE = 500;
const PULL_PAGE_SIZE = 1000;

const ENTITY_TABLES: Record<SyncableEntity, string> = {
  pacientes: "pacientes",
  consultas: "consultas",
  antropometrias: "antropometrias",
  lab_panels: "lab_panels",
  planes_alimenticios: "planes_alimenticios",
  adherence_records: "adherence_records",
};

/**
 * Cursor de pull por entidad. Cada entidad pagina de forma independiente
 * con su propio `since`; el cursor es el ROWVERSION de la última fila aplicada.
 */
function parseCursor(
  raw: string | undefined,
  fence: Buffer,
  sucursalId: string,
  entity: SyncableEntity,
): Buffer {
  // Old timestamp cursors require a safe full replay, not a guessed conversion.
  const match = raw?.match(/^rv1:([^:]+):([^:]+):([0-9a-f]{16})$/i);
  const scoped = match &&
    canonicalSyncId(match[1]!) === canonicalSyncId(sucursalId) &&
    match[2] === entity;
  const parsed = Buffer.from(scoped ? match[3]! : "0000000000000000", "hex");
  // A cursor at or beyond the current database horizon can only come from a
  // different/restored database incarnation or malformed client state.
  return Buffer.compare(parsed, fence) >= 0 ? Buffer.alloc(8) : parsed;
}

export async function getManifest(): Promise<SyncManifest> {
  const pool = await getPool();
  const timeResult = await pool
    .request()
    .query<{ t: Date }>("SELECT SYSUTCDATETIME() AS t");
  return {
    apiVersion: "v1",
    operationContract: SYNC_OPERATION_CONTRACT,
    apiContractVersion: API_VERSION,
    syncSchemaVersion: SYNC_SCHEMA_VERSION,
    serverTime: (timeResult.recordset[0]?.t ?? new Date()).toISOString(),
    entities: [...SYNCABLE_ENTITIES],
    maxBatchSize: MAX_BATCH_SIZE,
    supportsDelta: true,
  };
}

export async function pullChanges(
  sucursalId: string,
  since: SyncPullCursors | null,
  entityFilter: SyncableEntity[] | null,
  actor: SyncActor,
): Promise<SyncPullResponse> {
  const entities = authorizeSyncPull(actor, entityFilter);
  const pool = await getPool();
  const allChanges: SyncPullChange[] = [];
  const cursors: SyncPullCursors = {};
  let hasMore = false;
  // Never advance beyond an uncommitted ROWVERSION. A later-committing writer
  // must remain visible on a subsequent pull, even if other writers commit first.
  const fenceResult = await pool.request().query<{ fence: Buffer }>("SELECT MIN_ACTIVE_ROWVERSION() AS fence");
  const fence = fenceResult.recordset[0]!.fence;

  for (const entity of entities) {
    const table = ENTITY_TABLES[entity];
    const entitySince = parseCursor(since?.[entity], fence, sucursalId, entity);
    const result = await pool
      .request()
      .input("sucursal_id", sql.UniqueIdentifier(), sucursalId)
      .input("since_version", sql.VarBinary(8), entitySince)
      .input("safe_upper", sql.VarBinary(8), fence)
      .query<Record<string, unknown> & { id: string; updated_at: Date; deleted_at: Date | null; row_version: Buffer }>(
        `SELECT *
           FROM ${table}
           WHERE sucursal_id = @sucursal_id
             AND row_version > @since_version AND row_version < @safe_upper
           ORDER BY row_version ASC, id ASC
          OFFSET 0 ROWS FETCH NEXT ${PULL_PAGE_SIZE + 1} ROWS ONLY`,
      );
    const rows = result.recordset;
    const truncated = rows.length > PULL_PAGE_SIZE;
    const limited = truncated ? rows.slice(0, PULL_PAGE_SIZE) : rows;
    for (const r of limited) {
      const clientPayload = projectSyncServerPayload(
        entity,
        dbRowToClient(entity, r),
        actor.role,
      );
      if (!clientPayload) {
        throw new HttpError(403, `El rol ${actor.role} no puede leer ${entity}`);
      }
      allChanges.push({
        entity,
        id: r.id,
        op: r.deleted_at ? "delete" : "update",
        payload: clientPayload,
        ...(actor.role === "facturacion"
          ? { partial: true }
          : {}),
        serverUpdatedAt: r.updated_at.toISOString(),
        serverRowVersion: r.row_version
          ? Buffer.from(r.row_version).toString("base64")
          : "",
      });
    }
    if (limited.length > 0) {
      const last = limited[limited.length - 1]!;
      cursors[entity] = `rv1:${canonicalSyncId(sucursalId)}:${entity}:${Buffer.from(last.row_version).toString("hex")}`;
    }
    if (truncated) hasMore = true;
  }

  const serverTimeResult = await pool
    .request()
    .query<{ t: Date }>("SELECT SYSUTCDATETIME() AS t");
  return {
    serverTime: (serverTimeResult.recordset[0]?.t ?? new Date()).toISOString(),
    changes: allChanges,
    hasMore,
    cursors,
  };
}

export async function pushBatch(
  batch: SyncPushBatch,
  actor: SyncActor,
): Promise<SyncPushResponse> {
  if (batch.operations.length < 1 || batch.operations.length > MAX_BATCH_SIZE) {
    throw new HttpError(
      400,
      `El batch debe contener entre 1 y ${MAX_BATCH_SIZE} operaciones`,
    );
  }
  const authorizedBatch = authorizeAndNormalizeSyncBatch(batch, actor);
  const pool = await getPool();
  const results: SyncPushResultItem[] = [];

  for (const op of authorizedBatch.operations) {
    // Cada operación corre en su propia transacción: si algo falla a mitad,
    // se hace rollback y la operación queda como "error" sin efectos parciales.
    const tx = pool.transaction();
    try {
      await tx.begin();
      const result = await applyWithReceipt(
        tx, authorizedBatch.sucursalId, actor, op,
        () => applyOperation(tx, authorizedBatch.sucursalId, actor.id, op),
        () => lockSyncDependencies(tx, authorizedBatch.sucursalId, op),
      );
      await tx.commit();
      results.push(result);
    } catch (err) {
      try {
        await tx.rollback();
      } catch {
        // la transacción ya no está activa; el error original es el importante
      }
      results.push({
        operationId: op.operationId,
        entity: op.entity,
        id: op.id,
        status: "error",
        error:
          err instanceof HttpError && err.status < 500
            ? `SYNC_OPERATION_REJECTED_${err.status}`
            : "SYNC_OPERATION_FAILED",
      });
    }
  }

  const timeResult = await pool
    .request()
    .query<{ t: Date }>("SELECT SYSUTCDATETIME() AS t");
  return {
    results,
    serverTime: (timeResult.recordset[0]?.t ?? new Date()).toISOString(),
  };
}

/**
 * Columnas que el server inyecta desde el contexto de la request (no del
 * payload del cliente). Por ahora:
 *   - profesional_id: el profesional autenticado que está haciendo el push.
 *   - consulta_id: en planes, debe venir en el payload (FK a una consulta
 *     existente); si falta, el item falla con un error claro.
 */
const SERVER_INJECTED_COLUMNS: Record<
  SyncableEntity,
  Record<string, (op: { payload: unknown; profesionalId: string }) => unknown>
> = {
  pacientes: {
    profesional_titular_id: ({ profesionalId }) => profesionalId,
  },
  consultas: {
    profesional_id: ({ profesionalId }) => profesionalId,
  },
  antropometrias: {
    profesional_id: ({ profesionalId }) => profesionalId,
  },
  lab_panels: {
    profesional_id: ({ profesionalId }) => profesionalId,
  },
  planes_alimenticios: {
    profesional_id: ({ profesionalId }) => profesionalId,
  },
  adherence_records: {},
};

async function applyOperation(
  session: DbSession,
  sucursalId: string,
  profesionalId: string,
  op: {
    entity: SyncableEntity;
    id: string;
    op: "create" | "update" | "delete";
    payload: unknown;
    clientUpdatedAt: string;
    expectedRowVersion?: string;
  },
): Promise<SyncApplyResult> {
  const table = ENTITY_TABLES[op.entity];

  if (op.op === "delete") {
    await assertNoActiveSyncDescendants(session, op.entity, op.id, sucursalId);
    if (op.expectedRowVersion) {
      const existing = await session
        .request()
        .input("id", sql.UniqueIdentifier(), op.id)
        .input("sucursal_id", sql.UniqueIdentifier(), sucursalId)
        .query<{
          row_version: Buffer;
          updated_at: Date;
        }>(`SELECT row_version, updated_at FROM ${table} WHERE id = @id AND sucursal_id = @sucursal_id AND deleted_at IS NULL`);
      const current = existing.recordset[0];
      if (current) {
        const currentVersion = Buffer.from(current.row_version).toString(
          "base64",
        );
        if (currentVersion !== op.expectedRowVersion) {
          return {
            entity: op.entity,
            id: op.id,
            status: "conflict",
            serverUpdatedAt: current.updated_at.toISOString(),
            serverRowVersion: currentVersion,
            error: "row_version mismatch — server has newer changes",
          };
        }
      }
    }
    await session
      .request()
      .input("id", sql.UniqueIdentifier(), op.id)
      .input("sucursal_id", sql.UniqueIdentifier(), sucursalId)
      .query(
        `UPDATE ${table} SET deleted_at = SYSUTCDATETIME(), updated_at = SYSUTCDATETIME() WHERE id = @id AND sucursal_id = @sucursal_id AND deleted_at IS NULL`,
      );
    return { entity: op.entity, id: op.id, status: "applied" };
  }

  if (op.op === "create") {
    return applyCreate(session, sucursalId, profesionalId, op);
  }

  return applyUpdate(session, sucursalId, profesionalId, op);
}

async function applyCreate(
  session: DbSession,
  sucursalId: string,
  profesionalId: string,
  op: { entity: SyncableEntity; id: string; payload: unknown },
): Promise<SyncApplyResult> {
  const table = ENTITY_TABLES[op.entity];
  const prepared = prepareColumnsForWrite(op.entity, op.payload);

  const exists = await session
    .request()
    .input("id", sql.UniqueIdentifier(), op.id)
    .input("sucursal_id", sql.UniqueIdentifier(), sucursalId)
    .query<{
      id: string;
    }>(`SELECT id FROM ${table} WHERE id = @id AND sucursal_id = @sucursal_id`);

  if (exists.recordset.length > 0) {
    // Idempotencia: el server ya tiene la fila, el push para esa fila es exitoso.
    return { entity: op.entity, id: op.id, status: "applied" };
  }

  // Validar FKs que el server no puede auto-inferrir (consulta_id en planes).
  // Si el payload no incluye consulta_id para un plan, falla con error claro.
  if (op.entity === "planes_alimenticios") {
    const payload = (op.payload ?? {}) as Record<string, unknown>;
    if (!payload.consulta_id) {
      return {
        entity: op.entity,
        id: op.id,
        status: "error",
        error:
          "planes_alimenticios requiere consulta_id en el payload (FK a una consulta existente)",
      };
    }
  }

  await assertSyncReferencesInSucursal(
    session,
    op.entity,
    op.id,
    sucursalId,
    op.payload,
  );

  const cols: string[] = ["id", "sucursal_id"];
  const values: string[] = ["@id", "@sucursal_id"];
  const req = session
    .request()
    .input("id", sql.UniqueIdentifier(), op.id)
    .input("sucursal_id", sql.UniqueIdentifier(), sucursalId);

  for (const col of prepared) {
    if (col.value === null && !col.nullable) {
      // columna NOT NULL con null del cliente: saltamos para que el DB use DEFAULT
      continue;
    }
    const paramName = `c_${col.dbColumn}`;
    req.input(paramName, col.sqlType(), col.value as never);
    cols.push(`[${col.dbColumn}]`);
    values.push(`@${paramName}`);
  }

  if (op.entity === "consultas") {
    cols.push("[consultation_number]");
    values.push(
      `(SELECT ISNULL(MAX(consultation_number), 0) + 1
          FROM consultas WITH (UPDLOCK, HOLDLOCK)
         WHERE paciente_id = @c_paciente_id AND sucursal_id = @sucursal_id)`,
    );
  }

  // Inyectar columnas server-side desde el actor autenticado.
  const injected = SERVER_INJECTED_COLUMNS[op.entity] ?? {};
  for (const [colName, getValue] of Object.entries(injected)) {
    const paramName = `c_${colName}`;
    req.input(
      paramName,
      sql.UniqueIdentifier(),
      getValue({ payload: op.payload, profesionalId }) as string,
    );
    cols.push(`[${colName}]`);
    values.push(`@${paramName}`);
  }

  await req.query(
    `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${values.join(", ")})`,
  );
  return { entity: op.entity, id: op.id, status: "applied" };
}

async function applyUpdate(
  session: DbSession,
  sucursalId: string,
  _profesionalId: string,
  op: {
    entity: SyncableEntity;
    id: string;
    payload: unknown;
    expectedRowVersion?: string;
  },
): Promise<SyncApplyResult> {
  const table = ENTITY_TABLES[op.entity];
  const prepared = prepareColumnsForWrite(op.entity, op.payload);

  if (op.expectedRowVersion) {
    const existing = await session
      .request()
      .input("id", sql.UniqueIdentifier(), op.id)
      .input("sucursal_id", sql.UniqueIdentifier(), sucursalId)
      .query<{
        row_version: Buffer;
        updated_at: Date;
      }>(`SELECT row_version, updated_at FROM ${table} WHERE id = @id AND sucursal_id = @sucursal_id AND deleted_at IS NULL`);
    const current = existing.recordset[0];
    if (current) {
      const currentVersion = Buffer.from(current.row_version).toString(
        "base64",
      );
      if (currentVersion !== op.expectedRowVersion) {
        return {
          entity: op.entity,
          id: op.id,
          status: "conflict",
          serverUpdatedAt: current.updated_at.toISOString(),
          serverRowVersion: currentVersion,
          error: "row_version mismatch — server has newer changes",
        };
      }
    }
  }

  // Buscamos la fila incluyendo soft-deleted. Si existe con deleted_at
  // puesto, esto es una operación de RESTAURAR (cliente revive un
  // paciente/consulta/etc. eliminado) — la revivimos seteando
  // `deleted_at = NULL` y aplicando los valores del payload.
  const referenceColumns: Partial<Record<SyncableEntity, string>> = {
    consultas: ", paciente_id AS patient_id",
    antropometrias: ", paciente_id AS patient_id",
    lab_panels: ", paciente_id AS patient_id",
    planes_alimenticios:
      ", paciente_id AS patient_id, consulta_id AS consultation_id",
    adherence_records:
      ", paciente_id AS patient_id, consulta_id AS consultation_id",
  };
  const exists = await session
    .request()
    .input("id", sql.UniqueIdentifier(), op.id)
    .input("sucursal_id", sql.UniqueIdentifier(), sucursalId)
    .query<{
      id: string;
      deleted_at: Date | null;
      patient_id?: string;
      consultation_id?: string;
    }>(`SELECT id, deleted_at${referenceColumns[op.entity] ?? ""} FROM ${table} WHERE id = @id AND sucursal_id = @sucursal_id`);

  if (exists.recordset.length === 0) {
    return {
      entity: op.entity,
      id: op.id,
      status: "applied",
      error:
        "server row not found (treated as applied — likely already deleted)",
    };
  }

  const isReviving = exists.recordset[0]!.deleted_at !== null;

  const existing = exists.recordset[0]!;
  const referencePayload = {
    ...(op.payload as Record<string, unknown>),
    ...(existing.patient_id ? { patient_id: existing.patient_id } : {}),
    ...(existing.consultation_id
      ? { consultation_id: existing.consultation_id }
      : {}),
  };
  await assertSyncReferencesInSucursal(
    session,
    op.entity,
    op.id,
    sucursalId,
    referencePayload,
  );

  if (prepared.length === 0 && !isReviving) {
    return { entity: op.entity, id: op.id, status: "applied" };
  }

  const req = session
    .request()
    .input("id", sql.UniqueIdentifier(), op.id)
    .input("sucursal_id", sql.UniqueIdentifier(), sucursalId);
  const setClauses: string[] = [];
  for (const col of prepared) {
    const paramName = `u_${col.dbColumn}`;
    if (col.value === null) {
      setClauses.push(`[${col.dbColumn}] = NULL`);
    } else {
      req.input(paramName, col.sqlType(), col.value as never);
      setClauses.push(`[${col.dbColumn}] = @${paramName}`);
    }
  }
  setClauses.push("updated_at = SYSUTCDATETIME()");
  if (isReviving) {
    // Restaurar: limpiar deleted_at. El payload ya incluye `status = 'active'`
    // así que el WHERE-filter deleted_at IS NULL ya no es necesario.
    setClauses.push("deleted_at = NULL");
  }

  await req.query(
    isReviving
      ? `UPDATE ${table} SET ${setClauses.join(", ")} WHERE id = @id AND sucursal_id = @sucursal_id`
      : `UPDATE ${table} SET ${setClauses.join(", ")} WHERE id = @id AND sucursal_id = @sucursal_id AND deleted_at IS NULL`,
  );
  return { entity: op.entity, id: op.id, status: "applied" };
}

function readString(payload: unknown, key: string): string | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const value = (payload as Record<string, unknown>)[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

async function assertSyncReferencesInSucursal(
  session: DbSession,
  entity: SyncableEntity,
  entityId: string,
  sucursalId: string,
  payload: unknown,
): Promise<void> {
  const patientId = readString(payload, "patient_id");
  const consultaId = entity === "planes_alimenticios"
    ? readString(payload, "consulta_id")
    : entity === "adherence_records"
      ? readString(payload, "consultation_id")
      : undefined;

  if (
    patientId &&
    [
      "consultas",
      "antropometrias",
      "lab_panels",
      "planes_alimenticios",
      "adherence_records",
    ].includes(entity)
  ) {
    await assertPacienteInSucursal(session, patientId, sucursalId);
  }

  if (
    consultaId &&
    ["planes_alimenticios", "adherence_records"].includes(entity)
  ) {
    await assertConsultaInSucursal(session, consultaId, sucursalId, patientId);
  }

  if (entity === "consultas") {
    const anthropometryId = readString(payload, "anthropometry_id");
    const labPanelId = readString(payload, "lab_panel_id");
    if ((anthropometryId || labPanelId) && !patientId) {
      throw new HttpError(400, "La consulta requiere patient_id para validar referencias clínicas");
    }
    if (anthropometryId) {
      await assertPatientOwnedReference(
        session,
        "antropometrias",
        anthropometryId,
        sucursalId,
        patientId!,
      );
    }
    if (labPanelId) {
      await assertPatientOwnedReference(
        session,
        "lab_panels",
        labPanelId,
        sucursalId,
        patientId!,
      );
    }
  }

  if (entity === "pacientes") {
    const consentId = readString(payload, "consentimiento_informado_id");
    if (consentId) {
      await assertPatientOwnedReference(
        session,
        "consentimientos",
        consentId,
        sucursalId,
        entityId,
      );
    }
  }
}

async function assertPatientOwnedReference(
  session: DbSession,
  table: "antropometrias" | "lab_panels" | "consentimientos",
  id: string,
  sucursalId: string,
  patientId: string,
): Promise<void> {
  const result = await session
    .request()
    .input("reference_id", sql.UniqueIdentifier(), id)
    .input("sucursal_id", sql.UniqueIdentifier(), sucursalId)
    .input("paciente_id", sql.UniqueIdentifier(), patientId)
    .query<{ id: string }>(
      `SELECT id
         FROM ${table} WITH (UPDLOCK, HOLDLOCK)
        WHERE id = @reference_id
          AND sucursal_id = @sucursal_id
          AND paciente_id = @paciente_id
          AND deleted_at IS NULL`,
    );
  if (result.recordset.length === 0) {
    throw new HttpError(404, "Referencia clínica no encontrada para el paciente y sucursal activos");
  }
}

async function lockSyncDependencies(
  session: DbSession,
  sucursalId: string,
  op: SyncPushBatch["operations"][number],
): Promise<void> {
  if (op.entity === "pacientes") return;
  let payload = op.payload as Record<string, unknown> | null;
  if (op.op !== "create") {
    const table = ENTITY_TABLES[op.entity];
    const references = await session
      .request()
      .input("id", sql.UniqueIdentifier(), op.id)
      .input("sucursal_id", sql.UniqueIdentifier(), sucursalId)
      .query<{ patient_id?: string; consultation_id?: string }>(
        `SELECT paciente_id AS patient_id${
          op.entity === "planes_alimenticios" || op.entity === "adherence_records"
            ? ", consulta_id AS consultation_id"
            : ""
        }
           FROM ${table}
          WHERE id = @id AND sucursal_id = @sucursal_id`,
      );
    payload = references.recordset[0] ?? null;
  }
  const patientId = readString(payload, "patient_id");
  if (patientId) {
    if (op.op === "delete") {
      await lockExistingSyncParent(session, "pacientes", patientId, sucursalId);
    } else {
      await assertPacienteInSucursal(session, patientId, sucursalId);
    }
  }
  const consultationId = op.entity === "planes_alimenticios"
    ? readString(payload, op.op === "create" ? "consulta_id" : "consultation_id")
    : op.entity === "adherence_records"
      ? readString(payload, "consultation_id")
      : undefined;
  if (consultationId) {
    if (op.op === "delete") {
      await lockExistingSyncParent(
        session,
        "consultas",
        consultationId,
        sucursalId,
        patientId,
      );
    } else {
      await assertConsultaInSucursal(session, consultationId, sucursalId, patientId);
    }
  }
}

async function lockExistingSyncParent(
  session: DbSession,
  table: "pacientes" | "consultas",
  id: string,
  sucursalId: string,
  patientId?: string,
): Promise<void> {
  const request = session
    .request()
    .input("parent_id", sql.UniqueIdentifier(), id)
    .input("sucursal_id", sql.UniqueIdentifier(), sucursalId);
  if (patientId && table === "consultas") {
    request.input("paciente_id", sql.UniqueIdentifier(), patientId);
  }
  const result = await request.query<{ id: string }>(
    `SELECT id
       FROM ${table} WITH (UPDLOCK, HOLDLOCK)
      WHERE id = @parent_id
        AND sucursal_id = @sucursal_id${
          patientId && table === "consultas" ? " AND paciente_id = @paciente_id" : ""
        }`,
  );
  if (result.recordset.length === 0) {
    throw new HttpError(404, "La dependencia de sincronización no existe en la sucursal activa");
  }
}

async function assertNoActiveSyncDescendants(
  session: DbSession,
  entity: SyncableEntity,
  id: string,
  sucursalId: string,
): Promise<void> {
  const checks = entity === "pacientes"
    ? [
        ["consultas", "paciente_id"],
        ["antropometrias", "paciente_id"],
        ["lab_panels", "paciente_id"],
        ["planes_alimenticios", "paciente_id"],
        ["adherence_records", "paciente_id"],
      ] as const
    : entity === "consultas"
      ? [
          ["planes_alimenticios", "consulta_id"],
          ["adherence_records", "consulta_id"],
        ] as const
      : [];
  for (const [table, foreignKey] of checks) {
    const result = await session
      .request()
      .input("parent_id", sql.UniqueIdentifier(), id)
      .input("sucursal_id", sql.UniqueIdentifier(), sucursalId)
      .query<{ id: string }>(
        `SELECT TOP (1) id
           FROM ${table} WITH (UPDLOCK, HOLDLOCK)
          WHERE ${foreignKey} = @parent_id
            AND sucursal_id = @sucursal_id
            AND deleted_at IS NULL`,
      );
    if (result.recordset.length > 0) {
      throw new HttpError(409, "La entidad padre conserva dependencias activas");
    }
  }
}
