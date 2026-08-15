import { randomUUID } from 'node:crypto';
import sql from 'mssql';
import { z } from 'zod';
import type { Request } from 'express';
import type { SensitiveAction } from '@nutriclinica/shared';
import { getPool } from '../../../db/connection.js';
import { ForbiddenError, UnauthorizedError } from '../../../middleware/errorHandler.js';
import { findProfesionalById, verifyPassword } from './authService.js';
import { findTotpSecret, verifyTotp } from './twoFactorService.js';

const GRANT_TTL_SECONDS = 5 * 60;
const GRANT_SCOPE = 'local_database';

const SensitiveActionGrantSchema = z
  .object({
    tokenType: z.literal('sensitive_action'),
    sub: z.string().uuid(),
    action: z.enum(['backup.export', 'backup.restore']),
    scope: z.literal(GRANT_SCOPE),
    jti: z.string().uuid(),
    iat: z.number().int().nonnegative(),
    exp: z.number().int().positive(),
    iss: z.string().min(1),
    aud: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]),
  })
  .strict();

interface SensitiveActionAuditContext {
  ipAddress: string | null;
  userAgent: string | null;
}

export interface SensitiveActionGrantResult {
  grant: string;
  expiresAt: string;
}

export function sensitiveActionAuditContext(req: Request): SensitiveActionAuditContext {
  return {
    ipAddress: req.ip ?? req.socket.remoteAddress ?? null,
    userAgent: req.header('user-agent') ?? null,
  };
}

export async function authorizeSensitiveAction(input: {
  actorId: string;
  action: SensitiveAction;
  password: string;
  totpCode?: string;
  audit: SensitiveActionAuditContext;
}): Promise<SensitiveActionGrantResult> {
  const profesional = await findProfesionalById(input.actorId);
  if (!profesional?.activo || profesional.rol !== 'admin') {
    await auditRejected(input.actorId, input.action, 'role_or_account', input.audit);
    throw new ForbiddenError('La cuenta vigente no está autorizada para esta acción');
  }

  if (!(await verifyPassword(profesional.password_hash, input.password))) {
    await auditRejected(input.actorId, input.action, 'password', input.audit);
    throw new UnauthorizedError('Credenciales de reautenticación inválidas');
  }

  const totpSecret = await findTotpSecret(profesional.id);
  if (totpSecret && (!input.totpCode || !(await verifyTotp(input.totpCode, totpSecret)))) {
    await auditRejected(input.actorId, input.action, 'totp', input.audit);
    throw new UnauthorizedError('Se requiere un código TOTP vigente');
  }

  const issued = await issueSensitiveActionGrant(profesional.id, input.action);
  await storeSensitiveActionGrant({
    id: issued.id,
    actorId: profesional.id,
    action: input.action,
    expiresAt: issued.expiresAt,
    audit: input.audit,
  });
  return { grant: issued.grant, expiresAt: issued.expiresAt.toISOString() };
}

export async function consumeSensitiveActionGrant(input: { actorId: string; action: SensitiveAction; grant: string; audit: SensitiveActionAuditContext }): Promise<void> {
  let payload: z.infer<typeof SensitiveActionGrantSchema>;
  try {
    payload = await verifySensitiveActionGrant(input.grant);
  } catch {
    await auditRejected(input.actorId, input.action, 'invalid_grant', input.audit);
    throw new UnauthorizedError('Autorización sensible inválida o expirada');
  }

  if (payload.sub !== input.actorId || payload.action !== input.action) {
    await auditRejected(input.actorId, input.action, 'grant_scope', input.audit);
    throw new ForbiddenError('La autorización no corresponde a esta acción');
  }
  const profesional = await findProfesionalById(input.actorId);
  if (!profesional?.activo || profesional.rol !== 'admin') {
    await auditRejected(input.actorId, input.action, 'role_or_account', input.audit);
    throw new ForbiddenError('La cuenta vigente ya no está autorizada para esta acción');
  }

  const consumed = await consumeStoredSensitiveActionGrant({
    id: payload.jti,
    actorId: input.actorId,
    action: input.action,
    audit: input.audit,
  });
  if (!consumed) {
    await auditRejected(input.actorId, input.action, 'grant_replay_or_expired', input.audit);
    throw new UnauthorizedError('La autorización sensible ya fue utilizada o expiró');
  }
}

async function issueSensitiveActionGrant(actorId: string, action: SensitiveAction): Promise<{ id: string; grant: string; expiresAt: Date }> {
  const { default: jwt } = await import('jsonwebtoken');
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET no configurado');
  const grantId = randomUUID();
  const grant = jwt.sign(
    {
      tokenType: 'sensitive_action',
      sub: actorId,
      action,
      scope: GRANT_SCOPE,
    },
    secret,
    {
      algorithm: 'HS256',
      expiresIn: GRANT_TTL_SECONDS,
      issuer: process.env.JWT_ISSUER ?? 'nutriclinica-api',
      audience: process.env.JWT_AUDIENCE ?? 'nutriclinica-web',
      jwtid: grantId,
    },
  );
  return { id: grantId, grant, expiresAt: new Date(Date.now() + GRANT_TTL_SECONDS * 1000) };
}

async function verifySensitiveActionGrant(grant: string): Promise<z.infer<typeof SensitiveActionGrantSchema>> {
  const { default: jwt } = await import('jsonwebtoken');
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET no configurado');
  const payload = jwt.verify(grant, secret, {
    algorithms: ['HS256'],
    issuer: process.env.JWT_ISSUER ?? 'nutriclinica-api',
    audience: process.env.JWT_AUDIENCE ?? 'nutriclinica-web',
  });
  return SensitiveActionGrantSchema.parse(payload);
}

async function auditRejected(actorId: string, action: SensitiveAction, reason: string, context: SensitiveActionAuditContext): Promise<void> {
  try {
    await writeSensitiveActionAudit(actorId, action, 'rejected', reason, context);
  } catch (error) {
    console.warn('[audit] sensitive action rejection audit failed:', (error as Error).message);
  }
}

async function storeSensitiveActionGrant(input: { id: string; actorId: string; action: SensitiveAction; expiresAt: Date; audit: SensitiveActionAuditContext }): Promise<void> {
  const pool = await getPool();
  await pool
    .request()
    .input('grant_id', sql.UniqueIdentifier(), input.id)
    .input('profesional_id', sql.UniqueIdentifier(), input.actorId)
    .input('action', sql.NVarChar(40), input.action)
    .input('scope', sql.NVarChar(60), GRANT_SCOPE)
    .input('expires_at', sql.DateTime2, input.expiresAt)
    .input('audit_id', sql.UniqueIdentifier(), randomUUID())
    .input('entity_type', sql.NVarChar(60), 'local_backup_authorization')
    .input('operacion', sql.NVarChar(20), input.action === 'backup.export' ? 'read' : 'update')
    .input('detalles', sql.NVarChar(sql.MAX), JSON.stringify({ action: input.action, outcome: 'authorized', grantId: input.id }))
    .input('ip_address', sql.NVarChar(45), input.audit.ipAddress)
    .input('user_agent', sql.NVarChar(500), input.audit.userAgent).query(`SET XACT_ABORT ON;
      BEGIN TRANSACTION;
      INSERT INTO sensitive_action_grants (id, profesional_id, action, scope, expires_at)
      VALUES (@grant_id, @profesional_id, @action, @scope, @expires_at);
      INSERT INTO audit_log
        (id, sucursal_id, profesional_id, entity_type, entity_id, operacion, detalles, ip_address, user_agent)
      VALUES
        (@audit_id, NULL, @profesional_id, @entity_type, @profesional_id, @operacion, @detalles, @ip_address, @user_agent);
      COMMIT TRANSACTION;`);
}

async function consumeStoredSensitiveActionGrant(input: { id: string; actorId: string; action: SensitiveAction; audit: SensitiveActionAuditContext }): Promise<boolean> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('grant_id', sql.UniqueIdentifier(), input.id)
    .input('profesional_id', sql.UniqueIdentifier(), input.actorId)
    .input('action', sql.NVarChar(40), input.action)
    .input('scope', sql.NVarChar(60), GRANT_SCOPE)
    .input('audit_id', sql.UniqueIdentifier(), randomUUID())
    .input('entity_type', sql.NVarChar(60), 'local_backup_authorization')
    .input('operacion', sql.NVarChar(20), input.action === 'backup.export' ? 'read' : 'update')
    .input('detalles', sql.NVarChar(sql.MAX), JSON.stringify({ action: input.action, outcome: 'consumed', grantId: input.id }))
    .input('ip_address', sql.NVarChar(45), input.audit.ipAddress)
    .input('user_agent', sql.NVarChar(500), input.audit.userAgent).query<{ consumed: boolean }>(`SET XACT_ABORT ON;
      BEGIN TRANSACTION;
      IF NOT EXISTS (
        SELECT 1
          FROM profesionales WITH (UPDLOCK, HOLDLOCK)
         WHERE id = @profesional_id
           AND activo = 1
           AND rol = 'admin'
           AND deleted_at IS NULL
      )
      BEGIN
        ROLLBACK TRANSACTION;
        SELECT CAST(0 AS BIT) AS consumed;
        RETURN;
      END;
      UPDATE sensitive_action_grants WITH (UPDLOCK, ROWLOCK)
         SET consumed_at = SYSUTCDATETIME()
       WHERE id = @grant_id
         AND profesional_id = @profesional_id
         AND action = @action
         AND scope = @scope
         AND consumed_at IS NULL
         AND expires_at > SYSUTCDATETIME();
      IF @@ROWCOUNT = 1
      BEGIN
        INSERT INTO audit_log
          (id, sucursal_id, profesional_id, entity_type, entity_id, operacion, detalles, ip_address, user_agent)
        VALUES
          (@audit_id, NULL, @profesional_id, @entity_type, @profesional_id, @operacion, @detalles, @ip_address, @user_agent);
        COMMIT TRANSACTION;
        SELECT CAST(1 AS BIT) AS consumed;
      END
      ELSE
      BEGIN
        ROLLBACK TRANSACTION;
        SELECT CAST(0 AS BIT) AS consumed;
      END;`);
  return result.recordset[0]?.consumed === true;
}

async function writeSensitiveActionAudit(
  actorId: string,
  action: SensitiveAction,
  outcome: 'authorized' | 'consumed' | 'rejected',
  reasonOrGrantId: string | null,
  context: SensitiveActionAuditContext,
): Promise<void> {
  const pool = await getPool();
  await pool
    .request()
    .input('id', sql.UniqueIdentifier(), randomUUID())
    .input('profesional_id', sql.UniqueIdentifier(), actorId)
    .input('entity_type', sql.NVarChar(60), 'local_backup_authorization')
    .input('entity_id', sql.UniqueIdentifier(), actorId)
    .input('operacion', sql.NVarChar(20), action === 'backup.export' ? 'read' : 'update')
    .input('detalles', sql.NVarChar(sql.MAX), JSON.stringify({ action, outcome, reasonOrGrantId }))
    .input('ip_address', sql.NVarChar(45), context.ipAddress)
    .input('user_agent', sql.NVarChar(500), context.userAgent)
    .query(
      `INSERT INTO audit_log
         (id, sucursal_id, profesional_id, entity_type, entity_id, operacion, detalles, ip_address, user_agent)
       VALUES
         (@id, NULL, @profesional_id, @entity_type, @entity_id, @operacion, @detalles, @ip_address, @user_agent)`,
    );
}
