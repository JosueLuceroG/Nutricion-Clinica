import { Router as ExpressRouter, type Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import sql from 'mssql';
import { SENSITIVE_ACTIONS, type LoginRequest, type RegisterRequest, type Role, type AuthSucursalDTO } from '@nutriclinica/shared';
import { login, register, findProfesionalById, listSucursalesForProfesional, signToken, signPending2faToken, verifyPending2faToken, revokeProfesionalSessions } from './application/authService.js';
import { requireAuth, requireRole } from './middleware/requireAuth.js';
import { getPool } from '../../db/connection.js';
import { isTotpEnabled, verifyTotp, findTotpSecret } from './application/twoFactorService.js';
import { rateLimit } from '../../middleware/rateLimit.js';
import { authorizeSensitiveAction, consumeSensitiveActionGrant, sensitiveActionAuditContext } from './application/sensitiveActionService.js';

const router: Router = ExpressRouter();

const RoleSchemaLocal = z.enum(['admin', 'nutriologa', 'asistente', 'soporte_tecnico', 'auditor', 'facturacion']) satisfies z.ZodType<Role>;

const LoginBodySchema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(1).max(200),
  totpCode: z.string().max(6).optional(),
  pending2faToken: z.string().optional(),
});

const RegisterBodySchema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(1).max(200),
  nombreCompleto: z.string().min(1).max(200),
  rol: RoleSchemaLocal,
  cedulaProfesional: z.string().max(40).optional(),
  telefono: z.string().max(40).optional(),
  sucursalIds: z.array(z.string().uuid()).min(1),
});

const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  keyPrefix: 'auth',
});

const sensitiveActionRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyPrefix: 'sensitive-action',
});

const SensitiveActionSchema = z.enum(SENSITIVE_ACTIONS);
const SensitiveActionGrantBodySchema = z.object({
  action: SensitiveActionSchema,
  password: z.string().min(1).max(200),
  totpCode: z
    .string()
    .regex(/^\d{6}$/)
    .optional(),
});
const ConsumeSensitiveActionGrantBodySchema = z.object({
  action: SensitiveActionSchema,
  grant: z.string().min(1).max(4000),
});

router.post('/login', authRateLimit, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = LoginBodySchema.parse(req.body) satisfies LoginRequest;

    if (body.pending2faToken && body.totpCode) {
      const pool = await getPool();
      let payload;
      try {
        payload = await verifyPending2faToken(body.pending2faToken);
      } catch {
        res.status(401).json({ error: 'Token 2FA inválido o expirado' });
        return;
      }
      const prof = await findProfesionalById(payload.sub);
      if (!prof || !prof.activo || prof.email.toLowerCase() !== payload.email.toLowerCase()) {
        res.status(401).json({ error: 'Profesional no disponible para completar 2FA' });
        return;
      }
      const secret = await findTotpSecret(prof.id);
      if (!secret) {
        res.status(400).json({ error: '2FA no está habilitado' });
        return;
      }
      if (!(await verifyTotp(body.totpCode, secret))) {
        res.status(401).json({ error: 'Código TOTP inválido' });
        return;
      }
      const sucursales = await listSucursalesForProfesional(prof.id);
      const token = await signToken({
        sub: prof.id,
        email: prof.email,
        rol: prof.rol,
        sucursalIds: sucursales.map((s) => s.id),
        totpVerified: true,
        ver: prof.token_version,
      });
      try {
        await pool
          .request()
          .input('id', sql.UniqueIdentifier(), randomUUID())
          .input('profesional_id', sql.UniqueIdentifier(), prof.id)
          .input('entity_type', sql.NVarChar(60), 'auth')
          .input('operacion', sql.NVarChar(20), 'login')
          .input('detalles', sql.NVarChar(sql.MAX), JSON.stringify({ email: body.email, step: '2fa' }))
          .input('ip_address', sql.NVarChar(45), req.ip ?? req.socket.remoteAddress ?? null)
          .input('user_agent', sql.NVarChar(500), req.header('user-agent') ?? null)
          .query(
            `INSERT INTO audit_log (id, sucursal_id, profesional_id, entity_type, entity_id, operacion, detalles, ip_address, user_agent)
             VALUES (@id, NULL, @profesional_id, @entity_type, @profesional_id, @operacion, @detalles, @ip_address, @user_agent)`,
          );
      } catch (_err2) {
        console.warn('[audit] 2fa login audit failed:', (_err2 as Error).message);
      }
      res.json({
        token,
        profesional: {
          id: prof.id,
          email: prof.email,
          nombreCompleto: prof.nombre_completo,
          rol: prof.rol,
        },
        sucursales: sucursales.map((s) => ({
          id: s.id,
          nombre: s.nombre,
          esTitular: s.es_titular,
        })),
        sucursalActivaId: sucursales[0]?.id ?? null,
      });
      return;
    }

    const result = await login(body.email, body.password);
    const twofa = await isTotpEnabled(result.profesional.id);
    if (twofa) {
      const pendingToken = await signPending2faToken({
        sub: result.profesional.id,
        email: result.profesional.email,
      });
      res.json({
        requires2fa: true,
        pending2faToken: pendingToken,
        profesional: result.profesional,
      });
      return;
    }
    try {
      const pool = await getPool();
      await pool
        .request()
        .input('id', sql.UniqueIdentifier(), randomUUID())
        .input('profesional_id', sql.UniqueIdentifier(), result.profesional.id)
        .input('entity_type', sql.NVarChar(60), 'auth')
        .input('operacion', sql.NVarChar(20), 'login')
        .input('detalles', sql.NVarChar(sql.MAX), JSON.stringify({ email: body.email }))
        .input('ip_address', sql.NVarChar(45), req.ip ?? req.socket.remoteAddress ?? null)
        .input('user_agent', sql.NVarChar(500), req.header('user-agent') ?? null)
        .query(
          `INSERT INTO audit_log (id, sucursal_id, profesional_id, entity_type, entity_id, operacion, detalles, ip_address, user_agent)
           VALUES (@id, NULL, @profesional_id, @entity_type, @profesional_id, @operacion, @detalles, @ip_address, @user_agent)`,
        );
    } catch (_err) {
      console.warn('[audit] failed to log login:', (_err as Error).message);
    }
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/logout', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    await revokeProfesionalSessions(req.user.sub);
    try {
      const pool = await getPool();
      await pool
        .request()
        .input('id', sql.UniqueIdentifier(), randomUUID())
        .input('profesional_id', sql.UniqueIdentifier(), req.user.sub)
        .input('entity_type', sql.NVarChar(60), 'auth')
        .input('operacion', sql.NVarChar(20), 'logout')
        .input('detalles', sql.NVarChar(sql.MAX), JSON.stringify({ email: req.user.email }))
        .input('ip_address', sql.NVarChar(45), req.ip ?? req.socket.remoteAddress ?? null)
        .input('user_agent', sql.NVarChar(500), req.header('user-agent') ?? null)
        .query(
          `INSERT INTO audit_log (id, sucursal_id, profesional_id, entity_type, entity_id, operacion, detalles, ip_address, user_agent)
           VALUES (@id, NULL, @profesional_id, @entity_type, @profesional_id, @operacion, @detalles, @ip_address, @user_agent)`,
        );
    } catch (_err) {
      console.warn('[audit] failed to log logout:', (_err as Error).message);
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post('/register', requireAuth, requireRole('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = RegisterBodySchema.parse(req.body) as RegisterRequest;
    const result = await register(body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/sensitive-action-grants', requireAuth, sensitiveActionRateLimit, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const body = SensitiveActionGrantBodySchema.parse(req.body);
    const result = await authorizeSensitiveAction({
      actorId: req.user.sub,
      action: body.action,
      password: body.password,
      totpCode: body.totpCode,
      audit: sensitiveActionAuditContext(req),
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post('/sensitive-action-grants/consume', requireAuth, sensitiveActionRateLimit, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const body = ConsumeSensitiveActionGrantBodySchema.parse(req.body);
    await consumeSensitiveActionGrant({
      actorId: req.user.sub,
      action: body.action,
      grant: body.grant,
      audit: sensitiveActionAuditContext(req),
    });
    res.json({ authorized: true });
  } catch (error) {
    next(error);
  }
});

router.get('/me', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const prof = await findProfesionalById(req.user.sub);
    if (!prof) {
      res.status(404).json({ error: 'Profesional no encontrado' });
      return;
    }
    const sucursales: AuthSucursalDTO[] = (await listSucursalesForProfesional(prof.id)).map((s) => ({
      id: s.id,
      nombre: s.nombre,
      esTitular: s.es_titular,
    }));
    res.json({
      profesional: {
        id: prof.id,
        email: prof.email,
        nombreCompleto: prof.nombre_completo,
        rol: prof.rol,
      },
      sucursales,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
