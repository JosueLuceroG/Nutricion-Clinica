/**
 * Modos de credencial. La autenticación NUNCA otorga certificación clínica.
 * No existe scraping de cookies/sesiones de navegador para inferencia general.
 */

export type CredentialMode =
  | 'LOCAL_NO_CREDENTIAL'
  | 'API_KEY'
  | 'OAUTH_USER_SESSION'
  | 'SUPPORTED_WEB_AUTH'
  | 'SERVICE_ACCOUNT';

export type CredentialModeStatus =
  | 'AVAILABLE'
  | 'MISSING_CREDENTIAL'
  | 'UNSUPPORTED_FOR_GENERAL_PROVIDER_AUTH'
  | 'NOT_CONFIGURED';

export const CREDENTIAL_MODES: readonly CredentialMode[] = [
  'LOCAL_NO_CREDENTIAL',
  'API_KEY',
  'OAUTH_USER_SESSION',
  'SUPPORTED_WEB_AUTH',
  'SERVICE_ACCOUNT',
];

export interface CredentialResolution {
  providerId: string;
  mode: CredentialMode;
  status: CredentialModeStatus;
  hasCredential: boolean;
  /** Nunca incluye el secreto. */
  summary: string;
}

/**
 * Vault server-side. Los secretos viven SOLO en el servidor (env/vault);
 * el frontend nunca puede recuperarlos. No se registran en audit ni en
 * manifiestos de egress.
 */
export interface CredentialVault {
  resolve(providerId: string, env?: NodeJS.ProcessEnv): CredentialResolution;
  /** Devuelve la API key para uso directo del adapter (solo server-side). */
  getApiKey(providerId: string, env?: NodeJS.ProcessEnv): string | null;
}

export class EnvCredentialVault implements CredentialVault {
  getApiKey(providerId: string, env: NodeJS.ProcessEnv = process.env): string | null {
    if (providerId === 'openai') return env.OPENAI_API_KEY ?? env.AI_API_KEY ?? null;
    return null;
  }

  resolve(providerId: string, env: NodeJS.ProcessEnv = process.env): CredentialResolution {
    if (providerId === 'ollama') {
      return {
        providerId,
        mode: 'LOCAL_NO_CREDENTIAL',
        status: 'AVAILABLE',
        hasCredential: true,
        summary: 'local runtime sin credencial (LOCAL_NO_CREDENTIAL)',
      };
    }
    if (providerId === 'openai') {
      const hasKey = this.getApiKey(providerId, env) !== null;
      return {
        providerId,
        mode: 'API_KEY',
        status: hasKey ? 'AVAILABLE' : 'MISSING_CREDENTIAL',
        hasCredential: hasKey,
        summary: hasKey ? 'API_KEY server-side presente' : 'API_KEY ausente (MISSING_CREDENTIAL)',
      };
    }
    return {
      providerId,
      mode: 'API_KEY',
      status: 'NOT_CONFIGURED',
      hasCredential: false,
      summary: `proveedor ${providerId} sin modo de credencial configurado`,
    };
  }
}

/**
 * Modos web/OAuth solo se integran si el proveedor lo soporta oficialmente
 * para inferencia general. Sin soporte oficial → fail-closed.
 */
export function generalProviderAuthStatus(providerId: string, mode: CredentialMode): CredentialModeStatus {
  if (providerId === 'openai' && (mode === 'OAUTH_USER_SESSION' || mode === 'SUPPORTED_WEB_AUTH')) {
    return 'UNSUPPORTED_FOR_GENERAL_PROVIDER_AUTH';
  }
  if (mode === 'SERVICE_ACCOUNT') return 'NOT_CONFIGURED';
  if (mode === 'OAUTH_USER_SESSION' || mode === 'SUPPORTED_WEB_AUTH') return 'NOT_CONFIGURED';
  return 'AVAILABLE';
}

export const credentialVault = new EnvCredentialVault();

/** NO existe scraping de ChatGPT/Codex (cookies, sessionStorage, bearer de navegador). */
export function scrapingIsSupported(): false {
  return false;
}