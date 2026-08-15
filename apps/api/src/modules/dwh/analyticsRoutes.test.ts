import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { createAnalyticsRouter } from './analyticsRoutes.js';
import { InMemoryDwhStore } from './dwhStore.js';
import type { DailyMetricSource } from './etl.js';

interface ExpressLayerLike {
  handle?: ((req: Request, res: Response, next: NextFunction) => void | Promise<void>) & { name?: string };
  route?: {
    path?: string;
    methods?: Record<string, boolean>;
    stack?: ExpressLayerLike[];
  };
}

function routeHandlers(router: ReturnType<typeof createAnalyticsRouter>, path: string, method: string) {
  return ((router as unknown as { stack: ExpressLayerLike[] }).stack)
    .find((layer) => layer.route?.path === path && layer.route.methods?.[method])
    ?.route?.stack?.map((layer) => layer.handle)
    .filter((handler): handler is NonNullable<ExpressLayerLike['handle']> => Boolean(handler)) ?? [];
}

function makeResponse(): Response {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  } as unknown as Response;
}

const ADMIN = '00000000-0000-4000-8000-000000000001';
const NUTRI = '00000000-0000-4000-8000-000000000011';
const SUCURSAL = '00000000-0000-4000-8000-000000000002';

const source: DailyMetricSource = {
  async getDailyValues(input) {
    return input.metricId === 'consultas_diarias' ? [{ date: '2026-08-14', value: 12 }] : [];
  },
};

function makeEnv() {
  const store = new InMemoryDwhStore();
  const router = createAnalyticsRouter({
    store,
    source,
    now: () => new Date('2026-08-14T12:00:00.000Z'),
  });
  return { store, router };
}

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

describe('analytics routes', () => {
  beforeEach(() => {
    vi.stubEnv('DWH_ENABLED', 'true');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('fail-closes when the DWH is disabled', async () => {
    vi.stubEnv('DWH_ENABLED', 'false');
    const { router } = makeEnv();
    const controller = routeHandlers(router, '/catalog', 'get')[0]!;
    const res = makeResponse();
    await controller(baseReq(), res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(503);
  });

  it('serves the semantic catalog', async () => {
    const { router } = makeEnv();
    const controller = routeHandlers(router, '/catalog', 'get')[0]!;
    const res = makeResponse();
    await controller(baseReq(), res, vi.fn());
    const payload = vi.mocked(res.json).mock.calls[0]?.[0] as { metrics: Array<{ id: string }>; dimensions: Array<{ id: string }> };
    expect(payload.metrics.some((m) => m.id === 'consultas_diarias')).toBe(true);
    expect(payload.dimensions.map((d) => d.id)).toEqual(['fecha', 'sucursal']);
  });

  it('serves metric series filtered by date with lineage', async () => {
    const { store, router } = makeEnv();
    await store.saveSnapshot({ metricId: 'consultas_diarias', dimensionKey: '2026-08-14', value: 12, loadedAt: '2026-08-14T11:00:00.000Z', sourceRunId: 'run-1' });
    await store.saveSnapshot({ metricId: 'consultas_diarias', dimensionKey: '2026-07-01', value: 3, loadedAt: '2026-07-01T00:00:00.000Z', sourceRunId: 'run-0' });
    const controller = routeHandlers(router, '/metrics/:metricId', 'get')[0]!;
    const res = makeResponse();

    await controller(baseReq({ params: { metricId: 'consultas_diarias' }, query: { from: '2026-08-01' } }), res, vi.fn());

    const payload = vi.mocked(res.json).mock.calls[0]?.[0] as { series: Array<{ date: string; sourceRunId: string }> };
    expect(payload.series).toEqual([expect.objectContaining({ date: '2026-08-14', sourceRunId: 'run-1' })]);
  });

  it('rejects unknown metrics with 404 and invalid filters with 400', async () => {
    const { router } = makeEnv();
    const controller = routeHandlers(router, '/metrics/:metricId', 'get')[0]!;

    const unknown = makeResponse();
    await controller(baseReq({ params: { metricId: 'no_existe' } }), unknown, vi.fn());
    expect(unknown.status).toHaveBeenCalledWith(404);

    const badFilter = makeResponse();
    await controller(baseReq({ params: { metricId: 'consultas_diarias' }, query: { from: 'ayer' } }), badFilter, vi.fn());
    expect(badFilter.status).toHaveBeenCalledWith(400);
  });

  it('runs an admin-only load and persists the run', async () => {
    const { store, router } = makeEnv();
    const controller = routeHandlers(router, '/load', 'post')[0]!;

    const forbidden = makeResponse();
    await controller(baseReq(), forbidden, vi.fn());
    expect(forbidden.status).toHaveBeenCalledWith(403);

    const ok = makeResponse();
    await controller(baseReq({ user: { sub: ADMIN, rol: 'admin' } }), ok, vi.fn());
    expect(ok.status).not.toHaveBeenCalled();
    const payload = vi.mocked(ok.json).mock.calls[0]?.[0] as { run: { status: string; rowsLoaded: number } };
    expect(payload.run.status).toBe('success');
    expect(payload.run.rowsLoaded).toBeGreaterThan(0);
    expect((await store.listLoadRuns()).length).toBe(1);
  });

  it('reports freshness and recent runs', async () => {
    const { store, router } = makeEnv();
    await store.saveSnapshot({ metricId: 'consultas_diarias', dimensionKey: '2026-08-14', value: 12, loadedAt: '2026-08-14T11:00:00.000Z', sourceRunId: 'run-1' });
    const freshness = routeHandlers(router, '/freshness', 'get')[0]!;
    const runs = routeHandlers(router, '/runs', 'get')[0]!;

    const freshnessRes = makeResponse();
    await freshness(baseReq(), freshnessRes, vi.fn());
    const payload = vi.mocked(freshnessRes.json).mock.calls[0]?.[0] as { freshness: Array<{ metricId: string; stale: boolean }> };
    expect(payload.freshness.find((f) => f.metricId === 'consultas_diarias')?.stale).toBe(false);

    const runsRes = makeResponse();
    await runs(baseReq(), runsRes, vi.fn());
    expect(vi.mocked(runsRes.json).mock.calls[0]?.[0]).toEqual({ runs: [] });
  });
});