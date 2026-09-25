import { describe, expect, it } from 'vitest';
import { NUTRICLINICA_LOCAL_AUTO_CONTRACT, applyRoutingContract, resolveRoutingAvailability, ROUTING_INVARIANTS } from './nutriclinicaLocalAutoContract.js';

describe('NUTRICLINICA_LOCAL_AUTO (Build 07 preparado)', () => {
  it('declara el contrato con candidatos locales informativos', () => {
    expect(NUTRICLINICA_LOCAL_AUTO_CONTRACT.version).toBe('routing-contract.v1');
    expect(NUTRICLINICA_LOCAL_AUTO_CONTRACT.mode).toBe('NUTRICLINICA_LOCAL_AUTO');
    expect(NUTRICLINICA_LOCAL_AUTO_CONTRACT.localCandidates).toContain('llama3.2');
  });

  it('el hint de modelo JAMAS desbloquea capacidades', () => {
    const applied = applyRoutingContract({ mode: 'NUTRICLINICA_LOCAL_AUTO', preferredModelHint: 'llama3.2' });
    expect(applied.unlocksCapabilities).toBe(false);
    expect(applied.preferredModelHint).toBe('llama3.2');
  });

  it('invariantes: la certificación manda, la preferencia nunca', () => {
    expect(ROUTING_INVARIANTS.join(' ')).toContain('nunca');
    expect(ROUTING_INVARIANTS.join(' ')).toContain('certificación');
  });

  it('disponibilidad fail-closed: sin modelos locales certificados cae a FALLBACK/NO_AVAILABLE', () => {
    expect(resolveRoutingAvailability({ mode: 'NUTRICLINICA_LOCAL_AUTO', certifiedLocalModelCount: 0, apiCredentialAvailable: true })).toBe('FALLBACK');
    expect(resolveRoutingAvailability({ mode: 'NUTRICLINICA_LOCAL_AUTO', certifiedLocalModelCount: 0, apiCredentialAvailable: false })).toBe('NO_AVAILABLE');
    expect(resolveRoutingAvailability({ mode: 'NUTRICLINICA_LOCAL_AUTO', certifiedLocalModelCount: 1, apiCredentialAvailable: false })).toBe('AVAILABLE');
  });
});