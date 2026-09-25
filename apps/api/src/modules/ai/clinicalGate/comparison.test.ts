import { describe, expect, it } from 'vitest';
import { classifyComparison, COMPARISON_VERDICTS } from './comparison.js';

describe('classifyComparison', () => {
  it('classifies a professional critical disagreement on a served run as critical', () => {
    const result = classifyComparison({ verdict: 'critical_disagreement', served: true });
    expect(result.isCritical).toBe(true);
    expect(result.reason).toContain('Desacuerdo critico');
  });

  it('does not count disagreements on runs that were not served', () => {
    const result = classifyComparison({ verdict: 'critical_disagreement', served: false });
    expect(result.isCritical).toBe(false);
    expect(result.reason).toContain('no fue servido');
  });

  it('treats aligned and minor divergence as non-critical', () => {
    expect(classifyComparison({ verdict: 'aligned', served: true }).isCritical).toBe(false);
    expect(classifyComparison({ verdict: 'minor_divergence', served: true }).isCritical).toBe(false);
  });

  it('exposes all verdicts for the zod enum', () => {
    expect(COMPARISON_VERDICTS).toEqual(['aligned', 'minor_divergence', 'critical_disagreement']);
  });
});