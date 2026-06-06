import { Router as ExpressRouter, type Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { getPool } from '../../db/connection.js';
import { requireAuth } from '../auth/middleware/requireAuth.js';
import { listSucursalesForProfesional, type SucursalAsignada } from '../auth/application/authService.js';
import { ForbiddenError } from '../../middleware/errorHandler.js';
import type { SucursalDTO, AuthSucursalDTO } from '@nutriclinica/shared';

const router: Router = ExpressRouter();

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface SucursalRow {
  id: string;
  nombre: string;
  direccion: string | null;
  telefono: string | null;
  email: string | null;
  activa: boolean;
  created_at: Date;
  updated_at: Date;
}

function rowToDTO(row: SucursalRow): SucursalDTO {
  return {
    id: row.id,
    nombre: row.nombre,
    direccion: row.direccion,
    telefono: row.telefono,
    email: row.email,
    activa: row.activa,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

router.get('/me', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const sucursales: SucursalAsignada[] = await listSucursalesForProfesional(req.user.sub);
    const result: AuthSucursalDTO[] = sucursales.map((s: SucursalAsignada) => ({
      id: s.id,
      nombre: s.nombre,
      esTitular: s.es_titular,
    }));
    res.json({ sucursales: result, sucursalActivaId: result[0]?.id ?? null });
  } catch (err) {
    next(err);
  }
});

router.get('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const pool = await getPool();
    let result;
    if (req.user.rol === 'admin') {
      result = await pool
        .request()
        .query<SucursalRow>(
          `SELECT id, nombre, direccion, telefono, email, activa, created_at, updated_at
             FROM sucursales WHERE deleted_at IS NULL ORDER BY nombre`,
        );
    } else {
      result = await pool
        .request()
        .input('ids', sql.NVarChar(2000), req.user.sucursalIds.join(','))
        .query<SucursalRow>(
          `SELECT id, nombre, direccion, telefono, email, activa, created_at, updated_at
             FROM sucursales
            WHERE deleted_at IS NULL AND id IN (SELECT value FROM STRING_SPLIT(@ids, ','))
            ORDER BY nombre`,
        );
    }
    res.json({ sucursales: result.recordset.map(rowToDTO) });
  } catch (err) {
    next(err);
  }
});

const CreateSucursalBody = z.object({
  nombre: z.string().min(1).max(120),
  direccion: z.string().max(250).optional().nullable(),
  telefono: z.string().max(40).optional().nullable(),
  email: z.string().email().max(200).optional().nullable(),
  config: z.record(z.unknown()).optional().nullable(),
});

router.post('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    if (req.user.rol !== 'admin') {
      throw new ForbiddenError('Solo admin puede crear sucursales');
    }
    const body = CreateSucursalBody.parse(req.body);
    const { randomUUID } = await import('node:crypto');
    const id = randomUUID();
    const sql = await import('mssql');
    const pool = await getPool();
    const configJson = body.config ? JSON.stringify(body.config) : null;
    await pool
      .request()
      .input('id', sql.default.UniqueIdentifier(), id)
      .input('nombre', sql.default.NVarChar(120), body.nombre)
      .input('direccion', sql.default.NVarChar(250), body.direccion ?? null)
      .input('telefono', sql.default.NVarChar(40), body.telefono ?? null)
      .input('email', sql.default.NVarChar(200), body.email ?? null)
      .input('config', sql.default.NVarChar(sql.MAX), configJson)
      .query(
        `INSERT INTO sucursales (id, nombre, direccion, telefono, email, config_json)
         VALUES (@id, @nombre, @direccion, @telefono, @email, @config)`,
      );
    const created = await pool
      .request()
      .input('id', sql.default.UniqueIdentifier(), id)
      .query<SucursalRow>(
        `SELECT id, nombre, direccion, telefono, email, activa, created_at, updated_at
           FROM sucursales WHERE id = @id`,
      );
    res.status(201).json(rowToDTO(created.recordset[0]!));
  } catch (err) {
    next(err);
  }
});

router.get('/:id', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const id = String(req.params.id);
    if (!UUID_REGEX.test(id)) {
      res.status(400).json({ error: 'id debe ser UUID' });
      return;
    }
    if (req.user.rol !== 'admin' && !req.user.sucursalIds.includes(id)) {
      throw new ForbiddenError('No tienes acceso a esta sucursal');
    }
    const sql = await import('mssql');
    const pool = await getPool();
    const result = await pool
      .request()
      .input('id', sql.default.UniqueIdentifier(), id)
      .query<SucursalRow>(
        `SELECT id, nombre, direccion, telefono, email, activa, created_at, updated_at
           FROM sucursales WHERE id = @id AND deleted_at IS NULL`,
      );
    if (result.recordset.length === 0) {
      res.status(404).json({ error: 'Sucursal no encontrada' });
      return;
    }
    res.json(rowToDTO(result.recordset[0]!));
  } catch (err) {
    next(err);
  }
});

export default router;
