import { describe, expect, it } from 'vitest';
import { InMemoryActionLedger } from './actionLedger.js';
import type { ActionConfirmation, ActionExecution } from './actionTypes.js';

const NOW = '2026-08-14T12:00:00.000Z';

function confirmation(overrides: Partial<ActionConfirmation> = {}): ActionConfirmation {
  return {
    id: 'conf-1',
    actionId: 'create_memory_note',
    actor: { profesionalId: 'prof-1', role: 'nutriologa' },
    sucursalId: 'suc-1',
    pacienteId: 'pac-1',
    input: { content: 'nota' },
    idempotencyKey: null,
    previewSummary: 'preview',
    expiresAt: '2026-08-14T12:10:00.000Z',
    used: false,
    createdAt: NOW,
    ...overrides,
  };
}

function execution(overrides: Partial<ActionExecution> = {}): ActionExecution {
  return {
    id: 'exec-1',
    actionId: 'create_memory_note',
    confirmationId: 'conf-1',
    idempotencyKey: null,
    actor: { profesionalId: 'prof-1', role: 'nutriologa' },
    sucursalId: 'suc-1',
    pacienteId: 'pac-1',
    input: { content: 'nota' },
    status: 'executed',
    result: { entryId: 'entry-1' },
    createdAt: NOW,
    confirmedAt: NOW,
    executedAt: NOW,
    ...overrides,
  };
}

describe('InMemoryActionLedger', () => {
  const clock = () => new Date(NOW);

  it('stores and retrieves confirmations', async () => {
    const ledger = new InMemoryActionLedger({ now: clock });
    await ledger.createConfirmation(confirmation());
    expect((await ledger.getConfirmation('conf-1'))?.previewSummary).toBe('preview');
    expect(await ledger.getConfirmation('missing')).toBeUndefined();
  });

  it('markUsed is single-use', async () => {
    const ledger = new InMemoryActionLedger({ now: clock });
    await ledger.createConfirmation(confirmation());
    expect(await ledger.markUsed('conf-1')).toBe(true);
    expect(await ledger.markUsed('conf-1')).toBe(false);
    expect(await ledger.markUsed('missing')).toBe(false);
  });

  it('counts pending confirmations per actor excluding used and expired', async () => {
    const ledger = new InMemoryActionLedger({ now: clock });
    await ledger.createConfirmation(confirmation());
    await ledger.createConfirmation(confirmation({ id: 'conf-2', actor: { profesionalId: 'prof-2', role: 'asistente' } }));
    await ledger.createConfirmation(confirmation({ id: 'conf-3', expiresAt: '2026-08-14T11:00:00.000Z' }));
    await ledger.createConfirmation(confirmation({ id: 'conf-4', used: true }));

    expect(await ledger.countPendingConfirmations('prof-1')).toBe(1);
    expect(await ledger.countPendingConfirmations('prof-2')).toBe(1);
  });

  it('finds executions by idempotency key scoped to action and sucursal', async () => {
    const ledger = new InMemoryActionLedger({ now: clock });
    await ledger.recordExecution(execution({ idempotencyKey: 'key-1' }));
    await ledger.recordExecution(execution({ id: 'exec-2', idempotencyKey: 'key-1', actionId: 'other_action' }));
    await ledger.recordExecution(execution({ id: 'exec-3', idempotencyKey: 'key-1', sucursalId: 'suc-2' }));

    expect((await ledger.findExecutionByIdempotencyKey('key-1', 'create_memory_note', 'suc-1'))?.id).toBe('exec-1');
  });

  it('rolls back only executed executions', async () => {
    const ledger = new InMemoryActionLedger({ now: clock });
    await ledger.recordExecution(execution());
    await ledger.recordExecution(execution({ id: 'exec-failed', status: 'failed' }));

    expect(await ledger.markRolledBack('exec-1', 'cambio de opinion', '2026-08-14T13:00:00.000Z')).toBe(true);
    expect(await ledger.markRolledBack('exec-failed', 'x', '2026-08-14T13:00:00.000Z')).toBe(false);
    expect((await ledger.getExecution('exec-1'))?.status).toBe('rolled_back');
  });
});