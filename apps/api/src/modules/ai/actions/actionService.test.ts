import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type { Role } from '@nutriclinica/shared';
import { InMemoryActionLedger } from './actionLedger.js';
import { ActionRegistry } from './actionRegistry.js';
import { ConfirmableActionsService } from './actionService.js';
import type { ConfirmableActionsConfig } from './config.js';
import type { ConfirmableActionDefinition } from './actionTypes.js';

const NOW = new Date('2026-08-14T12:00:00.000Z');

function config(overrides: Partial<ConfirmableActionsConfig> = {}): ConfirmableActionsConfig {
  return { enabled: true, store: 'memory', confirmationTtlMin: 10, maxPendingConfirmations: 2, ...overrides };
}

function actor(overrides: { profesionalId?: string; role?: Role } = {}) {
  return { profesionalId: 'prof-1', role: 'nutriologa' as Role, ...overrides };
}

function build(overrides: {
  definition?: Partial<ConfirmableActionDefinition>;
  consents?: Record<string, boolean>;
  config?: ConfirmableActionsConfig;
  now?: () => Date;
} = {}) {
  const now = overrides.now ?? (() => NOW);
  const ledger = new InMemoryActionLedger({ now });
  const registry = new ActionRegistry();
  const execute = vi.fn(async (): Promise<Record<string, unknown>> => ({ done: true }));
  const compensate = vi.fn(async (): Promise<Record<string, unknown>> => ({ deleted: true }));
  registry.register({
    id: 'create_memory_note',
    name: 'Nota de memoria',
    description: 'desc',
    riskLevel: 'low',
    requiredRole: 'nutriologa',
    requiredConsents: ['ai_memory'],
    inputSchema: z.object({ content: z.string() }),
    preview: async (input) => ({ summary: `Guardar: ${input.content}`, details: { content: input.content } }),
    execute,
    compensate,
    ...overrides.definition,
  });
  const consentChecker = vi.fn(async (_pacienteId: string, _sucursalId: string, tipo: string) => (overrides.consents?.[tipo] ?? true));
  const service = new ConfirmableActionsService({
    registry,
    ledger,
    consentChecker,
    config: () => overrides.config ?? config(),
    now,
  });
  return { service, ledger, registry, execute, compensate, consentChecker };
}

function preview(service: ConfirmableActionsService, input: Record<string, unknown> = { content: 'nota' }, extra: Record<string, unknown> = {}) {
  return service.preview({ actionId: 'create_memory_note', pacienteId: 'pac-1', input, ...extra }, actor(), 'suc-1');
}

describe('ConfirmableActionsService.preview', () => {
  it('fails closed when disabled', async () => {
    const { service } = build({ config: config({ enabled: false }) });
    const result = await preview(service);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(503);
  });

  it('rejects unknown actions with 404', async () => {
    const { service } = build();
    const result = await service.preview({ actionId: 'nope', input: {} }, actor(), 'suc-1');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(404);
  });

  it('rejects insufficient roles with 403', async () => {
    const { service } = build();
    const result = await service.preview({ actionId: 'create_memory_note', pacienteId: 'pac-1', input: { content: 'nota' } }, { profesionalId: 'prof-2', role: 'facturacion' }, 'suc-1');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(403);
  });

  it('requires a patient when consents are declared', async () => {
    const { service } = build();
    const result = await service.preview({ actionId: 'create_memory_note', input: { content: 'nota' } }, actor(), 'suc-1');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(400);
  });

  it('requires accepted consents', async () => {
    const { service } = build({ consents: { ai_memory: false } });
    const result = await preview(service);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(403);
      expect(result.error).toContain('ai_memory');
    }
  });

  it('rejects invalid input with 400', async () => {
    const { service } = build();
    const result = await preview(service, { content: 42 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(400);
  });

  it('limits pending confirmations per actor with 429', async () => {
    const { service } = build({ config: config({ maxPendingConfirmations: 1 }) });
    expect((await preview(service)).ok).toBe(true);
    const second = await preview(service);
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.status).toBe(429);
  });

  it('returns a confirmation id with preview and expiry', async () => {
    const { service, ledger } = build();
    const result = await preview(service, { content: 'tomar mas agua' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.actionId).toBe('create_memory_note');
    expect(result.value.preview.summary).toContain('tomar mas agua');
    expect(result.value.expiresAt).toBe('2026-08-14T12:10:00.000Z');
    const stored = await ledger.getConfirmation(result.value.confirmationId);
    expect(stored?.previewSummary).toContain('tomar mas agua');
    expect(stored?.idempotencyKey).toBeNull();
  });
});

describe('ConfirmableActionsService.confirm', () => {
  it('rejects unknown confirmations with 404', async () => {
    const { service } = build();
    const result = await service.confirm({ actionId: 'create_memory_note', confirmationId: 'missing', input: { content: 'nota' } }, actor(), 'suc-1');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(404);
  });

  it('rejects confirmations owned by another professional or sucursal', async () => {
    const { service } = build();
    const previewResult = await preview(service);
    if (!previewResult.ok) throw new Error('preview failed');

    const otherActor = await service.confirm(
      { actionId: 'create_memory_note', confirmationId: previewResult.value.confirmationId, input: { content: 'nota' } },
      { profesionalId: 'prof-2', role: 'nutriologa' },
      'suc-1',
    );
    expect(otherActor.ok).toBe(false);
    if (!otherActor.ok) expect(otherActor.status).toBe(403);

    const otherSucursal = await service.confirm(
      { actionId: 'create_memory_note', confirmationId: previewResult.value.confirmationId, input: { content: 'nota' } },
      actor(),
      'suc-2',
    );
    expect(otherSucursal.ok).toBe(false);
    if (!otherSucursal.ok) expect(otherSucursal.status).toBe(403);
  });

  it('rejects expired confirmations with 410', async () => {
    const { service, ledger, registry, consentChecker } = build({ config: config({ confirmationTtlMin: 0 }) });
    const previewResult = await preview(service);
    if (!previewResult.ok) throw new Error('preview failed');
    const lateService = new ConfirmableActionsService({
      registry,
      ledger,
      consentChecker,
      config: () => config(),
      now: () => new Date(NOW.getTime() + 60 * 1000),
    });
    const result = await lateService.confirm(
      { actionId: 'create_memory_note', confirmationId: previewResult.value.confirmationId, input: { content: 'nota' } },
      actor(),
      'suc-1',
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(410);
  });

  it('rejects reused confirmations with 409', async () => {
    const { service, execute } = build();
    const previewResult = await preview(service);
    if (!previewResult.ok) throw new Error('preview failed');
    const first = await service.confirm({ actionId: 'create_memory_note', confirmationId: previewResult.value.confirmationId, input: { content: 'nota' } }, actor(), 'suc-1');
    expect(first.ok).toBe(true);
    const second = await service.confirm({ actionId: 'create_memory_note', confirmationId: previewResult.value.confirmationId, input: { content: 'nota' } }, actor(), 'suc-1');
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.status).toBe(409);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('rejects input that does not match the confirmed preview', async () => {
    const { service } = build();
    const previewResult = await preview(service, { content: 'nota original' });
    if (!previewResult.ok) throw new Error('preview failed');
    const result = await service.confirm(
      { actionId: 'create_memory_note', confirmationId: previewResult.value.confirmationId, input: { content: 'nota alterada' } },
      actor(),
      'suc-1',
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(400);
  });

  it('executes and records the execution', async () => {
    const { service, execute } = build();
    const previewResult = await preview(service);
    if (!previewResult.ok) throw new Error('preview failed');
    const result = await service.confirm({ actionId: 'create_memory_note', confirmationId: previewResult.value.confirmationId, input: { content: 'nota' } }, actor(), 'suc-1');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.replayed).toBe(false);
    expect(result.value.execution.status).toBe('executed');
    expect(result.value.execution.result).toEqual({ done: true });
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('replays idempotent executions without re-executing', async () => {
    const { service, execute } = build();
    const firstPreview = await preview(service, { content: 'nota' }, { idempotencyKey: 'key-1' });
    if (!firstPreview.ok) throw new Error('first preview failed');
    const first = await service.confirm(
      { actionId: 'create_memory_note', confirmationId: firstPreview.value.confirmationId, idempotencyKey: 'key-1', input: { content: 'nota' } },
      actor(),
      'suc-1',
    );
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const secondPreview = await preview(service, { content: 'nota' }, { idempotencyKey: 'key-1' });
    if (!secondPreview.ok) throw new Error('second preview failed');
    const second = await service.confirm(
      { actionId: 'create_memory_note', confirmationId: secondPreview.value.confirmationId, idempotencyKey: 'key-1', input: { content: 'nota' } },
      actor(),
      'suc-1',
    );
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.value.replayed).toBe(true);
    expect(second.value.execution.id).toBe(first.value.execution.id);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('marks the confirmation used and records failures', async () => {
    const { service, execute, ledger } = build();
    execute.mockImplementation(async () => {
      throw new Error('store down');
    });
    const previewResult = await preview(service);
    if (!previewResult.ok) throw new Error('preview failed');
    const result = await service.confirm({ actionId: 'create_memory_note', confirmationId: previewResult.value.confirmationId, input: { content: 'nota' } }, actor(), 'suc-1');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(502);
    expect((await ledger.getConfirmation(previewResult.value.confirmationId))?.used).toBe(true);
  });
});

describe('ConfirmableActionsService.rollback', () => {
  it('rejects actions without compensation', async () => {
    const { service } = build({ definition: { compensate: undefined } });
    const result = await service.rollback({ actionId: 'create_memory_note', executionId: 'exec-1' }, actor(), 'suc-1');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(400);
  });

  it('rejects unknown executions with 404', async () => {
    const { service } = build();
    const result = await service.rollback({ actionId: 'create_memory_note', executionId: 'exec-1' }, actor(), 'suc-1');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(404);
  });

  it('compensates executed executions and records the rollback', async () => {
    const { service, compensate, ledger } = build();
    const previewResult = await preview(service);
    if (!previewResult.ok) throw new Error('preview failed');
    const confirmed = await service.confirm({ actionId: 'create_memory_note', confirmationId: previewResult.value.confirmationId, input: { content: 'nota' } }, actor(), 'suc-1');
    if (!confirmed.ok) throw new Error('confirm failed');

    const result = await service.rollback(
      { actionId: 'create_memory_note', executionId: confirmed.value.execution.id, reason: 'fue un error' },
      actor(),
      'suc-1',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.execution.status).toBe('rolled_back');
    expect(result.value.execution.rollbackReason).toBe('fue un error');
    expect(result.value.execution.result?.compensation).toEqual({ deleted: true });
    expect(compensate).toHaveBeenCalledTimes(1);
    expect((await ledger.getExecution(confirmed.value.execution.id))?.status).toBe('rolled_back');
  });
});