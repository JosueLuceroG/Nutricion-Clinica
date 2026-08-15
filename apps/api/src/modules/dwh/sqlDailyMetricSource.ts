import type { DailyMetricSource } from './etl.js';

const DATE_FILTER = 'AND fecha >= @from AND fecha < DATEADD(DAY, 1, @to)';

export const sqlDailyMetricSource: DailyMetricSource = {
  async getDailyValues(input: { metricId: string; sucursalId: string; from: string; to: string }): Promise<Array<{ date: string; value: number }>> {
    const { getPool } = await import('../../db/connection.js');
    const sql = (await import('mssql')).default;
    const pool = await getPool();
    const req = pool.request()
      .input('sucursal_id', sql.UniqueIdentifier(), input.sucursalId)
      .input('from', sql.DateTime2(3), new Date(input.from))
      .input('to', sql.DateTime2(3), new Date(input.to));

    let query: string;
    switch (input.metricId) {
      case 'consultas_diarias':
        query = `SELECT CAST(consultation_date AS DATE) AS fecha, COUNT(*) AS value
                 FROM consultas WHERE sucursal_id = @sucursal_id AND deleted_at IS NULL ${DATE_FILTER}
                 GROUP BY CAST(consultation_date AS DATE)`;
        break;
      case 'pacientes_nuevos_diarios':
        query = `SELECT CAST(created_at AS DATE) AS fecha, COUNT(*) AS value
                 FROM pacientes WHERE sucursal_id = @sucursal_id AND deleted_at IS NULL ${DATE_FILTER}
                 GROUP BY CAST(created_at AS DATE)`;
        break;
      case 'planes_activos_diarios':
        query = `SELECT CAST(SYSUTCDATETIME() AS DATE) AS fecha, COUNT(*) AS value
                 FROM planes_alimenticios
                 WHERE sucursal_id = @sucursal_id AND [status] = 'active' AND deleted_at IS NULL`;
        break;
      case 'adherencia_promedio_diaria':
        query = `SELECT CAST(record_date AS DATE) AS fecha, AVG((adherence_menu + adherence_water + adherence_activity + adherence_supplements + adherence_sleep) / 5.0) AS value
                 FROM adherence_records WHERE sucursal_id = @sucursal_id AND deleted_at IS NULL ${DATE_FILTER}
                 GROUP BY CAST(record_date AS DATE)`;
        break;
      case 'consultas_pendientes_pago_diarias':
        query = `SELECT CAST(consultation_date AS DATE) AS fecha, COUNT(*) AS value
                 FROM consultas
                 WHERE sucursal_id = @sucursal_id AND deleted_at IS NULL AND paid = 0 AND cost > 0 AND [status] != 'cancelled' ${DATE_FILTER}
                 GROUP BY CAST(consultation_date AS DATE)`;
        break;
      default:
        throw new Error(`Metrica desconocida para el source SQL: ${input.metricId}`);
    }

    const result = await req.query<{ fecha: Date; value: number }>(query);
    return result.recordset.map((row) => ({
      date: row.fecha instanceof Date ? row.fecha.toISOString().slice(0, 10) : String(row.fecha).slice(0, 10),
      value: Number(row.value),
    }));
  },
};