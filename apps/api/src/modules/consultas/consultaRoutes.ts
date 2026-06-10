import { Router as ExpressRouter, type Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import sql from 'mssql';
import { getPool } from '../../db/connection.js';
import { requireAuth } from '../auth/middleware/requireAuth.js';
import { requireSucursalAccess } from '../tenancy/middleware/requireSucursalAccess.js';
import { assertPacienteInSucursal } from '../tenancy/application/tenantGuards.js';
import { ForbiddenError } from '../../middleware/errorHandler.js';

const router: Router = ExpressRouter();
router.use(requireAuth, requireSucursalAccess);

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ConsultaStatus = ['scheduled', 'in-progress', 'completed', 'cancelled'] as const;

const ConsultaCreateBody = z.object({
  pacienteId: z.string().uuid(),
  profesionalId: z.string().uuid().optional(),
  consultationDate: z.string().datetime(),
  status: z.enum(ConsultaStatus).default('scheduled'),
  reason: z.string().min(1).max(500),
  subjective: z.string().max(5000).optional().nullable(),
  objective: z.string().max(5000).optional().nullable(),
  assessment: z.string().max(5000).optional().nullable(),
  plan: z.string().max(5000).optional().nullable(),
  vitalsJson: z.string().max(20000).optional().nullable(),
  nextVisitDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
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
    let query = `SELECT id, sucursal_id, paciente_id, profesional_id, consultation_number, consultation_date,
                        status, reason, subjective, objective, assessment, plan, vitals_json, next_visit_date,
                        created_at, updated_at
                   FROM consultas WHERE deleted_at IS NULL AND sucursal_id = @sucursal_id`;
    if (pacienteId && UUID_REGEX.test(pacienteId)) {
      query += ' AND paciente_id = @paciente_id';
      r.input('paciente_id', sql.UniqueIdentifier(), pacienteId);
    }
    query += ' ORDER BY consultation_date DESC';
    const result = await r.query(query);
    res.json({ consultas: result.recordset });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user || !canMutate(req.user.rol)) {
      throw new ForbiddenError('Rol sin permisos para crear consultas');
    }
    const body = ConsultaCreateBody.parse(req.body);
    const sucursalId = String(req.sucursalId);
    const profesionalId = body.profesionalId ?? req.user.sub;
    const { randomUUID } = await import('node:crypto');
    const id = randomUUID();
    const pool = await getPool();
    await assertPacienteInSucursal(pool, body.pacienteId, sucursalId);
    const consultNumResult = await pool
      .request()
      .input('paciente_id', sql.UniqueIdentifier(), body.pacienteId)
      .input('sucursal_id', sql.UniqueIdentifier(), sucursalId)
      .query<{ next_num: number }>(
        `SELECT ISNULL(MAX(consultation_number), 0) + 1 AS next_num
           FROM consultas WHERE paciente_id = @paciente_id AND sucursal_id = @sucursal_id AND deleted_at IS NULL`,
      );
    const consultationNumber = consultNumResult.recordset[0]?.next_num ?? 1;
    await pool
      .request()
      .input('id', sql.UniqueIdentifier(), id)
      .input('sucursal_id', sql.UniqueIdentifier(), sucursalId)
      .input('paciente_id', sql.UniqueIdentifier(), body.pacienteId)
      .input('profesional_id', sql.UniqueIdentifier(), profesionalId)
      .input('consultation_number', sql.Int(), consultationNumber)
      .input('consultation_date', sql.DateTime2(), body.consultationDate)
      .input('status', sql.NVarChar(20), body.status)
      .input('reason', sql.NVarChar(500), body.reason)
      .input('subjective', sql.NVarChar(sql.MAX), body.subjective ?? null)
      .input('objective', sql.NVarChar(sql.MAX), body.objective ?? null)
      .input('assessment', sql.NVarChar(sql.MAX), body.assessment ?? null)
      .input('plan', sql.NVarChar(sql.MAX), body.plan ?? null)
      .input('vitals_json', sql.NVarChar(sql.MAX), body.vitalsJson ?? null)
      .input('next_visit_date', sql.Date(), body.nextVisitDate ?? null)
      .query(
        `INSERT INTO consultas
           (id, sucursal_id, paciente_id, profesional_id, consultation_number, consultation_date, status,
            reason, subjective, objective, assessment, plan, vitals_json, next_visit_date)
         VALUES
           (@id, @sucursal_id, @paciente_id, @profesional_id, @consultation_number, @consultation_date, @status,
            @reason, @subjective, @objective, @assessment, @plan, @vitals_json, @next_visit_date)`,
      );
    res.status(201).json({ id, consultationNumber });
  } catch (err) {
    next(err);
  }
});

export default router;
