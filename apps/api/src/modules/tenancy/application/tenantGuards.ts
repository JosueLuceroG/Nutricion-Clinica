import sql from 'mssql';
import { HttpError } from '../../../middleware/errorHandler.js';

function notFound(message: string): never {
  throw new HttpError(404, message);
}

export async function assertPacienteInSucursal(
  pool: sql.ConnectionPool,
  pacienteId: string,
  sucursalId: string,
): Promise<void> {
  const result = await pool
    .request()
    .input('paciente_id', sql.UniqueIdentifier(), pacienteId)
    .input('sucursal_id', sql.UniqueIdentifier(), sucursalId)
    .query<{ id: string }>(
      `SELECT id
         FROM pacientes
        WHERE id = @paciente_id
          AND sucursal_id = @sucursal_id
          AND deleted_at IS NULL`,
    );

  if (result.recordset.length === 0) {
    notFound('Paciente no encontrado en la sucursal activa');
  }
}

export async function assertConsultaInSucursal(
  pool: sql.ConnectionPool,
  consultaId: string,
  sucursalId: string,
  pacienteId?: string,
): Promise<void> {
  const request = pool
    .request()
    .input('consulta_id', sql.UniqueIdentifier(), consultaId)
    .input('sucursal_id', sql.UniqueIdentifier(), sucursalId);

  let query = `SELECT id
                 FROM consultas
                WHERE id = @consulta_id
                  AND sucursal_id = @sucursal_id
                  AND deleted_at IS NULL`;

  if (pacienteId) {
    request.input('paciente_id', sql.UniqueIdentifier(), pacienteId);
    query += ' AND paciente_id = @paciente_id';
  }

  const result = await request.query<{ id: string }>(query);

  if (result.recordset.length === 0) {
    notFound('Consulta no encontrada en la sucursal activa');
  }
}
