import { describe, expect, it } from 'vitest';
import { ERP_TOOLS } from './erpToolExecutors.js';

describe('ERP tools', () => {
  it('registers read-only tools with unique ids (7 originales + nuevas canonicas)', () => {
    const ids = ERP_TOOLS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(
      expect.arrayContaining(['patient_profile', 'recent_consultations', 'lab_results', 'meal_plan', 'adherence_summary', 'billing_history', 'anthropometry_tool']),
    );
    expect(ids).toEqual(
      expect.arrayContaining(['search_patient', 'get_patient_history', 'get_diet', 'get_body_composition', 'get_vital_signs', 'get_medications', 'get_allergies', 'get_intolerances', 'get_diagnoses', 'get_clinical_notes', 'get_documents', 'get_appointments', 'get_patient_metrics', 'get_evolution']),
    );
    for (const tool of ERP_TOOLS) {
      expect(tool.readOnly).toBe(true);
    }
  });

  it('carries risk metadata and data categories on every tool', () => {
    for (const tool of ERP_TOOLS) {
      expect(['low', 'medium', 'high']).toContain(tool.riskLevel);
      expect(tool.dataCategories.length).toBeGreaterThan(0);
      expect(tool.maxAgeMs).toBeGreaterThan(0);
      expect(tool.requiredConsent).toBe('ai_opt_in');
      expect(tool.toolVersion).toMatch(/^\d+\.\d+\.\d+$/);
    }
  });

  it('requires at least a nutriologa role for clinical tools and facturacion for billing', () => {
    const billing = ERP_TOOLS.find((t) => t.id === 'billing_history')!;
    expect(billing.minRole).toBe('facturacion');
    expect(billing.dataCategories).toContain('financial');
    for (const tool of ERP_TOOLS.filter((t) => t.id !== 'billing_history')) {
      expect(tool.minRole).toBe('nutriologa');
    }
  });

  it('validates pacienteId as a UUID in every patient-scoped schema', () => {
    for (const tool of ERP_TOOLS.filter((t) => t.id !== 'search_patient')) {
      const parsed = tool.schema.safeParse({ pacienteId: 'not-a-uuid' });
      expect(parsed.success).toBe(false);
      expect(tool.schema.safeParse({ pacienteId: '00000000-0000-4000-8000-000000000001' }).success).toBe(true);
    }
  });

  it('search_patient es tenant-scoped: schema propio y patientScoped=false', () => {
    const search = ERP_TOOLS.find((t) => t.id === 'search_patient')!;
    expect(search.patientScoped).toBe(false);
    expect(search.schema.safeParse({ query: 'ro' }).success).toBe(true);
    expect(search.schema.safeParse({ query: 'r' }).success).toBe(false);
    expect(search.schema.safeParse({ query: 'ro', pacienteId: '00000000-0000-4000-8000-000000000001' }).success).toBe(false);
  });

  it('expone los toolVersion y patientScoped por defecto en las herramientas', () => {
    for (const tool of ERP_TOOLS) {
      expect(typeof tool.toolVersion).toBe('string');
      expect(typeof tool.patientScoped).toBe('boolean');
    }
  });
});