import { describe, expect, it } from 'vitest';
import { ERP_TOOLS } from './erpToolExecutors.js';

describe('ERP tools', () => {
  it('registers six read-only tools with unique ids', () => {
    const ids = ERP_TOOLS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(
      expect.arrayContaining(['patient_profile', 'recent_consultations', 'lab_results', 'meal_plan', 'adherence_summary', 'billing_history']),
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

  it('validates pacienteId as a UUID in every schema', () => {
    for (const tool of ERP_TOOLS) {
      const parsed = tool.schema.safeParse({ pacienteId: 'not-a-uuid' });
      expect(parsed.success).toBe(false);
      expect(tool.schema.safeParse({ pacienteId: '00000000-0000-4000-8000-000000000001' }).success).toBe(true);
    }
  });
});