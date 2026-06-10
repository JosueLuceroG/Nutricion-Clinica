import { Router as ExpressRouter, type Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import sql from 'mssql';
import { type LoginRequest, type RegisterRequest, type Role, type AuthSucursalDTO } from '@nutriclinica/shared';
import { login, register, findProfesionalById, listSucursalesForProfesional } from './application/authService.js';
import { requireAuth } from './middleware/requireAuth.js';
import { getPool } from '../../db/connection.js';

const router: Router = ExpressRouter();

const RoleSchemaLocal = z.enum(['admin', 'nutriologa', 'asistente', 'soporte_tecnico', 'auditor', 'facturacion']) satisfies z.ZodType<Role>;

const LoginBodySchema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(1).max(200),
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

router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = LoginBodySchema.parse(req.body) satisfies LoginRequest;
    const result = await login(body.email, body.password);
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

router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = RegisterBodySchema.parse(req.body) as RegisterRequest;
    const result = await register(body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
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
