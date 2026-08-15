import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockHash,
  mockVerify,
  mockJwtSign,
  mockJwtVerify,
  mockRequestInput,
  mockRequestQuery,
  mockPoolRequest,
  mockGetPool,
} = vi.hoisted(() => {
  const mockRequestInput = vi.fn().mockReturnThis();
  const mockRequestQuery = vi.fn();
  const mockPoolRequest = vi.fn(() => ({
    input: mockRequestInput,
    query: mockRequestQuery,
  }));
  return {
    mockHash: vi.fn(async (plain: string) => `$argon2id$hash-of:${plain}`),
    mockVerify: vi.fn(async () => true),
    mockJwtSign: vi.fn((payload: object) => `signed.${JSON.stringify(payload)}`),
    mockJwtVerify: vi.fn((token: string): unknown => {
      if (token.startsWith('bad.')) throw new Error('invalid signature');
      return {
        tokenType: 'access',
        sub: '00000000-0000-4000-8000-000000000001',
        email: 'admin@example.com',
        rol: 'admin',
        sucursalIds: ['00000000-0000-4000-8000-000000000002'],
        totpVerified: true,
        ver: 1,
        iat: 1,
        exp: 2,
        iss: 'nutriclinica-api',
        aud: 'nutriclinica-web',
      };
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

import {
  hashPassword,
  verifyPassword,
  login,
  register,
  signToken,
  signPending2faToken,
  verifyToken,
  verifyPending2faToken,
  revokeProfesionalSessions,
} from './authService.js';
import {
  InvalidCredentialsError,
  EmailAlreadyExistsError,
  InactiveAccountError,
  WeakPasswordError,
} from '../domain/errors.js';

beforeEach(() => {
  vi.clearAllMocks();
  mockRequestInput.mockReturnThis();
  mockPoolRequest.mockImplementation(() => ({
    input: mockRequestInput,
    query: mockRequestQuery,
  }));
  mockRequestQuery.mockResolvedValue({
    recordset: [{ token_version: 1, activo: true }],
  });
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
        recordset: [
          {
            id: 'p1',
            email: 'admin@x.com',
            password_hash: 'h',
            nombre_completo: 'Admin',
            rol: 'admin',
            activo: true,
            email_verificado: true,
          },
        ],
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
      recordset: [
        {
          id: 'p1',
          email: 'x',
          password_hash: 'h',
          nombre_completo: 'X',
          rol: 'nutriologa',
          activo: false,
          email_verificado: true,
        },
      ],
    });
    await expect(login('x@x.com', 'p')).rejects.toBeInstanceOf(InactiveAccountError);
  });

  it('login: password incorrecta lanza InvalidCredentialsError', async () => {
    mockRequestQuery.mockResolvedValueOnce({
      recordset: [
        {
          id: 'p1',
          email: 'x',
          password_hash: 'h',
          nombre_completo: 'X',
          rol: 'admin',
          activo: true,
          email_verificado: true,
        },
      ],
    });
    mockVerify.mockResolvedValueOnce(false);
    await expect(login('x@x.com', 'wrong')).rejects.toBeInstanceOf(InvalidCredentialsError);
  });
});

describe('authService — register', () => {
  it('register: valida password antes de tocar DB', async () => {
    await expect(
      register({
        email: 'a@b.com',
        password: 'corta',
        nombreCompleto: 'X',
        rol: 'admin',
        sucursalIds: ['s1'],
      }),
    ).rejects.toBeInstanceOf(WeakPasswordError);
    expect(mockRequestQuery).not.toHaveBeenCalled();
  });

  it('register: email duplicado lanza EmailAlreadyExistsError', async () => {
    mockRequestQuery.mockResolvedValueOnce({
      recordset: [
        {
          id: 'p1',
          email: 'a@b.com',
          password_hash: 'h',
          nombre_completo: 'X',
          rol: 'admin',
          activo: true,
          email_verificado: true,
        },
      ],
    });
    await expect(
      register({
        email: 'a@b.com',
        password: 'S3gura!MuyFuerte#2024',
        nombreCompleto: 'X',
        rol: 'admin',
        sucursalIds: ['00000000-0000-0000-0000-000000000001'],
      }),
    ).rejects.toBeInstanceOf(EmailAlreadyExistsError);
  });

  it('register: crea profesional y asigna sucursales', async () => {
    mockRequestQuery
      .mockResolvedValueOnce({ recordset: [] })
      .mockResolvedValueOnce({ recordset: undefined })
      .mockResolvedValueOnce({ recordset: undefined })
      .mockResolvedValueOnce({
        recordset: [
          {
            id: 'p-new',
            email: 'a@b.com',
            password_hash: 'h',
            nombre_completo: 'A',
            rol: 'nutriologa',
            activo: true,
            email_verificado: false,
          },
        ],
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
    const t = await signToken({
      sub: '00000000-0000-4000-8000-000000000001',
      email: 'admin@example.com',
      rol: 'admin',
      sucursalIds: ['00000000-0000-4000-8000-000000000002'],
      ver: 3,
    });
    expect(t).toContain('signed.');
    expect(mockJwtSign).toHaveBeenCalledWith(
      expect.objectContaining({ tokenType: 'access', totpVerified: false, ver: 3 }),
      expect.any(String),
      expect.any(Object),
    );
  });

  it('verifyToken retorna payload si es válido', async () => {
    const p = await verifyToken('valid.token');
    expect(p.sub).toBe('00000000-0000-4000-8000-000000000001');
  });

  it('verifyToken propaga error si es inválido', async () => {
    await expect(verifyToken('bad.token')).rejects.toThrow();
  });

  it('rechaza un pending token como access token', async () => {
    mockJwtVerify.mockReturnValueOnce({
      tokenType: 'pending_2fa',
      sub: '00000000-0000-4000-8000-000000000001',
      email: 'admin@example.com',
      iat: 1,
      exp: 2,
      iss: 'nutriclinica-api',
      aud: 'nutriclinica-web',
    });

    await expect(verifyToken('pending.token')).rejects.toThrow();
  });

  it('rechaza un access token como pending token', async () => {
    await expect(verifyPending2faToken('access.token')).rejects.toThrow();
  });

  it('rechaza tokens sin tokenType o con claims desconocidos', async () => {
    const base = {
      sub: '00000000-0000-4000-8000-000000000001',
      email: 'admin@example.com',
      rol: 'admin',
      sucursalIds: [],
      totpVerified: false,
      ver: 1,
      iat: 1,
      exp: 2,
      iss: 'nutriclinica-api',
      aud: 'nutriclinica-web',
    };
    mockJwtVerify.mockReturnValueOnce(base);
    await expect(verifyToken('missing-type.token')).rejects.toThrow();

    mockJwtVerify.mockReturnValueOnce({ ...base, tokenType: 'unknown' });
    await expect(verifyToken('unknown-type.token')).rejects.toThrow();
  });

  it('rechaza tokens sin claim ver', async () => {
    mockJwtVerify.mockReturnValueOnce({
      tokenType: 'access',
      sub: '00000000-0000-4000-8000-000000000001',
      email: 'admin@example.com',
      rol: 'admin',
      sucursalIds: [],
      totpVerified: false,
      iat: 1,
      exp: 2,
      iss: 'nutriclinica-api',
      aud: 'nutriclinica-web',
    });

    await expect(verifyToken('no-ver.token')).rejects.toThrow();
  });

  it('verifyToken rechaza sesiones revocadas por versión de token', async () => {
    mockRequestQuery.mockResolvedValueOnce({
      recordset: [{ token_version: 2, activo: true }],
    });

    await expect(verifyToken('revoked.token')).rejects.toThrow(
      /Sesión revocada/,
    );
  });

  it('verifyToken rechaza cuentas inactivas', async () => {
    mockRequestQuery.mockResolvedValueOnce({
      recordset: [{ token_version: 1, activo: false }],
    });

    await expect(verifyToken('inactive.token')).rejects.toThrow(
      /Sesión revocada/,
    );
  });

  it('verifyToken rechaza profesionales inexistentes', async () => {
    mockRequestQuery.mockResolvedValueOnce({ recordset: [] });

    await expect(verifyToken('missing-user.token')).rejects.toThrow(
      /Sesión revocada/,
    );
  });

  it('revokeProfesionalSessions incrementa la versión de token', async () => {
    await revokeProfesionalSessions('00000000-0000-4000-8000-000000000001');

    expect(mockRequestQuery).toHaveBeenCalledWith(
      expect.stringContaining('token_version = token_version + 1'),
    );
  });

  it('firma pending tokens con propósito y expiración corta', async () => {
    await signPending2faToken({
      sub: '00000000-0000-4000-8000-000000000001',
      email: 'admin@example.com',
    });

    expect(mockJwtSign).toHaveBeenCalledWith(
      expect.objectContaining({ tokenType: 'pending_2fa' }),
      expect.any(String),
      expect.objectContaining({ expiresIn: '5m' }),
    );
  });
});
