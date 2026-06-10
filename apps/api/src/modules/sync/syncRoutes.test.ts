import { describe, expect, it } from 'vitest';
import router from './syncRoutes.js';

interface ExpressRouteLayerLike {
  route?: {
    path?: string;
    stack?: Array<{ handle?: { name?: string } }>;
  };
}

describe('syncRoutes', () => {
  it('/push exige requireSucursalAccess antes de procesar el batch', () => {
    const stack = (router as unknown as { stack: ExpressRouteLayerLike[] }).stack;
    const pushRoute = stack.find((layer) => layer.route?.path === '/push')?.route;
    const middlewareNames = pushRoute?.stack?.map((layer) => layer.handle?.name) ?? [];

    expect(pushRoute).toBeDefined();
    expect(middlewareNames).toContain('requireAuth');
    expect(middlewareNames).toContain('requireSucursalAccess');
  });
});
