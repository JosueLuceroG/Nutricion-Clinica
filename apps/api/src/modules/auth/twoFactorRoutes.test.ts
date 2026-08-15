import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { NextFunction, Request, Response } from 'express';

const mocks = vi.hoisted(() => ({
  isTotpEnabled: vi.fn(),
  generateTotpSecret: vi.fn(() => 'NEWSECRET'),
  beginTotpEnrollment: vi.fn(),
  buildTotpUri: vi.fn(() => 'otpauth://test'),
  generateQrCode: vi.fn(async () => 'data:image/png;base64,test'),
  findPendingTotpEnrollment: vi.fn(),
  verifyTotp: vi.fn(),
  activatePendingTotp: vi.fn(),
  findTotpSecret: vi.fn(),
  disableTotp: vi.fn(),
}));

vi.mock('./middleware/requireAuth.js', () => ({
  requireAuth: vi.fn((_req, _res, next: NextFunction) => next()),
}));

vi.mock('../../middleware/auditMiddleware.js', () => ({
  auditLog: vi.fn(() => (_req: Request, _res: Response, next: NextFunction) => next()),
}));

vi.mock('./application/twoFactorService.js', () => mocks);

import router from './twoFactorRoutes.js';

interface ExpressLayerLike {
  handle?: (req: Request, res: Response, next: NextFunction) => void | Promise<void>;
  route?: {
    path?: string;
    methods?: Record<string, boolean>;
    stack?: ExpressLayerLike[];
  };
}

function controller(path: string, method: string) {
  const stack = (router as unknown as { stack: ExpressLayerLike[] }).stack;
  const handlers = stack
    .find((layer) => layer.route?.path === path && layer.route.methods?.[method])
    ?.route?.stack?.map((layer) => layer.handle)
    .filter((handler): handler is NonNullable<ExpressLayerLike['handle']> => Boolean(handler));
  if (!handlers?.length) throw new Error(`Missing ${method.toUpperCase()} ${path}`);
  return handlers.at(-1)!;
}

function request(body: unknown = {}): Request {
  return {
    body,
    user: {
      tokenType: 'access',
      sub: '00000000-0000-4000-8000-000000000001',
      email: 'professional@example.com',
      rol: 'nutriologa',
      sucursalIds: [],
      totpVerified: true,
      iat: 1,
      exp: 2,
      iss: 'nutriclinica-api',
      aud: 'nutriclinica-web',
    },
  } as unknown as Request;
}

function response(): Response {
  const res = {
    status: vi.fn(),
    json: vi.fn(),
  };
  res.status.mockReturnValue(res);
  return res as unknown as Response;
}

describe('twoFactorRoutes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects setup when a factor is already active', async () => {
    mocks.isTotpEnabled.mockResolvedValueOnce(true);
    const res = response();

    await controller('/2fa/setup', 'post')(request(), res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(409);
    expect(mocks.beginTotpEnrollment).not.toHaveBeenCalled();
  });

  it('binds setup to a server-side pending enrollment', async () => {
    mocks.isTotpEnabled.mockResolvedValueOnce(false);
    mocks.beginTotpEnrollment.mockResolvedValueOnce(true);
    const res = response();

    await controller('/2fa/setup', 'post')(request(), res, vi.fn());

    expect(mocks.beginTotpEnrollment).toHaveBeenCalledWith(
      '00000000-0000-4000-8000-000000000001',
      'NEWSECRET',
      expect.any(Date),
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ secret: 'NEWSECRET' }));
  });

  it('rejects an attacker-supplied secret that is not the pending enrollment', async () => {
    mocks.findPendingTotpEnrollment.mockResolvedValueOnce({
      secret: 'SERVERSECRET',
      expiresAt: new Date(Date.now() + 60_000),
      storageValue: 'enc:v1:server-secret',
    });
    const res = response();

    await controller('/2fa/enable', 'post')(request({ secret: 'ATTACKERSECRET', totpCode: '123456' }), res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mocks.verifyTotp).not.toHaveBeenCalled();
    expect(mocks.activatePendingTotp).not.toHaveBeenCalled();
  });

  it('activates only the verified pending enrollment', async () => {
    mocks.findPendingTotpEnrollment.mockResolvedValueOnce({
      secret: 'SERVERSECRET',
      expiresAt: new Date(Date.now() + 60_000),
      storageValue: 'enc:v1:server-secret',
    });
    mocks.verifyTotp.mockResolvedValueOnce(true);
    mocks.activatePendingTotp.mockResolvedValueOnce(true);
    const res = response();

    await controller('/2fa/enable', 'post')(request({ secret: 'SERVERSECRET', totpCode: '123456' }), res, vi.fn());

    expect(mocks.activatePendingTotp).toHaveBeenCalledWith(
      '00000000-0000-4000-8000-000000000001',
      'enc:v1:server-secret',
    );
    expect(res.json).toHaveBeenCalledWith({ enabled: true });
  });

  it('requires the current factor before disabling or replacing it', async () => {
    mocks.findTotpSecret.mockResolvedValueOnce('CURRENTSECRET');
    mocks.verifyTotp.mockResolvedValueOnce(false);
    const res = response();

    await controller('/2fa/disable', 'post')(request({ totpCode: '000000' }), res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mocks.disableTotp).not.toHaveBeenCalled();
  });
});
