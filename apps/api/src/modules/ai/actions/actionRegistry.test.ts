import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ActionRegistry, isClinicalCriticalActionId } from './actionRegistry.js';
import type { ActionRiskLevel, ConfirmableActionDefinition } from './actionTypes.js';

function definition(overrides: Partial<ConfirmableActionDefinition> = {}): ConfirmableActionDefinition {
  return {
    id: 'create_memory_note',
    name: 'Nota de memoria',
    description: 'desc',
    riskLevel: 'low',
    requiredRole: 'nutriologa',
    requiredConsents: ['ai_memory'],
    inputSchema: z.object({ content: z.string() }),
    preview: async () => ({ summary: 'preview', details: {} }),
    execute: async () => ({}),
    compensate: async () => ({}),
    ...overrides,
  };
}

describe('ActionRegistry', () => {
  it('registers, lists and looks up actions', () => {
    const registry = new ActionRegistry();
    registry.register(definition());
    expect(registry.get('create_memory_note')?.id).toBe('create_memory_note');
    expect(registry.list()).toHaveLength(1);
    expect(registry.get('missing')).toBeUndefined();
  });

  it('rejects duplicate registrations', () => {
    const registry = new ActionRegistry();
    registry.register(definition());
    expect(() => registry.register(definition())).toThrow(/ya registrada/);
  });

  it('rejects high risk actions (fail-closed)', () => {
    const registry = new ActionRegistry();
    expect(() => registry.register(definition({ riskLevel: 'high' as unknown as ActionRiskLevel }))).toThrow(/riesgo alto/);
  });

  it('rejects clinical critical action ids', () => {
    const registry = new ActionRegistry();
    expect(() => registry.register(definition({ id: 'modify_plan_portions' }))).toThrow(/clinicas criticas/);
    expect(() => registry.register(definition({ id: 'prescribe_menu' }))).toThrow(/clinicas criticas/);
    expect(() => registry.register(definition({ id: 'diagnose_deficit' }))).toThrow(/clinicas criticas/);
  });

  it('classifies clinical critical prefixes', () => {
    expect(isClinicalCriticalActionId('modify_lab_results')).toBe(true);
    expect(isClinicalCriticalActionId('cancel_consulta_next')).toBe(true);
    expect(isClinicalCriticalActionId('share_educational_resource')).toBe(false);
    expect(isClinicalCriticalActionId('create_memory_note')).toBe(false);
  });
});