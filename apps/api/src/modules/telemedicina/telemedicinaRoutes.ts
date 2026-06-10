import { Router as ExpressRouter, type Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import sql from 'mssql';
import { randomUUID } from 'node:crypto';
import { getPool } from '../../db/connection.js';
import { requireAuth } from '../auth/middleware/requireAuth.js';
import { requireSucursalAccess } from '../tenancy/middleware/requireSucursalAccess.js';
import { auditLog } from '../../middleware/auditMiddleware.js';
import type { TelemedicinaSalaDTO } from '@nutriclinica/shared';

const router: Router = ExpressRouter();

router.use(requireAuth, requireSucursalAccess);

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CreateSalaSchema = z.object({
  pacienteId: z.string().uuid(),
  scheduledAt: z.string().datetime().optional(),
  notas: z.string().max(2000).optional(),
});

interface VideoSalaRow {
  id: string;
  paciente_id: string;
  profesional_id: string;
  sucursal_id: string;
  estado: string;
  scheduled_at: Date | null;
  iniciada_at: Date | null;
  finalizada_at: Date | null;
  notas: string | null;
  created_at: Date;
  updated_at: Date;
  row_version: Buffer;
}

function rowToSala(row: VideoSalaRow): TelemedicinaSalaDTO {
  return {
    id: row.id,
    pacienteId: row.paciente_id,
    profesionalId: row.profesional_id,
    sucursalId: row.sucursal_id,
    estado: row.estado as TelemedicinaSalaDTO['estado'],
    scheduledAt: row.scheduled_at?.toISOString() ?? null,
    iniciadaAt: row.iniciada_at?.toISOString() ?? null,
    finalizadaAt: row.finalizada_at?.toISOString() ?? null,
    notas: row.notas,
    createdAt: row.created_at.toISOString(),
  };
}

function canMutate(rol: string): boolean {
  return ['admin', 'nutriologa'].includes(rol);
}

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sucursalId = String(req.sucursalId);
    const pool = await getPool();
    const result = await pool
      .request()
      .input('sucursal_id', sql.UniqueIdentifier(), sucursalId)
      .query<VideoSalaRow>(
        `SELECT id, paciente_id, profesional_id, sucursal_id, estado, scheduled_at,
                iniciada_at, finalizada_at, notas, created_at, updated_at, row_version
           FROM video_salas
          WHERE sucursal_id = @sucursal_id AND deleted_at IS NULL
          ORDER BY created_at DESC`,
      );
    res.json({ salas: result.recordset.map(rowToSala) });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id);
    if (!UUID_REGEX.test(id)) { res.status(400).json({ error: 'id debe ser UUID' }); return; }
    const sucursalId = String(req.sucursalId);
    const pool = await getPool();
    const result = await pool
      .request()
      .input('id', sql.UniqueIdentifier(), id)
      .input('sucursal_id', sql.UniqueIdentifier(), sucursalId)
      .query<VideoSalaRow>(
        `SELECT id, paciente_id, profesional_id, sucursal_id, estado, scheduled_at,
                iniciada_at, finalizada_at, notas, created_at, updated_at, row_version
           FROM video_salas
          WHERE id = @id AND sucursal_id = @sucursal_id AND deleted_at IS NULL`,
      );
    if (result.recordset.length === 0) { res.status(404).json({ error: 'Sala no encontrada' }); return; }
    res.json(rowToSala(result.recordset[0]!));
  } catch (err) {
    next(err);
  }
});

router.post('/',
  auditLog('create', 'video_sala'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user || !canMutate(req.user.rol)) {
        res.status(403).json({ error: 'Rol sin permisos' });
        return;
      }
      const body = CreateSalaSchema.parse(req.body);
      const sucursalId = String(req.sucursalId);
      const id = randomUUID();
      const pool = await getPool();
      await pool
        .request()
        .input('id', sql.UniqueIdentifier(), id)
        .input('paciente_id', sql.UniqueIdentifier(), body.pacienteId)
        .input('profesional_id', sql.UniqueIdentifier(), req.user.sub)
        .input('sucursal_id', sql.UniqueIdentifier(), sucursalId)
        .input('scheduled_at', sql.DateTime2(3), body.scheduledAt ?? null)
        .input('notas', sql.NVarChar(sql.MAX), body.notas ?? null)
        .query(
          `INSERT INTO video_salas (id, paciente_id, profesional_id, sucursal_id, scheduled_at, notas)
           VALUES (@id, @paciente_id, @profesional_id, @sucursal_id, @scheduled_at, @notas)`,
        );
      res.status(201).json({ id });
    } catch (err) {
      next(err);
    }
  },
);

router.patch('/:id/estado',
  auditLog('update', 'video_sala'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user || !canMutate(req.user.rol)) {
        res.status(403).json({ error: 'Rol sin permisos' });
        return;
      }
      const id = String(req.params.id);
      if (!UUID_REGEX.test(id)) { res.status(400).json({ error: 'id debe ser UUID' }); return; }
      const sucursalId = String(req.sucursalId);
      const pool = await getPool();
      const { estado } = z.object({ estado: z.enum(['pendiente', 'activa', 'finalizada', 'cancelada']) }).parse(req.body);

      let extraSet = '';
      if (estado === 'activa') extraSet = ', iniciada_at = SYSUTCDATETIME()';
      if (estado === 'finalizada') extraSet = ', finalizada_at = SYSUTCDATETIME()';

      await pool
        .request()
        .input('id', sql.UniqueIdentifier(), id)
        .input('sucursal_id', sql.UniqueIdentifier(), sucursalId)
        .input('estado', sql.NVarChar(20), estado)
        .query(
          `UPDATE video_salas SET estado = @estado${extraSet}
            WHERE id = @id AND sucursal_id = @sucursal_id AND deleted_at IS NULL`,
        );
      res.json({ updated: 1 });
    } catch (err) {
      next(err);
    }
  },
);

router.delete('/:id',
  auditLog('delete', 'video_sala'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user || !canMutate(req.user.rol)) {
        res.status(403).json({ error: 'Rol sin permisos' });
        return;
      }
      const id = String(req.params.id);
      if (!UUID_REGEX.test(id)) { res.status(400).json({ error: 'id debe ser UUID' }); return; }
      const sucursalId = String(req.sucursalId);
      const pool = await getPool();
      await pool
        .request()
        .input('id', sql.UniqueIdentifier(), id)
        .input('sucursal_id', sql.UniqueIdentifier(), sucursalId)
        .query(`UPDATE video_salas SET deleted_at = SYSUTCDATETIME() WHERE id = @id AND sucursal_id = @sucursal_id AND deleted_at IS NULL`);
      res.json({ deleted: 1 });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
