import { describe, expect, it } from 'vitest';
import { ModelSelectionObservability } from './modelSelectionEvents.js';

describe('ModelSelectionObservability', () => {
  it('guarda eventos sin PHI y recorta al maximo', () => {
    const obs = new ModelSelectionObservability(3);
    obs.record({ ts: 'a', mode: 'NUTRICLINICA_LOCAL_AUTO', capabilityId: 'chat_general', selectedProvider: 'ollama', selectedModel: 'llama3.2', deploymentFingerprint: 'deploy-x', reason: 'SELECTED', abstained: false, setupRequired: false, cloudFallbackAllowed: false, excludedSummary: [], hardwareClass: 'CPU_ONLY_HIGH' });
    obs.record({ ts: 'b', mode: 'NUTRICLINICA_LOCAL_AUTO', capabilityId: 'nutrition_reasoning', selectedProvider: null, selectedModel: null, deploymentFingerprint: null, reason: 'NO_ELIGIBLE_LOCAL_MODEL', abstained: true, setupRequired: true, cloudFallbackAllowed: false, excludedSummary: [{ candidateId: 'ollama-llama3.2-3b', reasons: ['stale_certification'] }], hardwareClass: 'CPU_ONLY_HIGH' });
    obs.record({ ts: 'c', mode: 'EXPLICIT_APPROVED_MODEL', capabilityId: 'chat_general', selectedProvider: 'openai', selectedModel: 'gpt-4o-mini', deploymentFingerprint: 'deploy-y', reason: 'EXPLICIT', abstained: false, setupRequired: false, cloudFallbackAllowed: false, excludedSummary: [], hardwareClass: 'CPU_ONLY_HIGH' });
    obs.record({ ts: 'd', mode: 'ORGANIZATION_PREFERRED', capabilityId: 'chat_general', selectedProvider: 'ollama', selectedModel: 'llama3.2', deploymentFingerprint: null, reason: 'ORGANIZATION', abstained: false, setupRequired: false, cloudFallbackAllowed: false, excludedSummary: [], hardwareClass: 'CPU_ONLY_HIGH' });

    expect(obs.all().map((e) => e.ts)).toEqual(['b', 'c', 'd']);
    expect(obs.recent(2).map((e) => e.ts)).toEqual(['c', 'd']);
  });

  it('el event log nunca contiene texto de paciente/prompt', () => {
    const obs = new ModelSelectionObservability();
    obs.record({ ts: 'x', mode: 'NUTRICLINICA_LOCAL_AUTO', capabilityId: 'patient_support', selectedProvider: null, selectedModel: null, deploymentFingerprint: null, reason: 'NO_ELIGIBLE_LOCAL_MODEL', abstained: true, setupRequired: true, cloudFallbackAllowed: false, excludedSummary: [], hardwareClass: 'CPU_ONLY_HIGH' });
    const json = JSON.stringify(obs.all());
    expect(json).not.toMatch(/prompt|paciente|pacient/i);
  });
});