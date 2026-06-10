import { Router as ExpressRouter, type Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import sql from 'mssql';
import { getPool } from '../../db/connection.js';
import { requireAuth } from '../auth/middleware/requireAuth.js';
import { requireSucursalAccess } from '../tenancy/middleware/requireSucursalAccess.js';
import { assertConsultaInSucursal, assertPacienteInSucursal } from '../tenancy/application/tenantGuards.js';
import { ForbiddenError } from '../../middleware/errorHandler.js';

const router: Router = ExpressRouter();
router.use(requireAuth, requireSucursalAccess);

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const AdherenceSourceSchema = z.enum(['consulta', 'portal', 'app', 'llamada']);

const AdherenceCreateBody = z.object({
  pacienteId: z.string().uuid(),
  consultaId: z.string().uuid().optional().nullable(),
  source: AdherenceSourceSchema.default('consulta'),
  date: z.string().regex(DATE_ONLY_REGEX),
  adherenceMenu: z.number().min(0).max(100),
  adherenceWater: z.number().min(0).max(100),
  adherenceActivity: z.number().min(0).max(100),
  adherenceSupplements: z.number().min(0).max(100),
  adherenceSleep: z.number().min(0).max(100),
  hungerAvg: z.number().min(1).max(10).optional().nullable(),
  satietyAvg: z.number().min(1).max(10).optional().nullable(),
  moodAvg: z.number().min(1).max(10).optional().nullable(),
  energyAvg: z.number().min(1).max(10).optional().nullable(),
  intercurrentEvents: z.string().max(1000).default(''),
  barriers: z.string().max(1000).default(''),
  facilitators: z.string().max(1000).default(''),
  mealsLogged: z.string().max(2000).default(''),
  notes: z.string().max(2000).default(''),
});

const AdherenceUpdateBody = AdherenceCreateBody.partial().omit({ pacienteId: true });

function canMutate(rol: string): boolean {
  return ['admin', 'nutriologa'].includes(rol);
}

function dateFromDateOnly(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year!, month! - 1, day!));
}

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pacienteId = typeof req.query.pacienteId === 'string' ? req.query.pacienteId : undefined;
    const sucursalId = String(req.sucursalId);
    const pool = await getPool();
    const r = pool.request().input('sucursal_id', sql.UniqueIdentifier(), sucursalId);
    let query = `SELECT * FROM adherence_records WHERE deleted_at IS NULL AND sucursal_id = @sucursal_id`;
    if (pacienteId && UUID_REGEX.test(pacienteId)) {
      query += ' AND paciente_id = @paciente_id';
      r.input('paciente_id', sql.UniqueIdentifier(), pacienteId);
    }
    query += ' ORDER BY record_date DESC, created_at DESC';
    const result = await r.query(query);
    res.json({ records: result.recordset });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user || !canMutate(req.user.rol)) {
      throw new ForbiddenError('Rol sin permisos para crear registros de adherencia');
    }
    const body = AdherenceCreateBody.parse(req.body);
    const sucursalId = String(req.sucursalId);
    const { randomUUID } = await import('node:crypto');
    const id = randomUUID();
    const pool = await getPool();
    await assertPacienteInSucursal(pool, body.pacienteId, sucursalId);
    if (body.consultaId) {
      await assertConsultaInSucursal(pool, body.consultaId, sucursalId, body.pacienteId);
    }

    await pool
      .request()
      .input('id', sql.UniqueIdentifier(), id)
      .input('sucursal_id', sql.UniqueIdentifier(), sucursalId)
      .input('paciente_id', sql.UniqueIdentifier(), body.pacienteId)
      .input('consulta_id', sql.UniqueIdentifier(), body.consultaId ?? null)
      .input('source', sql.NVarChar(20), body.source)
      .input('record_date', sql.Date(), dateFromDateOnly(body.date))
      .input('adherence_menu', sql.Decimal(5, 2), body.adherenceMenu)
      .input('adherence_water', sql.Decimal(5, 2), body.adherenceWater)
      .input('adherence_activity', sql.Decimal(5, 2), body.adherenceActivity)
      .input('adherence_supplements', sql.Decimal(5, 2), body.adherenceSupplements)
      .input('adherence_sleep', sql.Decimal(5, 2), body.adherenceSleep)
      .input('hunger_avg', sql.Decimal(4, 1), body.hungerAvg ?? null)
      .input('satiety_avg', sql.Decimal(4, 1), body.satietyAvg ?? null)
      .input('mood_avg', sql.Decimal(4, 1), body.moodAvg ?? null)
      .input('energy_avg', sql.Decimal(4, 1), body.energyAvg ?? null)
      .input('intercurrent_events', sql.NVarChar(1000), body.intercurrentEvents)
      .input('barriers', sql.NVarChar(1000), body.barriers)
      .input('facilitators', sql.NVarChar(1000), body.facilitators)
      .input('meals_logged', sql.NVarChar(2000), body.mealsLogged)
      .input('notes', sql.NVarChar(2000), body.notes)
      .query(
        `INSERT INTO adherence_records
           (id, sucursal_id, paciente_id, consulta_id, source, record_date,
            adherence_menu, adherence_water, adherence_activity, adherence_supplements, adherence_sleep,
            hunger_avg, satiety_avg, mood_avg, energy_avg,
            intercurrent_events, barriers, facilitators, meals_logged, notes)
         VALUES
           (@id, @sucursal_id, @paciente_id, @consulta_id, @source, @record_date,
            @adherence_menu, @adherence_water, @adherence_activity, @adherence_supplements, @adherence_sleep,
            @hunger_avg, @satiety_avg, @mood_avg, @energy_avg,
            @intercurrent_events, @barriers, @facilitators, @meals_logged, @notes)`,
      );

    res.status(201).json({ id });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user || !canMutate(req.user.rol)) {
      throw new ForbiddenError('Rol sin permisos para editar registros de adherencia');
    }
    const id = String(req.params.id);
    if (!UUID_REGEX.test(id)) {
      res.status(400).json({ error: 'id debe ser UUID' });
      return;
    }
    const body = AdherenceUpdateBody.parse(req.body);
    const sucursalId = String(req.sucursalId);
    const pool = await getPool();

    const existing = await pool
      .request()
      .input('id', sql.UniqueIdentifier(), id)
      .input('sucursal_id', sql.UniqueIdentifier(), sucursalId)
      .query<{ id: string; paciente_id: string }>('SELECT id, paciente_id FROM adherence_records WHERE id = @id AND sucursal_id = @sucursal_id AND deleted_at IS NULL');

    if (existing.recordset.length === 0) {
      res.status(404).json({ error: 'Registro de adherencia no encontrado' });
      return;
    }

    if (body.consultaId) {
      await assertConsultaInSucursal(pool, body.consultaId, sucursalId, existing.recordset[0]!.paciente_id);
    }

    const sets: string[] = [];
    const r = pool.request().input('id', sql.UniqueIdentifier(), id).input('sucursal_id', sql.UniqueIdentifier(), sucursalId);

    if (body.consultaId !== undefined) { r.input('consulta_id', sql.UniqueIdentifier(), body.consultaId ?? null); sets.push('consulta_id = @consulta_id'); }
    if (body.source !== undefined) { r.input('source', sql.NVarChar(20), body.source); sets.push('source = @source'); }
    if (body.date !== undefined) { r.input('record_date', sql.Date(), dateFromDateOnly(body.date)); sets.push('record_date = @record_date'); }
    if (body.adherenceMenu !== undefined) { r.input('adherence_menu', sql.Decimal(5, 2), body.adherenceMenu); sets.push('adherence_menu = @adherence_menu'); }
    if (body.adherenceWater !== undefined) { r.input('adherence_water', sql.Decimal(5, 2), body.adherenceWater); sets.push('adherence_water = @adherence_water'); }
    if (body.adherenceActivity !== undefined) { r.input('adherence_activity', sql.Decimal(5, 2), body.adherenceActivity); sets.push('adherence_activity = @adherence_activity'); }
    if (body.adherenceSupplements !== undefined) { r.input('adherence_supplements', sql.Decimal(5, 2), body.adherenceSupplements); sets.push('adherence_supplements = @adherence_supplements'); }
    if (body.adherenceSleep !== undefined) { r.input('adherence_sleep', sql.Decimal(5, 2), body.adherenceSleep); sets.push('adherence_sleep = @adherence_sleep'); }
    if (body.hungerAvg !== undefined) { r.input('hunger_avg', sql.Decimal(4, 1), body.hungerAvg ?? null); sets.push('hunger_avg = @hunger_avg'); }
    if (body.satietyAvg !== undefined) { r.input('satiety_avg', sql.Decimal(4, 1), body.satietyAvg ?? null); sets.push('satiety_avg = @satiety_avg'); }
    if (body.moodAvg !== undefined) { r.input('mood_avg', sql.Decimal(4, 1), body.moodAvg ?? null); sets.push('mood_avg = @mood_avg'); }
    if (body.energyAvg !== undefined) { r.input('energy_avg', sql.Decimal(4, 1), body.energyAvg ?? null); sets.push('energy_avg = @energy_avg'); }
    if (body.intercurrentEvents !== undefined) { r.input('intercurrent_events', sql.NVarChar(1000), body.intercurrentEvents); sets.push('intercurrent_events = @intercurrent_events'); }
    if (body.barriers !== undefined) { r.input('barriers', sql.NVarChar(1000), body.barriers); sets.push('barriers = @barriers'); }
    if (body.facilitators !== undefined) { r.input('facilitators', sql.NVarChar(1000), body.facilitators); sets.push('facilitators = @facilitators'); }
    if (body.mealsLogged !== undefined) { r.input('meals_logged', sql.NVarChar(2000), body.mealsLogged); sets.push('meals_logged = @meals_logged'); }
    if (body.notes !== undefined) { r.input('notes', sql.NVarChar(2000), body.notes); sets.push('notes = @notes'); }

    if (sets.length === 0) {
      res.status(400).json({ error: 'No hay campos para actualizar' });
      return;
    }

    sets.push('updated_at = SYSUTCDATETIME()');
    await r.query(`UPDATE adherence_records SET ${sets.join(', ')} WHERE id = @id AND sucursal_id = @sucursal_id AND deleted_at IS NULL`);
    res.json({ id });
  } catch (err) {
    next(err);
  }
});

export default router;
