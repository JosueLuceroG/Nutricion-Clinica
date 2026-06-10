import { httpRequest } from './httpClient.js';
import { useAuthStore } from '@store/authStore';
import { useSyncStore } from '@store/syncStore';
import type { TelemedicinaGrabacionDTO, TelemedicinaSalaDTO } from '@nutriclinica/shared';

export interface CreateSalaInput {
  pacienteId: string;
  scheduledAt?: string;
  notas?: string;
}

export interface UploadGrabacionInput {
  blob: Blob;
  durationMs: number;
  mimeType: string;
  originalSizeBytes: number;
  iv: string;
  consentAcceptedAt: string;
  consentTextVersion: string;
}

function getBaseUrl(): string {
  const fromVite = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_API_URL;
  if (fromVite) return fromVite;
  const fromProcess = typeof process !== 'undefined' ? process.env?.VITE_API_URL : undefined;
  return fromProcess ?? 'http://localhost:3000';
}

function buildUrl(path: string): string {
  return `${getBaseUrl().replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  const token = useAuthStore.getState().token;
  const sucursalId = useSyncStore.getState().sucursalId;
  if (token) headers.Authorization = `Bearer ${token}`;
  if (sucursalId) headers['X-Sucursal-Id'] = sucursalId;
  return headers;
}

export const telemedicinaApi = {
  async list(): Promise<{ salas: TelemedicinaSalaDTO[] }> {
    return httpRequest('/telemedicina');
  },

  async get(id: string): Promise<TelemedicinaSalaDTO> {
    return httpRequest(`/telemedicina/${id}`);
  },

  async create(input: CreateSalaInput): Promise<{ id: string }> {
    return httpRequest('/telemedicina', { method: 'POST', body: input });
  },

  async updateEstado(id: string, estado: TelemedicinaSalaDTO['estado']): Promise<{ updated: number }> {
    return httpRequest(`/telemedicina/${id}/estado`, { method: 'PATCH', body: { estado } });
  },

  async delete(id: string): Promise<{ deleted: number }> {
    return httpRequest(`/telemedicina/${id}`, { method: 'DELETE' });
  },

  async listRecordings(salaId: string): Promise<{ grabaciones: TelemedicinaGrabacionDTO[] }> {
    return httpRequest(`/telemedicina/${salaId}/grabaciones`);
  },

  async uploadRecording(salaId: string, input: UploadGrabacionInput): Promise<{ id: string }> {
    const response = await fetch(buildUrl(`/telemedicina/${salaId}/grabaciones`), {
      method: 'POST',
      headers: {
        ...authHeaders(),
        'Content-Type': 'application/octet-stream',
        'X-Duration-Ms': String(input.durationMs),
        'X-Mime-Type': input.mimeType,
        'X-Original-Size-Bytes': String(input.originalSizeBytes),
        'X-IV': input.iv,
        'X-Consent-Accepted-At': input.consentAcceptedAt,
        'X-Consent-Text-Version': input.consentTextVersion,
      },
      body: input.blob,
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json() as Promise<{ id: string }>;
  },

  async downloadRecordingBlob(salaId: string, recordingId: string): Promise<Blob> {
    const response = await fetch(buildUrl(`/telemedicina/${salaId}/grabaciones/${recordingId}/blob`), {
      method: 'GET',
      headers: {
        ...authHeaders(),
        Accept: 'application/octet-stream',
      },
    });
    if (!response.ok) throw new Error(await response.text());
    return response.blob();
  },

  async deleteRecording(salaId: string, recordingId: string): Promise<{ deleted: number }> {
    return httpRequest(`/telemedicina/${salaId}/grabaciones/${recordingId}`, { method: 'DELETE' });
  },
};
