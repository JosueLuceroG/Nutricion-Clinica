import { Router as ExpressRouter, type Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import sql from 'mssql';
import { getPool } from '../../db/connection.js';
import { requireAuth } from '../auth/middleware/requireAuth.js';
import { requireSucursalAccess } from '../tenancy/middleware/requireSucursalAccess.js';
import { ForbiddenError } from '../../middleware/errorHandler.js';

const router: Router = ExpressRouter();
router.use(requireAuth, requireSucursalAccess);

const AntropometriaCreateBody = z.object({
  pacienteId: z.string().uuid(),
  profesionalId: z.string().uuid().optional(),
  measuredAt: z.string().datetime(),
  weightKg: z.number().min(0).max(700),
  heightM: z.number().min(0).max(3),
  waistCm: z.number().min(0).max(500).optional().nullable(),
  hipCm: z.number().min(0).max(500).optional().nullable(),
  neckCm: z.number().min(0).max(500).optional().nullable(),
  chestCm: z.number().min(0).max(500).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

function canMutate(rol: string): boolean {
  return ['admin', 'nutriologa'].includes(rol);
}

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pacienteId = typeof req.query.pacienteId === 'string' ? req.query.pacienteId : undefined;
    const sucursalId = String(req.sucursalId);
    const pool = await getPool();
    const r = pool.request().input('sucursal_id', sql.UniqueIdentifier(), sucursalId);
    let query = `SELECT * FROM antropometrias WHERE deleted_at IS NULL AND sucursal_id = @sucursal_id`;
    if (pacienteId) {
      query += ' AND paciente_id = @paciente_id';
      r.input('paciente_id', sql.UniqueIdentifier(), pacienteId);
    }
    query += ' ORDER BY measured_at DESC';
    const result = await r.query(query);
    res.json({ antropometrias: result.recordset });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user || !canMutate(req.user.rol)) {
      throw new ForbiddenError('Rol sin permisos para crear antropometrias');
    }
    const body = AntropometriaCreateBody.parse(req.body);
    const sucursalId = String(req.sucursalId);
    const profesionalId = body.profesionalId ?? req.user.sub;
    const { randomUUID } = await import('node:crypto');
    const id = randomUUID();
    const bmi = body.heightM > 0 ? body.weightKg / (body.heightM * body.heightM) : null;
    const pool = await getPool();
    await pool
      .request()
      .input('id', sql.UniqueIdentifier(), id)
      .input('sucursal_id', sql.UniqueIdentifier(), sucursalId)
      .input('paciente_id', sql.UniqueIdentifier(), body.pacienteId)
      .input('profesional_id', sql.UniqueIdentifier(), profesionalId)
      .input('measured_at', sql.DateTime2(), body.measuredAt)
      .input('weight_kg', sql.Decimal(6, 2), body.weightKg)
      .input('height_m', sql.Decimal(4, 2), body.heightM)
      .input('waist_cm', sql.Decimal(5, 1), body.waistCm ?? null)
      .input('hip_cm', sql.Decimal(5, 1), body.hipCm ?? null)
      .input('neck_cm', sql.Decimal(5, 1), body.neckCm ?? null)
      .input('chest_cm', sql.Decimal(5, 1), body.chestCm ?? null)
      .input('bmi', sql.Decimal(5, 2), bmi)
      .input('notes', sql.NVarChar(sql.MAX), body.notes ?? null)
      .query(
        `INSERT INTO antropometrias
           (id, sucursal_id, paciente_id, profesional_id, measured_at, weight_kg, height_m, waist_cm,
            hip_cm, neck_cm, chest_cm, bmi, notes)
         VALUES
           (@id, @sucursal_id, @paciente_id, @profesional_id, @measured_at, @weight_kg, @height_m, @waist_cm,
            @hip_cm, @neck_cm, @chest_cm, @bmi, @notes)`,
      );
    res.status(201).json({ id, bmi });
  } catch (err) {
    next(err);
  }
});

export default router;
