import { Router as ExpressRouter, type Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import sql from 'mssql';
import { getPool } from '../../db/connection.js';
import { requireAuth } from '../auth/middleware/requireAuth.js';
import { requireSucursalAccess } from '../tenancy/middleware/requireSucursalAccess.js';
import { HttpError, ForbiddenError } from '../../middleware/errorHandler.js';

const router: Router = ExpressRouter({ mergeParams: true });

router.use(requireAuth, requireSucursalAccess);

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CreateSubstitutionBody = z.object({
  originalFoodId: z.string().nullable().optional(),
  substituteFoodId: z.string().min(1),
  mealSlot: z.string().nullable().optional(),
});

const BatchSaveBody = z.object({
  substitutions: z.array(CreateSubstitutionBody),
});

interface SubstitutionRow {
  id: number;
  paciente_id: string;
  original_food_id: string | null;
  substitute_food_id: string;
  meal_slot: string | null;
  created_at: Date;
  updated_at: Date;
  is_active: boolean;
}

function rowToSubstitution(row: SubstitutionRow) {
  return {
    id: row.id,
    pacienteId: row.paciente_id,
    originalFoodId: row.original_food_id,
    substituteFoodId: row.substitute_food_id,
    mealSlot: row.meal_slot,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    isActive: row.is_active,
  };
}

async function assertPatientAccess(pool: sql.ConnectionPool, pacienteId: string, sucursalId: string): Promise<void> {
  const result = await pool
    .request()
    .input('paciente_id', sql.UniqueIdentifier(), pacienteId)
    .input('sucursal_id', sql.UniqueIdentifier(), sucursalId)
    .query<{ id: string }>(
      `SELECT id
         FROM pacientes
        WHERE id = @paciente_id AND sucursal_id = @sucursal_id AND deleted_at IS NULL`,
    );
  if (result.recordset.length === 0) {
    throw new HttpError(404, 'Paciente no encontrado');
  }
}

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pacienteId = String(req.params.pacienteId);
    if (!UUID_REGEX.test(pacienteId)) {
      res.status(400).json({ error: 'pacienteId debe ser UUID' });
      return;
    }
    const sucursalId = String(req.sucursalId);
    const pool = await getPool();
    const result = await pool
      .request()
      .input('paciente_id', sql.UniqueIdentifier(), pacienteId)
      .input('sucursal_id', sql.UniqueIdentifier(), sucursalId)
      .query<SubstitutionRow>(
        `SELECT s.id, s.paciente_id, s.original_food_id, s.substitute_food_id, s.meal_slot,
                s.created_at, s.updated_at, s.is_active
           FROM patient_substitutions s
           INNER JOIN pacientes p ON p.id = s.paciente_id
          WHERE s.paciente_id = @paciente_id
            AND p.sucursal_id = @sucursal_id
            AND p.deleted_at IS NULL
            AND s.is_active = 1
          ORDER BY s.created_at DESC`,
      );
    res.json({ substitutions: result.recordset.map(rowToSubstitution) });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user || !['admin', 'nutriologa', 'asistente'].includes(req.user.rol)) {
      throw new ForbiddenError('Rol sin permisos para modificar sustituciones');
    }
    const pacienteId = String(req.params.pacienteId);
    if (!UUID_REGEX.test(pacienteId)) {
      res.status(400).json({ error: 'pacienteId debe ser UUID' });
      return;
    }
    const body = CreateSubstitutionBody.parse(req.body);
    const pool = await getPool();
    await assertPatientAccess(pool, pacienteId, String(req.sucursalId));
    const result = await pool
      .request()
      .input('paciente_id', sql.UniqueIdentifier(), pacienteId)
      .input('original_food_id', sql.NVarChar(100), body.originalFoodId ?? null)
      .input('substitute_food_id', sql.NVarChar(100), body.substituteFoodId)
      .input('meal_slot', sql.NVarChar(50), body.mealSlot ?? null)
      .query<SubstitutionRow>(
        `INSERT INTO patient_substitutions (paciente_id, original_food_id, substitute_food_id, meal_slot)
         OUTPUT INSERTED.*
         VALUES (@paciente_id, @original_food_id, @substitute_food_id, @meal_slot)`,
      );
    res.status(201).json(rowToSubstitution(result.recordset[0]!));
  } catch (err) {
    next(err);
  }
});

router.put('/:subId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user || !['admin', 'nutriologa', 'asistente'].includes(req.user.rol)) {
      throw new ForbiddenError('Rol sin permisos para modificar sustituciones');
    }
    const pacienteId = String(req.params.pacienteId);
    const subId = Number(req.params.subId);
    if (!UUID_REGEX.test(pacienteId) || Number.isNaN(subId)) {
      res.status(400).json({ error: 'parametros invalidos' });
      return;
    }
    const body = CreateSubstitutionBody.partial().parse(req.body);
    const pool = await getPool();
    await assertPatientAccess(pool, pacienteId, String(req.sucursalId));
    const existing = await pool
      .request()
      .input('id', sql.Int(), subId)
      .input('paciente_id', sql.UniqueIdentifier(), pacienteId)
      .query(`SELECT id FROM patient_substitutions WHERE id = @id AND paciente_id = @paciente_id`);
    if (existing.recordset.length === 0) {
      throw new HttpError(404, 'Sustitucion no encontrada');
    }
    const sets: string[] = [];
    const r = pool.request().input('id', sql.Int(), subId);
    if (body.originalFoodId !== undefined) {
      sets.push('original_food_id = @original_food_id');
      r.input('original_food_id', sql.NVarChar(100), body.originalFoodId);
    }
    if (body.substituteFoodId !== undefined) {
      sets.push('substitute_food_id = @substitute_food_id');
      r.input('substitute_food_id', sql.NVarChar(100), body.substituteFoodId);
    }
    if (body.mealSlot !== undefined) {
      sets.push('meal_slot = @meal_slot');
      r.input('meal_slot', sql.NVarChar(50), body.mealSlot);
    }
    sets.push('updated_at = SYSUTCDATETIME()');
    if (sets.length > 1) {
      await r.query(`UPDATE patient_substitutions SET ${sets.join(', ')} WHERE id = @id`);
    }
    res.json({ updated: 1 });
  } catch (err) {
    next(err);
  }
});

router.delete('/:subId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user || !['admin', 'nutriologa', 'asistente'].includes(req.user.rol)) {
      throw new ForbiddenError('Rol sin permisos para modificar sustituciones');
    }
    const pacienteId = String(req.params.pacienteId);
    const subId = Number(req.params.subId);
    if (!UUID_REGEX.test(pacienteId) || Number.isNaN(subId)) {
      res.status(400).json({ error: 'parametros invalidos' });
      return;
    }
    const pool = await getPool();
    await assertPatientAccess(pool, pacienteId, String(req.sucursalId));
    await pool
      .request()
      .input('id', sql.Int(), subId)
      .input('paciente_id', sql.UniqueIdentifier(), pacienteId)
      .query(`UPDATE patient_substitutions SET is_active = 0, updated_at = SYSUTCDATETIME() WHERE id = @id AND paciente_id = @paciente_id`);
    res.json({ deleted: 1 });
  } catch (err) {
    next(err);
  }
});

router.post('/batch', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user || !['admin', 'nutriologa', 'asistente'].includes(req.user.rol)) {
      throw new ForbiddenError('Rol sin permisos para modificar sustituciones');
    }
    const pacienteId = String(req.params.pacienteId);
    if (!UUID_REGEX.test(pacienteId)) {
      res.status(400).json({ error: 'pacienteId debe ser UUID' });
      return;
    }
    const body = BatchSaveBody.parse(req.body);
    if (body.substitutions.length === 0) {
      res.json({ inserted: 0 });
      return;
    }
    const pool = await getPool();
    await assertPatientAccess(pool, pacienteId, String(req.sucursalId));
    let inserted = 0;
    for (const sub of body.substitutions) {
      await pool
        .request()
        .input('paciente_id', sql.UniqueIdentifier(), pacienteId)
        .input('original_food_id', sql.NVarChar(100), sub.originalFoodId ?? null)
        .input('substitute_food_id', sql.NVarChar(100), sub.substituteFoodId)
        .input('meal_slot', sql.NVarChar(50), sub.mealSlot ?? null)
        .query(
          `INSERT INTO patient_substitutions (paciente_id, original_food_id, substitute_food_id, meal_slot)
           VALUES (@paciente_id, @original_food_id, @substitute_food_id, @meal_slot)`,
        );
      inserted++;
    }
    res.status(201).json({ inserted });
  } catch (err) {
    next(err);
  }
});

export default router;
