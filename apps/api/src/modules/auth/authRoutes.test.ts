import { describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import router from './authRoutes.js';

interface ExpressLayerLike {
  handle?: ((req: Request, res: Response, next: NextFunction) => void | Promise<void>) & { name?: string };
  route?: {
    path?: string;
    methods?: Record<string, boolean>;
    stack?: ExpressLayerLike[];
  };
}

function routeHandlers(path: string, method: string) {
  const stack = (router as unknown as { stack: ExpressLayerLike[] }).stack;
  return (
    stack
      .find((layer) => layer.route?.path === path && layer.route.methods?.[method])
      ?.route?.stack?.map((layer) => layer.handle)
      .filter((handler): handler is NonNullable<ExpressLayerLike['handle']> => Boolean(handler)) ?? []
  );
}

describe('authRoutes', () => {
  it('protects register with auth before the controller', () => {
    const handlers = routeHandlers('/register', 'post');

    expect(handlers.map((handler) => handler.name)).toEqual(['requireAuth', '', '']);
  });

  it('limits register to admin role', () => {
    const roleHandler = routeHandlers('/register', 'post')[1]!;
    const next = vi.fn();

    roleHandler(
      {
        user: {
          tokenType: 'access',
          sub: '00000000-0000-4000-8000-000000000001',
          email: 'u@example.com',
          rol: 'nutriologa',
          sucursalIds: [],
          totpVerified: true,
          iat: 1,
          exp: 2,
          iss: 'nutriclinica-api',
          aud: 'nutriclinica-web',
        },
      } as unknown as Request,
      {} as Response,
      next,
    );

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 403 }));
  });

  it.each(['/sensitive-action-grants', '/sensitive-action-grants/consume', '/logout'])('protects %s with access-token authentication', (path) => {
    expect(routeHandlers(path, 'post')[0]?.name).toBe('requireAuth');
  });
});
