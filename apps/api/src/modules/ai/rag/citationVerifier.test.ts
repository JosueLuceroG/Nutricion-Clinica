import { describe, expect, it } from 'vitest';
import { extractCitations, verifyCitations } from './citationVerifier.js';

const DOC_A = '00000000-0000-4000-8000-000000000101';
const DOC_B = '00000000-0000-4000-8000-000000000102';
const DOC_C = '00000000-0000-4000-8000-000000000999';

describe('extractCitations', () => {
  it('extracts bracketed uuids from content', () => {
    const content = `La recomendacion es de 30 ml/kg [${DOC_A}] y de proteina [${DOC_B}].`;
    expect(extractCitations(content)).toEqual([DOC_A, DOC_B]);
  });

  it('returns an empty list without citations', () => {
    expect(extractCitations('Sin citas aqui')).toEqual([]);
  });
});

describe('verifyCitations', () => {
  it('passes when every citation is backed by the retrieved set', () => {
    const result = verifyCitations({ content: `30 ml/kg [${DOC_A}] y proteina [${DOC_B}]`, retrievedDocIds: [DOC_A, DOC_B] });
    expect(result.ok).toBe(true);
    expect(result.verified).toEqual([DOC_A, DOC_B]);
    expect(result.missing).toEqual([]);
  });

  it('fails when a citation references a doc not in the retrieved set', () => {
    const result = verifyCitations({ content: `30 ml/kg [${DOC_A}] y [${DOC_C}]`, retrievedDocIds: [DOC_A] });
    expect(result.ok).toBe(false);
    expect(result.missing).toEqual([DOC_C]);
    expect(result.verified).toEqual([DOC_A]);
  });

  it('passes with no citations at all', () => {
    const result = verifyCitations({ content: 'consejo general', retrievedDocIds: [DOC_A] });
    expect(result.ok).toBe(true);
    expect(result.cited).toEqual([]);
  });

  it('is case-insensitive for cited uuids', () => {
    const result = verifyCitations({ content: `[${DOC_A.toUpperCase()}]`, retrievedDocIds: [DOC_A] });
    expect(result.ok).toBe(true);
  });
});