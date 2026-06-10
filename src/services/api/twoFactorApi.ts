import { httpRequest } from './httpClient.js';

export interface TwoFactorSetupResponse {
  secret: string;
  uri: string;
  qrCode: string;
}

export interface TwoFactorStatusResponse {
  enabled: boolean;
}

export const twoFactorApi = {
  async setup(): Promise<TwoFactorSetupResponse> {
    return httpRequest<TwoFactorSetupResponse>('/auth/2fa/setup', { method: 'POST' });
  },

  async enable(secret: string, totpCode: string): Promise<{ enabled: boolean }> {
    return httpRequest('/auth/2fa/enable', { method: 'POST', body: { secret, totpCode } });
  },

  async disable(totpCode: string): Promise<{ disabled: boolean }> {
    return httpRequest('/auth/2fa/disable', { method: 'POST', body: { totpCode } });
  },

  async status(): Promise<TwoFactorStatusResponse> {
    return httpRequest<TwoFactorStatusResponse>('/auth/2fa/status');
  },
};
