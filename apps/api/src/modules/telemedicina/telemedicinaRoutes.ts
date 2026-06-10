import express, { Router as ExpressRouter, type Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import sql from 'mssql';
import { randomUUID } from 'node:crypto';
import { getPool } from '../../db/connection.js';
import { requireAuth } from '../auth/middleware/requireAuth.js';
import { requireSucursalAccess } from '../tenancy/middleware/requireSucursalAccess.js';
import { auditLog } from '../../middleware/auditMiddleware.js';
import { buildTurnConfig } from './turnConfig.js';
import type { TelemedicinaGrabacionDTO, TelemedicinaSalaDTO } from '@nutriclinica/shared';

const router: Router = ExpressRouter();
const turnRouter: Router = ExpressRouter();

router.use(requireAuth, requireSucursalAccess);
turnRouter.use(requireAuth);

turnRouter.get('/turn-config', (_req: Request, res: Response) => {
  const config = buildTurnConfig(process.env as Record<string, string | undefined>);
  res.json(config);
});

export { turnRouter };

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CreateSalaSchema = z.object({
  pacienteId: z.string().uuid(),
  scheduledAt: z.string().datetime().optional(),
  notas: z.string().max(2000).optional(),
});

const UploadGrabacionHeadersSchema = z.object({
  durationMs: z.coerce.number().int().min(0),
  mimeType: z.string().min(1).max(100),
  originalSizeBytes: z.coerce.number().int().min(0),
  iv: z.string().min(1).max(200),
  consentAcceptedAt: z.string().datetime(),
  consentTextVersion: z.string().min(1).max(100),
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

interface VideoGrabacionRow {
  id: string;
  sala_id: string;
  sucursal_id: string;
  created_by: string;
  created_at: Date;
  duration_ms: number;
  mime_type: string;
  original_size_bytes: number;
  encrypted_size_bytes: number;
  iv: string;
  consent_accepted_at: Date;
  consent_text_version: string;
}

interface VideoGrabacionBlobRow extends VideoGrabacionRow {
  encrypted_blob: Buffer;
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

function rowToGrabacion(row: VideoGrabacionRow): TelemedicinaGrabacionDTO {
  return {
    id: row.id,
    salaId: row.sala_id,
    sucursalId: row.sucursal_id,
    createdBy: row.created_by,
    createdAt: row.created_at.toISOString(),
    durationMs: Number(row.duration_ms),
    mimeType: row.mime_type,
    originalSizeBytes: Number(row.original_size_bytes),
    encryptedSizeBytes: Number(row.encrypted_size_bytes),
    iv: row.iv,
    consentAcceptedAt: row.consent_accepted_at.toISOString(),
    consentTextVersion: row.consent_text_version,
  };
}

function canMutate(rol: string): boolean {
  return ['admin', 'nutriologa'].includes(rol);
}

async function ensureSalaInSucursal(salaId: string, sucursalId: string): Promise<boolean> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('id', sql.UniqueIdentifier(), salaId)
    .input('sucursal_id', sql.UniqueIdentifier(), sucursalId)
    .query<{ id: string }>(`SELECT TOP 1 id FROM video_salas WHERE id = @id AND sucursal_id = @sucursal_id AND deleted_at IS NULL`);
  return result.recordset.length > 0;
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

router.get('/:id/grabaciones', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id);
    if (!UUID_REGEX.test(id)) { res.status(400).json({ error: 'id debe ser UUID' }); return; }
    const sucursalId = String(req.sucursalId);
    if (!(await ensureSalaInSucursal(id, sucursalId))) { res.status(404).json({ error: 'Sala no encontrada' }); return; }
    const pool = await getPool();
    const result = await pool
      .request()
      .input('sala_id', sql.UniqueIdentifier(), id)
      .input('sucursal_id', sql.UniqueIdentifier(), sucursalId)
      .query<VideoGrabacionRow>(
        `SELECT id, sala_id, sucursal_id, created_by, created_at, duration_ms, mime_type,
                original_size_bytes, encrypted_size_bytes, iv, consent_accepted_at, consent_text_version
           FROM video_grabaciones
          WHERE sala_id = @sala_id AND sucursal_id = @sucursal_id AND deleted_at IS NULL
          ORDER BY created_at DESC`,
      );
    res.json({ grabaciones: result.recordset.map(rowToGrabacion) });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/grabaciones',
  auditLog('create', 'video_grabacion'),
  express.raw({ type: 'application/octet-stream', limit: '100mb' }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user || !canMutate(req.user.rol)) { res.status(403).json({ error: 'Rol sin permisos' }); return; }
      const id = String(req.params.id);
      if (!UUID_REGEX.test(id)) { res.status(400).json({ error: 'id debe ser UUID' }); return; }
      const sucursalId = String(req.sucursalId);
      if (!(await ensureSalaInSucursal(id, sucursalId))) { res.status(404).json({ error: 'Sala no encontrada' }); return; }
      if (!Buffer.isBuffer(req.body) || req.body.length === 0) { res.status(400).json({ error: 'Body binario requerido' }); return; }

      const headers = UploadGrabacionHeadersSchema.parse({
        durationMs: req.header('x-duration-ms'),
        mimeType: req.header('x-mime-type'),
        originalSizeBytes: req.header('x-original-size-bytes'),
        iv: req.header('x-iv'),
        consentAcceptedAt: req.header('x-consent-accepted-at'),
        consentTextVersion: req.header('x-consent-text-version'),
      });

      const grabacionId = randomUUID();
      const pool = await getPool();
      await pool
        .request()
        .input('id', sql.UniqueIdentifier(), grabacionId)
        .input('sala_id', sql.UniqueIdentifier(), id)
        .input('sucursal_id', sql.UniqueIdentifier(), sucursalId)
        .input('created_by', sql.UniqueIdentifier(), req.user.sub)
        .input('duration_ms', sql.BigInt(), headers.durationMs)
        .input('mime_type', sql.NVarChar(100), headers.mimeType)
        .input('original_size_bytes', sql.BigInt(), headers.originalSizeBytes)
        .input('encrypted_size_bytes', sql.BigInt(), req.body.length)
        .input('iv', sql.NVarChar(200), headers.iv)
        .input('consent_accepted_at', sql.DateTime2(3), headers.consentAcceptedAt)
        .input('consent_text_version', sql.NVarChar(100), headers.consentTextVersion)
        .input('encrypted_blob', sql.VarBinary(sql.MAX), req.body)
        .query(
          `INSERT INTO video_grabaciones
             (id, sala_id, sucursal_id, created_by, duration_ms, mime_type, original_size_bytes,
              encrypted_size_bytes, iv, consent_accepted_at, consent_text_version, encrypted_blob)
           VALUES
             (@id, @sala_id, @sucursal_id, @created_by, @duration_ms, @mime_type, @original_size_bytes,
              @encrypted_size_bytes, @iv, @consent_accepted_at, @consent_text_version, @encrypted_blob)`,
        );

      res.status(201).json({ id: grabacionId });
    } catch (err) {
      next(err);
    }
  },
);

router.get('/:id/grabaciones/:grabacionId/blob',
  auditLog('read', 'video_grabacion', (req) => req.params.grabacionId ?? null),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = String(req.params.id);
      const grabacionId = String(req.params.grabacionId);
      if (!UUID_REGEX.test(id) || !UUID_REGEX.test(grabacionId)) { res.status(400).json({ error: 'ids deben ser UUID' }); return; }
      const sucursalId = String(req.sucursalId);
      const pool = await getPool();
      const result = await pool
        .request()
        .input('id', sql.UniqueIdentifier(), grabacionId)
        .input('sala_id', sql.UniqueIdentifier(), id)
        .input('sucursal_id', sql.UniqueIdentifier(), sucursalId)
        .query<VideoGrabacionBlobRow>(
          `SELECT id, sala_id, sucursal_id, created_by, created_at, duration_ms, mime_type,
                  original_size_bytes, encrypted_size_bytes, iv, consent_accepted_at, consent_text_version,
                  encrypted_blob
             FROM video_grabaciones
            WHERE id = @id AND sala_id = @sala_id AND sucursal_id = @sucursal_id AND deleted_at IS NULL`,
        );
      const row = result.recordset[0];
      if (!row) { res.status(404).json({ error: 'Grabación no encontrada' }); return; }
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('X-Mime-Type', row.mime_type);
      res.setHeader('X-IV', row.iv);
      res.setHeader('X-Duration-Ms', String(row.duration_ms));
      res.setHeader('X-Original-Size-Bytes', String(row.original_size_bytes));
      res.send(row.encrypted_blob);
    } catch (err) {
      next(err);
    }
  },
);

router.delete('/:id/grabaciones/:grabacionId',
  auditLog('delete', 'video_grabacion', (req) => req.params.grabacionId ?? null),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user || !canMutate(req.user.rol)) { res.status(403).json({ error: 'Rol sin permisos' }); return; }
      const id = String(req.params.id);
      const grabacionId = String(req.params.grabacionId);
      if (!UUID_REGEX.test(id) || !UUID_REGEX.test(grabacionId)) { res.status(400).json({ error: 'ids deben ser UUID' }); return; }
      const sucursalId = String(req.sucursalId);
      const pool = await getPool();
      await pool
        .request()
        .input('id', sql.UniqueIdentifier(), grabacionId)
        .input('sala_id', sql.UniqueIdentifier(), id)
        .input('sucursal_id', sql.UniqueIdentifier(), sucursalId)
        .query(`UPDATE video_grabaciones SET deleted_at = SYSUTCDATETIME() WHERE id = @id AND sala_id = @sala_id AND sucursal_id = @sucursal_id AND deleted_at IS NULL`);
      res.json({ deleted: 1 });
    } catch (err) {
      next(err);
    }
  },
);

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
