import { type Request, type Response, type NextFunction } from 'express';
import { randomUUID } from 'node:crypto';
import sql from 'mssql';
import { getPool } from '../db/connection.js';

export type AuditOperation = 'create' | 'read' | 'update' | 'delete' | 'login' | 'logout' | 'sync';

export type AuditMiddleware = ((req: Request, res: Response, next: NextFunction) => Promise<void>) & {
  auditOperation?: AuditOperation;
  auditEntityType?: string;
};

export function auditLog(op: AuditOperation, entityType: string, getEntityId?: (req: Request) => string | string[] | null | undefined) {
  const middleware: AuditMiddleware = async function auditMiddleware(req: Request, _res: Response, next: NextFunction): Promise<void> {
    try {
      const pool = await getPool();
      const rawEntityId = getEntityId?.(req);
      const entityId = Array.isArray(rawEntityId) ? rawEntityId[0] ?? null : rawEntityId ?? null;
      const reqRecord = req as unknown as Record<string, unknown>;
      const userRecord = reqRecord.user as Record<string, unknown> | null | undefined;
      const detalles = JSON.stringify({
        method: req.method,
        path: req.originalUrl,
        params: req.params,
        query: req.query,
      });
      await pool
        .request()
        .input('id', sql.UniqueIdentifier(), randomUUID())
        .input('sucursal_id', sql.UniqueIdentifier(), reqRecord.sucursalId as string | null)
        .input('profesional_id', sql.UniqueIdentifier(), userRecord?.sub as string | null)
        .input('entity_type', sql.NVarChar(60), entityType)
        .input('entity_id', sql.UniqueIdentifier(), entityId)
        .input('operacion', sql.NVarChar(20), op)
        .input('detalles', sql.NVarChar(sql.MAX), detalles)
        .input('ip_address', sql.NVarChar(45), req.ip ?? req.socket.remoteAddress ?? null)
        .input('user_agent', sql.NVarChar(500), req.header('user-agent') ?? null)
        .query(
          `INSERT INTO audit_log
             (id, sucursal_id, profesional_id, entity_type, entity_id, operacion, detalles, ip_address, user_agent)
           VALUES
             (@id, @sucursal_id, @profesional_id, @entity_type, @entity_id, @operacion, @detalles, @ip_address, @user_agent)`,
        );
    } catch (_err) {
      console.warn('[audit] failed to write audit log:', (_err as Error).message);
    }
    next();
  };
  middleware.auditOperation = op;
  middleware.auditEntityType = entityType;
  return middleware;
}
