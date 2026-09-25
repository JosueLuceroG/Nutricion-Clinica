import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type { AIToolDefinition } from './toolDefinition.js';
import { AIToolRegistry } from './toolRegistry.js';
import { ToolExecutionService } from './toolExecutionService.js';

function fakeTool(): AIToolDefinition {
  return {
    id: 'fake_lookup',
    name: 'fake',
    description: 'desc',
    readOnly: true,
    riskLevel: 'medium',
    dataCategories: ['clinical'],
    requiredConsent: 'ai_opt_in',
    maxAgeMs: 60_000,
    minRole: 'nutriologa',
    schema: z.object({ q: z.string().min(1), extra: z.string().optional() }).strict(),
    execute: vi.fn(async () => ({ rows: [{ id: 1 }] })),
  };
}

const ENABLED_ENV = { AI_TOOLS_ENABLED: 'true', AI_TOOLS_ALLOWLIST: 'fake_lookup' } as NodeJS.ProcessEnv;
const ACTOR = { profesionalId: '00000000-0000-4000-8000-000000000001', role: 'nutriologa' as const };
const SUCURSAL = '00000000-0000-4000-8000-000000000002';

function makeService(env: NodeJS.ProcessEnv = ENABLED_ENV) {
  const tool = fakeTool();
  const registry = new AIToolRegistry();
  registry.register(tool);
  return { service: new ToolExecutionService(registry, { env }), tool };
}

const REQ = {
  toolId: 'fake_lookup',
  args: { q: 'hi' },
  actor: ACTOR,
  sucursalId: SUCURSAL,
  pacienteId: '00000000-0000-4000-8000-000000000003',
};

describe('ToolExecutionService', () => {
  it('is fail-closed: 503 when tools are disabled', async () => {
    const { service } = makeService({} as NodeJS.ProcessEnv);
    const result = await service.invoke(REQ);
    expect(result).toEqual({ ok: false, status: 503, error: 'Herramientas IA deshabilitadas' });
  });

  it('returns 404 for unknown tools', async () => {
    const { service } = makeService();
    const result = await service.invoke({ ...REQ, toolId: 'nope' });
    expect(result).toMatchObject({ ok: false, status: 404 });
  });

  it('returns 403 when the tool is not allowlisted', async () => {
    const { service } = makeService({ AI_TOOLS_ENABLED: 'true' } as NodeJS.ProcessEnv);
    const result = await service.invoke(REQ);
    expect(result).toMatchObject({ ok: false, status: 403, error: 'Herramienta no permitida' });
  });

  it('rejects invalid arguments with 400 and strict details', async () => {
    const { service } = makeService();
    const result = await service.invoke({ ...REQ, args: { q: 'hi', unknownKey: 1 } });
    expect(result).toMatchObject({ ok: false, status: 400, error: 'Argumentos invalidos' });
    if (result.ok === false && result.status === 400 && 'details' in result) {
      expect(result.details).toBeDefined();
    }
  });

  it('denies with 403 when the role is insufficient', async () => {
    const { service } = makeService();
    const audit = vi.fn();
    const result = await service.invoke({ ...REQ, actor: { ...ACTOR, role: 'asistente' } }, { audit });
    expect(result).toMatchObject({ ok: false, status: 403 });
    expect((result as { ok: false; error: string }).error).toBe('Rol sin permiso para esta herramienta');
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ ok: false, status: 403 }));
  });

  it('denies with 403 when patient consent is not accepted', async () => {
    const { service } = makeService();
    const result = await service.invoke(REQ, { consent: { pacienteId: REQ.pacienteId!, checker: async () => false } });
    expect(result).toMatchObject({ ok: false, status: 403, error: "Consentimiento 'ai_opt_in' no otorgado" });
  });

  it('returns a rich envelope on success (provenance, freshness, risk, audit)', async () => {
    const { service, tool } = makeService();
    const audit = vi.fn();
    const result = await service.invoke(REQ, {
      consent: { pacienteId: REQ.pacienteId!, checker: async () => true },
      audit,
      now: new Date('2026-08-14T00:00:00.000Z'),
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({ rows: [{ id: 1 }] });
      expect(result.provenance).toEqual({ source: 'erp', query: 'fake_lookup', retrievedAt: '2026-08-14T00:00:00.000Z' });
      expect(result.freshness).toEqual({ maxAgeMs: 60_000, ageMs: 0, isFresh: true });
      expect(result.riskLevel).toBe('medium');
      expect(result.dataCategories).toEqual(['clinical']);
    }
    expect(tool.execute).toHaveBeenCalledWith(expect.objectContaining({ args: { q: 'hi' } }));
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ toolId: 'fake_lookup', ok: true, status: 200 }));
  });

  it('returns 502 and audits when the executor throws', async () => {
    const { service, tool } = makeService();
    (tool.execute as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('db exploded'));
    const audit = vi.fn();
    const result = await service.invoke(REQ, { consent: { pacienteId: REQ.pacienteId!, checker: async () => true }, audit });
    expect(result).toMatchObject({ ok: false, status: 502, error: 'Fallo la ejecucion de la herramienta' });
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ ok: false, status: 502, reason: 'db exploded' }));
  });
});