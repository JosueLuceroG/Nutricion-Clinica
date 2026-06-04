import { describe, it, expect, vi } from 'vitest';
import type { Request } from 'express';
import { requireSucursalAccess, getRequestSucursalId, isCrossTenantAllowed } from './requireSucursalAccess.js';
import { UnauthorizedError, ForbiddenError } from '../../../middleware/errorHandler.js';
import type { JwtPayload } from '@nutriclinica/shared';

function makeReq(overrides: Partial<Request & { user?: JwtPayload }> = {}): Request {
  return {
    header: vi.fn().mockReturnValue(undefined),
    query: {},
    ...overrides,
  } as unknown as Request;
}

const next = vi.fn();

describe('requireSucursalAccess', () => {
  it('rechaza si no hay user', () => {
    const req = makeReq({ header: vi.fn().mockReturnValue('s1') });
    requireSucursalAccess(req, {} as never, next);
    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });

  it('rechaza si falta header y query', () => {
    const req = makeReq({ user: { sub: 'p1', email: 'a', rol: 'admin', sucursalIds: [], iat: 0, exp: 0 } });
    requireSucursalAccess(req, {} as never, next);
    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });

  it('extrae sucursalId del header X-Sucursal-Id', () => {
    const req = makeReq({
      user: { sub: 'p1', email: 'a', rol: 'nutriologa', sucursalIds: ['s1'], iat: 0, exp: 0 },
      header: vi.fn().mockReturnValue('s1'),
    });
    requireSucursalAccess(req, {} as never, next);
    expect(next).toHaveBeenCalledWith();
    expect(req.sucursalId).toBe('s1');
  });

  it('extrae sucursalId del query param como fallback', () => {
    const req = makeReq({
      user: { sub: 'p1', email: 'a', rol: 'nutriologa', sucursalIds: ['s2'], iat: 0, exp: 0 },
      query: { sucursalId: 's2' },
    });
    requireSucursalAccess(req, {} as never, next);
    expect(next).toHaveBeenCalledWith();
    expect(req.sucursalId).toBe('s2');
  });

  it('admin puede acceder a cualquier sucursal (incluso no listada)', () => {
    const req = makeReq({
      user: { sub: 'p1', email: 'a', rol: 'admin', sucursalIds: ['s1'], iat: 0, exp: 0 },
      header: vi.fn().mockReturnValue('s-other'),
    });
    requireSucursalAccess(req, {} as never, next);
    expect(next).toHaveBeenCalledWith();
    expect(req.sucursalId).toBe('s-other');
  });

  it('no-admin es Forbidden si la sucursal no est\u00e1 en su lista', () => {
    const req = makeReq({
      user: { sub: 'p1', email: 'a', rol: 'nutriologa', sucursalIds: ['s1'], iat: 0, exp: 0 },
      header: vi.fn().mockReturnValue('s-otra'),
    });
    requireSucursalAccess(req, {} as never, next);
    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });

  it('ignora header vac\u00edo y cae a query', () => {
    const req = makeReq({
      user: { sub: 'p1', email: 'a', rol: 'nutriologa', sucursalIds: ['s1'], iat: 0, exp: 0 },
      header: vi.fn().mockReturnValue('   '),
      query: { sucursalId: 's1' },
    });
    requireSucursalAccess(req, {} as never, next);
    expect(next).toHaveBeenCalledWith();
    expect(req.sucursalId).toBe('s1');
  });
});

describe('getRequestSucursalId', () => {
  it('lanza si el middleware no se ejecut\u00f3', () => {
    const req = makeReq();
    expect(() => getRequestSucursalId(req)).toThrow(/requireSucursalAccess/);
  });

  it('retorna el sucursalId del request', () => {
    const req = makeReq({ sucursalId: 's1' } as Partial<Request>);
    expect(getRequestSucursalId(req)).toBe('s1');
  });
});

describe('isCrossTenantAllowed', () => {
  it('admin \u2192 true', () => {
    const req = makeReq({
      user: { sub: 'p1', email: 'a', rol: 'admin', sucursalIds: [], iat: 0, exp: 0 },
    });
    expect(isCrossTenantAllowed(req)).toBe(true);
  });

  it('nutriologa \u2192 false', () => {
    const req = makeReq({
      user: { sub: 'p1', email: 'a', rol: 'nutriologa', sucursalIds: ['s1'], iat: 0, exp: 0 },
    });
    expect(isCrossTenantAllowed(req)).toBe(false);
  });

  it('sin user \u2192 false', () => {
    expect(isCrossTenantAllowed(makeReq())).toBe(false);
  });
});
