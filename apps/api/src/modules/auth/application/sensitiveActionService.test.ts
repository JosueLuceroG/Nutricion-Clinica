import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const input = vi.fn().mockReturnThis();
  const query = vi.fn();
  const request = vi.fn(() => ({ input, query }));
  return {
    input,
    query,
    request,
    getPool: vi.fn(async () => ({ request })),
    findProfesionalById: vi.fn(),
    verifyPassword: vi.fn(),
    findTotpSecret: vi.fn(),
    verifyTotp: vi.fn(),
    jwtSign: vi.fn(() => 'sensitive-grant'),
    jwtVerify: vi.fn(),
  };
});

vi.mock('../../../db/connection.js', () => ({ getPool: mocks.getPool }));
vi.mock('./authService.js', () => ({
  findProfesionalById: mocks.findProfesionalById,
  verifyPassword: mocks.verifyPassword,
}));
vi.mock('./twoFactorService.js', () => ({
  findTotpSecret: mocks.findTotpSecret,
  verifyTotp: mocks.verifyTotp,
}));
vi.mock('jsonwebtoken', () => ({
  default: { sign: mocks.jwtSign, verify: mocks.jwtVerify },
}));
vi.mock('mssql', () => {
  const NVarChar = (length: number) => ({ type: 'NVarChar', length });
  const UniqueIdentifier = () => ({ type: 'UniqueIdentifier' });
  return { default: { NVarChar, UniqueIdentifier, DateTime2: { type: 'DateTime2' }, MAX: -1 } };
});

import { authorizeSensitiveAction, consumeSensitiveActionGrant } from './sensitiveActionService.js';

const ACTOR_ID = '00000000-0000-4000-8000-000000000001';
const GRANT_ID = '00000000-0000-4000-8000-000000000002';
const audit = { ipAddress: '127.0.0.1', userAgent: 'vitest' };

function admin() {
  return {
    id: ACTOR_ID,
    email: 'admin@example.com',
    password_hash: 'password-hash',
    nombre_completo: 'Admin',
    rol: 'admin',
    activo: true,
    email_verificado: true,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.input.mockReturnThis();
  mocks.request.mockImplementation(() => ({ input: mocks.input, query: mocks.query }));
  mocks.findProfesionalById.mockResolvedValue(admin());
  mocks.verifyPassword.mockResolvedValue(true);
  mocks.findTotpSecret.mockResolvedValue(null);
  mocks.query.mockResolvedValue({ recordset: [] });
  process.env.JWT_SECRET = 'test-secret';
});

describe('sensitiveActionService', () => {
  it('issues an action-bound grant only after current admin reauthentication', async () => {
    const result = await authorizeSensitiveAction({
      actorId: ACTOR_ID,
      action: 'backup.export',
      password: 'account-password',
      audit,
    });

    expect(result.grant).toBe('sensitive-grant');
    expect(mocks.verifyPassword).toHaveBeenCalledWith('password-hash', 'account-password');
    expect(mocks.jwtSign).toHaveBeenCalledWith(
      expect.objectContaining({ tokenType: 'sensitive_action', sub: ACTOR_ID, action: 'backup.export' }),
      'test-secret',
      expect.objectContaining({ algorithm: 'HS256', expiresIn: 300, jwtid: expect.any(String) }),
    );
    expect(mocks.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO sensitive_action_grants'));
    expect(mocks.input.mock.calls.flat()).not.toContain('account-password');
  });

  it('rejects a non-admin using the current database role', async () => {
    mocks.findProfesionalById.mockResolvedValue({ ...admin(), rol: 'soporte_tecnico' });

    await expect(authorizeSensitiveAction({ actorId: ACTOR_ID, action: 'backup.export', password: 'password', audit })).rejects.toMatchObject({ status: 403 });

    expect(mocks.verifyPassword).not.toHaveBeenCalled();
    expect(mocks.jwtSign).not.toHaveBeenCalled();
  });

  it('requires a fresh TOTP code when the account has 2FA enabled', async () => {
    mocks.findTotpSecret.mockResolvedValue('TOTPSECRET');

    await expect(authorizeSensitiveAction({ actorId: ACTOR_ID, action: 'backup.restore', password: 'password', audit })).rejects.toMatchObject({ status: 401 });

    expect(mocks.verifyTotp).not.toHaveBeenCalled();
    expect(mocks.jwtSign).not.toHaveBeenCalled();
  });

  it('consumes a stored grant atomically after rechecking the admin role', async () => {
    mocks.jwtVerify.mockReturnValue({
      tokenType: 'sensitive_action',
      sub: ACTOR_ID,
      action: 'backup.restore',
      scope: 'local_database',
      jti: GRANT_ID,
      iat: 1,
      exp: 9999999999,
      iss: 'nutriclinica-api',
      aud: 'nutriclinica-web',
    });
    mocks.query.mockResolvedValue({ recordset: [{ consumed: true }] });

    await consumeSensitiveActionGrant({ actorId: ACTOR_ID, action: 'backup.restore', grant: 'grant', audit });

    expect(mocks.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE sensitive_action_grants WITH (UPDLOCK, ROWLOCK)'));
    expect(mocks.query).toHaveBeenCalledWith(expect.stringContaining('FROM profesionales WITH (UPDLOCK, HOLDLOCK)'));
  });

  it('rejects consumption after the database role is revoked', async () => {
    mocks.jwtVerify.mockReturnValue({
      tokenType: 'sensitive_action',
      sub: ACTOR_ID,
      action: 'backup.export',
      scope: 'local_database',
      jti: GRANT_ID,
      iat: 1,
      exp: 9999999999,
      iss: 'nutriclinica-api',
      aud: 'nutriclinica-web',
    });
    mocks.findProfesionalById.mockResolvedValue({ ...admin(), rol: 'auditor' });

    await expect(consumeSensitiveActionGrant({ actorId: ACTOR_ID, action: 'backup.export', grant: 'grant', audit })).rejects.toMatchObject({ status: 403 });

    expect(mocks.query.mock.calls.some(([query]) => String(query).includes('UPDATE sensitive_action_grants'))).toBe(false);
  });

  it('rejects replayed or expired grants', async () => {
    mocks.jwtVerify.mockReturnValue({
      tokenType: 'sensitive_action',
      sub: ACTOR_ID,
      action: 'backup.export',
      scope: 'local_database',
      jti: GRANT_ID,
      iat: 1,
      exp: 9999999999,
      iss: 'nutriclinica-api',
      aud: 'nutriclinica-web',
    });
    mocks.query.mockResolvedValueOnce({ recordset: [{ consumed: false }] }).mockResolvedValueOnce({ recordset: [] });

    await expect(consumeSensitiveActionGrant({ actorId: ACTOR_ID, action: 'backup.export', grant: 'grant', audit })).rejects.toMatchObject({ status: 401 });
  });
});
