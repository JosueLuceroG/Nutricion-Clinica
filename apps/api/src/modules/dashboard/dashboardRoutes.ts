import { Router as ExpressRouter, type Router, type Request, type Response, type NextFunction } from 'express';
import sql from 'mssql';
import { getPool } from '../../db/connection.js';
import { requireAuth } from '../auth/middleware/requireAuth.js';
import { requireSucursalAccess } from '../tenancy/middleware/requireSucursalAccess.js';

const router: Router = ExpressRouter();

router.use(requireAuth, requireSucursalAccess);

interface DashboardMetrics {
  pacientes: {
    total: number;
    activos: number;
    inactivos: number;
    archivados: number;
    nuevosEsteMes: number;
  };
  sexoDistribucion: Array<{ sexo: string; count: number }>;
  consultas: {
    total: number;
    esteMes: number;
    pendientesPago: number;
  };
  planesAlimenticios: {
    activos: number;
    porVencer: number;
  };
  adherencia: {
    promedioGlobal: number | null;
    totalRegistros: number;
  };
  patologias: Array<{ tag: string; count: number }>;
}

router.get('/metrics', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sucursalId = String(req.sucursalId);
    const pool = await getPool();

    const [pacientes, sexo, consultas, planes, adherencia, patos] = await Promise.all([
      pool.request()
        .input('sucursal_id', sql.UniqueIdentifier(), sucursalId)
        .query<{ total: number; activos: number; inactivos: number; archivados: number; nuevos: number }>(`
          SELECT
            COUNT(*) AS total,
            SUM(CASE WHEN [status] = 'active' AND deleted_at IS NULL THEN 1 ELSE 0 END) AS activos,
            SUM(CASE WHEN [status] = 'inactive' AND deleted_at IS NULL THEN 1 ELSE 0 END) AS inactivos,
            SUM(CASE WHEN [status] = 'archived' OR deleted_at IS NOT NULL THEN 1 ELSE 0 END) AS archivados,
            SUM(CASE WHEN created_at >= DATEADD(MONTH, DATEDIFF(MONTH, 0, SYSUTCDATETIME()), 0) AND deleted_at IS NULL THEN 1 ELSE 0 END) AS nuevos
          FROM pacientes WHERE sucursal_id = @sucursal_id
        `),

      pool.request()
        .input('sucursal_id', sql.UniqueIdentifier(), sucursalId)
        .query<{ sexo: string; count: number }>(`
          SELECT sexo, COUNT(*) AS count
          FROM pacientes
          WHERE sucursal_id = @sucursal_id AND deleted_at IS NULL
          GROUP BY sexo
          ORDER BY count DESC
        `),

      pool.request()
        .input('sucursal_id', sql.UniqueIdentifier(), sucursalId)
        .query<{ total: number; esteMes: number; pendientesPago: number }>(`
          SELECT
            COUNT(*) AS total,
            SUM(CASE WHEN consultation_date >= DATEADD(MONTH, DATEDIFF(MONTH, 0, SYSUTCDATETIME()), 0) THEN 1 ELSE 0 END) AS esteMes,
            SUM(CASE WHEN paid = 0 AND cost > 0 AND [status] != 'cancelled' AND deleted_at IS NULL THEN 1 ELSE 0 END) AS pendientesPago
          FROM consultas WHERE sucursal_id = @sucursal_id AND deleted_at IS NULL
        `),

      pool.request()
        .input('sucursal_id', sql.UniqueIdentifier(), sucursalId)
        .query<{ activos: number; porVencer: number }>(`
          SELECT
            SUM(CASE WHEN [status] = 'active' AND deleted_at IS NULL THEN 1 ELSE 0 END) AS activos,
            SUM(CASE WHEN [status] = 'active' AND end_date IS NOT NULL AND end_date <= DATEADD(DAY, 30, CAST(SYSUTCDATETIME() AS DATE)) AND end_date >= CAST(SYSUTCDATETIME() AS DATE) AND deleted_at IS NULL THEN 1 ELSE 0 END) AS porVencer
          FROM planes_alimenticios WHERE sucursal_id = @sucursal_id
        `),

      pool.request()
        .input('sucursal_id', sql.UniqueIdentifier(), sucursalId)
        .query<{ promedio: number | null; total: number }>(`
          SELECT
            AVG((adherence_menu + adherence_water + adherence_activity + adherence_supplements + adherence_sleep) / 5.0) AS promedio,
            COUNT(*) AS total
          FROM adherence_records
          WHERE sucursal_id = @sucursal_id AND deleted_at IS NULL
        `),

      pool.request()
        .input('sucursal_id', sql.UniqueIdentifier(), sucursalId)
        .query<{ tag: string; count: number }>(`
          SELECT
            LTRIM(RTRIM(tags.tag)) AS tag,
            COUNT(*) AS count
          FROM pacientes
          CROSS APPLY OPENJSON(CASE WHEN ISJSON(clinical_tags_json) = 1 THEN clinical_tags_json ELSE '[]' END) WITH (tag NVARCHAR(200) '$') AS tags
          WHERE sucursal_id = @sucursal_id AND deleted_at IS NULL AND LTRIM(RTRIM(tags.tag)) != ''
          GROUP BY LTRIM(RTRIM(tags.tag))
          ORDER BY count DESC
        `),
    ]);

    const metrics: DashboardMetrics = {
      pacientes: {
        total: pacientes.recordset[0]?.total ?? 0,
        activos: pacientes.recordset[0]?.activos ?? 0,
        inactivos: pacientes.recordset[0]?.inactivos ?? 0,
        archivados: pacientes.recordset[0]?.archivados ?? 0,
        nuevosEsteMes: pacientes.recordset[0]?.nuevos ?? 0,
      },
      sexoDistribucion: sexo.recordset,
      consultas: {
        total: consultas.recordset[0]?.total ?? 0,
        esteMes: consultas.recordset[0]?.esteMes ?? 0,
        pendientesPago: consultas.recordset[0]?.pendientesPago ?? 0,
      },
      planesAlimenticios: {
        activos: planes.recordset[0]?.activos ?? 0,
        porVencer: planes.recordset[0]?.porVencer ?? 0,
      },
      adherencia: {
        promedioGlobal: adherencia.recordset[0]?.promedio ?? null,
        totalRegistros: adherencia.recordset[0]?.total ?? 0,
      },
      patologias: patos.recordset,
    };

    res.json(metrics);
  } catch (err) {
    next(err);
  }
});

export default router;
