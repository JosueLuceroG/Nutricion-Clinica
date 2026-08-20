import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveScope, assertCanBreakdownByProfessional } from './authorization.js';
import { ForbiddenError } from '../../../middleware/errorHandler.js';

/**
 * Build 08: el alcance analytics SIEMPRE deriva del token + header de sucursal.
 * - profesional no-admin: solo su sucursal y su propio professional_key;
 * - admin: puede pedir vista global (allBranches);
 * - sucursal sin carga en DWH => ForbiddenError.
 */

vi.mock('../dwhConnection.js', () => ({ getDwhPool: vi.fn() }));

import { getDwhPool } from '../dwhConnection.js';

const ADMIN = { sub: '00000000-0000-4000-8000-000000000001', rol: 'admin', sucursalIds: ['s1'] } as never;
const NUTRI = { sub: '00000000-0000-4000-8000-000000000011', rol: 'nutriologa', sucursalIds: ['s1'] } as never;

function fakePool(rows: Array<Record<string, unknown>>) {
  return {
    request() {
      return {
        input() {
          return this;
        },
        async query<T>(sqlText: string): Promise<{ recordset: T[] }> {
          if (sqlText.includes('dim_sucursal')) {
            const found = rows.filter((r) => r.table === 'dim_sucursal');
            return { recordset: found as T[] };
          }
          if (sqlText.includes('dim_professional')) {
            const found = rows.filter((r) => r.table === 'dim_professional');
            return { recordset: found as T[] };
          }
          return { recordset: [] };
        },
      };
    },
  };
}

describe('resolveScope (Build 08)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('admin con allBranches=true => alcance global (sin filtro de sucursal)', async () => {
    (getDwhPool as ReturnType<typeof vi.fn>).mockResolvedValue(fakePool([
      { table: 'dim_sucursal', sucursal_key: 1 },
      { table: 'dim_professional', professional_key: 7 },
    ]));
    const scope = await resolveScope(ADMIN, 's1', true);
    expect(scope.isAdmin).toBe(true);
    expect(scope.sucursalKeys).toEqual([]);
    expect(scope.professionalKey).toBeUndefined();
  });

  it('admin sin allBranches => restringido a la sucursal del header', async () => {
    (getDwhPool as ReturnType<typeof vi.fn>).mockResolvedValue(fakePool([
      { table: 'dim_sucursal', sucursal_key: 3 },
    ]));
    const scope = await resolveScope(ADMIN, 's1');
    expect(scope.sucursalKeys).toEqual([3]);
  });

  it('profesional no-admin => sucursal + su propio professional_key', async () => {
    (getDwhPool as ReturnType<typeof vi.fn>).mockResolvedValue(fakePool([
      { table: 'dim_sucursal', sucursal_key: 3 },
      { table: 'dim_professional', professional_key: 9 },
    ]));
    const scope = await resolveScope(NUTRI, 's1');
    expect(scope.sucursalKeys).toEqual([3]);
    expect(scope.professionalKey).toBe(9);
    expect(scope.isAdmin).toBe(false);
  });

  it('sucursal sin carga en DWH => ForbiddenError (fail-closed, nunca datos vacíos)', async () => {
    (getDwhPool as ReturnType<typeof vi.fn>).mockResolvedValue(fakePool([]));
    await expect(resolveScope(NUTRI, 's-unknown')).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('breakdown por profesional: no-admin SIN dimensión cargada => ForbiddenError', () => {
    expect(() => assertCanBreakdownByProfessional({ sucursalKeys: [3], professionalKey: undefined, isAdmin: false })).toThrow(ForbiddenError);
    expect(() => assertCanBreakdownByProfessional({ sucursalKeys: [3], professionalKey: 9, isAdmin: false })).not.toThrow();
    expect(() => assertCanBreakdownByProfessional({ sucursalKeys: [], professionalKey: undefined, isAdmin: true })).not.toThrow();
  });
});