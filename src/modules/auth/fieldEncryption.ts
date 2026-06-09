import { cryptoService } from "@services/crypto/cryptoService";

const PBKDF2_ITERATIONS = 600000;
const KEY_LENGTH = 256;

async function deriveKeyMaterial(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt.buffer as ArrayBuffer,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: KEY_LENGTH },
    false,
    ["encrypt", "decrypt"],
  );
}

/**
 * Deriva una clave única por paciente + campo usando PBKDF2.
 * La master key se compone del patientId y fieldName para garantizar
 * que un mismo valor cifrado en distintos campos use claves diferentes.
 */
export async function deriveFieldKey(
  patientId: string,
  fieldName: string,
): Promise<string> {
  const salt = new TextEncoder().encode(`${patientId}:${fieldName}`);
  const key = await deriveKeyMaterial(`${patientId}:${fieldName}`, new Uint8Array(salt));
  const raw = await crypto.subtle.exportKey("raw", key);
  return btoa(String.fromCharCode(...new Uint8Array(raw)));
}

/**
 * Cifra un valor sensible a nivel de campo usando cryptoService.
 * @param value - Texto plano a cifrar
 * @param key - Clave derivada (usar deriveFieldKey)
 */
export async function encryptField(
  value: string,
  key: string,
): Promise<string> {
  const payload = await cryptoService.encrypt(value, key);
  return JSON.stringify(payload);
}

/**
 * Descifra un valor previamente cifrado con encryptField.
 * @param value - Payload JSON cifrado
 * @param key - Misma clave usada para cifrar
 */
export async function decryptField(
  value: string,
  key: string,
): Promise<string> {
  const payload = JSON.parse(value) as { ciphertext: string; iv: string; salt: string };
  return cryptoService.decrypt(payload, key);
}
