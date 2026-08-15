import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { AIToolRegistry } from './toolRegistry.js';
import type { AIToolDefinition } from './toolDefinition.js';

function fakeTool(id: string): AIToolDefinition {
  return {
    id,
    name: id,
    description: 'desc',
    readOnly: true,
    riskLevel: 'low',
    dataCategories: ['operational'],
    maxAgeMs: 1000,
    minRole: 'admin',
    schema: z.object({}).strict(),
    execute: async () => ({}),
  };
}

describe('AIToolRegistry', () => {
  it('registers, resolves and lists tools', () => {
    const registry = new AIToolRegistry();
    registry.register(fakeTool('a'));
    registry.register(fakeTool('b'));
    expect(registry.get('a')?.id).toBe('a');
    expect(registry.get('missing')).toBeUndefined();
    expect(registry.list().map((t) => t.id)).toEqual(['a', 'b']);
  });

  it('rejects non read-only tools', () => {
    const registry = new AIToolRegistry();
    expect(() => registry.register({ ...fakeTool('x'), readOnly: false as never })).toThrow(/read-only/);
  });

  it('is fail-closed: tools require an explicit AI_TOOLS_ENABLED=true', () => {
    const registry = new AIToolRegistry();
    expect(registry.isToolsEnabled({})).toBe(false);
    expect(registry.isToolsEnabled({ AI_TOOLS_ENABLED: 'false' })).toBe(false);
    expect(registry.isToolsEnabled({ AI_TOOLS_ENABLED: 'true' })).toBe(true);
  });

  it('parses the allowlist, empty means nothing is allowed', () => {
    const registry = new AIToolRegistry();
    expect(registry.allowedToolIds({}).size).toBe(0);
    expect(registry.allowedToolIds({ AI_TOOLS_ALLOWLIST: 'a, b ,c' })).toEqual(new Set(['a', 'b', 'c']));
  });
});