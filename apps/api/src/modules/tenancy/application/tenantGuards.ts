import sql from 'mssql';
import { HttpError } from '../../../middleware/errorHandler.js';

/** Sesión de DB: un pool o una transacción activa (ambos exponen request()). */
export interface DbSession {
  request(): sql.Request;
}

function notFound(message: string): never {
  throw new HttpError(404, message);
}

export async function assertPacienteInSucursal(
  session: DbSession,
  pacienteId: string,
  sucursalId: string,
): Promise<void> {
  const result = await session
    .request()
    .input('paciente_id', sql.UniqueIdentifier(), pacienteId)
    .input('sucursal_id', sql.UniqueIdentifier(), sucursalId)
    .query<{ id: string }>(
       `SELECT id
          FROM pacientes WITH (UPDLOCK, HOLDLOCK)
        WHERE id = @paciente_id
          AND sucursal_id = @sucursal_id
          AND deleted_at IS NULL`,
    );

  if (result.recordset.length === 0) {
    notFound('Paciente no encontrado en la sucursal activa');
  }
}

export async function assertConsultaInSucursal(
  session: DbSession,
  consultaId: string,
  sucursalId: string,
  pacienteId?: string,
): Promise<void> {
  const request = session
    .request()
    .input('consulta_id', sql.UniqueIdentifier(), consultaId)
    .input('sucursal_id', sql.UniqueIdentifier(), sucursalId);

  let query = `SELECT id
                 FROM consultas WITH (UPDLOCK, HOLDLOCK)
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
