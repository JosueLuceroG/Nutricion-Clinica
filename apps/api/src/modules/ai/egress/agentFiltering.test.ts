import { describe, expect, it } from 'vitest';
import { egressCapabilityForAgent, filterToolResultByCapability } from './capabilityContracts.js';

describe('filterToolResultByCapability (agentes)', () => {
  const patientProfile = {
    nombre: 'Ana',
    apellido_paterno: 'López',
    email: 'ana@test.com',
    telefono: '5512345678',
    genero: 'femenino',
    fecha_nacimiento: '1990-01-01',
    estado_expediente: 'activo',
  };

  it('patient_profile deja solo genero/fecha/estado para nutrition_reasoning', () => {
    const { filtered, removed } = filterToolResultByCapability('patient_profile', patientProfile, 'nutrition_reasoning');
    expect(filtered).toEqual({ genero: 'femenino', fecha_nacimiento: '1990-01-01', estado_expediente: 'activo' });
    expect(removed).toEqual(
      expect.arrayContaining(['patient_profile.nombre', 'patient_profile.email', 'patient_profile.telefono']),
    );
  });

  it('billing_history (sin shape) se descarta por completo', () => {
    const { filtered, removed } = filterToolResultByCapability('billing_history', { monto: 500, folio: 'F-1' }, 'nutrition_reasoning');
    expect(filtered).toEqual({});
    expect(removed).toEqual(expect.arrayContaining(['billing_history.*']));
  });

  it('capability desconocida descarta por completo (fail-closed)', () => {
    const { filtered, removed } = filterToolResultByCapability('patient_profile', patientProfile, 'capability_inexistente');
    expect(filtered).toEqual({});
    expect(removed).toEqual(['patient_profile.*']);
  });

  it('adherence_summary conserva solo el registro de adherencia', () => {
    const { filtered } = filterToolResultByCapability('adherence_summary', { record_date: '2026-08-01', adherence_menu: 80, secreto: 1 }, 'nutrition_reasoning');
    expect(filtered).toEqual({ record_date: '2026-08-01', adherence_menu: 80 });
  });

  it('lab_results conserva solo lab_name/taken_at/results_json', () => {
    const { filtered } = filterToolResultByCapability('lab_results', { lab_name: 'Glucosa', taken_at: '2026-08-01', results_json: '{"v":90}', costo: 150 }, 'nutrition_reasoning');
    expect(filtered).toEqual({ lab_name: 'Glucosa', taken_at: '2026-08-01', results_json: '{"v":90}' });
  });

  it('recent_consultations vacía cada fila pero preserva la longitud', () => {
    const { filtered } = filterToolResultByCapability('recent_consultations', [{ motivo: 'x', detalle: 'y' }, { motivo: 'a' }], 'nutrition_reasoning');
    expect(filtered).toEqual([{}, {}]);
  });
});

describe('egressCapabilityForAgent', () => {
  it('mapea agentes conocidos y cae a generic_assistant', () => {
    expect(egressCapabilityForAgent('nutrition_support_agent')).toBe('nutrition_reasoning');
    expect(egressCapabilityForAgent('patient_overview_agent')).toBe('patient_overview');
    expect(egressCapabilityForAgent('otro_agente')).toBe('generic_assistant');
  });
});