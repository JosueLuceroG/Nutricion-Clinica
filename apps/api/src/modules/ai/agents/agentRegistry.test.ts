import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import '../tools/toolRoutes.js';
import { AIToolRegistry } from '../tools/toolRegistry.js';
import { defineTool } from '../tools/toolDefinition.js';
import { AgentRegistry, createDefaultAgentRegistry } from './agentRegistry.js';
import type { BoundedAgentDefinition } from './agentTypes.js';

function fakeToolRegistry(): AIToolRegistry {
  const registry = new AIToolRegistry();
  registry.register(
    defineTool({
      id: 'patient_profile',
      name: 'Perfil del paciente',
      description: 'Lee el perfil del paciente',
      readOnly: true,
      riskLevel: 'high',
      dataCategories: ['pii'],
      requiredConsent: 'ai_opt_in',
      minRole: 'nutriologa',
      maxAgeMs: 900000,
      schema: { pacienteId: z.string().uuid() },
      execute: async () => ({ nombre: 'Ana' }),
    }),
  );
  return registry;
}

function agent(overrides: Partial<BoundedAgentDefinition> = {}): BoundedAgentDefinition {
  return {
    id: 'nutrition_support_agent',
    name: 'Agente de soporte',
    description: 'desc',
    riskLevel: 'medium',
    requiredRole: 'nutriologa',
    requiredConsents: ['ai_opt_in'],
    requiresPaciente: true,
    allowedToolIds: ['patient_profile'],
    capability: 'nutrition_reasoning',
    systemPrompt: 'prompt',
    budget: { maxSteps: 4, maxToolCalls: 3, maxTokens: 2048, maxCost: 0.5, timeoutMs: 45000 },
    confirmationPolicy: 'none',
    inputSchema: z.object({ task: z.string() }),
    ...overrides,
  };
}

describe('agent registry', () => {
  it('registers, lists and looks up agents', () => {
    const registry = new AgentRegistry(fakeToolRegistry());
    registry.register(agent());
    expect(registry.list()).toHaveLength(1);
    expect(registry.get('nutrition_support_agent')?.name).toBe('Agente de soporte');
    expect(registry.get('unknown')).toBeUndefined();
  });

  it('rejects duplicate ids', () => {
    const registry = new AgentRegistry(fakeToolRegistry());
    registry.register(agent());
    expect(() => registry.register(agent())).toThrow(/ya registrado/);
  });

  it('rejects high risk agents (fail-closed)', () => {
    const registry = new AgentRegistry(fakeToolRegistry());
    expect(() => registry.register(agent({ riskLevel: 'high' as 'medium' }))).toThrow(/riesgo alto/);
  });

  it('rejects unknown tool ids', () => {
    const registry = new AgentRegistry(fakeToolRegistry());
    expect(() => registry.register(agent({ allowedToolIds: ['not_a_tool'] }))).toThrow(/desconocida/);
  });

  it('rejects clinical critical agent ids (fail-closed)', () => {
    const registry = new AgentRegistry(fakeToolRegistry());
    expect(() => registry.register(agent({ id: 'prescribe_medication' }))).toThrow(/criticos no se automatizan/);
  });

  it('seeds the default registry with agents using registered ERP tools', () => {
    const registry = createDefaultAgentRegistry();
    const ids = registry.list().map((a) => a.id);
    expect(ids).toContain('nutrition_support_agent');
    expect(ids).toContain('patient_overview_agent');
    expect(registry.get('patient_overview_agent')?.confirmationPolicy).toBe('step_confirm');
  });
});