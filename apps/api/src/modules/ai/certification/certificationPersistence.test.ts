import { describe, expect, it } from 'vitest';
import { ClinicalCertificationRegistry } from './clinicalCertification.js';
import { CURRENT_VERSIONS } from './versions.js';
import { createMemoryCertificationPersistence, initializeCertificationPersistence, selectCertificationPersistence } from './certificationPersistence.js';
import type { AIModelCapability } from '../evaluation/capabilities.js';

const v = CURRENT_VERSIONS;

function recordFor(overrides: Partial<{
  certificationId: string;
  providerId: string;
  modelId: string;
  modelVersion: string;
  capabilityId: AIModelCapability;
  deploymentFingerprint?: string;
}> = {}) {
  const capability = overrides.capabilityId ?? 'nutrition_reasoning';
  return {
    certificationId: overrides.certificationId ?? `cert-${overrides.providerId}-${overrides.modelId}-${capability}`,
    key: {
      providerId: overrides.providerId ?? 'ollama',
      modelId: overrides.modelId ?? 'modelo-cert',
      modelVersion: overrides.modelVersion ?? '1.0',
      capabilityId: capability,
      promptVersion: v.promptVersion[capability],
      toolsetVersion: v.toolsetVersion,
      policyVersion: v.policyVersion,
      outputSchemaVersion: v.outputSchemaVersion[capability],
      evaluationDatasetVersion: v.evaluationDatasetVersion,
      knowledgePolicyVersion: v.knowledgePolicyVersion,
      retrievalPolicyVersion: v.retrievalPolicyVersion,
      smaeCatalogVersion: v.smaeCatalogVersion,
      deploymentFingerprint: overrides.deploymentFingerprint,
    },
    state: 'APPROVED_NUTRITION_SUPPORT' as const,
    evaluatedAt: '2026-08-20T00:00:00.000Z',
    datasetFingerprint: 'dataset-fp-v1',
    reportRef: 'report.json',
  };
}

describe('certification persistence (Build 09.5A §55-57, §85)', () => {
  it('replaceAll: reemplaza seeds por estado persistido (fail-closed)', () => {
    const registry = new ClinicalCertificationRegistry();
    expect(registry.list().length).toBeGreaterThan(0);
    registry.replaceAll([], []);
    expect(registry.list()).toEqual([]);
    const res = registry.resolve('openai', 'gpt-4o-mini', 'gpt-4o-mini-2024-07-18', 'nutrition_reasoning', {
      requiredState: 'APPROVED_NUTRITION_SUPPORT',
    });
    expect(res.eligible).toBe(false);
  });

  it('registro persistido + reinicio (nuevo registry) => mismo estado cargado', () => {
    const first = new ClinicalCertificationRegistry();
    first.replaceAll([recordFor({ certificationId: 'cert-1', providerId: 'ollama', modelId: 'modelo-cert', deploymentFingerprint: 'deploy-abc' })], []);
    const records = first.list();
    const flags = first.listRequalificationFlags();

    const restarted = new ClinicalCertificationRegistry();
    restarted.replaceAll(records, flags);
    const res = restarted.resolve('ollama', 'modelo-cert', '1.0', 'nutrition_reasoning', {
      requiredState: 'APPROVED_NUTRITION_SUPPORT',
      deploymentFingerprint: 'deploy-abc',
    });
    expect(res.eligible).toBe(true);
    expect(res.stale).toBe(false);
  });

  it('cambio de fingerprint tras reinicio => REQUALIFICATION_REQUIRED (nunca se reutiliza)', () => {
    const registry = new ClinicalCertificationRegistry();
    registry.replaceAll([recordFor({ certificationId: 'cert-1', providerId: 'ollama', modelId: 'modelo-cert', deploymentFingerprint: 'deploy-abc' })], []);
    const res = registry.resolve('ollama', 'modelo-cert', '1.0', 'nutrition_reasoning', {
      requiredState: 'APPROVED_NUTRITION_SUPPORT',
      deploymentFingerprint: 'deploy-XYZ',
    });
    expect(res.eligible).toBe(false);
    expect(res.requalificationRequired).toBe(true);
    expect(res.stale).toBe(true);
  });

  it('fingerprint ausente en registro + contexto con fingerprint => requalification', () => {
    const registry = new ClinicalCertificationRegistry();
    registry.replaceAll([recordFor({ certificationId: 'cert-2', providerId: 'ollama', modelId: 'modelo-cert' })], []);
    const res = registry.resolve('ollama', 'modelo-cert', '1.0', 'nutrition_reasoning', {
      requiredState: 'APPROVED_NUTRITION_SUPPORT',
      deploymentFingerprint: 'deploy-abc',
    });
    expect(res.eligible).toBe(false);
    expect(res.requalificationRequired).toBe(true);
  });

  it('requalification flags persistidas bloquean tras "reinicio"', () => {
    const first = new ClinicalCertificationRegistry();
    first.replaceAll(
      [recordFor({ certificationId: 'cert-3', providerId: 'ollama', modelId: 'modelo-cert', deploymentFingerprint: 'deploy-abc' })],
      [{ providerId: 'ollama', modelId: 'modelo-cert', capabilityId: 'nutrition_reasoning' }],
    );
    const restarted = new ClinicalCertificationRegistry();
    restarted.replaceAll(first.list(), first.listRequalificationFlags());
    const res = restarted.resolve('ollama', 'modelo-cert', '1.0', 'nutrition_reasoning', {
      requiredState: 'APPROVED_NUTRITION_SUPPORT',
      deploymentFingerprint: 'deploy-abc',
    });
    expect(res.eligible).toBe(false);
    expect(res.requalificationRequired).toBe(true);
  });

  it('flags por defecto: llama3.2 y gpt-4o-mini REQUALIFICATION_REQUIRED (torneo 07.5A)', () => {
    const registry = new ClinicalCertificationRegistry();
    const llama = registry.resolve('ollama', 'llama3.2', '3.2', 'nutrition_reasoning', {
      requiredState: 'APPROVED_NUTRITION_SUPPORT',
    });
    expect(llama.eligible).toBe(false);
    expect(llama.requalificationRequired).toBe(true);
    const mini = registry.resolve('openai', 'gpt-4o-mini', 'gpt-4o-mini-2024-07-18', 'nutrition_reasoning', {
      requiredState: 'APPROVED_NUTRITION_SUPPORT',
    });
    expect(mini.eligible).toBe(false);
    expect(mini.requalificationRequired).toBe(true);
  });

  it('clearRequalificationRequired restaura elegibilidad (procedimiento de operador)', () => {
    const registry = new ClinicalCertificationRegistry();
    registry.clearRequalificationRequired('ollama', 'llama3.2', 'nutrition_reasoning');
    const res = registry.resolve('ollama', 'llama3.2', '3.2', 'nutrition_reasoning', {
      requiredState: 'APPROVED_NUTRITION_SUPPORT',
    });
    expect(res.eligible).toBe(true);
  });

  it('store por defecto memory; selectCertificationPersistence refleja AI_CERTIFICATION_STORE', () => {
    expect(selectCertificationPersistence({}).kind).toBe('memory');
    expect(selectCertificationPersistence({ AI_CERTIFICATION_STORE: 'sql' }).kind).toBe('sql');
    expect(selectCertificationPersistence({ AI_CERTIFICATION_STORE: 'memory' }).kind).toBe('memory');
  });

  it('initialize con store memory: no lanza y mantiene registry', async () => {
    const persistence = await initializeCertificationPersistence({ AI_CERTIFICATION_STORE: 'memory' });
    expect(persistence.kind).toBe('memory');
  });

  it('persistencia memory: save/mark son no-op sin romper', async () => {
    const persistence = createMemoryCertificationPersistence();
    await persistence.saveCertificationRecord(recordFor({ certificationId: 'x' }));
    await persistence.markRequalification({ providerId: 'a', modelId: 'b', capabilityId: 'chat_general' });
    await persistence.clearRequalification('a', 'b', 'chat_general');
    expect(await persistence.loadCertificationRecords()).toEqual([]);
  });
});