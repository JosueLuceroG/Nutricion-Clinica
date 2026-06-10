import { Router as ExpressRouter, type Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import sql from 'mssql';
import { randomUUID } from 'node:crypto';
import { getPool } from '../../db/connection.js';
import { requireAuth } from '../auth/middleware/requireAuth.js';
import { requireSucursalAccess } from '../tenancy/middleware/requireSucursalAccess.js';
import { ForbiddenError } from '../../middleware/errorHandler.js';
import { auditLog } from '../../middleware/auditMiddleware.js';

const router: Router = ExpressRouter({ mergeParams: true });

router.use(requireAuth, requireSucursalAccess);

const TIPO_VALUES = [
  'tratamiento', 'datos_personales', 'fotografia',
  'investigacion', 'comunicacion', 'terminos_servicio',
] as const;

const ConsentimientoCreateBody = z.object({
  tipo: z.enum(TIPO_VALUES),
  titulo: z.string().min(1).max(200),
  contenidoHtml: z.string().min(1),
});

const ConsentimientoUpdateBody = z.object({
  aceptado: z.boolean(),
  ipAddress: z.string().max(45).optional(),
});

interface ConsentimientoRow {
  id: string;
  paciente_id: string;
  sucursal_id: string;
  tipo: string;
  titulo: string;
  contenido_html: string;
  version: number;
  aceptado: boolean;
  fecha_aceptacion: Date | null;
  ip_address: string | null;
  revocado: boolean;
  fecha_revocacion: Date | null;
  created_at: Date;
  updated_at: Date;
  row_version: Buffer;
}

function rowToConsentimiento(row: ConsentimientoRow): Record<string, unknown> {
  return {
    id: row.id,
    pacienteId: row.paciente_id,
    sucursalId: row.sucursal_id,
    tipo: row.tipo,
    titulo: row.titulo,
    contenidoHtml: row.contenido_html,
    version: row.version,
    aceptado: row.aceptado,
    fechaAceptacion: row.fecha_aceptacion?.toISOString() ?? null,
    ipAddress: row.ip_address,
    revocado: row.revocado,
    fechaRevocacion: row.fecha_revocacion?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function canMutate(rol: string): boolean {
  return ['admin', 'nutriologa', 'asistente'].includes(rol);
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
      .query<ConsentimientoRow>(
        `SELECT id, paciente_id, sucursal_id, tipo, titulo, contenido_html, version,
                aceptado, fecha_aceptacion, ip_address, revocado, fecha_revocacion,
                created_at, updated_at, row_version
           FROM consentimientos
          WHERE paciente_id = @paciente_id AND sucursal_id = @sucursal_id AND deleted_at IS NULL
          ORDER BY created_at DESC`,
      );
    res.json({ consentimientos: result.recordset.map(rowToConsentimiento) });
  } catch (err) {
    next(err);
  }
});

router.post('/',
  auditLog('create', 'consentimiento', (req) => req.params.pacienteId),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user || !canMutate(req.user.rol)) {
        throw new ForbiddenError('Rol sin permisos');
      }
      const pacienteId = String(req.params.pacienteId);
      if (!UUID_REGEX.test(pacienteId)) {
        res.status(400).json({ error: 'pacienteId debe ser UUID' });
        return;
      }
      const body = ConsentimientoCreateBody.parse(req.body);
      const sucursalId = String(req.sucursalId);
      const id = randomUUID();
      const pool = await getPool();
      await pool
        .request()
        .input('id', sql.UniqueIdentifier(), id)
        .input('paciente_id', sql.UniqueIdentifier(), pacienteId)
        .input('sucursal_id', sql.UniqueIdentifier(), sucursalId)
        .input('tipo', sql.NVarChar(60), body.tipo)
        .input('titulo', sql.NVarChar(200), body.titulo)
        .input('contenido_html', sql.NVarChar(sql.MAX), body.contenidoHtml)
        .query(
          `INSERT INTO consentimientos (id, paciente_id, sucursal_id, tipo, titulo, contenido_html)
           VALUES (@id, @paciente_id, @sucursal_id, @tipo, @titulo, @contenido_html)`,
        );
      res.status(201).json({ id });
    } catch (err) {
      next(err);
    }
  },
);

router.patch('/:id',
  auditLog('update', 'consentimiento', (req) => req.params.id),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user || !canMutate(req.user.rol)) {
        throw new ForbiddenError('Rol sin permisos');
      }
      const pacienteId = String(req.params.pacienteId);
      const id = String(req.params.id);
      if (!UUID_REGEX.test(pacienteId) || !UUID_REGEX.test(id)) {
        res.status(400).json({ error: 'IDs deben ser UUID' });
        return;
      }
      const body = ConsentimientoUpdateBody.parse(req.body);
      const sucursalId = String(req.sucursalId);
      const pool = await getPool();
      const now = new Date().toISOString();
      if (body.aceptado) {
        await pool
          .request()
          .input('id', sql.UniqueIdentifier(), id)
          .input('paciente_id', sql.UniqueIdentifier(), pacienteId)
          .input('sucursal_id', sql.UniqueIdentifier(), sucursalId)
          .input('ip_address', sql.NVarChar(45), body.ipAddress ?? req.ip ?? null)
          .input('fecha_aceptacion', sql.DateTime2(3), now)
          .query(
            `UPDATE consentimientos
                SET aceptado = 1, fecha_aceptacion = @fecha_aceptacion, ip_address = @ip_address, revocado = 0
              WHERE id = @id AND paciente_id = @paciente_id AND sucursal_id = @sucursal_id AND deleted_at IS NULL`,
          );
      } else {
        await pool
          .request()
          .input('id', sql.UniqueIdentifier(), id)
          .input('paciente_id', sql.UniqueIdentifier(), pacienteId)
          .input('sucursal_id', sql.UniqueIdentifier(), sucursalId)
          .query(
            `UPDATE consentimientos
                SET aceptado = 0, fecha_aceptacion = NULL, revocado = 1, fecha_revocacion = SYSUTCDATETIME()
              WHERE id = @id AND paciente_id = @paciente_id AND sucursal_id = @sucursal_id AND deleted_at IS NULL`,
          );
      }
      res.json({ updated: 1 });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
