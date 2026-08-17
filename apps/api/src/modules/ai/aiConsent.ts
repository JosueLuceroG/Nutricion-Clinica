import sql from 'mssql';
import { getPool } from '../../db/connection.js';

export type ConsentChecker = (pacienteId: string, sucursalId: string, tipo: string) => Promise<boolean>;

export type ConsentStatus = 'valid' | 'missing' | 'revoked' | 'error';

export interface ConsentStatusResult {
  status: ConsentStatus;
  reference?: string;
}

export async function getConsentStatus(pacienteId: string, sucursalId: string, tipo: string): Promise<ConsentStatusResult> {
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('paciente_id', sql.UniqueIdentifier(), pacienteId)
      .input('sucursal_id', sql.UniqueIdentifier(), sucursalId)
      .input('tipo', sql.NVarChar(60), tipo)
      .query(
        `SELECT TOP 1 id, aceptado, revocado FROM consentimientos
         WHERE paciente_id = @paciente_id AND sucursal_id = @sucursal_id AND tipo = @tipo AND deleted_at IS NULL
         ORDER BY created_at DESC`,
      );
    const row = result.recordset[0];
    if (!row) return { status: 'missing' };
    if (Number(row.aceptado) === 1 && Number(row.revocado) !== 1) {
      return { status: 'valid', reference: String(row.id) };
    }
    return { status: 'revoked' };
  } catch (err) {
    console.warn('[ai] consent check failed:', err instanceof Error ? err.message : err);
    return { status: 'error' };
  }
}

export async function isConsentAccepted(pacienteId: string, sucursalId: string, tipo: string): Promise<boolean> {
  return (await getConsentStatus(pacienteId, sucursalId, tipo)).status === 'valid';
}

export async function getPatientNames(pacienteId: string, sucursalId: string): Promise<string[]> {
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('id', sql.UniqueIdentifier(), pacienteId)
      .input('sucursal_id', sql.UniqueIdentifier(), sucursalId)
      .query(
        `SELECT TOP 1 nombres, apellido_paterno, apellido_materno
         FROM pacientes WHERE id = @id AND sucursal_id = @sucursal_id AND deleted_at IS NULL`,
      );
    const row = result.recordset[0];
    if (!row) return [];
    return [row.nombres, row.apellido_paterno, row.apellido_materno]
      .filter((part): part is string => typeof part === 'string' && part.trim().length >= 3);
  } catch (err) {
    console.warn('[ai] patient names fetch failed:', err instanceof Error ? err.message : err);
    return [];
  }
}