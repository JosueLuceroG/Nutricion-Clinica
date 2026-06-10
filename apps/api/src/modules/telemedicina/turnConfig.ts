import { z } from 'zod';

const TurnCredentialsSchema = z.object({
  VITE_STUN_URLS: z.string().optional(),
  VITE_TURN_URLS: z.string().optional(),
  VITE_TURN_USERNAME: z.string().optional(),
  VITE_TURN_CREDENTIAL: z.string().optional(),
});

export interface TurnIceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface TurnConfigDTO {
  iceServers: TurnIceServer[];
  configured: boolean;
}

const DEFAULT_STUN_URLS = ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'];

function csv(value: string | undefined): string[] {
  return value?.split(',').map((v) => v.trim()).filter(Boolean) ?? [];
}

export function buildTurnConfig(env: Record<string, string | undefined>): TurnConfigDTO {
  const parsed = TurnCredentialsSchema.safeParse(env);
  if (!parsed.success) {
    return { iceServers: [{ urls: DEFAULT_STUN_URLS }], configured: false };
  }

  const { VITE_STUN_URLS, VITE_TURN_URLS, VITE_TURN_USERNAME, VITE_TURN_CREDENTIAL } = parsed.data;
  const stunUrls = csv(VITE_STUN_URLS);
  const turnUrls = csv(VITE_TURN_URLS);
  const iceServers: TurnIceServer[] = [{ urls: stunUrls.length > 0 ? stunUrls : DEFAULT_STUN_URLS }];

  if (turnUrls.length > 0) {
    iceServers.push({
      urls: turnUrls,
      username: VITE_TURN_USERNAME,
      credential: VITE_TURN_CREDENTIAL,
    });
  }

  return { iceServers, configured: turnUrls.length > 0 };
}
