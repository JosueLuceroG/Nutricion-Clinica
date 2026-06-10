import { db, type TelemedicinaRecordingRow } from "@services/db/dexieSchema";
import { useAuthStore } from "@store/authStore";

const KEY_PREFIX = "nutriclinica:telemedicina-recording-key:v1";
const CONSENT_TEXT_VERSION = "telemedicina-recording-v1";
const IV_BYTES = 12;

export interface TelemedicinaRecordingSummary {
  id: string;
  salaId: string;
  createdAt: string;
  durationMs: number;
  mimeType: string;
  originalSizeBytes: number;
  consentAcceptedAt: string;
}

interface SaveRecordingInput {
  salaId: string;
  blob: Blob;
  durationMs: number;
  consentAcceptedAt: string;
}

export const recordingStorageService = {
  async saveEncrypted(input: SaveRecordingInput): Promise<TelemedicinaRecordingSummary> {
    const user = useAuthStore.getState().user;
    const key = await getOrCreateKey(user?.id ?? "anonymous");
    const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
    const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv.buffer as ArrayBuffer }, key, await input.blob.arrayBuffer());
    const encryptedBlob = new Blob([encrypted], { type: "application/octet-stream" });
    const now = new Date().toISOString();
    const row: TelemedicinaRecordingRow = {
      id: crypto.randomUUID(),
      sala_id: input.salaId,
      created_by: user?.id ?? null,
      created_at: now,
      duration_ms: input.durationMs,
      mime_type: input.blob.type || "video/webm",
      original_size_bytes: input.blob.size,
      encrypted_size_bytes: encryptedBlob.size,
      iv: bytesToBase64(iv),
      encrypted_blob: encryptedBlob,
      consent_accepted_at: input.consentAcceptedAt,
      consent_text_version: CONSENT_TEXT_VERSION,
    };
    await db.telemedicina_recordings.put(row);
    return toSummary(row);
  },

  async listBySala(salaId: string): Promise<TelemedicinaRecordingSummary[]> {
    const rows = await db.telemedicina_recordings.where("sala_id").equals(salaId).toArray();
    rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
    return rows.map(toSummary);
  },

  async decryptBlob(id: string): Promise<{ blob: Blob; summary: TelemedicinaRecordingSummary } | null> {
    const row = await db.telemedicina_recordings.get(id);
    if (!row) return null;
    const key = await getOrCreateKey(row.created_by ?? "anonymous");
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: base64ToBytes(row.iv).buffer as ArrayBuffer },
      key,
      await row.encrypted_blob.arrayBuffer(),
    );
    return { blob: new Blob([decrypted], { type: row.mime_type }), summary: toSummary(row) };
  },

  async download(id: string): Promise<boolean> {
    const result = await this.decryptBlob(id);
    if (!result) return false;
    const url = URL.createObjectURL(result.blob);
    const a = document.createElement("a");
    const stamp = result.summary.createdAt.replace(/[:.]/g, "-");
    a.href = url;
    a.download = `nutriclinica-sala-${result.summary.salaId.slice(0, 8)}-${stamp}.webm`;
    a.click();
    URL.revokeObjectURL(url);
    return true;
  },
};

function toSummary(row: TelemedicinaRecordingRow): TelemedicinaRecordingSummary {
  return {
    id: row.id,
    salaId: row.sala_id,
    createdAt: row.created_at,
    durationMs: row.duration_ms,
    mimeType: row.mime_type,
    originalSizeBytes: row.original_size_bytes,
    consentAcceptedAt: row.consent_accepted_at,
  };
}

async function getOrCreateKey(userId: string): Promise<CryptoKey> {
  const storageKey = `${KEY_PREFIX}:${userId}`;
  let raw = localStorage.getItem(storageKey);
  if (!raw) {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    raw = bytesToBase64(bytes);
    localStorage.setItem(storageKey, raw);
  }
  return crypto.subtle.importKey("raw", base64ToBytes(raw).buffer as ArrayBuffer, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}
