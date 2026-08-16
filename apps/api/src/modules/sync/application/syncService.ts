import sql from "mssql";
import { getPool } from "../../../db/connection.js";
import {
  SYNCABLE_ENTITIES,
  SYNC_SCHEMA_VERSION,
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
  type SyncActor,
} from "./syncAuthorization.js";
import { HttpError } from "../../../middleware/errorHandler.js";

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
 * con su propio `since`; el cursor es `ISO@id` para que filas con el mismo
 * updated_at no se salten entre páginas (la query usa > since OR (= since AND id > lastId)).
 */
function parseCursor(raw: string | undefined): { since: Date; lastId: string } {
  if (raw) {
    const at = raw.lastIndexOf("@");
    if (at > 0) {
      const t = new Date(raw.slice(0, at));
      if (!isNaN(t.getTime())) {
        return { since: t, lastId: raw.slice(at + 1) };
      }
    }
  }
  return { since: new Date(0), lastId: "" };
}

function cursorFromRow(updatedAt: Date, id: string): string {
  return `${updatedAt.toISOString()}@${id}`;
}

export async function getManifest(): Promise<SyncManifest> {
  const pool = await getPool();
  const timeResult = await pool
    .request()
    .query<{ t: Date }>("SELECT SYSUTCDATETIME() AS t");
  return {
    apiVersion: "v1",
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
): Promise<SyncPullResponse> {
  const pool = await getPool();
  const entities =
    entityFilter && entityFilter.length > 0
      ? entityFilter
      : [...SYNCABLE_ENTITIES];
  const allChanges: SyncPullChange[] = [];
  const cursors: SyncPullCursors = {};
  let hasMore = false;

  for (const entity of entities) {
    const table = ENTITY_TABLES[entity];
    const { since: entitySince, lastId } = parseCursor(since?.[entity]);
    const result = await pool
      .request()
      .input("sucursal_id", sql.UniqueIdentifier(), sucursalId)
      .input("since", sql.DateTime2(), entitySince)
      .input("last_id", sql.UniqueIdentifier(), lastId || "00000000-0000-0000-0000-000000000000")
      .query<{
        id: string;
        updated_at: Date;
        deleted_at: Date | null;
        row_version: Buffer;
      }>(
        `SELECT id, updated_at, deleted_at, row_version
           FROM ${table} WITH (NOLOCK)
          WHERE sucursal_id = @sucursal_id
            AND (updated_at > @since OR (updated_at = @since AND id > @last_id))
          ORDER BY updated_at ASC, id ASC
          OFFSET 0 ROWS FETCH NEXT ${PULL_PAGE_SIZE + 1} ROWS ONLY`,
      );
    const rows = result.recordset;
    const truncated = rows.length > PULL_PAGE_SIZE;
    const limited = truncated ? rows.slice(0, PULL_PAGE_SIZE) : rows;
    for (const r of limited) {
      const detail = await pool
        .request()
        .input("id", sql.UniqueIdentifier(), r.id)
        .input("sucursal_id", sql.UniqueIdentifier(), sucursalId)
        .query<
          Record<string, unknown>
        >(`SELECT * FROM ${table} WHERE id = @id AND sucursal_id = @sucursal_id`);
      const dbRow = detail.recordset[0] ?? null;
      const clientPayload = dbRow ? dbRowToClient(entity, dbRow) : null;
      allChanges.push({
        entity,
        id: r.id,
        op: r.deleted_at ? "delete" : "update",
        payload: clientPayload,
        serverUpdatedAt: r.updated_at.toISOString(),
        serverRowVersion: r.row_version
          ? Buffer.from(r.row_version).toString("base64")
          : "",
      });
    }
    if (limited.length > 0) {
      const last = limited[limited.length - 1]!;
      cursors[entity] = cursorFromRow(last.updated_at, last.id);
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
      const result = await applyOperation(
        tx,
        authorizedBatch.sucursalId,
        actor.id,
        op,
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
        entity: op.entity,
        id: op.id,
        status: "error",
        error: err instanceof Error ? err.message : String(err),
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
): Promise<SyncPushResultItem> {
  const table = ENTITY_TABLES[op.entity];

  if (op.op === "delete") {
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
): Promise<SyncPushResultItem> {
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

  await assertSyncReferencesInSucursal(session, op.entity, sucursalId, op.payload);

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
): Promise<SyncPushResultItem> {
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
  const exists = await session
    .request()
    .input("id", sql.UniqueIdentifier(), op.id)
    .input("sucursal_id", sql.UniqueIdentifier(), sucursalId)
    .query<{
      id: string;
      deleted_at: Date | null;
    }>(`SELECT id, deleted_at FROM ${table} WHERE id = @id AND sucursal_id = @sucursal_id`);

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

  await assertSyncReferencesInSucursal(session, op.entity, sucursalId, op.payload);

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
  sucursalId: string,
  payload: unknown,
): Promise<void> {
  const patientId = readString(payload, "patient_id");
  const consultaId =
    readString(payload, "consulta_id") ??
    readString(payload, "consultation_id");

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
}
