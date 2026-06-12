import { describe, expect, it } from 'vitest';
import router, { turnRouter } from './telemedicinaRoutes.js';
import type { AuditMiddleware, AuditOperation } from '../../middleware/auditMiddleware.js';

interface ExpressLayerLike {
  handle?: {
    name?: string;
    auditOperation?: AuditOperation;
    auditEntityType?: string;
  };
  route?: {
    path?: string;
    methods?: Record<string, boolean>;
    stack?: Array<{ handle?: { name?: string } & Partial<AuditMiddleware> }>;
  };
}

function routerStack(): ExpressLayerLike[] {
  return (router as unknown as { stack: ExpressLayerLike[] }).stack;
}

function findRoute(path: string, method: string) {
  return routerStack().find((layer) => layer.route?.path === path && layer.route.methods?.[method])?.route;
}

function routeHandlers(path: string, method: string) {
  return findRoute(path, method)?.stack?.map((layer) => layer.handle) ?? [];
}

describe('telemedicinaRoutes', () => {
  it('protege todas las rutas con auth antes de tenancy', () => {
    const stack = routerStack();
    const firstRouteIndex = stack.findIndex((layer) => layer.route);
    const globalMiddlewareNames = stack.slice(0, firstRouteIndex).map((layer) => layer.handle?.name);

    expect(globalMiddlewareNames).toContain('requireAuth');
    expect(globalMiddlewareNames).toContain('requireSucursalAccess');
    expect(globalMiddlewareNames.indexOf('requireAuth')).toBeLessThan(globalMiddlewareNames.indexOf('requireSucursalAccess'));
  });

  it('registra endpoints de grabaciones cifradas por sala', () => {
    expect(findRoute('/:id/grabaciones', 'get')).toBeDefined();
    expect(findRoute('/:id/grabaciones', 'post')).toBeDefined();
    expect(findRoute('/:id/grabaciones/:grabacionId/blob', 'get')).toBeDefined();
    expect(findRoute('/:id/grabaciones/:grabacionId', 'delete')).toBeDefined();
  });

  it('subida remota audita create y parsea body binario raw', () => {
    const handlers = routeHandlers('/:id/grabaciones', 'post');
    const names = handlers.map((handler) => handler?.name);
    const audit = handlers.find((handler) => handler?.auditOperation === 'create');

    expect(audit?.auditEntityType).toBe('video_grabacion');
    expect(names.indexOf('auditMiddleware')).toBeLessThan(names.indexOf('rawParser'));
    expect(names).toContain('rawParser');
  });

  it('descarga de blob cifrado audita read sobre video_grabacion', () => {
    const handlers = routeHandlers('/:id/grabaciones/:grabacionId/blob', 'get');
    const audit = handlers.find((handler) => handler?.auditOperation === 'read');

    expect(audit?.name).toBe('auditMiddleware');
    expect(audit?.auditEntityType).toBe('video_grabacion');
  });

  it('eliminación remota audita delete sobre video_grabacion', () => {
    const handlers = routeHandlers('/:id/grabaciones/:grabacionId', 'delete');
    const audit = handlers.find((handler) => handler?.auditOperation === 'delete');

    expect(audit?.name).toBe('auditMiddleware');
    expect(audit?.auditEntityType).toBe('video_grabacion');
  });

  describe('turnRouter', () => {
    it('expone ruta GET /turn-config con auth', () => {
      const stack = (turnRouter as unknown as { stack: Array<{ route?: { path: string; methods: Record<string, boolean> } }> }).stack;
      const turnRoute = stack.find((layer) => layer.route?.path === '/turn-config' && layer.route.methods?.get);
      expect(turnRoute).toBeDefined();
    });

    it('protege turnRouter con requireAuth', () => {
      const stack = (turnRouter as unknown as { stack: ExpressLayerLike[] }).stack;
      const beforeRoute = stack.findIndex((layer) => layer.route);
      const globalMiddlewareNames = stack.slice(0, beforeRoute < 0 ? undefined : beforeRoute).map((l) => l.handle?.name);
      expect(globalMiddlewareNames).toContain('requireAuth');
    });
  });
});
