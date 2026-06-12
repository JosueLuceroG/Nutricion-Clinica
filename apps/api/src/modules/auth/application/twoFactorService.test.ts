import { beforeEach, describe, expect, it } from 'vitest';
import { protectTotpSecretForStorage, revealTotpSecretFromStorage } from './twoFactorService.js';

describe('twoFactorService secret storage', () => {
  beforeEach(() => {
    process.env.TOTP_ENCRYPTION_KEY = 'test-totp-master-key';
    delete process.env.FIELD_ENCRYPTION_KEY;
  });

  it('encrypts TOTP secrets before storage', () => {
    const stored = protectTotpSecretForStorage('JBSWY3DPEHPK3PXP');

    expect(stored).toMatch(/^enc:v1:/);
    expect(stored).not.toContain('JBSWY3DPEHPK3PXP');
  });

  it('decrypts encrypted TOTP secrets from storage', () => {
    const stored = protectTotpSecretForStorage('JBSWY3DPEHPK3PXP');

    expect(revealTotpSecretFromStorage(stored)).toBe('JBSWY3DPEHPK3PXP');
  });

  it('keeps legacy plaintext TOTP secrets readable', () => {
    expect(revealTotpSecretFromStorage('LEGACYSECRET')).toBe('LEGACYSECRET');
  });
});
