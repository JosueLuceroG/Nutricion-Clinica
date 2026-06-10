import { type Request, type Response, type NextFunction } from 'express';
import { randomUUID } from 'node:crypto';
import sql from 'mssql';
import { getPool } from '../db/connection.js';

export type AuditOperation = 'create' | 'read' | 'update' | 'delete' | 'login' | 'logout' | 'sync';

export function auditLog(op: AuditOperation, entityType: string, getEntityId?: (req: Request) => string | null) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const pool = await getPool();
      const entityId = getEntityId?.(req) ?? null;
      const detalles = JSON.stringify({
        method: req.method,
        path: req.originalUrl,
        params: req.params,
        query: req.query,
      });
      await pool
        .request()
        .input('id', sql.UniqueIdentifier(), randomUUID())
        .input('sucursal_id', sql.UniqueIdentifier(), (req as Record<string, unknown>).sucursalId as string | null)
        .input('profesional_id', sql.UniqueIdentifier(), ((req as Record<string, unknown>).user as Record<string, unknown> | null)?.sub as string | null)
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
}
