import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockHash, mockVerify, mockJwtSign, mockJwtVerify, mockRequestInput, mockRequestQuery, mockPoolRequest, mockGetPool } = vi.hoisted(() => {
  const mockRequestInput = vi.fn().mockReturnThis();
  const mockRequestQuery = vi.fn();
  const mockPoolRequest = vi.fn(() => ({ input: mockRequestInput, query: mockRequestQuery }));
  return {
    mockHash: vi.fn(async (plain: string) => `$argon2id$hash-of:${plain}`),
    mockVerify: vi.fn(async () => true),
    mockJwtSign: vi.fn((payload: object) => `signed.${JSON.stringify(payload)}`),
    mockJwtVerify: vi.fn((token: string) => {
      if (token.startsWith('bad.')) throw new Error('invalid signature');
      return { sub: 'p1', email: 'a@b.c', rol: 'admin', sucursalIds: ['s1'] };
    }),
    mockRequestInput,
    mockRequestQuery,
    mockPoolRequest,
    mockGetPool: vi.fn(async () => ({ request: mockPoolRequest })),
  };
});

vi.mock('argon2', () => ({
  default: {
    hash: mockHash,
    verify: mockVerify,
    argon2id: 2,
  },
  hash: mockHash,
  verify: mockVerify,
  argon2id: 2,
}));

vi.mock('jsonwebtoken', () => ({
  default: {
    sign: mockJwtSign,
    verify: mockJwtVerify,
  },
}));

vi.mock('mssql', () => {
  const NVarChar = (n: number) => ({ type: 'NVarChar', length: n });
  const UniqueIdentifier = () => ({ type: 'UniqueIdentifier' });
  return { default: { NVarChar, UniqueIdentifier } };
});

vi.mock('../../../db/connection.js', () => ({
  getPool: mockGetPool,
  closePool: vi.fn(),
}));

import { hashPassword, verifyPassword, login, register, signToken, verifyToken } from './authService.js';
import {
  InvalidCredentialsError,
  EmailAlreadyExistsError,
  InactiveAccountError,
  WeakPasswordError,
} from '../domain/errors.js';

beforeEach(() => {
  vi.clearAllMocks();
  mockRequestInput.mockReturnThis();
  mockPoolRequest.mockImplementation(() => ({ input: mockRequestInput, query: mockRequestQuery }));
  process.env.JWT_SECRET = 'test-secret-for-vitest';
});

describe('authService — hashPassword / verifyPassword', () => {
  it('hashPassword usa argon2id con opciones OWASP', async () => {
    await hashPassword('secret');
    expect(mockHash).toHaveBeenCalledWith('secret', expect.objectContaining({ type: 2 }));
  });

  it('verifyPassword retorna true si coincide', async () => {
    mockVerify.mockResolvedValueOnce(true);
    const ok = await verifyPassword('hash', 'plain');
    expect(ok).toBe(true);
  });

  it('verifyPassword retorna false si argon2 lanza', async () => {
    mockVerify.mockRejectedValueOnce(new Error('bad hash'));
    const ok = await verifyPassword('bad', 'plain');
    expect(ok).toBe(false);
  });
});

describe('authService — login', () => {
  it('login exitoso: retorna token y sucursales', async () => {
    mockRequestQuery
      .mockResolvedValueOnce({
        recordset: [{
          id: 'p1',
          email: 'admin@x.com',
          password_hash: 'h',
          nombre_completo: 'Admin',
          rol: 'admin',
          activo: true,
          email_verificado: true,
        }],
      })
      .mockResolvedValueOnce({
        recordset: [
          { id: 's1', nombre: 'Centro', es_titular: true },
          { id: 's2', nombre: 'Norte', es_titular: false },
        ],
      });

    const result = await login('admin@x.com', 'secret');
    expect(result.token).toContain('signed.');
    expect(result.profesional.id).toBe('p1');
    expect(result.sucursales).toHaveLength(2);
    expect(result.sucursales[0]!.esTitular).toBe(true);
  });

  it('login: email no registrado lanza InvalidCredentialsError', async () => {
    mockRequestQuery.mockResolvedValueOnce({ recordset: [] });
    await expect(login('nadie@x.com', 'p')).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  it('login: cuenta inactiva lanza InactiveAccountError', async () => {
    mockRequestQuery.mockResolvedValueOnce({
      recordset: [{
        id: 'p1', email: 'x', password_hash: 'h', nombre_completo: 'X',
        rol: 'nutriologa', activo: false, email_verificado: true,
      }],
    });
    await expect(login('x@x.com', 'p')).rejects.toBeInstanceOf(InactiveAccountError);
  });

  it('login: password incorrecta lanza InvalidCredentialsError', async () => {
    mockRequestQuery.mockResolvedValueOnce({
      recordset: [{
        id: 'p1', email: 'x', password_hash: 'h', nombre_completo: 'X',
        rol: 'admin', activo: true, email_verificado: true,
      }],
    });
    mockVerify.mockResolvedValueOnce(false);
    await expect(login('x@x.com', 'wrong')).rejects.toBeInstanceOf(InvalidCredentialsError);
  });
});

describe('authService — register', () => {
  it('register: valida password antes de tocar DB', async () => {
    await expect(register({
      email: 'a@b.com',
      password: 'corta',
      nombreCompleto: 'X',
      rol: 'admin',
      sucursalIds: ['s1'],
    })).rejects.toBeInstanceOf(WeakPasswordError);
    expect(mockRequestQuery).not.toHaveBeenCalled();
  });

  it('register: email duplicado lanza EmailAlreadyExistsError', async () => {
    mockRequestQuery.mockResolvedValueOnce({ recordset: [{
      id: 'p1', email: 'a@b.com', password_hash: 'h', nombre_completo: 'X',
      rol: 'admin', activo: true, email_verificado: true,
    }]});
    await expect(register({
      email: 'a@b.com',
      password: 'S3gura!MuyFuerte#2024',
      nombreCompleto: 'X',
      rol: 'admin',
      sucursalIds: ['00000000-0000-0000-0000-000000000001'],
    })).rejects.toBeInstanceOf(EmailAlreadyExistsError);
  });

  it('register: crea profesional y asigna sucursales', async () => {
    mockRequestQuery
      .mockResolvedValueOnce({ recordset: [] })
      .mockResolvedValueOnce({ recordset: undefined })
      .mockResolvedValueOnce({ recordset: undefined })
      .mockResolvedValueOnce({
        recordset: [{
          id: 'p-new', email: 'a@b.com', password_hash: 'h', nombre_completo: 'A',
          rol: 'nutriologa', activo: true, email_verificado: false,
        }],
      })
      .mockResolvedValueOnce({
        recordset: [{ id: 's1', nombre: 'Centro', es_titular: true }],
      });

    const result = await register({
      email: 'a@b.com',
      password: 'S3gura!MuyFuerte#2024',
      nombreCompleto: 'A',
      rol: 'nutriologa',
      sucursalIds: ['00000000-0000-0000-0000-000000000001'],
    });

    expect(result.profesional.rol).toBe('nutriologa');
    expect(result.sucursales).toHaveLength(1);
  });
});

describe('authService — signToken / verifyToken', () => {
  it('signToken firma con payload dado', async () => {
    const t = await signToken({ sub: 'p1', email: 'a', rol: 'admin', sucursalIds: ['s1'] });
    expect(t).toContain('signed.');
  });

  it('verifyToken retorna payload si es válido', async () => {
    const p = await verifyToken('valid.token');
    expect(p.sub).toBe('p1');
  });

  it('verifyToken propaga error si es inválido', async () => {
    await expect(verifyToken('bad.token')).rejects.toThrow();
  });
});
