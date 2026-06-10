import { authenticator } from 'otplib';
import sql from 'mssql';
import QRCode from 'qrcode';
import { getPool } from '../../../db/connection.js';

authenticator.options = { step: 30, window: 1 };

const ISSUER = 'NutriClínica';

export function generateTotpSecret(): string {
  return authenticator.generateSecret();
}

export function generateTotpToken(secret: string): string {
  return authenticator.generate(secret);
}

export function verifyTotp(token: string, secret: string): boolean {
  return authenticator.verify({ token, secret });
}

export function buildTotpUri(email: string, secret: string): string {
  return authenticator.keyuri(email, ISSUER, secret);
}

export async function generateQrCode(uri: string): Promise<string> {
  return QRCode.toDataURL(uri);
}

export async function enableTotp(profesionalId: string, secret: string): Promise<void> {
  const pool = await getPool();
  await pool
    .request()
    .input('id', sql.UniqueIdentifier(), profesionalId)
    .input('totp_secret', sql.NVarChar(100), secret)
    .query(`UPDATE profesionales SET totp_secret = @totp_secret, totp_enabled = 1 WHERE id = @id AND deleted_at IS NULL`);
}

export async function disableTotp(profesionalId: string): Promise<void> {
  const pool = await getPool();
  await pool
    .request()
    .input('id', sql.UniqueIdentifier(), profesionalId)
    .query(`UPDATE profesionales SET totp_secret = NULL, totp_enabled = 0 WHERE id = @id AND deleted_at IS NULL`);
}

export async function findTotpSecret(profesionalId: string): Promise<string | null> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('id', sql.UniqueIdentifier(), profesionalId)
    .query<{ totp_secret: string | null; totp_enabled: boolean }>(
      `SELECT totp_secret, totp_enabled FROM profesionales WHERE id = @id AND deleted_at IS NULL`,
    );
  const row = result.recordset[0];
  return row?.totp_enabled ? row.totp_secret : null;
}

export async function isTotpEnabled(profesionalId: string): Promise<boolean> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('id', sql.UniqueIdentifier(), profesionalId)
    .query<{ totp_enabled: boolean }>(
      `SELECT totp_enabled FROM profesionales WHERE id = @id AND deleted_at IS NULL`,
    );
  return result.recordset[0]?.totp_enabled ?? false;
}
