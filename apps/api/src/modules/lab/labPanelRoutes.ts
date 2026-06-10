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

const LabPanelCreateBody = z.object({
  pacienteId: z.string().uuid(),
  profesionalId: z.string().uuid().optional(),
  takenAt: z.string().datetime(),
  labName: z.string().max(200).optional().nullable(),
  resultsJson: z.string().min(2).max(50000),
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
    let query = `SELECT id, sucursal_id, paciente_id, profesional_id, taken_at, lab_name, results_json, notes,
                        created_at, updated_at
                   FROM lab_panels WHERE deleted_at IS NULL AND sucursal_id = @sucursal_id`;
    if (pacienteId) {
      query += ' AND paciente_id = @paciente_id';
      r.input('paciente_id', sql.UniqueIdentifier(), pacienteId);
    }
    query += ' ORDER BY taken_at DESC';
    const result = await r.query(query);
    res.json({ labPanels: result.recordset });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user || !canMutate(req.user.rol)) {
      throw new ForbiddenError('Rol sin permisos para crear lab panels');
    }
    const body = LabPanelCreateBody.parse(req.body);
    const sucursalId = String(req.sucursalId);
    const profesionalId = body.profesionalId ?? req.user.sub;
    const { randomUUID } = await import('node:crypto');
    const id = randomUUID();
    const pool = await getPool();
    await assertPacienteInSucursal(pool, body.pacienteId, sucursalId);
    await pool
      .request()
      .input('id', sql.UniqueIdentifier(), id)
      .input('sucursal_id', sql.UniqueIdentifier(), sucursalId)
      .input('paciente_id', sql.UniqueIdentifier(), body.pacienteId)
      .input('profesional_id', sql.UniqueIdentifier(), profesionalId)
      .input('taken_at', sql.DateTime2(), body.takenAt)
      .input('lab_name', sql.NVarChar(200), body.labName ?? null)
      .input('results_json', sql.NVarChar(sql.MAX), body.resultsJson)
      .input('notes', sql.NVarChar(sql.MAX), body.notes ?? null)
      .query(
        `INSERT INTO lab_panels
           (id, sucursal_id, paciente_id, profesional_id, taken_at, lab_name, results_json, notes)
         VALUES
           (@id, @sucursal_id, @paciente_id, @profesional_id, @taken_at, @lab_name, @results_json, @notes)`,
      );
    res.status(201).json({ id });
  } catch (err) {
    next(err);
  }
});

export default router;
