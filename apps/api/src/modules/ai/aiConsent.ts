import sql from 'mssql';
import { getPool } from '../../db/connection.js';

export type ConsentChecker = (pacienteId: string, sucursalId: string, tipo: string) => Promise<boolean>;

export async function isConsentAccepted(pacienteId: string, sucursalId: string, tipo: string): Promise<boolean> {
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('paciente_id', sql.UniqueIdentifier(), pacienteId)
      .input('sucursal_id', sql.UniqueIdentifier(), sucursalId)
      .input('tipo', sql.NVarChar(60), tipo)
      .query(
        `SELECT TOP 1 1 AS found FROM consentimientos
         WHERE paciente_id = @paciente_id AND sucursal_id = @sucursal_id AND tipo = @tipo AND aceptado = 1 AND deleted_at IS NULL`,
      );
    return result.recordset.length > 0;
  } catch (err) {
    console.warn('[ai] consent check failed:', err instanceof Error ? err.message : err);
    return false;
  }
}