import { describe, expect, it } from 'vitest';
import { pseudonymizePatientRef } from './pseudonymizer.js';

describe('pseudonymizePatientRef', () => {
  it('genera un pseudo-referencia determinista por ejecucion', () => {
    const a = pseudonymizePatientRef('p-1', 'exec-1');
    const b = pseudonymizePatientRef('p-1', 'exec-1');
    expect(a).toBe(b);
    expect(a).toMatch(/^PATIENT_REF_[0-9a-f]{8}$/);
  });

  it('no permite correlacionar entre ejecuciones', () => {
    const a = pseudonymizePatientRef('p-1', 'exec-1');
    const b = pseudonymizePatientRef('p-1', 'exec-2');
    expect(a).not.toBe(b);
  });

  it('no permite correlacionar entre pacientes en la misma ejecucion', () => {
    const a = pseudonymizePatientRef('p-1', 'exec-1');
    const b = pseudonymizePatientRef('p-2', 'exec-1');
    expect(a).not.toBe(b);
  });

  it('nunca expone el id real del paciente', () => {
    const ref = pseudonymizePatientRef('paciente-abc-123', 'exec-1');
    expect(ref).not.toContain('paciente-abc-123');
  });
});