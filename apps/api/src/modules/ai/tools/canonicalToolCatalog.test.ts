import { describe, expect, it } from 'vitest';
import { CANONICAL_TOOL_CATALOG, availableCanonicalTools, blockedCanonicalTools, canonicalToolImplementation } from './canonicalToolCatalog.js';
import { ERP_TOOLS } from './erpToolExecutors.js';

describe('Canonical tool catalog (paridad ERP 20 herramientas)', () => {
  it('define exactamente las 20 herramientas canonicas', () => {
    expect(CANONICAL_TOOL_CATALOG.length).toBe(20);
    const ids = CANONICAL_TOOL_CATALOG.map((e) => e.canonicalId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(expect.arrayContaining([
      'search_patient', 'get_patient_profile', 'get_patient_history', 'get_consultations', 'get_evolution',
      'get_nutrition_plan', 'get_diet', 'get_goals', 'get_anthropometry', 'get_body_composition',
      'get_vital_signs', 'get_lab_results', 'get_medications', 'get_allergies', 'get_diagnoses',
      'get_clinical_notes', 'get_documents', 'get_appointments', 'get_alerts', 'get_patient_metrics',
    ]));
  });

  it('toda implementacion declarada existe en el registro de ejecutores', () => {
    const registered = new Set(ERP_TOOLS.map((t) => t.id));
    for (const entry of CANONICAL_TOOL_CATALOG) {
      if (entry.implementationId) {
        expect(registered.has(entry.implementationId), `${entry.canonicalId} -> ${entry.implementationId}`).toBe(true);
      }
    }
  });

  it('reporta las herramientas bloqueadas por falta de fuente autoritativa (sin inventar)', () => {
    const blocked = blockedCanonicalTools();
    expect(blocked.map((b) => b.canonicalId)).toEqual(expect.arrayContaining(['get_goals', 'get_alerts']));
    for (const entry of blocked) {
      expect(entry.implementationId).toBeNull();
      expect(entry.sourceOfTruth).toMatch(/NO DISPONIBLE/);
      expect(entry.notes).toMatch(/BLOCKED/);
    }
  });

  it('toda herramienta disponible tiene implementacion registrada y read-only', () => {
    for (const entry of availableCanonicalTools()) {
      const implementation = canonicalToolImplementation(entry.canonicalId);
      expect(implementation).not.toBeNull();
      expect(implementation!.readOnly).toBe(true);
      expect(implementation!.requiredConsent).toBe('ai_opt_in');
    }
  });

  it('cuenta la disponibilidad de forma honesta: disponibles + bloqueadas = 20', () => {
    const available = availableCanonicalTools().length;
    const blocked = blockedCanonicalTools().length;
    expect(available + blocked).toBe(20);
    expect(available).toBe(18);
    expect(blocked).toBe(2);
  });
});