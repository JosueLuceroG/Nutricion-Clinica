import { Router as ExpressRouter, type Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import sql from 'mssql';
import { getPool } from '../../db/connection.js';
import { requireAuth } from '../auth/middleware/requireAuth.js';
import { requireSucursalAccess } from '../tenancy/middleware/requireSucursalAccess.js';
import { ForbiddenError } from '../../middleware/errorHandler.js';

const router: Router = ExpressRouter();
router.use(requireAuth, requireSucursalAccess);

const PlanStatus = ['draft', 'active', 'paused', 'completed', 'cancelled'] as const;

const PlanCreateBody = z.object({
  pacienteId: z.string().uuid(),
  consultaId: z.string().uuid(),
  profesionalId: z.string().uuid().optional(),
  name: z.string().min(1).max(200),
  description: z.string().max(500).optional().nullable(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  kcalTarget: z.number().int().min(0).max(10000),
  proteinTargetG: z.number().int().min(0).max(500),
  carbsTargetG: z.number().int().min(0).max(1000),
  fatTargetG: z.number().int().min(0).max(500),
  mealsJson: z.string().min(2).max(50000),
  notes: z.string().max(2000).optional().nullable(),
  status: z.enum(PlanStatus).default('draft'),
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
    let query = `SELECT id, sucursal_id, paciente_id, consulta_id, profesional_id, name, description,
                        start_date, end_date, kcal_target, protein_target_g, carbs_target_g,
                        fat_target_g, meals_json, notes, status, created_at, updated_at
                   FROM planes_alimenticios WHERE deleted_at IS NULL AND sucursal_id = @sucursal_id`;
    if (pacienteId) {
      query += ' AND paciente_id = @paciente_id';
      r.input('paciente_id', sql.UniqueIdentifier(), pacienteId);
    }
    query += ' ORDER BY start_date DESC';
    const result = await r.query(query);
    res.json({ planes: result.recordset });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user || !canMutate(req.user.rol)) {
      throw new ForbiddenError('Rol sin permisos para crear planes');
    }
    const body = PlanCreateBody.parse(req.body);
    const sucursalId = String(req.sucursalId);
    const profesionalId = body.profesionalId ?? req.user.sub;
    const { randomUUID } = await import('node:crypto');
    const id = randomUUID();
    const pool = await getPool();
    await pool
      .request()
      .input('id', sql.UniqueIdentifier(), id)
      .input('sucursal_id', sql.UniqueIdentifier(), sucursalId)
      .input('paciente_id', sql.UniqueIdentifier(), body.pacienteId)
      .input('consulta_id', sql.UniqueIdentifier(), body.consultaId)
      .input('profesional_id', sql.UniqueIdentifier(), profesionalId)
      .input('name', sql.NVarChar(200), body.name)
      .input('description', sql.NVarChar(500), body.description ?? null)
      .input('start_date', sql.Date(), body.startDate)
      .input('end_date', sql.Date(), body.endDate ?? null)
      .input('kcal_target', sql.Int(), body.kcalTarget)
      .input('protein_target_g', sql.Int(), body.proteinTargetG)
      .input('carbs_target_g', sql.Int(), body.carbsTargetG)
      .input('fat_target_g', sql.Int(), body.fatTargetG)
      .input('meals_json', sql.NVarChar(sql.MAX), body.mealsJson)
      .input('notes', sql.NVarChar(sql.MAX), body.notes ?? null)
      .input('status', sql.NVarChar(20), body.status)
      .query(
        `INSERT INTO planes_alimenticios
           (id, sucursal_id, paciente_id, consulta_id, profesional_id, name, description, start_date,
            end_date, kcal_target, protein_target_g, carbs_target_g, fat_target_g, meals_json, notes, status)
         VALUES
           (@id, @sucursal_id, @paciente_id, @consulta_id, @profesional_id, @name, @description, @start_date,
            @end_date, @kcal_target, @protein_target_g, @carbs_target_g, @fat_target_g, @meals_json, @notes, @status)`,
      );
    res.status(201).json({ id });
  } catch (err) {
    next(err);
  }
});

export default router;
