import { generateSecret, generate, verify, generateURI } from 'otplib';
import sql from 'mssql';
import QRCode from 'qrcode';
import { getPool } from '../../../db/connection.js';
import { decryptField, encryptField } from '../../../services/crypto/serverCryptoService.js';

const ISSUER = 'NutriClínica';
const ENCRYPTED_PREFIX = 'enc:v1:';

function getTotpMasterKey(): string {
  const key = process.env.TOTP_ENCRYPTION_KEY ?? process.env.FIELD_ENCRYPTION_KEY ?? process.env.JWT_SECRET;
  if (!key) throw new Error('TOTP_ENCRYPTION_KEY o JWT_SECRET no configurado');
  return key;
}

export function protectTotpSecretForStorage(secret: string): string {
  return `${ENCRYPTED_PREFIX}${encryptField(secret, getTotpMasterKey())}`;
}

export function revealTotpSecretFromStorage(secret: string): string {
  if (!secret.startsWith(ENCRYPTED_PREFIX)) return secret;
  return decryptField(secret.slice(ENCRYPTED_PREFIX.length), getTotpMasterKey());
}

export function generateTotpSecret(): string {
  return generateSecret();
}

export async function generateTotpToken(secret: string): Promise<string> {
  return generate({ secret });
}

export async function verifyTotp(token: string, secret: string): Promise<boolean> {
  const result = await verify({ token, secret });
  return result.valid;
}

export function buildTotpUri(email: string, secret: string): string {
  return generateURI({ issuer: ISSUER, label: email, secret });
}

export async function generateQrCode(uri: string): Promise<string> {
  return QRCode.toDataURL(uri);
}

export interface PendingTotpEnrollment {
  secret: string;
  expiresAt: Date;
  storageValue: string;
}

export async function beginTotpEnrollment(profesionalId: string, secret: string, expiresAt: Date): Promise<boolean> {
  const pool = await getPool();
  const protectedSecret = protectTotpSecretForStorage(secret);
  const result = await pool
    .request()
    .input('id', sql.UniqueIdentifier(), profesionalId)
    .input('pending_secret', sql.NVarChar(400), protectedSecret)
    .input('pending_expires_at', sql.DateTime2, expiresAt).query(`UPDATE profesionales
               SET totp_pending_secret = @pending_secret,
                   totp_pending_expires_at = @pending_expires_at
             WHERE id = @id
               AND activo = 1
               AND totp_enabled = 0
               AND deleted_at IS NULL`);
  return (result.rowsAffected[0] ?? 0) === 1;
}

export async function findPendingTotpEnrollment(profesionalId: string): Promise<PendingTotpEnrollment | null> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('id', sql.UniqueIdentifier(), profesionalId)
    .query<{
      totp_pending_secret: string | null;
      totp_pending_expires_at: Date | null;
    }>(
      `SELECT totp_pending_secret, totp_pending_expires_at
         FROM profesionales
        WHERE id = @id
          AND activo = 1
          AND totp_enabled = 0
          AND deleted_at IS NULL`,
    );
  const row = result.recordset[0];
  if (!row?.totp_pending_secret || !row.totp_pending_expires_at) return null;
  if (row.totp_pending_expires_at.getTime() <= Date.now()) return null;
  return {
    secret: revealTotpSecretFromStorage(row.totp_pending_secret),
    expiresAt: row.totp_pending_expires_at,
    storageValue: row.totp_pending_secret,
  };
}

export async function activatePendingTotp(profesionalId: string, expectedStorageValue: string): Promise<boolean> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('id', sql.UniqueIdentifier(), profesionalId)
    .input('expected_pending_secret', sql.NVarChar(400), expectedStorageValue).query(`UPDATE profesionales
               SET totp_secret = totp_pending_secret,
                   totp_enabled = 1,
                   totp_pending_secret = NULL,
                   totp_pending_expires_at = NULL,
                   token_version = token_version + 1
             WHERE id = @id
               AND activo = 1
               AND totp_enabled = 0
               AND totp_pending_secret IS NOT NULL
               AND totp_pending_secret = @expected_pending_secret
               AND totp_pending_expires_at > SYSUTCDATETIME()
               AND deleted_at IS NULL`);
  return (result.rowsAffected[0] ?? 0) === 1;
}

export async function disableTotp(profesionalId: string): Promise<void> {
  const pool = await getPool();
  await pool.request().input('id', sql.UniqueIdentifier(), profesionalId).query(`UPDATE profesionales
               SET totp_secret = NULL,
                   totp_enabled = 0,
                   totp_pending_secret = NULL,
                   totp_pending_expires_at = NULL,
                   token_version = token_version + 1
             WHERE id = @id AND deleted_at IS NULL`);
}

export async function findTotpSecret(profesionalId: string): Promise<string | null> {
  const pool = await getPool();
  const result = await pool.request().input('id', sql.UniqueIdentifier(), profesionalId).query<{
    totp_secret: string | null;
    totp_enabled: boolean;
  }>(`SELECT totp_secret, totp_enabled FROM profesionales WHERE id = @id AND deleted_at IS NULL`);
  const row = result.recordset[0];
  return row?.totp_enabled && row.totp_secret ? revealTotpSecretFromStorage(row.totp_secret) : null;
}

export async function isTotpEnabled(profesionalId: string): Promise<boolean> {
  const pool = await getPool();
  const result = await pool.request().input('id', sql.UniqueIdentifier(), profesionalId).query<{
    totp_enabled: boolean;
  }>(`SELECT totp_enabled FROM profesionales WHERE id = @id AND deleted_at IS NULL`);
  return result.recordset[0]?.totp_enabled ?? false;
}
