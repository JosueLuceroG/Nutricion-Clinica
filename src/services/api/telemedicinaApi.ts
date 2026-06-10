import { httpRequest } from './httpClient.js';
import type { TelemedicinaSalaDTO } from '@nutriclinica/shared';

export interface CreateSalaInput {
  pacienteId: string;
  scheduledAt?: string;
  notas?: string;
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
};
