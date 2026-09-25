import { type Request, type Response, type NextFunction } from "express";
import { randomUUID } from "node:crypto";
import sql from "mssql";
import { getPool } from "../db/connection.js";

export type AuditOperation =
  | "create"
  | "read"
  | "update"
  | "delete"
  | "login"
  | "logout"
  | "sync";

export type AuditMiddleware = ((
  req: Request,
  res: Response,
  next: NextFunction,
) => Promise<void>) & {
  auditOperation?: AuditOperation;
  auditEntityType?: string;
  auditRequired?: boolean;
};

function buildAuditLog(
  op: AuditOperation,
  entityType: string,
  required: boolean,
  getEntityId?: (req: Request) => string | string[] | null | undefined,
  getReference?: (req: Request) => string | null | undefined,
) {
  const middleware: AuditMiddleware = async function auditMiddleware(
    req: Request,
    _res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const pool = await getPool();
      const rawEntityId = getEntityId?.(req);
      const candidateEntityId = Array.isArray(rawEntityId)
        ? (rawEntityId[0] ?? null)
        : (rawEntityId ?? null);
      const entityId =
        typeof candidateEntityId === "string" &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          candidateEntityId,
        )
          ? candidateEntityId
          : null;
      const candidateReference = getReference?.(req)?.trim() ?? "";
      const reference =
        /^[A-Za-z0-9][A-Za-z0-9._:/+-]{0,199}$/.test(candidateReference)
          ? candidateReference
          : undefined;
      const reqRecord = req as unknown as Record<string, unknown>;
      const userRecord = reqRecord.user as
        | Record<string, unknown>
        | null
        | undefined;
      const detalles = JSON.stringify({
        phase: "attempt",
        method: req.method,
        path:
          typeof req.route?.path === "string"
            ? `${req.baseUrl ?? ""}${req.route.path}`
            : "UNRESOLVED_ROUTE",
        paramKeys: Object.keys(req.params),
        queryKeys: Object.keys(req.query),
        ...(reference ? { reference } : {}),
      });
      await pool
        .request()
        .input("id", sql.UniqueIdentifier(), randomUUID())
        .input(
          "sucursal_id",
          sql.UniqueIdentifier(),
          reqRecord.sucursalId as string | null,
        )
        .input(
          "profesional_id",
          sql.UniqueIdentifier(),
          userRecord?.sub as string | null,
        )
        .input("entity_type", sql.NVarChar(60), entityType)
        .input("entity_id", sql.UniqueIdentifier(), entityId)
        .input("operacion", sql.NVarChar(20), op)
        .input("detalles", sql.NVarChar(sql.MAX), detalles)
        .input(
          "ip_address",
          sql.NVarChar(45),
          req.ip ?? req.socket.remoteAddress ?? null,
        )
        .input(
          "user_agent",
          sql.NVarChar(500),
          req.header("user-agent")?.slice(0, 500) ?? null,
        )
        .query(
          `INSERT INTO audit_log
             (id, sucursal_id, profesional_id, entity_type, entity_id, operacion, detalles, ip_address, user_agent)
           VALUES
             (@id, @sucursal_id, @profesional_id, @entity_type, @entity_id, @operacion, @detalles, @ip_address, @user_agent)`,
        );
    } catch (error) {
      console.warn(
        "[audit] failed to write audit log:",
        error instanceof Error ? error.name : "UnknownAuditError",
      );
      if (required) {
        const unavailable = new Error("Audit log unavailable") as Error & {
          status?: number;
        };
        unavailable.status = 503;
        next(unavailable);
        return;
      }
    }
    next();
  };
  middleware.auditOperation = op;
  middleware.auditEntityType = entityType;
  middleware.auditRequired = required;
  return middleware;
}

export function auditLog(
  op: AuditOperation,
  entityType: string,
  getEntityId?: (req: Request) => string | string[] | null | undefined,
  getReference?: (req: Request) => string | null | undefined,
) {
  return buildAuditLog(op, entityType, false, getEntityId, getReference);
}

export function requiredAuditLog(
  op: AuditOperation,
  entityType: string,
  getEntityId?: (req: Request) => string | string[] | null | undefined,
  getReference?: (req: Request) => string | null | undefined,
) {
  return buildAuditLog(op, entityType, true, getEntityId, getReference);
}
