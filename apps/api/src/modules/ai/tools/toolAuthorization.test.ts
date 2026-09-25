import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { authorizeTool, roleSatisfies } from './toolAuthorization.js';
import type { AIToolDefinition } from './toolDefinition.js';

function tool(overrides: Partial<AIToolDefinition> = {}): AIToolDefinition {
  return {
    id: 't',
    name: 't',
    description: 'desc',
    readOnly: true,
    riskLevel: 'high',
    dataCategories: ['clinical'],
    requiredConsent: 'ai_opt_in',
    maxAgeMs: 1000,
    minRole: 'nutriologa',
    schema: z.object({}).strict(),
    execute: async () => ({}),
    ...overrides,
  };
}

describe('roleSatisfies', () => {
  it('ranks roles from lowest to highest privilege', () => {
    expect(roleSatisfies('admin', 'nutriologa')).toBe(true);
    expect(roleSatisfies('nutriologa', 'nutriologa')).toBe(true);
    expect(roleSatisfies('asistente', 'nutriologa')).toBe(false);
    expect(roleSatisfies('facturacion', 'facturacion')).toBe(true);
  });
});

describe('authorizeTool', () => {
  const actor = { role: 'nutriologa' as const, sucursalId: 's1' };

  it('denies when the role is below the minimum', async () => {
    const result = await authorizeTool(tool({ minRole: 'admin' }), actor);
    expect(result).toEqual({ allowed: false, status: 403, reason: 'Rol sin permiso para esta herramienta' });
  });

  it('denies with 400 when a consent is required but no consent check is provided', async () => {
    const result = await authorizeTool(tool(), actor);
    expect(result).toMatchObject({ allowed: false, status: 400 });
  });

  it('denies with 403 when the consent is not accepted', async () => {
    const checker = vi.fn(async () => false);
    const result = await authorizeTool(tool(), actor, { pacienteId: 'p1', checker });
    expect(result).toMatchObject({ allowed: false, status: 403, reason: "Consentimiento 'ai_opt_in' no otorgado" });
    expect(checker).toHaveBeenCalledWith('p1', 's1', 'ai_opt_in');
  });

  it('allows when the consent is accepted', async () => {
    const result = await authorizeTool(tool(), actor, { pacienteId: 'p1', checker: async () => true });
    expect(result).toEqual({ allowed: true });
  });

  it('allows without patient consent when the tool requires none', async () => {
    const result = await authorizeTool(tool({ requiredConsent: undefined }), actor);
    expect(result).toEqual({ allowed: true });
  });
});