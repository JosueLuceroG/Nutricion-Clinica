import { Router as ExpressRouter, type Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { LoginRequest, RegisterRequest, type Role, type AuthSucursalDTO } from '@nutriclinica/shared';
import { login, register, findProfesionalById, listSucursalesForProfesional } from './application/authService.js';
import { requireAuth } from './middleware/requireAuth.js';

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
