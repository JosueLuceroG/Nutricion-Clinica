import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import router from './analyticsRoutes.js';
import { readDwhConfig } from '../config.js';

/**
 * Build 08: rutas /dwh/analytics.
 * - montadas tras requireAuth + requireSucursalAccess;
 * - DWH deshabilitado => 503 fail-closed;
 * - herramienta no registrada => 404;
 * - DWH vacío / reconciliación fallida => estados semánticos (nunca 0 fingido).
 */

interface ExpressLayerLike {
  handle?: ((req: Request, res: Response, next: NextFunction) => void | Promise<void>) & { name?: string };
  route?: {
    path?: string;
    methods?: Record<string, boolean>;
    stack?: ExpressLayerLike[];
  };
}

function middlewareNames(): string[] {
  return ((router as unknown as { stack: ExpressLayerLike[] }).stack)
    .filter((layer) => layer.handle)
    .map((layer) => layer.handle!.name ?? 'anonymous');
}

function routeHandlers(path: string, method: string) {
  return ((router as unknown as { stack: ExpressLayerLike[] }).stack)
    .find((layer) => layer.route?.path === path && layer.route.methods?.[method])
    ?.route?.stack?.map((layer) => layer.handle)
    .filter((handler): handler is NonNullable<ExpressLayerLike['handle']> => Boolean(handler)) ?? [];
}

function makeResponse(): Response {
  return { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response;
}

const NUTRI = '00000000-0000-4000-8000-000000000011';
const SUCURSAL = '00000000-0000-4000-8000-000000000002';

function baseReq(overrides: Record<string, unknown> = {}) {
  return {
    query: {},
    params: {},
    user: { sub: NUTRI, rol: 'nutriologa' },
    sucursalId: SUCURSAL,
    ip: '127.0.0.1',
    socket: { remoteAddress: '127.0.0.1' },
    header: () => 'test',
    ...overrides,
  } as unknown as Request;
}

describe('dwh analytics routes (Build 08)', () => {
  beforeEach(() => {
    vi.stubEnv('DWH_ENABLED', 'true');
    vi.stubEnv('DWH_DATABASE', 'nc_b08_dw_test');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('monta requireAuth + requireSucursalAccess antes que cualquier ruta', () => {
    const names = middlewareNames();
    expect(names).toContain('requireAuth');
    expect(names).toContain('requireSucursalAccess');
    expect(names.indexOf('requireAuth')).toBeLessThan(names.indexOf('requireSucursalAccess'));
  });

  it('fail-closed: DWH deshabilitado => 503 (error con status via next)', async () => {
    vi.stubEnv('DWH_ENABLED', 'false');
    const controller = routeHandlers('/metrics', 'get')[0]!;
    const res = makeResponse();
    const next = vi.fn();
    await controller(baseReq(), res, next);
    const err = next.mock.calls[0]?.[0] as (Error & { status?: number }) | undefined;
    expect(err?.status).toBe(503);
  });

  it('/metrics lista solo métricas aprobadas del catálogo', async () => {
    const controller = routeHandlers('/metrics', 'get')[0]!;
    const res = makeResponse();
    await controller(baseReq(), res, vi.fn());
    const body = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0] as { metrics: Array<{ metricId: string; status: string }> };
    expect(Array.isArray(body.metrics)).toBe(true);
    expect(body.metrics.length).toBeGreaterThan(0);
    expect(body.metrics.every((m) => m.status === 'APPROVED')).toBe(true);
    expect(body.metrics.some((m) => m.metricId === 'revenue')).toBe(false);
  });

  it('/tools expone el allowlist', async () => {
    const controller = routeHandlers('/tools', 'get')[0]!;
    const res = makeResponse();
    await controller(baseReq(), res, vi.fn());
    const body = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0] as { tools: Array<{ toolId: string }> };
    expect(body.tools.map((t) => t.toolId)).toContain('get_metric');
    expect(body.tools.map((t) => t.toolId)).toContain('data_freshness');
    expect(body.tools.some((t) => t.toolId === 'run_sql')).toBe(false);
  });

  it('/tools/:toolId desconocido => 404', async () => {
    const controller = routeHandlers('/tools/:toolId', 'get')[0]!;
    const res = makeResponse();
    await controller(baseReq({ params: { toolId: 'SELECT 1' } }), res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('configuraciones de entorno inválidas fallan cerrado (misma DB OLTP/DWH)', () => {
    vi.stubEnv('DWH_ENABLED', 'true');
    vi.stubEnv('DB_NAME', 'nutriclinica');
    vi.stubEnv('DWH_DATABASE', 'nutriclinica');
    expect(() => readDwhConfig()).toThrow(/fail-closed/);
  });

  it('small-cell default = 5 (DWH_SMALL_CELL_MIN)', () => {
    expect(readDwhConfig().smallCellMin).toBe(5);
  });
});