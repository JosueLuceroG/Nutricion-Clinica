import { describe, expect, it } from 'vitest';
import { classifyEscalation, safeLanguageCheck } from './patientGuardrails.js';

describe('classifyEscalation', () => {
  it('escalates when the query mentions urgent signs', () => {
    const decision = classifyEscalation('tengo dolor intenso en el pecho');
    expect(decision.escalate).toBe(true);
    expect(decision.matchedTerms).toContain('dolor intenso');
  });

  it('escalates on medications, symptoms and emergencies', () => {
    expect(classifyEscalation('puedo comer esto si tomo insulina?').escalate).toBe(true);
    expect(classifyEscalation('ayer tuve un desmayo').escalate).toBe(true);
    expect(classifyEscalation('es una urgencia').escalate).toBe(true);
    expect(classifyEscalation('vomite esta mañana').escalate).toBe(true);
  });

  it('is case insensitive and matches partial terms', () => {
    const decision = classifyEscalation('Sangrado leve al cepillarme');
    expect(decision.escalate).toBe(true);
    expect(decision.matchedTerms).toContain('sangrado');
  });

  it('does not escalate benign educational questions', () => {
    const decision = classifyEscalation('cuantas frutas debo comer al dia?');
    expect(decision.escalate).toBe(false);
    expect(decision.matchedTerms).toEqual([]);
  });
});

describe('safeLanguageCheck', () => {
  it('flags diagnostic and prescriptive language', () => {
    const report = safeLanguageCheck('Usted tiene diabetes, suspenda el azucar.');
    expect(report.unsafe).toBe(true);
    expect(report.flags).toContain('usted tiene');
    expect(report.flags).toContain('suspenda');
  });

  it('flags alarmist wording', () => {
    expect(safeLanguageCheck('esto puede ser mortal').unsafe).toBe(true);
    expect(safeLanguageCheck('no te preocupes, es solo una duda').unsafe).toBe(false);
  });

  it('accepts educational and safe language', () => {
    const report = safeLanguageCheck('Se recomienda incluir una porcion de fruta en el desayuno.');
    expect(report.unsafe).toBe(false);
    expect(report.flags).toEqual([]);
  });
});