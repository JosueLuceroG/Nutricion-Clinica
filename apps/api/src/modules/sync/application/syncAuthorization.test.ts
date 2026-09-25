import { describe, expect, it } from 'vitest';
import type { Role, SyncPushBatch, SyncPushOperation } from '@nutriclinica/shared';
import {
  authorizeAndNormalizeSyncBatch,
  authorizeSyncPull,
  projectSyncServerPayload,
  SyncBatchPolicyError,
} from './syncAuthorization.js';

const sucursalId = '00000000-0000-4000-8000-000000000001';
const actorId = '00000000-0000-4000-8000-000000000002';

function actor(role: Role) {
  return { id: actorId, role };
}

type TestSyncPushOperation = Omit<SyncPushOperation, 'operationId'> & {
  operationId?: string;
};

function batch(operations: TestSyncPushOperation[]): SyncPushBatch {
  return {
    sucursalId,
    operations: operations.map((operation, index) => ({
      ...operation,
      operationId:
        operation.operationId ??
        `00000000-0000-4000-9000-${String(index + 1).padStart(12, '0')}`,
    })),
  };
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

function writablePayload(entity: SyncPushOperation['entity'], create: boolean) {
  switch (entity) {
    case 'pacientes': return { first_name: create ? 'Created' : 'Updated' };
    case 'consultas': return { reason: create ? 'Created' : 'Updated' };
    case 'antropometrias': return { notes: create ? 'Created' : 'Updated' };
    case 'lab_panels': return { notes: create ? 'Created' : 'Updated' };
    case 'planes_alimenticios': return { notes: create ? 'Created' : 'Updated' };
    case 'adherence_records': return {
      ...(create ? { source: 'app' } : {}),
      notes: create ? 'Created' : 'Updated',
    };
  }
}

describe('authorizeAndNormalizeSyncBatch', () => {
  it.each(['admin', 'nutriologa'] as const)('allows %s clinical operations across every sync entity', (role) => {
    const entities = ['pacientes', 'consultas', 'antropometrias', 'lab_panels', 'planes_alimenticios', 'adherence_records'] as const;
    const operations = entities.flatMap((entity, entityIndex) => [
      {
        entity,
        id: `00000000-0000-4000-8000-${String(entityIndex * 3 + 10).padStart(12, '0')}`,
        op: 'create' as const,
        payload: writablePayload(entity, true),
        clientUpdatedAt: '2026-08-13T12:00:00.000Z',
      },
      {
        entity,
        id: `00000000-0000-4000-8000-${String(entityIndex * 3 + 11).padStart(12, '0')}`,
        op: 'update' as const,
        payload: writablePayload(entity, false),
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

  it.each(['asistente', 'facturacion'] as const)('rejects consultation restoration by %s', (role) => {
    expect(() => authorizeAndNormalizeSyncBatch(
      batch([{ ...consultationUpdate({ payment_status: 'paid' }), restoreDeleted: true }]),
      actor(role),
    )).toThrow(SyncBatchPolicyError);
  });

  it('rejects restoreDeleted on operations other than update', () => {
    expect(() => authorizeAndNormalizeSyncBatch(batch([{
      entity: 'pacientes',
      id: '00000000-0000-4000-8000-000000000004',
      op: 'create',
      restoreDeleted: true,
      payload: {},
      clientUpdatedAt: '2026-08-13T12:00:00.000Z',
    }]), actor('admin'))).toThrow(/restoreDeleted solo es válido para update/);
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

  it.each(['portal', 'Portal', 'portal '])('rejects portal-attributed adherence source %j through professional sync', (source) => {
    expect(() =>
      authorizeAndNormalizeSyncBatch(
        batch([
          {
            entity: 'adherence_records',
            id: '00000000-0000-4000-8000-000000000010',
            op: 'create',
            payload: {
              patient_id: '00000000-0000-4000-8000-000000000009',
              source,
              date: '2026-08-13',
            },
            clientUpdatedAt: '2026-08-13T12:00:00.000Z',
          },
        ]),
        actor('admin'),
      ),
    ).toThrow(SyncBatchPolicyError);
  });

  it('requires an explicit canonical adherence source', () => {
    expect(() => authorizeAndNormalizeSyncBatch(batch([{
      entity: 'adherence_records',
      id: '00000000-0000-4000-8000-000000000010',
      op: 'create',
      payload: {
        patient_id: '00000000-0000-4000-8000-000000000009',
        date: '2026-08-13',
      },
      clientUpdatedAt: '2026-08-13T12:00:00.000Z',
    }]), actor('admin'))).toThrow(/source de adherencia/);
  });

  it('rejects a duplicated operation receipt identity before applying the batch', () => {
    const operationId = '00000000-0000-4000-8000-000000000090';
    expect(() => authorizeAndNormalizeSyncBatch(batch([
      { ...consultationUpdate({ payment_status: 'paid' }), operationId },
      {
        ...consultationUpdate({ payment_status: 'partial' }),
        operationId: operationId.toUpperCase(),
        id: '00000000-0000-4000-8000-000000000004',
      },
    ]), actor('admin'))).toThrow(/operationId está duplicado/);
  });

  it('rejects competing aliases, unknown fields and implicit tombstones', () => {
    expect(() => authorizeAndNormalizeSyncBatch(batch([{
      entity: 'adherence_records',
      id: '00000000-0000-4000-8000-000000000010',
      op: 'create',
      payload: {
        patient_id: '00000000-0000-4000-8000-000000000009',
        consultation_id: '00000000-0000-4000-8000-000000000008',
        consulta_id: '00000000-0000-4000-8000-000000000007',
        source: 'app',
      },
      clientUpdatedAt: '2026-08-13T12:00:00.000Z',
    }]), actor('admin'))).toThrow(/campo de payload no reconocido: consulta_id/);

    expect(() => authorizeAndNormalizeSyncBatch(batch([consultationUpdate({ typo_payment_status: 'paid' })]), actor('admin')))
      .toThrow(/campo de payload no reconocido/);
    expect(() => authorizeAndNormalizeSyncBatch(batch([consultationUpdate({ deleted_at: false })]), actor('admin')))
      .toThrow(/use op=delete/);
  });

  it('rejects malformed ROWVERSION values and versions attached to creates', () => {
    expect(() => authorizeAndNormalizeSyncBatch(batch([{
      ...consultationUpdate({ reason: 'Control' }),
      expectedRowVersion: 'not-rowversion',
    }]), actor('admin'))).toThrow(/expectedRowVersion/);

    expect(() => authorizeAndNormalizeSyncBatch(batch([{
      entity: 'pacientes',
      id: '00000000-0000-4000-8000-000000000010',
      op: 'create',
      payload: { first_name: 'Ana' },
      expectedRowVersion: 'AAAAAAAAAAE=',
      clientUpdatedAt: '2026-08-13T12:00:00.000Z',
    }]), actor('admin'))).toThrow(/expectedRowVersion/);
  });

  it('canonicalizes UUID identities at the policy boundary', () => {
    const normalized = authorizeAndNormalizeSyncBatch(batch([{
      ...consultationUpdate({
        anthropometry_id: '00000000-0000-4000-8000-000000000009'.toUpperCase(),
        reason: 'Control',
      }),
      id: 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA',
      operationId: 'BBBBBBBB-BBBB-4BBB-8BBB-BBBBBBBBBBBB',
    }]), actor('admin'));
    expect(normalized.operations[0]).toMatchObject({
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      operationId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      payload: expect.objectContaining({ anthropometry_id: '00000000-0000-4000-8000-000000000009' }),
    });
  });
});

describe('authorizeSyncPull', () => {
  it('allows full clinical pull only to clinical roles', () => {
    expect(authorizeSyncPull(actor('admin'), null)).toHaveLength(6);
    expect(authorizeSyncPull(actor('nutriologa'), ['pacientes'])).toEqual(['pacientes']);
    expect(authorizeSyncPull(actor('asistente'), null)).toEqual([
      'pacientes',
      'consultas',
      'antropometrias',
      'lab_panels',
    ]);
    expect(projectSyncServerPayload('pacientes', { first_name: 'Ana' }, 'asistente')).toEqual({ first_name: 'Ana' });
  });

  it('limits billing roles to consultations and rejects non-clinical readers', () => {
    expect(authorizeSyncPull(actor('facturacion'), null)).toEqual(['consultas']);
    expect(() => authorizeSyncPull(actor('asistente'), ['planes_alimenticios'])).toThrow(/no puede leer/);
    expect(() => authorizeSyncPull(actor('auditor'), null)).toThrow(/no puede leer/);
  });
});
