import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import type { Role } from '@nutriclinica/shared';
import { defineTool, uuidField, type ToolDataCategory, type ToolRiskLevel } from './toolDefinition.js';

const base = {
  name: 'Test',
  description: 'desc',
  readOnly: true as const,
  riskLevel: 'low' as ToolRiskLevel,
  dataCategories: ['operational'] as ToolDataCategory[],
  maxAgeMs: 1000,
  minRole: 'admin' as Role,
  execute: async () => ({}),
};

describe('defineTool', () => {
  it('enforces a strict parameter schema (rejects unknown keys)', async () => {
    const tool = defineTool({ ...base, id: 't1', schema: { a: z.string() } });
    const ok = tool.schema.safeParse({ a: 'x', extra: 1 });
    expect(ok.success).toBe(false);
    expect(tool.schema.safeParse({ a: 'x' }).success).toBe(true);
  });

  it('rejects tools that are not read-only', () => {
    expect(() =>
      defineTool({ ...base, id: 't2', schema: {}, readOnly: false as never }),
    ).toThrow(/read-only/);
  });

  it('exposes the schema as strict', () => {
    const tool = defineTool({ ...base, id: 't3', schema: { n: z.number() } });
    expect(tool.readOnly).toBe(true);
    expect((tool.schema as { _def?: { unknownKeys?: unknown } })._def?.unknownKeys).toBe('strict');
  });
});

describe('uuidField', () => {
  it('validates UUIDs', () => {
    const field = uuidField('msg');
    expect(field.safeParse('not-a-uuid').success).toBe(false);
    expect(field.safeParse('00000000-0000-4000-8000-000000000001').success).toBe(true);
  });
});