const PBKDF2_ITERATIONS = 600000;
const KEY_LENGTH = 256;
const SALT_BYTES = 32;
const IV_BYTES = 12;

function ab2b64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function b642ab(b64: string): ArrayBuffer {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)).buffer;
}

async function deriveKey(password: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
  const saltBuf = salt.buffer as ArrayBuffer;
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: saltBuf, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: KEY_LENGTH },
    false,
    ["encrypt", "decrypt"],
  );
}

export interface EncryptedPayload {
  ciphertext: string;
  iv: string;
  salt: string;
}

export const cryptoService = {
  async encrypt(plaintext: string, password: string): Promise<EncryptedPayload> {
    const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES)) as Uint8Array<ArrayBuffer>;
    const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES)) as Uint8Array<ArrayBuffer>;
    const key = await deriveKey(password, salt);
    const enc = new TextEncoder();
    const ivBuf = iv.buffer as ArrayBuffer;
    const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv: ivBuf }, key, enc.encode(plaintext));
    return { ciphertext: ab2b64(ciphertext), iv: ab2b64(iv.buffer), salt: ab2b64(salt.buffer) };
  },

  async decrypt(payload: EncryptedPayload, password: string): Promise<string> {
    const salt = new Uint8Array(b642ab(payload.salt)) as Uint8Array<ArrayBuffer>;
    const iv = new Uint8Array(b642ab(payload.iv)) as Uint8Array<ArrayBuffer>;
    const key = await deriveKey(password, salt);
    const ivBuf = iv.buffer as ArrayBuffer;
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: ivBuf },
      key,
      b642ab(payload.ciphertext),
    );
    return new TextDecoder().decode(decrypted);
  },

  encryptToJson(plaintext: string, password: string): Promise<string> {
    return this.encrypt(plaintext, password).then((p) => JSON.stringify(p));
  },

  async decryptFromJson(json: string, password: string): Promise<string> {
    const payload: EncryptedPayload = JSON.parse(json);
    return this.decrypt(payload, password);
  },
};

export type CryptoService = typeof cryptoService;
