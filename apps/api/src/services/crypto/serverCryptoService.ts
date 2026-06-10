import { randomBytes, createCipheriv, createDecipheriv, scryptSync } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_DERIVATION_SALT = process.env.CRYPTO_SALT ?? 'nutriclinica-server-v1';
const IV_LENGTH = 16;

function deriveKey(masterKey: string): Buffer {
  return scryptSync(masterKey, KEY_DERIVATION_SALT, 32);
}

export function encryptField(plaintext: string, masterKey: string): string {
  const key = deriveKey(masterKey);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${tag}:${encrypted}`;
}

export function decryptField(ciphertext: string, masterKey: string): string {
  const key = deriveKey(masterKey);
  const parts = ciphertext.split(':');
  if (parts.length !== 3) throw new Error('Formato de campo cifrado inválido');
  const iv = Buffer.from(parts[0]!, 'hex');
  const tag = Buffer.from(parts[1]!, 'hex');
  const encrypted = parts[2]!;
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
