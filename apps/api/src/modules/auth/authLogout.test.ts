import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';

const mocks = vi.hoisted(() => {
  const input = vi.fn().mockReturnThis();
  const query = vi.fn();
  const request = vi.fn(() => ({ input, query }));
  return {
    input,
    query,
    request,
    getPool: vi.fn(async () => ({ request })),
  };
});

vi.mock('../../db/connection.js', () => ({ getPool: mocks.getPool }));
vi.mock('mssql', () => {
  const NVarChar = (length: number) => ({ type: 'NVarChar', length });
  const UniqueIdentifier = () => ({ type: 'UniqueIdentifier' });
  return { default: { NVarChar, UniqueIdentifier, DateTime2: { type: 'DateTime2' }, MAX: -1 } };
});

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

const PROFESIONAL_ID = '00000000-0000-4000-8000-000000000001';

function authedRequest(): Request {
  return {
    user: {
      tokenType: 'access',
      sub: PROFESIONAL_ID,
      email: 'u@example.com',
      rol: 'admin',
      sucursalIds: [],
      totpVerified: true,
      iat: 1,
      exp: 2,
      iss: 'nutriclinica-api',
      aud: 'nutriclinica-web',
      ver: 1,
    },
    ip: '127.0.0.1',
    socket: { remoteAddress: '127.0.0.1' },
    header: () => 'vitest',
  } as unknown as Request;
}

function jsonResponse() {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(payload: unknown) {
      res.body = payload;
      return res;
    },
  };
  return res as unknown as Response & { statusCode: number; body: unknown };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.input.mockReturnThis();
  mocks.request.mockImplementation(() => ({ input: mocks.input, query: mocks.query }));
  mocks.query.mockResolvedValue({ recordset: [] });
});

describe('POST /auth/logout', () => {
  it('protege el endpoint con access-token authentication', () => {
    const handlers = routeHandlers('/logout', 'post');
    expect(handlers[0]?.name).toBe('requireAuth');
  });

  it('revoca las sesiones del profesional y responde ok', async () => {
    const controller = routeHandlers('/logout', 'post')[1]!;
    const res = jsonResponse();
    const next = vi.fn();

    await controller(authedRequest(), res, next);

    const revokeQuery = mocks.query.mock.calls.find(([sqlText]) =>
      String(sqlText).includes('token_version = token_version + 1'),
    );
    expect(revokeQuery).toBeDefined();
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(next).not.toHaveBeenCalled();
  });

  it('escribe un registro de auditoría de logout (fall-soft)', async () => {
    const controller = routeHandlers('/logout', 'post')[1]!;
    const res = jsonResponse();

    await controller(authedRequest(), res, vi.fn());

    const auditQuery = mocks.query.mock.calls.find(([sqlText]) =>
      String(sqlText).includes('INSERT INTO audit_log'),
    );
    expect(auditQuery).toBeDefined();
    expect(mocks.input.mock.calls.some(([, , value]) => value === 'logout')).toBe(true);
  });

  it('responde 401 sin profesional autenticado', async () => {
    const controller = routeHandlers('/logout', 'post')[1]!;
    const res = jsonResponse();

    await controller({ header: () => undefined } as unknown as Request, res, vi.fn());

    expect(res.statusCode).toBe(401);
  });

  it('audit falla de forma fall-soft sin romper la revocación', async () => {
    mocks.query
      .mockResolvedValueOnce({ recordset: [] })
      .mockRejectedValueOnce(new Error('audit down'));
    const controller = routeHandlers('/logout', 'post')[1]!;
    const res = jsonResponse();
    const next = vi.fn();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await controller(authedRequest(), res, next);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(next).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});