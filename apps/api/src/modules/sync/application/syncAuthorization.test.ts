import { describe, expect, it } from 'vitest';
import type { Role, SyncPushBatch } from '@nutriclinica/shared';
import { authorizeAndNormalizeSyncBatch, SyncBatchPolicyError } from './syncAuthorization.js';

const sucursalId = '00000000-0000-4000-8000-000000000001';
const actorId = '00000000-0000-4000-8000-000000000002';

function actor(role: Role) {
  return { id: actorId, role };
}

function batch(operations: SyncPushBatch['operations']): SyncPushBatch {
  return { sucursalId, operations };
}

function consultationUpdate(payload: Record<string, unknown>) {
  return {
    entity: 'consultas' as const,
    id: '00000000-0000-4000-8000-000000000003',
    op: 'update' as const,
    payload,
    clientUpdatedAt: '2026-08-13T12:00:00.000Z',
  };
}

describe('authorizeAndNormalizeSyncBatch', () => {
  it.each(['admin', 'nutriologa'] as const)('allows %s clinical operations across every sync entity', (role) => {
    const entities = ['pacientes', 'consultas', 'antropometrias', 'lab_panels', 'planes_alimenticios', 'adherence_records'] as const;
    const operations = entities.flatMap((entity, entityIndex) => [
      {
        entity,
        id: `00000000-0000-4000-8000-${String(entityIndex * 3 + 10).padStart(12, '0')}`,
        op: 'create' as const,
        payload: {},
        clientUpdatedAt: '2026-08-13T12:00:00.000Z',
      },
      {
        entity,
        id: `00000000-0000-4000-8000-${String(entityIndex * 3 + 11).padStart(12, '0')}`,
        op: 'update' as const,
        payload: {},
        clientUpdatedAt: '2026-08-13T12:00:00.000Z',
      },
      {
        entity,
        id: `00000000-0000-4000-8000-${String(entityIndex * 3 + 12).padStart(12, '0')}`,
        op: 'delete' as const,
        payload: null,
        clientUpdatedAt: '2026-08-13T12:00:00.000Z',
      },
    ]);

    expect(authorizeAndNormalizeSyncBatch(batch(operations), actor(role)).operations).toHaveLength(18);
  });

  it.each(['auditor', 'soporte_tecnico'] as const)('rejects every push operation for read-only role %s', (role) => {
    const input = batch([
      consultationUpdate({ payment_status: 'paid' }),
      {
        entity: 'pacientes',
        id: '00000000-0000-4000-8000-000000000004',
        op: 'delete',
        payload: null,
        clientUpdatedAt: '2026-08-13T12:00:00.000Z',
      },
    ]);

    expect(() => authorizeAndNormalizeSyncBatch(input, actor(role))).toThrow(SyncBatchPolicyError);
    try {
      authorizeAndNormalizeSyncBatch(input, actor(role));
    } catch (error) {
      expect((error as SyncBatchPolicyError).violations).toHaveLength(2);
      expect((error as SyncBatchPolicyError).violations.every((item) => item.code === 'unauthorized')).toBe(true);
    }
  });

  it.each(['asistente', 'facturacion'] as const)('allows %s to update billing fields and removes clinical fields from a full snapshot', (role) => {
    const normalized = authorizeAndNormalizeSyncBatch(
      batch([
        consultationUpdate({
          patient_id: '00000000-0000-4000-8000-000000000009',
          reason: 'clinical text must not be written',
          payment_status: 'paid',
          paid: true,
          amount_paid: 750,
          updated_at: '2026-08-13T12:00:00.000Z',
        }),
      ]),
      actor(role),
    );

    expect(normalized.operations[0]?.payload).toEqual({
      payment_status: 'paid',
      paid: true,
      amount_paid: 750,
    });
  });

  it('rejects assistant clinical-only mutations', () => {
    expect(() => authorizeAndNormalizeSyncBatch(batch([consultationUpdate({ reason: 'changed clinical reason' })]), actor('asistente'))).toThrow(SyncBatchPolicyError);
  });

  it('removes server-owned attribution and system fields for admin creates', () => {
    const normalized = authorizeAndNormalizeSyncBatch(
      batch([
        {
          entity: 'consultas',
          id: '00000000-0000-4000-8000-000000000003',
          op: 'create',
          payload: {
            id: '00000000-0000-4000-8000-000000000003',
            sucursal_id: sucursalId,
            patient_id: '00000000-0000-4000-8000-000000000009',
            profesional_id: '00000000-0000-4000-8000-000000000099',
            consultation_number: 999,
            consultation_date: '2026-08-13T12:00:00.000Z',
            reason: 'Control',
            created_at: '2026-08-13T12:00:00.000Z',
            deleted_at: null,
          },
          clientUpdatedAt: '2026-08-13T12:00:00.000Z',
        },
      ]),
      actor('admin'),
    );

    expect(normalized.operations[0]?.payload).toEqual({
      patient_id: '00000000-0000-4000-8000-000000000009',
      consultation_date: '2026-08-13T12:00:00.000Z',
      reason: 'Control',
    });
  });

  it('strips billing fields from nutritionist clinical mutations', () => {
    const normalized = authorizeAndNormalizeSyncBatch(
      batch([
        consultationUpdate({
          assessment: 'Clinical assessment',
          payment_status: 'paid',
          amount_paid: 500,
        }),
      ]),
      actor('nutriologa'),
    );

    expect(normalized.operations[0]?.payload).toEqual({
      assessment: 'Clinical assessment',
    });
  });

  it('collects violations across the full batch', () => {
    const input = batch([
      consultationUpdate({ reason: 'not billing' }),
      {
        entity: 'pacientes',
        id: '00000000-0000-4000-8000-000000000004',
        op: 'create',
        payload: { id: '00000000-0000-4000-8000-000000000005' },
        clientUpdatedAt: '2026-08-13T12:00:00.000Z',
      },
      consultationUpdate({ payment_status: 'paid' }),
    ]);

    try {
      authorizeAndNormalizeSyncBatch(input, actor('facturacion'));
      throw new Error('Expected policy error');
    } catch (error) {
      const policyError = error as SyncBatchPolicyError;
      expect(policyError.violations.map((item) => item.index)).toEqual([0, 1, 1, 2]);
      expect(policyError.violations).toEqual(expect.arrayContaining([expect.objectContaining({ index: 2, reason: expect.stringContaining('duplicados') })]));
    }
  });

  it('rejects portal-attributed adherence through professional sync', () => {
    expect(() =>
      authorizeAndNormalizeSyncBatch(
        batch([
          {
            entity: 'adherence_records',
            id: '00000000-0000-4000-8000-000000000010',
            op: 'create',
            payload: {
              patient_id: '00000000-0000-4000-8000-000000000009',
              source: 'portal',
              date: '2026-08-13',
            },
            clientUpdatedAt: '2026-08-13T12:00:00.000Z',
          },
        ]),
        actor('admin'),
      ),
    ).toThrow(SyncBatchPolicyError);
  });
});
